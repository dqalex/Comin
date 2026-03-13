// ============== OpenClaw Gateway Protocol v3 Types ==============
// 对齐 openclaw-reference 真实数据结构

// --- Cron ---
export interface CronSchedule {
  kind: 'every' | 'at' | 'cron';
  everyMs?: number;
  anchorMs?: number;
  at?: string;
  expr?: string;
  tz?: string;
}

export interface CronPayload {
  kind: 'agentTurn' | 'systemEvent';
  text?: string;
  message?: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
  deliver?: boolean;
  channel?: string;
  to?: string;
  bestEffortDeliver?: boolean;
  allowUnsafeExternalContent?: boolean;
}

export interface CronDelivery {
  mode: 'none' | 'announce' | 'webhook';
  channel?: string;
  to?: string;
  bestEffort?: boolean;
}

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: 'ok' | 'error' | 'skipped';
  lastError?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
}

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  agentId?: string;
  sessionKey?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'next-heartbeat' | 'now';
  payload: CronPayload;
  delivery?: CronDelivery;
  state: CronJobState;
}

export interface CronRunLogEntry {
  ts: number;
  jobId: string;
  action: 'finished';
  status?: 'ok' | 'error' | 'skipped';
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
}

export interface CronStatus {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs: number;
}

// --- Agents (from agents.list) ---
export interface AgentIdentity {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
}

export interface GatewayAgentRow {
  id: string;
  name?: string;
  identity?: AgentIdentity;
}

// --- Agent Health (from health RPC) ---
export interface HeartbeatSummary {
  enabled: boolean;
  every: string;
  everyMs: number | null;
  prompt: string;
  target: string;
  model?: string;
  ackMaxChars: number;
}

export interface AgentHealthSummary {
  agentId: string;
  name?: string;
  isDefault: boolean;
  heartbeat: HeartbeatSummary;
  sessions: {
    path: string;
    count: number;
    recent: { key: string; updatedAt: number | null; age: number | null }[];
  };
}

export interface ChannelAccountHealthSummary {
  accountId: string;
  configured?: boolean;
  linked?: boolean;
  authAgeMs?: number | null;
  probe?: unknown;
  lastProbeAt?: number | null;
  [key: string]: unknown;
}

export interface ChannelHealthSummary extends ChannelAccountHealthSummary {
  accounts?: Record<string, ChannelAccountHealthSummary>;
}

export interface HealthSummary {
  ok: true;
  ts: number;
  durationMs: number;
  channels: Record<string, ChannelHealthSummary>;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  heartbeatSeconds: number;
  defaultAgentId: string;
  agents: AgentHealthSummary[];
  sessions: {
    path: string;
    count: number;
    recent: { key: string; updatedAt: number | null; age: number | null }[];
  };
}

// --- Sessions (from sessions.list) ---
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
export type VerboseLevel = 'inherit' | 'off' | 'on' | 'full';
export type ReasoningLevel = 'off' | 'on' | 'stream';
export type SessionKind = 'direct' | 'group' | 'global' | 'unknown';

export interface Session {
  key: string;
  kind: SessionKind;
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  channel?: string;
  updatedAt: number | null;
  sessionId?: string;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  modelProvider?: string;
  model?: string;
  sendPolicy?: 'allow' | 'deny';
}

// --- Skills (from skills.status) ---
export interface SkillInstallOption {
  id: string;
  kind: 'brew' | 'node' | 'go' | 'uv' | 'download';
  label: string;
  bins: string[];
}

export interface Skill {
  name: string;
  description: string;
  source: string;
  bundled: boolean;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: { bins: string[]; anyBins: string[]; env: string[] };
  missing: { bins: string[]; anyBins: string[]; env: string[] };
  install: SkillInstallOption[];
}

// --- Snapshot (from snapshot.get) ---
export interface PresenceEntry {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;
  lastInputSeconds?: number;
  reason?: string;
  tags?: string[];
  text?: string;
  ts: number;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  instanceId?: string;
}

export interface Snapshot {
  presence: PresenceEntry[];
  health: HealthSummary | null;
  stateVersion: { presence: number; health: number };
  uptimeMs: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: { defaultAgentId: string; mainKey: string; mainSessionKey: string; scope?: string };
  authMode?: 'none' | 'token' | 'password' | 'trusted-proxy';
  policy?: { maxPayload?: number; maxBufferedBytes?: number; tickIntervalMs?: number };
}

/** hello-ok 握手响应中的完整 payload */
export interface HelloOkPayload {
  type: 'hello-ok';
  protocol?: number;
  server?: { name?: string; version?: string };
  snapshot?: Snapshot;
  policy?: { maxPayload?: number; maxBufferedBytes?: number; tickIntervalMs?: number };
}

// --- Chat Event (from Gateway WebSocket) ---
export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
}

// --- Chat Attachment ---
export interface ChatAttachment {
  id: string;
  dataUrl: string;
  mimeType: string;
}

// ============== Local Data Types ==============

export type TaskStatus = 'todo' | 'in_progress' | 'reviewing' | 'completed';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string;
  assignees: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
