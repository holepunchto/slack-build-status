import { beforeEach, describe, expect, it, vi } from "vitest";
import sampleMessage from "./fixtures/sample-message.json";

const mockGetInput = vi.fn();
const mockSetOutput = vi.fn();
const mockSetFailed = vi.fn();
vi.mock("@actions/core", () => ({
  getInput: (...args: any[]) => mockGetInput(...args),
  setOutput: (...args: any[]) => mockSetOutput(...args),
  setFailed: (...args: any[]) => mockSetFailed(...args),
  info: vi.fn(),
  warning: vi.fn(),
}));

const mockGetMessage = vi.fn();
const mockUpdateMessage = vi.fn();
const mockPostThreadReply = vi.fn();
vi.mock("../src/slack-client.js", () => ({
  SlackClient: vi.fn().mockImplementation(() => ({
    getMessage: mockGetMessage,
    updateMessage: mockUpdateMessage,
  })),
}));

describe("update action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMessage.mockResolvedValue(structuredClone(sampleMessage));
    mockUpdateMessage.mockResolvedValue(undefined);
    mockPostThreadReply.mockResolvedValue(undefined);
  });

  function setupInputs(overrides: Record<string, string> = {}) {
    const defaults: Record<string, string> = {
      token: "xoxb-test",
      "channel-id": "C123456",
      ts: "1234567890.123456",
      "build-name": "apk",
      status: "success",
      ...overrides,
    };
    mockGetInput.mockImplementation((name: string) => defaults[name] ?? "");
  }

  it("updates a single build status", async () => {
    setupInputs({ link: "https://dl.example.com/apk" });
    vi.resetModules();

    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: vi.fn(),
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
      })),
    }));

    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));

    expect(mockGetMessage).toHaveBeenCalledWith("C123456", "1234567890.123456");
    expect(mockUpdateMessage).toHaveBeenCalledTimes(1);

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    const androidField = (blocks[1] as any).fields[0].text;
    expect(androidField).toContain(":ga-success:");
    expect(androidField).toContain("https://dl.example.com/apk");
  });

  it("handles also-update for multiple builds", async () => {
    setupInputs({
      "build-name": "apk",
      status: "success",
      "also-update": JSON.stringify([{ name: "SV", status: "running" }]),
    });
    vi.resetModules();

    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: vi.fn(),
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
      })),
    }));

    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    const androidField = (blocks[1] as any).fields[0].text;
    expect(androidField).toContain("apk :ga-success:");
    expect(androidField).toContain("SV :ga-running:");
  });

  it("renames the matched build when label is set", async () => {
    setupInputs({
      "build-name": "SV",
      status: "success",
      label: "SV 1.2.3",
      "also-update": JSON.stringify([{ name: "aab", status: "running", label: "AAB 1.2.3" }]),
    });
    vi.resetModules();

    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: vi.fn(),
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
      })),
    }));

    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    const fields = (blocks[1] as any).fields;
    expect(fields[0].text).toBe(
      "Android:\napk :ga-running: | SV 1.2.3 :ga-success: | AAB 1.2.3 :ga-running:",
    );
    expect(fields[1].text).toBe("iOS:\nTestflight :ga-pending:");
  });

  it("keeps the build name when also-update has an empty label", async () => {
    setupInputs({
      "build-name": "apk",
      status: "success",
      "also-update": JSON.stringify([{ name: "aab", status: "running", label: "" }]),
    });
    vi.resetModules();

    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: vi.fn(),
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
      })),
    }));

    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    const fields = (blocks[1] as any).fields;
    expect(fields[0].text).toBe("Android:\napk :ga-success: | SV :ga-pending: | aab :ga-running:");
  });

  it("scopes the update to a specific group when group input is set", async () => {
    setupInputs({
      "build-name": "AAB",
      status: "success",
      group: "Android :production-bird:",
    });

    mockGetMessage.mockResolvedValue({
      channel: "C123456",
      ts: "1234567890.123456",
      blocks: [
        { type: "section", block_id: "header", text: { type: "mrkdwn", text: "header" } },
        {
          type: "section",
          block_id: "statuses",
          fields: [
            { type: "mrkdwn", text: "Android :internal-bird::\nAAB :ga-running:" },
            { type: "mrkdwn", text: "Android :production-bird::\nAAB :ga-running:" },
          ],
        },
      ],
    });

    vi.resetModules();
    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: vi.fn(),
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
      })),
    }));

    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));

    expect(mockUpdateMessage).toHaveBeenCalledTimes(1);
    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    const fields = (blocks[1] as any).fields;
    expect(fields[0].text).toBe("Android :internal-bird::\nAAB :ga-running:");
    expect(fields[1].text).toBe("Android :production-bird::\nAAB :ga-success:");
  });

  it("uses per-entry group on also-update entries, falling back to top-level group", async () => {
    setupInputs({
      "build-name": "AAB",
      status: "success",
      group: "Android :production-bird:",
      "also-update": JSON.stringify([
        { name: "APK", status: "running" },
        { name: "AAB", status: "running", group: "Android :internal-bird:" },
      ]),
    });

    mockGetMessage.mockResolvedValue({
      channel: "C123456",
      ts: "1234567890.123456",
      blocks: [
        { type: "section", block_id: "header", text: { type: "mrkdwn", text: "header" } },
        {
          type: "section",
          block_id: "statuses",
          fields: [
            {
              type: "mrkdwn",
              text: "Android :internal-bird::\nAAB :ga-pending: | APK :ga-pending:",
            },
            {
              type: "mrkdwn",
              text: "Android :production-bird::\nAAB :ga-running: | APK :ga-pending:",
            },
          ],
        },
      ],
    });

    vi.resetModules();
    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: vi.fn(),
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
      })),
    }));

    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    const fields = (blocks[1] as any).fields;
    expect(fields[0].text).toBe("Android :internal-bird::\nAAB :ga-running: | APK :ga-pending:");
    expect(fields[1].text).toBe("Android :production-bird::\nAAB :ga-success: | APK :ga-running:");
  });

  it("logs a warning when group is provided but no matching field exists", async () => {
    const mockWarning = vi.fn();

    setupInputs({
      "build-name": "AAB",
      status: "success",
      group: "iOS :nightly-bird:",
    });

    mockGetMessage.mockResolvedValue({
      channel: "C123456",
      ts: "1234567890.123456",
      blocks: [
        { type: "section", block_id: "header", text: { type: "mrkdwn", text: "header" } },
        {
          type: "section",
          block_id: "statuses",
          fields: [{ type: "mrkdwn", text: "Android :internal-bird::\nAAB :ga-running:" }],
        },
      ],
    });

    vi.resetModules();
    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: mockWarning,
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
      })),
    }));

    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));

    expect(mockWarning).toHaveBeenCalledWith(
      "Group 'iOS :nightly-bird:' not found in message; update for \"AAB\" skipped",
    );
  });

  async function runUpdate(overrides: Record<string, string>) {
    setupInputs(overrides);
    vi.resetModules();
    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: vi.fn(),
    }));
    vi.doMock("@actions/github", () => ({
      context: { repo: { owner: "default-org", repo: "default-repo" } },
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
        postThreadReply: mockPostThreadReply,
      })),
    }));
    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));
  }

  it("replaces the changelog block when changelog is set", async () => {
    await runUpdate({
      changelog: "fix bug (#42)",
      "changelog-compare-url": "https://github.com/org/repo/compare/v1.2.0...main",
      repo: "org/repo",
    });

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    const changelogBlocks = blocks.filter((b: any) => b.block_id === "changelog");
    expect(changelogBlocks).toHaveLength(1);
    const text = changelogBlocks[0].elements[0].text;
    expect(text).toContain("*<https://github.com/org/repo/compare/v1.2.0...main|Changelog:>*");
    expect(text).toContain("https://github.com/org/repo/pull/42");
    expect(text).not.toContain("feat: add login");
    expect((blocks[1] as any).fields[0].text).toContain("apk :ga-success:");
  });

  it("links PRs against the current repo when repo is not set", async () => {
    await runUpdate({ changelog: "fix bug (#42)" });

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    const changelogBlock = blocks.find((b: any) => b.block_id === "changelog");
    expect(changelogBlock.elements[0].text).toContain(
      "https://github.com/default-org/default-repo/pull/42",
    );
  });

  it("leaves the existing changelog block untouched when changelog is empty", async () => {
    await runUpdate({});

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    expect(blocks[2]).toEqual(sampleMessage.blocks[2]);
  });

  it("posts a CC thread reply after the update when notify-users is set", async () => {
    await runUpdate({ "notify-users": "<@U0123> <@U0456>" });

    expect(mockPostThreadReply).toHaveBeenCalledTimes(1);
    expect(mockPostThreadReply).toHaveBeenCalledWith(
      "C123456",
      "1234567890.123456",
      "CC: <@U0123> <@U0456>",
    );
    expect(mockUpdateMessage.mock.invocationCallOrder[0]).toBeLessThan(
      mockPostThreadReply.mock.invocationCallOrder[0],
    );
  });

  it("posts no thread reply when notify-users is empty", async () => {
    await runUpdate({});

    expect(mockUpdateMessage).toHaveBeenCalledTimes(1);
    expect(mockPostThreadReply).not.toHaveBeenCalled();
  });

  it("posts no thread reply when the update fails", async () => {
    mockUpdateMessage.mockRejectedValue(new Error("update failed"));
    await runUpdate({ "notify-users": "<@U0123>" });

    expect(mockSetFailed).toHaveBeenCalledWith("update failed");
    expect(mockPostThreadReply).not.toHaveBeenCalled();
  });

  it("matches renamed builds by label prefix for build-name and also-update", async () => {
    const message = structuredClone(sampleMessage);
    message.blocks[1].fields = [
      {
        type: "mrkdwn",
        text: "Android:\nandroid-a 31/34 :ga-failed: | android-b 30/34 :ga-failed:",
      },
    ];
    mockGetMessage.mockResolvedValue(message);

    await runUpdate({
      "build-name": "android-a",
      status: "success",
      label: "android-a 34/34",
      "also-update": JSON.stringify([
        { name: "android-b", status: "warning", label: "android-b 33/34" },
      ]),
    });

    const [, , blocks] = mockUpdateMessage.mock.calls[0];
    expect((blocks[1] as any).fields[0].text).toBe(
      "Android:\nandroid-a 34/34 :ga-success: | android-b 33/34 :warning:",
    );
  });

  it("calls setFailed on error", async () => {
    mockGetMessage.mockRejectedValue(new Error("network error"));
    setupInputs();
    vi.resetModules();

    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
      warning: vi.fn(),
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        getMessage: mockGetMessage,
        updateMessage: mockUpdateMessage,
      })),
    }));

    await import("../src/update.js");
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSetFailed).toHaveBeenCalledWith("network error");
  });
});
