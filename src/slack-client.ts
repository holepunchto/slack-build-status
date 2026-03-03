import * as fs from "node:fs";
import * as path from "node:path";
import { WebClient } from "@slack/web-api";
import type { Block, KnownBlock } from "@slack/web-api";
import type { SlackMessageRef } from "./types.js";

export class SlackApiError extends Error {
  constructor(
    public method: string,
    public slackError: string,
  ) {
    super(`Slack API ${method} failed: ${slackError}`);
    this.name = "SlackApiError";
  }
}

export class SlackClient {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async postMessage(
    channel: string,
    blocks: (KnownBlock | Block)[],
    text: string,
    opts?: { unfurl_links?: boolean; unfurl_media?: boolean },
  ): Promise<{ ts: string }> {
    const result = await this.client.chat.postMessage({
      channel,
      blocks,
      text,
      unfurl_links: opts?.unfurl_links ?? false,
      unfurl_media: opts?.unfurl_media ?? false,
    });

    if (!result.ok) {
      throw new SlackApiError("chat.postMessage", result.error ?? "unknown");
    }

    // biome-ignore lint/style/noNonNullAssertion: ts is always present when ok is true
    return { ts: result.ts! };
  }

  async postThreadReply(channel: string, threadTs: string, text: string): Promise<void> {
    const result = await this.client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text,
    });

    if (!result.ok) {
      throw new SlackApiError("chat.postMessage (thread)", result.error ?? "unknown");
    }
  }

  async updateMessage(
    channel: string,
    ts: string,
    blocks: (KnownBlock | Block)[],
    text?: string,
  ): Promise<void> {
    const result = await this.client.chat.update({
      channel,
      ts,
      blocks,
      text: text ?? "",
    });

    if (!result.ok) {
      throw new SlackApiError("chat.update", result.error ?? "unknown");
    }
  }

  async getMessage(channel: string, ts: string): Promise<SlackMessageRef> {
    const result = await this.client.conversations.history({
      channel,
      latest: ts,
      limit: 1,
      inclusive: true,
    });

    if (!result.ok) {
      throw new SlackApiError("conversations.history", result.error ?? "unknown");
    }

    const message = result.messages?.[0];
    if (!message || !message.blocks) {
      throw new SlackApiError("conversations.history", "No message found at the given timestamp");
    }

    return {
      channel,
      // biome-ignore lint/style/noNonNullAssertion: ts is always present on messages
      ts: message.ts!,
      blocks: message.blocks as (KnownBlock | Block)[],
    };
  }

  async uploadFile(
    channel: string,
    threadTs: string,
    filePath: string,
    filename?: string,
  ): Promise<{ fileUrl: string; fileId: string; _raw: unknown }> {
    const resolvedFilename = filename ?? path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);

    const result = await this.client.filesUploadV2({
      channel_id: channel,
      thread_ts: threadTs,
      file: fileContent,
      filename: resolvedFilename,
    });

    // filesUploadV2 nests files as result.files[0].files[0]
    // biome-ignore lint/suspicious/noExplicitAny: Slack SDK types incomplete for filesUploadV2
    const r = result as any;
    const file = r.files?.[0]?.files?.[0] ?? r.file;

    return {
      fileUrl: file?.permalink ?? "",
      fileId: file?.id ?? "",
      _raw: r,
    };
  }
}
