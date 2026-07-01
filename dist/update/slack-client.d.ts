import type { Block, KnownBlock } from "@slack/web-api";
import type { SlackMessageRef } from "./types.js";
export declare class SlackApiError extends Error {
    method: string;
    slackError: string;
    constructor(method: string, slackError: string);
}
export declare class SlackClient {
    private client;
    constructor(token: string);
    postMessage(channel: string, blocks: (KnownBlock | Block)[], text: string, opts?: {
        unfurl_links?: boolean;
        unfurl_media?: boolean;
    }): Promise<{
        ts: string;
    }>;
    postThreadReply(channel: string, threadTs: string, text: string, blocks?: (KnownBlock | Block)[]): Promise<void>;
    updateMessage(channel: string, ts: string, blocks: (KnownBlock | Block)[], text?: string): Promise<void>;
    getMessage(channel: string, ts: string): Promise<SlackMessageRef>;
    uploadFile(channel: string, threadTs: string, filePath: string, filename?: string): Promise<{
        fileUrl: string;
        fileId: string;
        _raw: unknown;
    }>;
}
