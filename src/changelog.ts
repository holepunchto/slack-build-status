const MAX_CONTEXT_ELEMENTS = 10;
const DEFAULT_MAX_CHARS = 2500;

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
