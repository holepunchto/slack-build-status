import type { Block, KnownBlock } from "@slack/web-api";
import { type Build, type CreateMessageParams, Status } from "./types.js";
export interface ParsedStatus {
    name: string;
    emoji: string;
    link?: string;
}
export declare function renderBuildStatus(build: Build): string;
export declare function buildStatusText(builds: Build[]): string;
export declare function buildLabelsText(builds: Build[]): string;
export declare function parseStatusText(text: string): ParsedStatus[];
export interface SlackPayload {
    channel: string;
    unfurl_links: boolean;
    unfurl_media: boolean;
    text: string;
    blocks: (KnownBlock | Block)[];
}
export declare function buildChangelogBlock(changelog: string, changelogCompareUrl: string | undefined, repo: string): KnownBlock | null;
export declare function buildMessage(channelId: string, params: CreateMessageParams, repo: string): SlackPayload;
export declare function updateBuildInBlocks(blocks: (KnownBlock | Block)[], buildName: string, newStatus: Status, link?: string, group?: string): (KnownBlock | Block)[];
export declare function cancelAllInBlocks(blocks: (KnownBlock | Block)[]): (KnownBlock | Block)[];
