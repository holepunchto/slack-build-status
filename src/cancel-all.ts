import * as core from "@actions/core";
import { cancelAllInBlocks } from "./block-kit.js";
import { SlackClient } from "./slack-client.js";

async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const channelId = core.getInput("channel-id", { required: true });
    const ts = core.getInput("ts", { required: true });

    const client = new SlackClient(token);
    const message = await client.getMessage(channelId, ts);
    const blocks = cancelAllInBlocks(message.blocks);
    await client.updateMessage(channelId, ts, blocks);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
