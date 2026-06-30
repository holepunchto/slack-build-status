import * as core from "@actions/core";
import * as github from "@actions/github";
import { buildChangelogBlock, buildMessage } from "./block-kit.js";
import { generateChangelog } from "./changelog.js";
import { SlackClient } from "./slack-client.js";
import { type Build, Status } from "./types.js";

function parseBuilds(input: string): Build[] {
  const raw = JSON.parse(input);
  if (!Array.isArray(raw)) {
    throw new Error("`builds` input must be a JSON array");
  }
  // biome-ignore lint/suspicious/noExplicitAny: JSON.parse returns unknown[]
  return raw.map((b: any) => ({
    name: b.name,
    label: b.label,
    group: b.group,
    status: (b.status as Status) ?? Status.Pending,
    link: b.link,
  }));
}

async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const channelId = core.getInput("channel-id", { required: true });
    const buildsJson = core.getInput("builds", { required: true });
    const version = core.getInput("version", { required: true });
    const branch = core.getInput("branch", { required: true });
    const gitUrl = core.getInput("git-url", { required: true });
    const icon = core.getInput("icon") || undefined;
    const extraBadges = core.getInput("extra-badges") || undefined;
    const threadRepliesJson = core.getInput("thread-replies") || undefined;
    const notifyUsers = core.getInput("notify-users") || undefined;
    const repo =
      core.getInput("repo") || `${github.context.repo.owner}/${github.context.repo.repo}`;

    const githubToken = core.getInput("github-token") || undefined;
    const octokit = githubToken ? github.getOctokit(githubToken) : undefined;

    const changelogFrom = core.getInput("changelog-from") || undefined;
    let changelog = core.getInput("changelog") || undefined;
    let changelogCompareUrl = core.getInput("changelog-compare-url") || undefined;
    const changelogInThread = core.getInput("changelog-in-thread") === "true";

    if (!changelog && changelogFrom) {
      const generated = await generateChangelog(changelogFrom, repo, octokit);
      if (generated) {
        changelog = generated.text;
        changelogCompareUrl = changelogCompareUrl ?? generated.compareUrl;
        core.info(
          `Generated changelog from "${changelogFrom}" (${generated.text.split("\n").length} commits)`,
        );
      } else {
        core.info(
          `Could not generate changelog from "${changelogFrom}" — ref not found or no commits`,
        );
      }
    }

    const builds = parseBuilds(buildsJson);
    core.info(
      `Posting status for ${builds.length} builds: ${builds.map((b) => b.name).join(", ")}`,
    );

    const payload = buildMessage(
      channelId,
      {
        builds,
        version,
        branch,
        gitUrl,
        changelog: changelogInThread ? undefined : changelog,
        changelogCompareUrl: changelogInThread ? undefined : changelogCompareUrl,
        icon,
        extraBadges,
      },
      repo,
    );

    const client = new SlackClient(token);
    const { ts } = await client.postMessage(payload.channel, payload.blocks, payload.text, {
      unfurl_links: payload.unfurl_links,
      unfurl_media: payload.unfurl_media,
    });

    core.info(`Message posted (ts: ${ts})`);
    core.setOutput("ts", ts);

    if (changelogInThread && changelog) {
      const changelogBlock = buildChangelogBlock(changelog, changelogCompareUrl, repo);
      if (changelogBlock) {
        await client.postThreadReply(channelId, ts, "Changelog", [changelogBlock]);
      }
    }

    if (threadRepliesJson) {
      const replies: { text: string }[] = JSON.parse(threadRepliesJson);
      for (const reply of replies) {
        await client.postThreadReply(channelId, ts, reply.text);
      }
    }

    if (notifyUsers) {
      await client.postThreadReply(channelId, ts, `CC: ${notifyUsers}`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
