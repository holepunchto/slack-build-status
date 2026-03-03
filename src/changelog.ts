const MAX_CONTEXT_ELEMENTS = 10;
const DEFAULT_MAX_CHARS = 2500;

export function detectPrLinks(text: string, repo: string): string {
  return text.replace(/\(#(\d+)\)/g, `(<https://github.com/${repo}/pull/$1|(#$1)>)`);
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
    current += (current.length > 0 ? "\n" : "") + line;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.slice(0, MAX_CONTEXT_ELEMENTS);
}
