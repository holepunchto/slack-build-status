import { describe, expect, it } from "vitest";
import { STATUS_EMOJI, Status, mapJobStatus } from "../src/types.js";

describe("mapJobStatus", () => {
  it("maps GitHub Actions status strings", () => {
    expect(mapJobStatus("success")).toBe(Status.Success);
    expect(mapJobStatus("failure")).toBe(Status.Failure);
    expect(mapJobStatus("cancelled")).toBe(Status.Cancelled);
    expect(mapJobStatus("skipped")).toBe(Status.Skipped);
  });

  it("maps shipped - emitted by callers after a successful remote upload", () => {
    expect(mapJobStatus("shipped")).toBe(Status.Shipped);
  });

  it("is case-insensitive", () => {
    expect(mapJobStatus("Success")).toBe(Status.Success);
    expect(mapJobStatus("FAILURE")).toBe(Status.Failure);
    expect(mapJobStatus("Shipped")).toBe(Status.Shipped);
  });

  it("defaults to Failure for unknown values", () => {
    expect(mapJobStatus("unknown")).toBe(Status.Failure);
    expect(mapJobStatus("")).toBe(Status.Failure);
  });
});

describe("STATUS_EMOJI", () => {
  it("has an emoji for every Status value", () => {
    for (const status of Object.values(Status)) {
      expect(STATUS_EMOJI[status]).toBeDefined();
      expect(STATUS_EMOJI[status]).toMatch(/^:[\w-]+:$/);
    }
  });

  it("uses :rocket: for the Shipped status", () => {
    expect(STATUS_EMOJI[Status.Shipped]).toBe(":rocket:");
  });
});
