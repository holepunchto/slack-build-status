import { execFileSync } from "node:child_process";
import * as core from "@actions/core";
import type { GitHub } from "@actions/github/lib/utils.js";

const MAX_CONTEXT_ELEMENTS = 10;
const DEFAULT_MAX_CHARS = 2500;

type Octokit = InstanceType<typeof GitHub>;

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function extractPrNumber(message: string): number | null {
  const start = message.indexOf("(#");
  if (start === -1) return null;
  let end = start + 2;
  while (end < message.length && message[end] >= "0" && message[end] <= "9") end++;
  if (end === start + 2 || message[end] !== ")") return null;
  return Number(message.slice(start + 2, end));
}

const ASANA_PREFIX = "https://app.asana.com/";
const LINK_TERMINATORS = new Set([" ", "\t", "\n", "\r", ")", ">", "]"]);

export function extractAsanaLinks(body: string): string[] {
  const links: string[] = [];
  let i = 0;
  while (i < body.length) {
    const idx = body.indexOf(ASANA_PREFIX, i);
    if (idx === -1) break;
    let end = idx + ASANA_PREFIX.length;
    while (end < body.length && !LINK_TERMINATORS.has(body[end])) end++;
    const link = body.slice(idx, end);
    if (!links.includes(link)) links.push(link);
    i = end;
  }
  return links;
}

async function fetchAsanaLinksForPrs(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumbers: number[],
): Promise<Map<number, string[]>> {
  const results = new Map<number, string[]>();
  const fetches = prNumbers.map(async (pr) => {
    try {
      const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: pr });
      const links = extractAsanaLinks(data.body ?? "");
      if (links.length > 0) {
        core.info(`Found ${links.length} Asana link(s) in PR #${pr}`);
        results.set(pr, links);
      }
    } catch (err) {
      core.warning(
        `Failed to fetch Asana links for PR #${pr}: ${err instanceof Error ? err.message : err}`,
      );
    }
  });
  await Promise.all(fetches);
  return results;
}

export async function generateChangelog(
  fromRef: string,
  repo: string,
  octokit?: Octokit,
): Promise<{ text: string; compareUrl: string } | null> {
  try {
    git("rev-parse", fromRef);
  } catch {
    return null;
  }

  const log = git("log", "--pretty=format:%H %s", `${fromRef}..HEAD`);
  if (!log) return null;

  const baseUrl = `https://github.com/${repo}`;
  const lines = log.split("\n").map((line) => {
    const spaceIdx = line.indexOf(" ");
    const hash = line.slice(0, spaceIdx);
    const message = line.slice(spaceIdx + 1);
    const short = hash.slice(0, 9);
    return { hash, message, formatted: `• <${baseUrl}/commit/${hash}|${short}> - ${message}` };
  });

  let asanaMap = new Map<number, string[]>();
  if (octokit) {
    const [owner, repoName] = repo.split("/");
    const prNumbers = lines
      .map((l) => extractPrNumber(l.message))
      .filter((n): n is number => n !== null);
    const unique = [...new Set(prNumbers)];
    if (unique.length > 0) {
      core.info(
        `Found ${unique.length} unique PR reference(s): ${unique.map((n) => `#${n}`).join(", ")}`,
      );
      asanaMap = await fetchAsanaLinksForPrs(octokit, owner, repoName, unique);
      core.info(`Asana links found for ${asanaMap.size} of ${unique.length} PR(s)`);
    } else {
      core.info("No PR references found in changelog commits");
    }
  }

  const text = lines
    .map((l) => {
      const pr = extractPrNumber(l.message);
      const links = pr ? asanaMap.get(pr) : undefined;
      if (!links?.length) return l.formatted;
      const asanaSuffix = links.map((url) => `<${url}|:asana:>`).join(" ");
      return `${l.formatted} ${asanaSuffix}`;
    })
    .join("\n");

  const sha = git("rev-parse", "HEAD");
  const compareUrl = `${baseUrl}/compare/${fromRef}...${sha}`;

  return { text, compareUrl };
}

export function detectPrLinks(text: string, repo: string): string {
  let result = "";
  let i = 0;

  while (i < text.length) {
    if (text[i] !== "#") {
      result = `${result}${text[i]}`;
      i++;
      continue;
    }

    let j = i + 1;
    while (j < text.length && text[j] >= "0" && text[j] <= "9") j++;
    if (j === i + 1) {
      result += "#";
      i++;
      continue;
    }

    const num = text.slice(i + 1, j);
    const link = `<https://github.com/${repo}/pull/${num}|#${num}>`;
    const wrapped = result.endsWith("(") && text[j] === ")";

    if (wrapped) {
      result = `${result.slice(0, -1)}<https://github.com/${repo}/pull/${num}|(#${num})>`;
      i = j + 1;
    } else {
      result = `${result}${link}`;
      i = j;
    }
  }

  return result;
}

/**
 * Splits text into chunks of at most `maxChars` characters, breaking on line
 * boundaries. Returns at most 10 chunks (Slack context block element limit).
 */
export function splitChunks(text: string, maxChars: number = DEFAULT_MAX_CHARS): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current);
      current = "";
    }
    current = `${current}${current.length > 0 ? "\n" : ""}${line}`;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.slice(0, MAX_CONTEXT_ELEMENTS);
}
