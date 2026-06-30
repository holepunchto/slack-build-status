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
  warning: vi.fn(),
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
      warning: vi.fn(),
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

  async function runCreate(overrides: Record<string, string>) {
    vi.resetModules();
    vi.doMock("@actions/core", () => ({
      getInput: (name: string) => mockGetInput(name),
      setOutput: (name: string, value: string) => mockSetOutput(name, value),
      setFailed: (message: string) => mockSetFailed(message),
      info: vi.fn(),
      warning: vi.fn(),
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
    setupInputs(overrides);
    await import("../src/create.js");
    await new Promise((r) => setTimeout(r, 50));
  }

  it("posts the changelog as a thread reply and omits it from the body when changelog-in-thread is true", async () => {
    await runCreate({
      changelog: "fix bug (#42)",
      "changelog-in-thread": "true",
    });

    const bodyBlocks = mockPostMessage.mock.calls[0][1] as { block_id?: string }[];
    expect(bodyBlocks.some((b) => b.block_id === "changelog")).toBe(false);

    const calls = mockPostThreadReply.mock.calls as unknown[][];
    const changelogReply = calls.find((c) => {
      const blocks = c[3] as { block_id?: string }[] | undefined;
      return Array.isArray(blocks) && blocks[0]?.block_id === "changelog";
    });
    expect(changelogReply).toBeDefined();
  });

  it("keeps the changelog in the body and posts no changelog thread reply when changelog-in-thread is false", async () => {
    await runCreate({
      changelog: "fix bug (#42)",
      "changelog-in-thread": "false",
    });

    const bodyBlocks = mockPostMessage.mock.calls[0][1] as { block_id?: string }[];
    expect(bodyBlocks.some((b) => b.block_id === "changelog")).toBe(true);

    const calls = mockPostThreadReply.mock.calls as unknown[][];
    const changelogReply = calls.find((c) => Array.isArray(c[3]));
    expect(changelogReply).toBeUndefined();
  });
});
