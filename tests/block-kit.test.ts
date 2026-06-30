import { describe, expect, it } from "vitest";
import {
  buildChangelogBlock,
  buildMessage,
  buildStatusText,
  cancelAllInBlocks,
  parseStatusText,
  renderBuildStatus,
  updateBuildInBlocks,
} from "../src/block-kit.js";
import { type Build, STATUS_EMOJI, Status } from "../src/types.js";
import sampleMessage from "./fixtures/sample-message.json";

describe("renderBuildStatus", () => {
  it("renders plain status without link", () => {
    const build: Build = {
      name: "apk",
      label: "APK",
      group: "Android",
      status: Status.Running,
    };
    expect(renderBuildStatus(build)).toBe("APK :ga-running:");
  });

  it("renders linked status", () => {
    const build: Build = {
      name: "apk",
      label: "APK",
      group: "Android",
      status: Status.Success,
      link: "https://example.com/apk",
    };
    expect(renderBuildStatus(build)).toBe("<https://example.com/apk|APK :ga-success:>");
  });
});

describe("buildStatusText", () => {
  it("joins multiple builds with pipes", () => {
    const builds: Build[] = [
      { name: "apk", label: "apk", group: "Android", status: Status.Running },
      { name: "sv", label: "SV", group: "Android", status: Status.Pending },
      { name: "aab", label: "aab", group: "Android", status: Status.Pending },
    ];
    expect(buildStatusText(builds)).toBe("apk :ga-running: | SV :ga-pending: | aab :ga-pending:");
  });
});

describe("parseStatusText", () => {
  it("parses plain statuses", () => {
    const parsed = parseStatusText("apk :ga-running: | SV :ga-pending: | aab :ga-pending:");
    expect(parsed).toEqual([
      { name: "apk", emoji: ":ga-running:" },
      { name: "SV", emoji: ":ga-pending:" },
      { name: "aab", emoji: ":ga-pending:" },
    ]);
  });

  it("parses linked statuses", () => {
    const parsed = parseStatusText("<https://example.com|apk :ga-success:> | SV :ga-pending:");
    expect(parsed).toEqual([
      { name: "apk", emoji: ":ga-success:", link: "https://example.com" },
      { name: "SV", emoji: ":ga-pending:" },
    ]);
  });

  it("round-trips with buildStatusText", () => {
    const builds: Build[] = [
      {
        name: "apk",
        label: "apk",
        group: "Android",
        status: Status.Success,
        link: "https://dl.example.com/apk",
      },
      { name: "sv", label: "SV", group: "Android", status: Status.Failure },
    ];
    const text = buildStatusText(builds);
    const parsed = parseStatusText(text);
    expect(parsed).toEqual([
      { name: "apk", emoji: ":ga-success:", link: "https://dl.example.com/apk" },
      { name: "SV", emoji: ":ga-failed:" },
    ]);
  });
});

describe("buildMessage", () => {
  const baseBuilds: Build[] = [
    { name: "apk", label: "apk", group: "Android", status: Status.Running },
    { name: "sv", label: "SV", group: "Android", status: Status.Pending },
    { name: "aab", label: "aab", group: "Android", status: Status.Pending },
    { name: "ios", label: "Testflight", group: "iOS", status: Status.Pending },
  ];

  it("creates a valid payload with all fields", () => {
    const payload = buildMessage(
      "C123",
      {
        builds: baseBuilds,
        version: "1.2.3",
        branch: "main",
        gitUrl: "https://github.com/org/repo/tree/main",
        changelog: "feat: something (#1)",
        changelogCompareUrl: "https://github.com/org/repo/compare/v1.1.0..main",
        icon: ":app-icon:",
      },
      "org/repo",
    );

    expect(payload.channel).toBe("C123");
    expect(payload.unfurl_links).toBe(false);
    expect(payload.unfurl_media).toBe(false);
    expect(payload.text).toContain("1.2.3");
    expect(payload.blocks.length).toBe(3); // header + statuses + changelog
  });

  it("sets block_id on all blocks", () => {
    const payload = buildMessage(
      "C123",
      {
        builds: baseBuilds,
        version: "1.2.3",
        branch: "main",
        gitUrl: "https://github.com/org/repo",
      },
      "org/repo",
    );

    for (const block of payload.blocks) {
      expect(block).toHaveProperty("block_id");
    }
  });

  it("groups builds by group field", () => {
    const payload = buildMessage(
      "C123",
      {
        builds: baseBuilds,
        version: "1.0.0",
        branch: "main",
        gitUrl: "https://github.com/org/repo",
      },
      "org/repo",
    );

    const statusBlock = payload.blocks.find((b) => "block_id" in b && b.block_id === "statuses");
    expect(statusBlock).toBeDefined();
    const fields = (statusBlock as any).fields;
    expect(fields).toHaveLength(2);
    expect(fields[0].text).toContain("Android:");
    expect(fields[1].text).toContain("iOS:");
  });

  it("omits changelog block when no changelog provided", () => {
    const payload = buildMessage(
      "C123",
      {
        builds: baseBuilds,
        version: "1.0.0",
        branch: "main",
        gitUrl: "https://github.com/org/repo",
      },
      "org/repo",
    );

    expect(payload.blocks.length).toBe(2); // header + statuses only
  });

  it("renders without group prefix when group is omitted", () => {
    const payload = buildMessage(
      "C123",
      {
        builds: [{ name: "lib", label: "org/repo", status: Status.Running }],
        version: "1.0.0",
        branch: "main",
        gitUrl: "https://github.com/org/repo",
      },
      "org/repo",
    );

    const statusBlock = payload.blocks.find((b) => "block_id" in b && b.block_id === "statuses");
    const fields = (statusBlock as any).fields;
    expect(fields).toHaveLength(1);
    expect(fields[0].text).toBe("org/repo :ga-running:");
    expect(fields[0].text).not.toContain("\n");
  });

  it("detects PR links in changelog", () => {
    const payload = buildMessage(
      "C123",
      {
        builds: baseBuilds,
        version: "1.0.0",
        branch: "main",
        gitUrl: "https://github.com/org/repo",
        changelog: "fix bug (#42)",
      },
      "org/repo",
    );

    const changelogBlock = payload.blocks.find(
      (b) => "block_id" in b && b.block_id === "changelog",
    );
    const elements = (changelogBlock as any).elements;
    expect(elements[0].text).toContain("/pull/42|(#42)>");
  });
});

describe("updateBuildInBlocks", () => {
  it("updates a build status in the blocks", () => {
    const blocks = structuredClone(sampleMessage.blocks);
    const updated = updateBuildInBlocks(
      blocks,
      "apk",
      Status.Success,
      "https://dl.example.com/apk",
    );

    const fields = (updated[1] as any).fields;
    expect(fields[0].text).toContain(":ga-success:");
    expect(fields[0].text).toContain("https://dl.example.com/apk");
    // Others unchanged
    expect(fields[0].text).toContain("SV :ga-pending:");
    expect(fields[1].text).toContain("Testflight :ga-pending:");
  });

  it("does not mutate the original blocks", () => {
    const blocks = structuredClone(sampleMessage.blocks);
    const originalText = (blocks[1] as any).fields[0].text;
    updateBuildInBlocks(blocks, "apk", Status.Success);
    expect((blocks[1] as any).fields[0].text).toBe(originalText);
  });

  it("handles linked status being updated to a new link", () => {
    const blocks = structuredClone(sampleMessage.blocks);
    // First make apk have a link
    const withLink = updateBuildInBlocks(blocks, "apk", Status.Success, "https://old.link");
    // Then update to failure with new link
    const updated = updateBuildInBlocks(withLink, "apk", Status.Failure, "https://new.link");

    const fields = (updated[1] as any).fields;
    expect(fields[0].text).toContain(":ga-failed:");
    expect(fields[0].text).toContain("https://new.link");
    expect(fields[0].text).not.toContain("https://old.link");
  });

  it("preserves existing link when no new link provided", () => {
    const blocks = structuredClone(sampleMessage.blocks);
    const withLink = updateBuildInBlocks(blocks, "apk", Status.Success, "https://keep.me");
    const updated = updateBuildInBlocks(withLink, "apk", Status.Failure);

    const fields = (updated[1] as any).fields;
    expect(fields[0].text).toContain("https://keep.me");
    expect(fields[0].text).toContain(":ga-failed:");
  });

  it("updates status in fields without group prefix", () => {
    const blocks = [
      { type: "section", block_id: "header", text: { type: "mrkdwn", text: "header" } },
      {
        type: "section",
        block_id: "statuses",
        fields: [{ type: "mrkdwn", text: "org/repo :ga-running:" }],
      },
    ];
    const updated = updateBuildInBlocks(blocks, "org/repo", Status.Success);
    const fields = (updated[1] as any).fields;
    expect(fields[0].text).toBe("org/repo :ga-success:");
  });

  it("returns unchanged blocks when build name not found", () => {
    const blocks = structuredClone(sampleMessage.blocks);
    const updated = updateBuildInBlocks(blocks, "nonexistent", Status.Success);
    expect(updated).toEqual(blocks);
  });

  it("scopes the matcher to a specific group when group is provided", () => {
    const blocks = [
      { type: "section", block_id: "header", text: { type: "mrkdwn", text: "header" } },
      {
        type: "section",
        block_id: "statuses",
        fields: [
          {
            type: "mrkdwn",
            text: "Android :internal-bird::\nAAB :ga-running:",
          },
          {
            type: "mrkdwn",
            text: "Android :production-bird::\nAAB :ga-running:",
          },
        ],
      },
    ];

    const updated = updateBuildInBlocks(
      blocks,
      "AAB",
      Status.Success,
      undefined,
      "Android :production-bird:",
    );

    const fields = (updated[1] as any).fields;
    expect(fields[0].text).toBe("Android :internal-bird::\nAAB :ga-running:");
    expect(fields[1].text).toBe("Android :production-bird::\nAAB :ga-success:");
  });

  it("returns unchanged blocks when group is provided but no field matches", () => {
    const blocks = [
      { type: "section", block_id: "header", text: { type: "mrkdwn", text: "header" } },
      {
        type: "section",
        block_id: "statuses",
        fields: [{ type: "mrkdwn", text: "Android :internal-bird::\nAAB :ga-running:" }],
      },
    ];

    const updated = updateBuildInBlocks(
      blocks,
      "AAB",
      Status.Success,
      undefined,
      "iOS :nightly-bird:",
    );

    expect(updated).toEqual(blocks);
  });

  it("preserves the first-match behavior when group is omitted (back-compat)", () => {
    const blocks = [
      { type: "section", block_id: "header", text: { type: "mrkdwn", text: "header" } },
      {
        type: "section",
        block_id: "statuses",
        fields: [
          { type: "mrkdwn", text: "Android :internal-bird::\nAAB :ga-running:" },
          { type: "mrkdwn", text: "Android :production-bird::\nAAB :ga-running:" },
        ],
      },
    ];

    const updated = updateBuildInBlocks(blocks, "AAB", Status.Success);

    const fields = (updated[1] as any).fields;
    expect(fields[0].text).toBe("Android :internal-bird::\nAAB :ga-success:");
    expect(fields[1].text).toBe("Android :production-bird::\nAAB :ga-running:");
  });
});

describe("cancelAllInBlocks", () => {
  it("replaces all pending and running with cancelled", () => {
    const blocks = structuredClone(sampleMessage.blocks);
    const cancelled = cancelAllInBlocks(blocks);

    const fields = (cancelled[1] as any).fields;
    expect(fields[0].text).not.toContain(":ga-pending:");
    expect(fields[0].text).not.toContain(":ga-running:");
    expect(fields[0].text).toContain(":ga-cancelled:");
    expect(fields[1].text).not.toContain(":ga-pending:");
    expect(fields[1].text).toContain(":ga-cancelled:");
  });

  it("does not modify already completed statuses", () => {
    const blocks = structuredClone(sampleMessage.blocks);
    // First set apk to success
    const updated = updateBuildInBlocks(blocks, "apk", Status.Success, "https://dl.example.com");
    const cancelled = cancelAllInBlocks(updated);

    const fields = (cancelled[1] as any).fields;
    expect(fields[0].text).toContain(":ga-success:");
  });

  it("does not mutate the original blocks", () => {
    const blocks = structuredClone(sampleMessage.blocks);
    cancelAllInBlocks(blocks);
    expect((blocks[1] as any).fields[0].text).toContain(":ga-running:");
  });
});

describe("buildChangelogBlock", () => {
  it("returns a context block with the compare-url header and PR links", () => {
    const block = buildChangelogBlock(
      "fix bug (#42)",
      "https://github.com/org/repo/compare/v1.0.0...main",
      "org/repo",
    ) as any;

    expect(block).not.toBeNull();
    expect(block.type).toBe("context");
    expect(block.block_id).toBe("changelog");
    expect(block.elements[0].text).toContain(
      "*<https://github.com/org/repo/compare/v1.0.0...main|Changelog:>*",
    );
    expect(block.elements[0].text).toContain("/pull/42|(#42)>");
  });

  it("returns null when changelog is empty", () => {
    expect(buildChangelogBlock("", undefined, "org/repo")).toBeNull();
  });
});
