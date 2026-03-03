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
    const link = core.getInput("link") || undefined;
    const alsoUpdateJson = core.getInput("also-update") || undefined;

    const client = new SlackClient(token);
    const message = await client.getMessage(channelId, ts);

    const status = mapJobStatus(statusInput);
    let blocks = updateBuildInBlocks(message.blocks, buildName, status, link);

    if (alsoUpdateJson) {
      const alsoUpdates: AlsoUpdate[] = JSON.parse(alsoUpdateJson);
      for (const update of alsoUpdates) {
        const updateStatus = mapJobStatus(update.status);
        blocks = updateBuildInBlocks(blocks, update.name, updateStatus, update.link);
      }
    }

    await client.updateMessage(channelId, ts, blocks);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
