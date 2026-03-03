import { beforeEach, describe, expect, it, vi } from "vitest";
import { Status } from "../src/types.js";

const mockGetInput = vi.fn();
const mockSetOutput = vi.fn();
const mockSetFailed = vi.fn();
vi.mock("@actions/core", () => ({
  getInput: (...args: any[]) => mockGetInput(...args),
  setOutput: (...args: any[]) => mockSetOutput(...args),
  setFailed: (...args: any[]) => mockSetFailed(...args),
  info: vi.fn(),
}));

vi.mock("@actions/github", () => ({
  context: { repo: { owner: "default-org", repo: "default-repo" } },
}));

const mockPostMessage = vi.fn();
const mockPostThreadReply = vi.fn();
vi.mock("../src/slack-client.js", () => ({
  SlackClient: vi.fn().mockImplementation(() => ({
    postMessage: mockPostMessage,
    postThreadReply: mockPostThreadReply,
  })),
}));

describe("create action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostMessage.mockResolvedValue({ ts: "111.222" });
    mockPostThreadReply.mockResolvedValue(undefined);
  });

  function setupInputs(overrides: Record<string, string> = {}) {
    const defaults: Record<string, string> = {
      token: "xoxb-test",
      "channel-id": "C123",
      builds: JSON.stringify([{ name: "apk", label: "APK", group: "Android", status: "running" }]),
      version: "1.0.0",
      branch: "main",
      "git-url": "https://github.com/org/repo",
      ...overrides,
    };
    mockGetInput.mockImplementation((name: string) => defaults[name] ?? "");
  }

  it("posts a message and sets ts output", async () => {
    setupInputs();
    await import("../src/create.js");

    // Wait for the async run() to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockSetOutput).toHaveBeenCalledWith("ts", "111.222");
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it("posts thread replies when provided", async () => {
    setupInputs({
      "thread-replies": JSON.stringify([{ text: "version info" }]),
    });

    // Re-import triggers run()
    vi.resetModules();

    // Need to re-mock after resetModules
    vi.doMock("@actions/core", () => ({
      getInput: (...args: any[]) => mockGetInput(...args),
      setOutput: (...args: any[]) => mockSetOutput(...args),
      setFailed: (...args: any[]) => mockSetFailed(...args),
      info: vi.fn(),
    }));
    vi.doMock("@actions/github", () => ({
      context: { repo: { owner: "default-org", repo: "default-repo" } },
    }));
    vi.doMock("../src/slack-client.js", () => ({
      SlackClient: vi.fn().mockImplementation(() => ({
        postMessage: mockPostMessage,
        postThreadReply: mockPostThreadReply,
      })),
    }));

    await import("../src/create.js");
    await new Promise((r) => setTimeout(r, 50));

    expect(mockPostThreadReply).toHaveBeenCalledWith("C123", "111.222", "version info");
  });
});
