// Vault file and folder types
export interface VaultItem {
  id: string;
  filename: string;
  type: 'email' | 'whatsapp' | 'transaction' | 'response' | 'approval' | 'plan' | 'briefing' | 'unknown';
  subject: string;
  frontmatter: Record<string, string>;
  preview: string;
  createdAt: string;
  modifiedAt: string;
  size: number;
  folder?: string;
}

export interface VaultFolder {
  name: string;
  path: string;
  fileCount: number;
  lastModified: string;
}

export interface VaultStats {
  Needs_Action: number;
  Pending_Approval: number;
  Done: number;
  In_Progress: number;
  Approved: number;
  Rejected: number;
  Failed: number;
  Inbox: number;
  Briefings: number;
  [key: string]: number;
}

export interface VaultAllData {
  stats: VaultStats;
  needsAction: VaultItem[];
  pendingApproval: VaultItem[];
  recentDone: VaultItem[];
  inProgress: VaultItem[];
  businessGoals: BusinessGoals | null;
  briefings: Briefing[];
  lastUpdated: string;
}

// Watcher types
export type WatcherType =
  | 'gmail'
  | 'whatsapp'
  | 'finance'
  | 'filesystem'
  | 'linkedin'
  | 'social_media'
  | 'xero'
  | 'odoo'
  | 'ralph_wiggum'
  | 'notification'
  | 'approval'
  | 'scheduler';

export interface WatcherStatus {
  name: string;
  type: WatcherType;
  status: 'active' | 'inactive' | 'error' | 'unknown';
  lastCheck: string | null;
  itemsProcessed: number;
  description: string;
  pid?: number;
  restartCount?: number;
}

export interface WatchdogStatus {
  timestamp: string;
  running: boolean;
  processes: Record<string, {
    name: string;
    status: string;
    pid: number | null;
    is_running: boolean;
    restart_count: number;
    can_restart: boolean;
    last_health_check: string | null;
  }>;
}

export interface WatchersResponse {
  watchers: WatcherStatus[];
  systemStatus: {
    pythonAvailable: boolean;
    orchestratorRunning: boolean;
    pendingApprovals: number;
    webhookServer: boolean;
    lastUpdate: string | null;
    timestamp: string;
  };
}

// Orchestrator status types
export interface OrchestratorStatus {
  running: boolean;
  pid: number | null;
  startTime: string | null;
  uptime: string;
  uptimeSeconds: number;
  watchers: {
    active: number;
    total: number;
    details: Record<string, { running: boolean }>;
  };
  webhookServer: boolean;
  pendingApprovals: number;
  lastUpdate: string | null;
  statusFileExists: boolean;
}

// Audit log types
export interface AuditEntry {
  timestamp: string;
  action: string;
  type: string;
  details: string;
  filename?: string;
}

export interface AuditLog {
  date: string;
  entries: AuditEntry[];
}

// Briefing types
export interface Briefing {
  id: string;
  filename: string;
  date: string;
  frontmatter: Record<string, string>;
  preview: string;
  content?: string;
}

export interface BriefingGenerateRequest {
  lookbackDays?: number;
  template?: 'daily' | 'weekly' | 'monthly';
}

export interface BriefingGenerateResponse {
  success: boolean;
  filename?: string;
  content?: string;
  error?: string;
}

// Business goals types
export interface BusinessMetric {
  metric: string;
  target: string;
  current: string;
  alertThreshold: string;
  status: string;
}

export interface BusinessGoals {
  frontmatter: Record<string, string>;
  metrics: BusinessMetric[];
  rawContent: string;
}

// API response types
export interface VaultMoveRequest {
  filename: string;
  fromFolder: string;
  toFolder: string;
  updateFrontmatter?: boolean;
}

export interface VaultMoveResponse {
  success: boolean;
  message: string;
  newPath?: string;
  error?: string;
  execution?: {
    triggered?: boolean;
    emailSent?: boolean;
  };
}

export interface LogsResponse {
  logs: AuditLog[];
  totalEntries: number;
}

// Team member type for AI Employee
export interface AIEmployeeStatus {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'busy';
  tasksCompleted: number;
  tasksPending: number;
  tasksInProgress: number;
  lastActive: string;
  watchersActive: number;
  watchersTotal: number;
  capabilities: string[];
}
