import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..');
const VAULT_PATH = path.join(PROJECT_ROOT, 'AI_Employee_Vault');
const ORCHESTRATOR_STATUS_FILE = path.join(PROJECT_ROOT, '.orchestrator_status.json');

type WatcherType = 'gmail' | 'whatsapp' | 'finance' | 'filesystem' | 'linkedin' | 'social_media' | 'xero' | 'odoo' | 'ralph_wiggum' | 'notification' | 'approval' | 'scheduler';

interface WatcherStatus {
  name: string;
  type: WatcherType;
  status: 'active' | 'inactive' | 'error' | 'unknown';
  lastCheck: string | null;
  itemsProcessed: number;
  description: string;
  pid?: number;
  restartCount?: number;
}

interface WatchdogStatusFile {
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

interface OrchestratorStatusFile {
  running: boolean;
  start_time: string | null;
  uptime_seconds: number;
  watchers: Record<string, { running: boolean }>;
  webhook_server: boolean;
  pending_approvals: number;
  last_update: string;
}

async function checkProcessRunning(processName: string): Promise<boolean> {
  try {
    // Windows command to check if process is running
    const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${processName}" 2>NUL`);
    return stdout.toLowerCase().includes(processName.toLowerCase());
  } catch {
    return false;
  }
}

function readWatchdogStatus(): WatchdogStatusFile | null {
  const statusFile = path.join(VAULT_PATH, '.watchdog_status.json');
  try {
    if (fs.existsSync(statusFile)) {
      const content = fs.readFileSync(statusFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to read watchdog status:', error);
  }
  return null;
}

function readOrchestratorStatus(): OrchestratorStatusFile | null {
  try {
    if (fs.existsSync(ORCHESTRATOR_STATUS_FILE)) {
      const content = fs.readFileSync(ORCHESTRATOR_STATUS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to read orchestrator status:', error);
  }
  return null;
}

function mapProcessToWatcher(name: string, processInfo: WatchdogStatusFile['processes'][string]): WatcherStatus {
  // Map process names to watcher types
  const typeMap: Record<string, WatcherType> = {
    'gmail_watcher': 'gmail',
    'gmail': 'gmail',
    'filesystem_watcher': 'filesystem',
    'filesystem': 'filesystem',
    'linkedin_watcher': 'linkedin',
    'linkedin': 'linkedin',
    'xero_watcher': 'xero',
    'xero': 'xero',
    'social_media_watcher': 'social_media',
    'social_media': 'social_media',
    'odoo_watcher': 'odoo',
    'odoo': 'odoo',
    'ralph_wiggum': 'ralph_wiggum',
    'ralph_wiggum_loop': 'ralph_wiggum',
    'whatsapp_keywords': 'whatsapp',
    'whatsapp_keyword_watcher': 'whatsapp',
    'notification_service': 'notification',
    'approval_executor': 'approval',
    'scheduler': 'scheduler',
  };

  const descriptionMap: Record<string, string> = {
    'gmail_watcher': 'Monitors Gmail inbox for new emails',
    'gmail': 'Monitors Gmail inbox for new emails',
    'filesystem_watcher': 'Monitors vault folders for new files',
    'filesystem': 'Monitors vault folders for new files',
    'linkedin_watcher': 'Manages LinkedIn posts and engagement',
    'linkedin': 'Manages LinkedIn posts and engagement',
    'xero_watcher': 'Tracks Xero accounting transactions',
    'xero': 'Tracks Xero accounting transactions',
    'social_media_watcher': 'Monitors social media engagement',
    'social_media': 'Monitors social media engagement',
    'odoo_watcher': 'Odoo ERP accounting integration',
    'odoo': 'Odoo ERP accounting integration',
    'ralph_wiggum': 'Autonomous multi-step task execution',
    'ralph_wiggum_loop': 'Autonomous multi-step task execution',
    'whatsapp_keywords': 'Monitors WhatsApp for urgent keywords',
    'whatsapp_keyword_watcher': 'Monitors WhatsApp for urgent keywords',
    'notification_service': 'Sends notifications for pending approvals',
    'approval_executor': 'Processes approved action items',
    'scheduler': 'Runs scheduled tasks (CEO Briefing, etc.)',
  };

  const displayNameMap: Record<string, string> = {
    'gmail_watcher': 'Gmail Watcher',
    'gmail': 'Gmail Watcher',
    'filesystem_watcher': 'File System Watcher',
    'filesystem': 'File System Watcher',
    'linkedin_watcher': 'LinkedIn Watcher',
    'linkedin': 'LinkedIn Watcher',
    'xero_watcher': 'Xero Watcher',
    'xero': 'Xero Watcher',
    'social_media_watcher': 'Social Media Watcher',
    'social_media': 'Social Media Watcher',
    'odoo_watcher': 'Odoo Accounting',
    'odoo': 'Odoo Accounting',
    'ralph_wiggum': 'Ralph Wiggum Loop',
    'ralph_wiggum_loop': 'Ralph Wiggum Loop',
    'whatsapp_keywords': 'WhatsApp Keywords',
    'whatsapp_keyword_watcher': 'WhatsApp Keywords',
    'notification_service': 'Notification Service',
    'approval_executor': 'Approval Executor',
    'scheduler': 'Task Scheduler',
  };

  const type = typeMap[name] || 'filesystem';
  let status: WatcherStatus['status'] = 'inactive';

  if (processInfo.is_running) {
    status = 'active';
  } else if (processInfo.status === 'error' || processInfo.status === 'crashed') {
    status = 'error';
  }

  return {
    name: displayNameMap[name] || processInfo.name || name,
    type,
    status,
    lastCheck: processInfo.last_health_check,
    itemsProcessed: 0,
    description: descriptionMap[name] || `Monitors ${name.replace(/_/g, ' ')}`,
    pid: processInfo.pid || undefined,
    restartCount: processInfo.restart_count,
  };
}

function mapOrchestratorWatcher(name: string, info: { running: boolean }): WatcherStatus {
  const typeMap: Record<string, WatcherType> = {
    'gmail': 'gmail',
    'filesystem': 'filesystem',
    'linkedin': 'linkedin',
    'xero': 'xero',
    'social_media': 'social_media',
    'odoo': 'odoo',
    'ralph_wiggum': 'ralph_wiggum',
    'whatsapp_keywords': 'whatsapp',
    'notification_service': 'notification',
    'approval_executor': 'approval',
    'scheduler': 'scheduler',
  };

  const descriptionMap: Record<string, string> = {
    'gmail': 'Monitors Gmail inbox for new emails',
    'filesystem': 'Monitors vault folders for new files',
    'linkedin': 'Manages LinkedIn posts and engagement',
    'xero': 'Tracks Xero accounting transactions',
    'social_media': 'Monitors social media engagement',
    'odoo': 'Odoo ERP accounting integration',
    'ralph_wiggum': 'Autonomous multi-step task execution',
    'whatsapp_keywords': 'Monitors WhatsApp for urgent keywords',
    'notification_service': 'Sends notifications for pending approvals',
    'approval_executor': 'Processes approved action items',
    'scheduler': 'Runs scheduled tasks (CEO Briefing, etc.)',
  };

  const displayNameMap: Record<string, string> = {
    'gmail': 'Gmail Watcher',
    'filesystem': 'File System Watcher',
    'linkedin': 'LinkedIn Watcher',
    'xero': 'Xero Watcher',
    'social_media': 'Social Media Watcher',
    'odoo': 'Odoo Accounting',
    'ralph_wiggum': 'Ralph Wiggum Loop',
    'whatsapp_keywords': 'WhatsApp Keywords',
    'notification_service': 'Notification Service',
    'approval_executor': 'Approval Executor',
    'scheduler': 'Task Scheduler',
  };

  return {
    name: displayNameMap[name] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    type: typeMap[name] || 'filesystem',
    status: info.running ? 'active' : 'inactive',
    lastCheck: new Date().toISOString(),
    itemsProcessed: 0,
    description: descriptionMap[name] || `Component: ${name}`,
  };
}

export async function GET() {
  // Check for running watcher processes
  const pythonRunning = await checkProcessRunning('python.exe');

  // Try to read orchestrator status file first (primary source)
  const orchestratorStatus = readOrchestratorStatus();

  // Also try watchdog status file as fallback
  const watchdogStatus = readWatchdogStatus();

  let watchers: WatcherStatus[];
  let orchestratorRunning = false;

  if (orchestratorStatus && orchestratorStatus.watchers) {
    // Use real data from orchestrator status file (preferred)
    orchestratorRunning = orchestratorStatus.running;
    watchers = Object.entries(orchestratorStatus.watchers).map(([name, info]) =>
      mapOrchestratorWatcher(name, info)
    );

    // If no watchers from orchestrator, try watchdog
    if (watchers.length === 0 && watchdogStatus?.processes) {
      watchers = Object.entries(watchdogStatus.processes).map(([name, info]) =>
        mapProcessToWatcher(name, info)
      );
    }

    // If still no watchers, use defaults
    if (watchers.length === 0) {
      watchers = getDefaultWatchers(pythonRunning);
    }
  } else if (watchdogStatus && watchdogStatus.processes) {
    // Fallback to watchdog status file
    orchestratorRunning = watchdogStatus.running;
    watchers = Object.entries(watchdogStatus.processes).map(([name, info]) =>
      mapProcessToWatcher(name, info)
    );

    if (watchers.length === 0) {
      watchers = getDefaultWatchers(pythonRunning);
    }
  } else {
    // Fallback to default watchers based on python running status
    watchers = getDefaultWatchers(pythonRunning);
  }

  // Count processed items from Done folder for rough estimate
  const doneFolder = path.join(VAULT_PATH, 'Done');
  let totalProcessed = 0;
  if (fs.existsSync(doneFolder)) {
    try {
      totalProcessed = fs.readdirSync(doneFolder).filter(f => f.endsWith('.md')).length;
    } catch {
      // Ignore errors reading folder
    }
  }

  // Distribute processed count roughly among active watchers
  const activeWatchers = watchers.filter(w => w.status === 'active');
  if (activeWatchers.length > 0) {
    const perWatcher = Math.floor(totalProcessed / activeWatchers.length);
    activeWatchers.forEach(w => {
      w.itemsProcessed = perWatcher;
    });
  }

  return NextResponse.json({
    watchers,
    systemStatus: {
      pythonAvailable: pythonRunning,
      orchestratorRunning,
      pendingApprovals: orchestratorStatus?.pending_approvals || 0,
      webhookServer: orchestratorStatus?.webhook_server || false,
      lastUpdate: orchestratorStatus?.last_update || null,
      timestamp: new Date().toISOString()
    }
  });
}

function getDefaultWatchers(pythonRunning: boolean): WatcherStatus[] {
  return [
    {
      name: 'Gmail Watcher',
      type: 'gmail',
      status: pythonRunning ? 'active' : 'inactive',
      lastCheck: pythonRunning ? new Date().toISOString() : null,
      itemsProcessed: 0,
      description: 'Monitors Gmail inbox for new emails'
    },
    {
      name: 'File System Watcher',
      type: 'filesystem',
      status: pythonRunning ? 'active' : 'inactive',
      lastCheck: pythonRunning ? new Date().toISOString() : null,
      itemsProcessed: 0,
      description: 'Monitors vault folders for new files'
    },
    {
      name: 'LinkedIn Watcher',
      type: 'linkedin',
      status: 'inactive',
      lastCheck: null,
      itemsProcessed: 0,
      description: 'Manages LinkedIn posts and engagement'
    },
    {
      name: 'Odoo Accounting',
      type: 'odoo',
      status: 'inactive',
      lastCheck: null,
      itemsProcessed: 0,
      description: 'Odoo ERP accounting integration'
    },
    {
      name: 'Social Media Watcher',
      type: 'social_media',
      status: 'inactive',
      lastCheck: null,
      itemsProcessed: 0,
      description: 'Monitors social media engagement'
    },
    {
      name: 'Ralph Wiggum Loop',
      type: 'ralph_wiggum',
      status: 'inactive',
      lastCheck: null,
      itemsProcessed: 0,
      description: 'Autonomous multi-step task execution'
    },
    {
      name: 'WhatsApp Keywords',
      type: 'whatsapp',
      status: 'inactive',
      lastCheck: null,
      itemsProcessed: 0,
      description: 'Monitors WhatsApp for urgent keywords'
    }
  ];
}
