import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetInput = vi.fn();
const mockSetOutput = vi.fn();
const mockSetFailed = vi.fn();
const mockUploadFile = vi.fn();

describe("upload action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFile.mockResolvedValue({
      fileUrl: "https://slack.example/F123",
      fileId: "F123",
      _raw: {},
    });
  });

  async function runUpload(overrides: Record<string, string>) {
    const inputs: Record<string, string> = {
      token: "xoxb-test",
      "channel-id": "C123456",
      ts: "1234567890.123456",
      "file-path": "build/app.apk",
      ...overrides,
    };
    mockGetInput.mockImplementation((name: string) => inputs[name] ?? "");
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
        uploadFile: mockUploadFile,
      })),
    }));
    await import("../src/upload.js");
    await new Promise((r) => setTimeout(r, 50));
  }

  it("uploads the file with file-comment as its initial comment", async () => {
    await runUpload({ filename: "app-1.2.3.apk", "file-comment": "sha256 abc" });

    expect(mockUploadFile).toHaveBeenCalledWith(
      "C123456",
      "1234567890.123456",
      "build/app.apk",
      "app-1.2.3.apk",
      "sha256 abc",
    );
    expect(mockSetOutput).toHaveBeenCalledWith("file-url", "https://slack.example/F123");
    expect(mockSetOutput).toHaveBeenCalledWith("file-id", "F123");
  });

  it("uploads the file without a comment when file-comment is empty", async () => {
    await runUpload({});

    expect(mockUploadFile).toHaveBeenCalledWith(
      "C123456",
      "1234567890.123456",
      "build/app.apk",
      undefined,
      undefined,
    );
  });
});
