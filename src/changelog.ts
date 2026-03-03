import { execFileSync } from "node:child_process";

const MAX_CONTEXT_ELEMENTS = 10;
const DEFAULT_MAX_CHARS = 2500;

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function generateChangelog(
  fromRef: string,
  repo: string,
): { text: string; compareUrl: string } | null {
  try {
    git("rev-parse", fromRef);
  } catch {
    return null;
  }

  const log = git("log", "--pretty=format:%H %s", `${fromRef}..HEAD`);
  if (!log) return null;

  const baseUrl = `https://github.com/${repo}`;
  const text = log
    .split("\n")
    .map((line) => {
      const spaceIdx = line.indexOf(" ");
      const hash = line.slice(0, spaceIdx);
      const message = line.slice(spaceIdx + 1);
      const short = hash.slice(0, 9);
      return `• <${baseUrl}/commit/${hash}|${short}> - ${message}`;
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
