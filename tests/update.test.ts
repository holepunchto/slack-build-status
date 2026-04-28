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
