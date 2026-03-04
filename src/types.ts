import type { Block, KnownBlock } from "@slack/web-api";

export enum Status {
  Pending = "pending",
  Running = "running",
  Success = "success",
  Failure = "failure",
  Cancelled = "cancelled",
  Skipped = "skipped",
}

export const STATUS_EMOJI: Record<Status, string> = {
  [Status.Pending]: ":ga-pending:",
  [Status.Running]: ":ga-running:",
  [Status.Success]: ":ga-success:",
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
}

/** GitHub provides: "success", "failure", "cancelled" */
export function mapJobStatus(jobStatus: string): Status {
  switch (jobStatus.toLowerCase()) {
    case "success":
      return Status.Success;
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
    default:
      return Status.Failure;
  }
}
