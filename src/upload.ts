import * as core from "@actions/core";
import { SlackClient } from "./slack-client.js";

async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const channelId = core.getInput("channel-id", { required: true });
    const ts = core.getInput("ts", { required: true });
    const filePath = core.getInput("file-path", { required: true });
    const filename = core.getInput("filename") || undefined;

    core.info(`Uploading "${filename ?? filePath}" to thread (ts: ${ts})`);
    const client = new SlackClient(token);
    const { fileUrl, fileId } = await client.uploadFile(channelId, ts, filePath, filename);
    if (fileUrl) {
      core.info(`File uploaded: ${fileUrl}`);
    } else {
      core.warning("File uploaded but permalink not returned by Slack API");
    }

    core.setOutput("file-url", fileUrl);
    core.setOutput("file-id", fileId);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
