import type { Block, KnownBlock } from "@slack/web-api";

export enum Status {
  Queued = "queued",
  Pending = "pending",
  Running = "running",
  Success = "success",
  Shipped = "shipped",
  Failure = "failure",
  Cancelled = "cancelled",
  Skipped = "skipped",
}

export const STATUS_EMOJI: Record<Status, string> = {
  [Status.Queued]: ":ga-queued:",
  [Status.Pending]: ":ga-pending:",
  [Status.Running]: ":ga-running:",
  [Status.Success]: ":ga-success:",
  [Status.Shipped]: ":rocket:",
  [Status.Failure]: ":ga-failed:",
  [Status.Cancelled]: ":ga-cancelled:",
  [Status.Skipped]: ":ga-skipped:",
};

export interface Build {
  name: string;
  label: string;
  group?: string;
  status: Status;
  link?: string;
}

export interface SlackMessageRef {
  channel: string;
  ts: string;
  blocks: (KnownBlock | Block)[];
}

export interface CreateMessageParams {
  builds: Build[];
  version: string;
  branch: string;
  gitUrl: string;
  changelog?: string;
  changelogCompareUrl?: string;
  icon?: string;
  extraBadges?: string;
  /** When false, renders build labels without status emojis — a static
   * announcement rather than a live status board. Defaults to true. */
  showStatus?: boolean;
}

/** GitHub provides: "success", "failure", "cancelled". "shipped" is a custom
 * value emitted by callers after a successful remote upload (e.g. Firebase
 * App Distribution, TestFlight). "queued" represents a build that hasn't
 * started yet (waiting for a runner) - distinct from "pending", which is
 * used for builds that are downstream of a currently-running build. */
export function mapJobStatus(jobStatus: string): Status {
  switch (jobStatus.toLowerCase()) {
    case "success":
      return Status.Success;
    case "shipped":
      return Status.Shipped;
    case "failure":
      return Status.Failure;
    case "cancelled":
      return Status.Cancelled;
    case "skipped":
      return Status.Skipped;
    case "running":
      return Status.Running;
    case "pending":
      return Status.Pending;
    case "queued":
      return Status.Queued;
    default:
      return Status.Failure;
  }
}
