import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlackApiError, SlackClient } from "../src/slack-client.js";

const mockPostMessage = vi.fn();
const mockUpdate = vi.fn();
const mockHistory = vi.fn();
const mockUploadV2 = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: {
      postMessage: mockPostMessage,
      update: mockUpdate,
    },
    conversations: {
      history: mockHistory,
    },
    filesUploadV2: mockUploadV2,
  })),
}));

describe("SlackClient", () => {
  let client: SlackClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SlackClient("xoxb-test-token");
  });

  describe("postMessage", () => {
    it("sends a message and returns ts", async () => {
      mockPostMessage.mockResolvedValue({ ok: true, ts: "123.456" });

      const result = await client.postMessage(
        "C123",
        [{ type: "section", text: { type: "mrkdwn", text: "test" } }],
        "fallback",
      );

      expect(result.ts).toBe("123.456");
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C123",
          text: "fallback",
          unfurl_links: false,
          unfurl_media: false,
        }),
      );
    });

    it("throws SlackApiError on failure", async () => {
      mockPostMessage.mockResolvedValue({ ok: false, error: "channel_not_found" });
      await expect(client.postMessage("C999", [], "test")).rejects.toThrow(SlackApiError);
    });
  });

  describe("updateMessage", () => {
    it("updates a message", async () => {
      mockUpdate.mockResolvedValue({ ok: true });

      await client.updateMessage("C123", "123.456", [
        { type: "section", text: { type: "mrkdwn", text: "updated" } },
      ]);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C123",
          ts: "123.456",
        }),
      );
    });

    it("throws on failure", async () => {
      mockUpdate.mockResolvedValue({ ok: false, error: "msg_too_long" });
      await expect(client.updateMessage("C123", "123.456", [])).rejects.toThrow(SlackApiError);
    });
  });

  describe("getMessage", () => {
    it("retrieves a message by timestamp", async () => {
      mockHistory.mockResolvedValue({
        ok: true,
        messages: [
          {
            ts: "123.456",
            blocks: [{ type: "section", text: { type: "mrkdwn", text: "hello" } }],
          },
        ],
      });

      const result = await client.getMessage("C123", "123.456");

      expect(result.ts).toBe("123.456");
      expect(result.blocks).toHaveLength(1);
      expect(mockHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C123",
          latest: "123.456",
          limit: 1,
          inclusive: true,
        }),
      );
    });

    it("throws when no message found", async () => {
      mockHistory.mockResolvedValue({ ok: true, messages: [] });
      await expect(client.getMessage("C123", "999.999")).rejects.toThrow("No message found");
    });

    it("throws on API failure", async () => {
      mockHistory.mockResolvedValue({ ok: false, error: "channel_not_found" });
      await expect(client.getMessage("C999", "123.456")).rejects.toThrow(SlackApiError);
    });
  });

  describe("postThreadReply", () => {
    it("posts a reply in a thread", async () => {
      mockPostMessage.mockResolvedValue({ ok: true, ts: "123.789" });

      await client.postThreadReply("C123", "123.456", "reply text");

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C123",
          thread_ts: "123.456",
          text: "reply text",
        }),
      );
    });
  });
});
