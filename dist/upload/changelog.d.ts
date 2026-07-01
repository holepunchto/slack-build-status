import type { GitHub } from "@actions/github/lib/utils.js";
type Octokit = InstanceType<typeof GitHub>;
export declare function extractPrNumber(message: string): number | null;
export declare function extractAsanaLinks(body: string): string[];
export declare function generateChangelog(fromRef: string, repo: string, octokit?: Octokit): Promise<{
    text: string;
    compareUrl: string;
} | null>;
export declare function detectPrLinks(text: string, repo: string): string;
/**
 * Splits text into chunks of at most `maxChars` characters, breaking on line
 * boundaries. Returns at most 10 chunks (Slack context block element limit).
 */
export declare function splitChunks(text: string, maxChars?: number): string[];
export {};
