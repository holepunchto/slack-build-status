import type { Block, KnownBlock } from "@slack/web-api";
import { detectPrLinks, splitChunks } from "./changelog.js";
import { type Build, type CreateMessageParams, STATUS_EMOJI, Status } from "./types.js";

export interface ParsedStatus {
  name: string;
  emoji: string;
  link?: string;
}

export function renderBuildStatus(build: Build): string {
  const emoji = STATUS_EMOJI[build.status];
  if (build.link) {
    return `<${build.link}|${build.label} ${emoji}>`;
  }
  return `${build.label} ${emoji}`;
}

export function buildStatusText(builds: Build[]): string {
  return builds.map(renderBuildStatus).join(" | ");
}

export function buildLabelsText(builds: Build[]): string {
  return builds.map((b) => (b.link ? `<${b.link}|${b.label}>` : b.label)).join(" | ");
}

export function parseStatusText(text: string): ParsedStatus[] {
  const results: ParsedStatus[] = [];
  const segments = text.split(" | ");

  for (const segment of segments) {
    const linkedMatch = segment.match(/^<(.+?)\|(.+?)\s+(:\S+?:)>$/);
    if (linkedMatch) {
      results.push({
        name: linkedMatch[2],
        emoji: linkedMatch[3],
        link: linkedMatch[1],
      });
      continue;
    }

    const plainMatch = segment.match(/^(.+?)\s+(:\S+?:)$/);
    if (plainMatch) {
      results.push({
        name: plainMatch[1],
        emoji: plainMatch[2],
      });
    }
  }

  return results;
}

export interface SlackPayload {
  channel: string;
  unfurl_links: boolean;
  unfurl_media: boolean;
  text: string;
  blocks: (KnownBlock | Block)[];
}

export function buildChangelogBlock(
  changelog: string,
  changelogCompareUrl: string | undefined,
  repo: string,
): KnownBlock | null {
  const processed = detectPrLinks(changelog, repo);
  const chunks = splitChunks(processed);

  const elements: { type: "mrkdwn"; text: string }[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prefix = i === 0 && changelogCompareUrl ? `*<${changelogCompareUrl}|Changelog:>*\n` : "";
    elements.push({ type: "mrkdwn", text: prefix + chunks[i] });
  }

  if (elements.length === 0) return null;

  return {
    type: "context",
    block_id: "changelog",
    elements,
  } as KnownBlock;
}

export function buildMessage(
  channelId: string,
  params: CreateMessageParams,
  repo: string,
): SlackPayload {
  const {
    builds,
    version,
    branch,
    gitUrl,
    changelog,
    changelogCompareUrl,
    icon,
    extraBadges,
    showStatus = true,
  } = params;

  const groups = new Map<string, Build[]>();
  for (const build of builds) {
    const key = build.group ?? "";
    const existing = groups.get(key) ?? [];
    existing.push(build);
    groups.set(key, existing);
  }

  const badges = [icon, extraBadges].filter(Boolean).join(" ");
  const branchSuffix = branch ? ` (${branch})` : "";
  const headerText = `${badges ? `${badges} ` : ""}*<${gitUrl}|${version}${branchSuffix}>*`;

  const statusParts = builds.map((b) => `${b.label}: ${b.status}`);
  const fallbackText = `Build ${version}${branchSuffix} — ${statusParts.join(", ")}`;

  const blocks: (KnownBlock | Block)[] = [
    {
      type: "section",
      block_id: "header",
      text: { type: "mrkdwn", text: headerText },
    },
  ];

  const fields: { type: "mrkdwn"; text: string }[] = [];
  for (const [groupName, groupBuilds] of groups) {
    const bodyText = showStatus ? buildStatusText(groupBuilds) : buildLabelsText(groupBuilds);
    let text = bodyText;
    if (groupName) {
      text = showStatus ? `${groupName}:\n${bodyText}` : `${groupName}: ${bodyText}`;
    }
    fields.push({ type: "mrkdwn", text });
  }

  blocks.push({
    type: "section",
    block_id: "statuses",
    fields,
  } as KnownBlock);

  if (changelog) {
    const changelogBlock = buildChangelogBlock(changelog, changelogCompareUrl, repo);
    if (changelogBlock) blocks.push(changelogBlock);
  }

  return {
    channel: channelId,
    unfurl_links: false,
    unfurl_media: false,
    text: fallbackText,
    blocks,
  };
}

function findStatusFields(blocks: (KnownBlock | Block)[]): { type: string; text: string }[] | null {
  // Try by block_id first
  const byId = blocks.find((b) => "block_id" in b && b.block_id === "statuses");
  if (byId && "fields" in byId) {
    return byId.fields as { type: string; text: string }[];
  }

  // Fallback: find the first section with fields
  for (const block of blocks) {
    if (block.type === "section" && "fields" in block && block.fields) {
      return block.fields as { type: string; text: string }[];
    }
  }

  return null;
}

export function updateBuildInBlocks(
  blocks: (KnownBlock | Block)[],
  buildName: string,
  newStatus: Status,
  link?: string,
  group?: string,
): (KnownBlock | Block)[] {
  const result = structuredClone(blocks);
  const fields = findStatusFields(result);
  if (!fields) return result;

  for (const field of fields) {
    const lines = field.text.split("\n");
    const hasGroup = lines.length >= 2;

    if (group !== undefined) {
      const headingLine = hasGroup ? lines[0] : "";
      if (headingLine !== `${group}:`) continue;
    }

    const statusLine = hasGroup ? lines.slice(1).join("\n") : lines[0];
    const parsed = parseStatusText(statusLine);
    const buildIndex = parsed.findIndex(
      (p) => p.name === buildName || p.name.toLowerCase() === buildName.toLowerCase(),
    );
    if (buildIndex === -1) continue;

    parsed[buildIndex].emoji = STATUS_EMOJI[newStatus];
    parsed[buildIndex].link = link ?? parsed[buildIndex].link;

    const rendered = parsed
      .map((p) => {
        if (p.link) return `<${p.link}|${p.name} ${p.emoji}>`;
        return `${p.name} ${p.emoji}`;
      })
      .join(" | ");

    field.text = hasGroup ? `${lines[0]}\n${rendered}` : rendered;
    break;
  }

  return result;
}

export function cancelAllInBlocks(blocks: (KnownBlock | Block)[]): (KnownBlock | Block)[] {
  const result = structuredClone(blocks);
  const fields = findStatusFields(result);
  if (!fields) return result;

  const pendingEmoji = STATUS_EMOJI[Status.Pending];
  const runningEmoji = STATUS_EMOJI[Status.Running];
  const cancelledEmoji = STATUS_EMOJI[Status.Cancelled];

  for (const field of fields) {
    field.text = field.text
      .replaceAll(pendingEmoji, cancelledEmoji)
      .replaceAll(runningEmoji, cancelledEmoji);
  }

  return result;
}
