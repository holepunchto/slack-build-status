import { describe, expect, it } from "vitest";
import { detectPrLinks, splitChunks } from "../src/changelog.js";

describe("detectPrLinks", () => {
  it("replaces (#123) with a Slack mrkdwn link", () => {
    const result = detectPrLinks("fix: resolve crash (#123)", "org/repo");
    expect(result).toBe("fix: resolve crash <https://github.com/org/repo/pull/123|(#123)>");
  });

  it("replaces bare #123 with a Slack mrkdwn link", () => {
    const result = detectPrLinks("fix: resolve crash #123", "org/repo");
    expect(result).toBe("fix: resolve crash <https://github.com/org/repo/pull/123|#123>");
  });

  it("works with git log changelog format", () => {
    const input = "• <https://github.com/org/repo/commit/91a4e0548|91a4e0548> - fix cancel (#6371)";
    const result = detectPrLinks(input, "org/repo");
    expect(result).toBe(
      "• <https://github.com/org/repo/commit/91a4e0548|91a4e0548> - fix cancel <https://github.com/org/repo/pull/6371|(#6371)>",
    );
  });

  it("replaces multiple PR references", () => {
    const result = detectPrLinks("feat: new feature (#10) and fix (#20)", "org/repo");
    expect(result).toContain("/pull/10|(#10)>");
    expect(result).toContain("/pull/20|(#20)>");
  });

  it("does not modify text without PR references", () => {
    const text = "chore: update deps";
    expect(detectPrLinks(text, "org/repo")).toBe(text);
  });

  it("does not match non-numeric hash references", () => {
    const text = "see (#abc) for details";
    expect(detectPrLinks(text, "org/repo")).toBe(text);
  });

  it("handles empty string", () => {
    expect(detectPrLinks("", "org/repo")).toBe("");
  });
});

describe("splitChunks", () => {
  it("returns single chunk for short text", () => {
    const result = splitChunks("hello world");
    expect(result).toEqual(["hello world"]);
  });

  it("splits on line boundaries", () => {
    const line = "a".repeat(1200);
    const text = `${line}\n${line}\n${line}`;
    const result = splitChunks(text, 2500);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(`${line}\n${line}`);
    expect(result[1]).toBe(line);
  });

  it("caps at 10 chunks", () => {
    const lines = Array.from({ length: 20 }, (_, i) => "x".repeat(2400));
    const text = lines.join("\n");
    const result = splitChunks(text, 2500);
    expect(result.length).toBe(10);
  });

  it("handles empty string", () => {
    expect(splitChunks("")).toEqual([]);
  });

  it("handles text with no newlines exceeding maxChars", () => {
    // A single line longer than maxChars stays as one chunk
    const longLine = "a".repeat(5000);
    const result = splitChunks(longLine, 2500);
    expect(result).toEqual([longLine]);
  });
});
