import { describe, expect, it } from "vitest";
import { STATUS_EMOJI, Status, mapJobStatus } from "../src/types.js";

describe("mapJobStatus", () => {
  it("maps GitHub Actions status strings", () => {
    expect(mapJobStatus("success")).toBe(Status.Success);
    expect(mapJobStatus("failure")).toBe(Status.Failure);
    expect(mapJobStatus("cancelled")).toBe(Status.Cancelled);
    expect(mapJobStatus("skipped")).toBe(Status.Skipped);
  });

  it("is case-insensitive", () => {
    expect(mapJobStatus("Success")).toBe(Status.Success);
    expect(mapJobStatus("FAILURE")).toBe(Status.Failure);
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
      expect(STATUS_EMOJI[status]).toMatch(/^:ga-\w+:$/);
    }
  });
});
