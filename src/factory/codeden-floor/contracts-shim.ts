// Adaptado de CodeDen (MIT) commit b0b2a5a: packages/contracts/src/factory-api.ts, components/factory-view/stages.ts, components/factory/meta.ts, stopped-items.ts
// Shim de tipos e helpers puros necessários para rodar os módulos 3D scene/* e floor/* 1:1 no plugin OrgFy.

export type WorkType = "bug" | "feature" | "docs";
export const DISCOVERY_AREAS = [
  "features",
  "ux",
  "performance",
  "tech_debt",
  "test_gaps",
  "security",
  "bugs",
  "docs",
] as const;
export type DiscoveryArea = (typeof DISCOVERY_AREAS)[number];
export const DiscoveryArea = DISCOVERY_AREAS;

export type FactoryLoopState =
  | "idle"
  | "discovering"
  | "building"
  | "verifying"
  | "paused"
  | "stopped"
  | "draining";

export type FactoryItemStage =
  | "candidate"
  | "ignored"
  | "backlog"
  | "building"
  | "verifying"
  | "watching"
  | "merged"
  | "reverted"
  | "rejected"
  | "failed"
  | "escalated";

export type PipelineStep =
  | "intake"
  | "queued"
  | "reproduce"
  | "analyze"
  | "implement"
  | "review"
  | "merge"
  | "ignored"
  | "done"
  | "stopped";

export interface FactoryWorkItem {
  id: string;
  title: string;
  workKey: string;
  stage: FactoryItemStage;
  step: PipelineStep;
  type: WorkType | null;
  attempts: number;
  sessionId: string | null;
  activeSessionId: string | null;
  reviewerSessionId?: string | null;
  reason: string | null;
  note: string | null;
  updatedAt: number;
  issue?: { number: number; url: string } | null;
  pr?: { number: number; url: string; state: string } | null;
  ownedPr?: { number: number; url: string; state: string } | null;
  trust?: string | null;
  cost?: { usd?: number; tokens?: number } | null;
  checks?: { passed: number; failed: number; total: number } | null;
}

export interface ScoutLens {
  area: DiscoveryArea;
  sessionId: string;
  status: string;
  active: boolean;
  reported: boolean;
  provider?: string;
  model?: string | null;
}

export interface ScoutStatus {
  sessionId: string | null;
  phase: "idle" | "planning" | "reviewing" | "filing";
  rounds: number;
  lenses: ScoutLens[];
  provider?: string;
  model?: string | null;
  heldFollowUps?: number;
  lastRoundAt: string | null;
  note?: string | null;
}
export type FactoryScout = ScoutStatus;

export interface FactoryPr {
  itemId: string;
  pr: { number: number; url: string; state: string };
  state: string;
  queuePosition?: number | null;
  sessionId?: string | null;
}

export interface FactoryStatus {
  projectId: string;
  mode: "manual" | "assisted" | "software_factory" | "dark_factory";
  experimental: boolean;
  loopState: FactoryLoopState;
  pausedReason: string | null;
  killSwitch: boolean;
  globalKillSwitch: boolean;
  drain: { since: number; inFlight: number; total: number; deadline: number | null } | null;
  limits: {
    maxConcurrentSessions: number;
    maxMergesPerDay: number;
    dailyBudget: { tokens?: number; usd?: number };
    pauseAfterConsecutiveFailures: number;
    autoMerge: boolean;
    mergePolicy: "fast" | "strict";
  };
  spendToday: { tokens: number; usd: number };
  mergesToday: number;
  stats: {
    mergedToday: number;
    failedToday: number;
    revertedToday: number;
    medianMergeMs7d: number | null;
    merged7d: number;
  };
  consecutiveFailures: number;
  activeSessions: number;
  wip: { openPrs: number; limit: number; holding: boolean; waitingOnProvider: number; note: string | null };
  backlog: FactoryWorkItem[];
  inProgress: FactoryWorkItem[];
  pullRequests: FactoryPr[];
  recent: FactoryWorkItem[];
  viewRecent: FactoryWorkItem[];
  ignored: FactoryWorkItem[];
  held: Array<{ issue: { number: number }; reason?: string | null }>;
  scout?: ScoutStatus | null;
}

export type ViewStageId = "intake" | "type" | "building" | "reviewing" | "merge" | "merged";
export type ViewPlace = ViewStageId | "needs_you";
export type CardState = "running" | "person" | "failed" | "idle";
export interface ViewNeed {
  kind: "merge" | "retry" | "retry_or_dismiss" | "answer" | "approve_spec" | "spec" | "stuck";
  label: string;
}

export interface SessionInfo {
  status: string;
  progress: string | null;
  progressAt: string | null;
  provider: string;
  providerId: string;
  model: string | null;
  workKey: string | null;
}

export interface ViewCard {
  item: FactoryWorkItem;
  place: ViewPlace;
  state: CardState;
  need: ViewNeed | null;
  activity: string;
  since: string;
  pr: FactoryPr | null;
  session: SessionInfo | null;
  sessionId: string | null;
}

export interface ViewPipeline {
  stages: Record<ViewStageId, ViewCard[]>;
  needsYou: ViewCard[];
  needsPerson: number;
  failed: number;
}

export const AREA_LABEL: Record<DiscoveryArea, string> = {
  features: "Features",
  ux: "UI & UX",
  performance: "Performance",
  tech_debt: "Code quality",
  test_gaps: "Test gaps",
  security: "Security",
  bugs: "Bugs",
  docs: "Docs",
};

export function drainText(drain: number | NonNullable<FactoryStatus["drain"]>): string {
  const n = typeof drain === "number" ? drain : drain.inFlight;
  return `Draining (${n} in flight)`;
}

export function cardNumber(w: FactoryWorkItem): string {
  if (w.issue?.number) return `#${w.issue.number}`;
  if (w.pr?.number) return `PR #${w.pr.number}`;
  return `#${String(w.id || "").slice(0, 6)}`;
}

export function stepLabel(step: PipelineStep | string, type: WorkType | null): string {
  switch (step) {
    case "intake": return "Identify type";
    case "queued": return "Waiting for an agent";
    case "reproduce": return "Reproduce";
    case "analyze": return "Analyze feature";
    case "implement": return type === "bug" ? "Create fix" : type === "docs" ? "Implement docs" : "Implement feature";
    case "review": return type === "bug" ? "Review fix" : type === "docs" ? "Checks & Review" : "Review feature";
    case "merge": return "Merge";
    case "done": return "Done";
    case "stopped": return "Stopped";
    default: return String(step || "");
  }
}

export type StoppedKind = "retry" | "stuck" | "merge";
export type StoppedAction = "retry" | "open_pr" | "dismiss" | "none";

export function stoppedKind(w: FactoryWorkItem, _pr?: FactoryPr | null): StoppedKind {
  if (w.stage === "escalated") return "merge";
  if (w.stage === "failed" || w.stage === "reverted") return "retry";
  return "stuck";
}
export function stoppedLabel(w: FactoryWorkItem, _pr?: FactoryPr | null): string {
  return w.reason || w.note || w.stage;
}
export function stoppedAction(w: FactoryWorkItem, _pr?: FactoryPr | null): StoppedAction {
  if (w.stage === "escalated") return "open_pr";
  if (w.stage === "failed" || w.stage === "reverted") return "retry";
  return "none";
}
