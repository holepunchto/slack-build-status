import * as core from "@actions/core";
import { updateBuildInBlocks } from "./block-kit.js";
import { SlackClient } from "./slack-client.js";
import { mapJobStatus } from "./types.js";

interface AlsoUpdate {
  name: string;
  status: string;
  link?: string;
}

async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const channelId = core.getInput("channel-id", { required: true });
    const ts = core.getInput("ts", { required: true });
    const buildName = core.getInput("build-name", { required: true });
    const statusInput = core.getInput("status", { required: true });
    let link = core.getInput("link") || undefined;
    const filePath = core.getInput("file-path") || undefined;
    const alsoUpdateJson = core.getInput("also-update") || undefined;

    core.info(`Updating build "${buildName}" to "${statusInput}" (ts: ${ts})`);

    const client = new SlackClient(token);

    if (filePath) {
      core.info(`Uploading "${filePath}" to thread`);
      const { fileUrl } = await client.uploadFile(channelId, ts, filePath);
      link = link ?? fileUrl;
      core.info(`File uploaded: ${fileUrl}`);
    }

    const message = await client.getMessage(channelId, ts);
    core.info(`Fetched message with ${message.blocks.length} blocks`);

    const status = mapJobStatus(statusInput);
    let blocks = updateBuildInBlocks(message.blocks, buildName, status, link);

    if (alsoUpdateJson) {
      const alsoUpdates: AlsoUpdate[] = JSON.parse(alsoUpdateJson);
      for (const update of alsoUpdates) {
        core.info(`Also updating "${update.name}" to "${update.status}"`);
        const updateStatus = mapJobStatus(update.status);
        blocks = updateBuildInBlocks(blocks, update.name, updateStatus, update.link);
      }
    }

    await client.updateMessage(channelId, ts, blocks);
    core.info("Message updated successfully");
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
