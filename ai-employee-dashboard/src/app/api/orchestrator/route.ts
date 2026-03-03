import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..');
const STATUS_FILE = path.join(PROJECT_ROOT, '.orchestrator_status.json');
const PID_FILE = path.join(PROJECT_ROOT, '.orchestrator.pid');
const IS_WINDOWS = process.platform === 'win32';
// Only Vercel is read-only; HuggingFace Spaces (Docker) can run Python
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

interface OrchestratorStatus {
  running: boolean;
  start_time: string | null;
  uptime_seconds: number;
  watchers: Record<string, { running: boolean }>;
  webhook_server: boolean;
  pending_approvals: number;
  last_update: string;
}

function readStatusFile(): OrchestratorStatus | null {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const content = fs.readFileSync(STATUS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to read status file:', error);
  }
  return null;
}

function savePid(pid: number): void {
  try {
    fs.writeFileSync(PID_FILE, pid.toString());
  } catch (error) {
    console.error('Failed to save PID:', error);
  }
}

function readPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      return parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
    }
  } catch (error) {
    console.error('Failed to read PID:', error);
  }
  return null;
}

function deletePidFile(): void {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    console.error('Failed to delete PID file:', error);
  }
}

async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    if (IS_WINDOWS) {
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" 2>NUL`);
      return stdout.includes(pid.toString());
    } else {
      // On Linux: kill -0 checks if process exists without signaling it
      await execAsync(`kill -0 ${pid} 2>/dev/null`);
      return true;
    }
  } catch {
    return false;
  }
}

async function findOrchestratorProcess(): Promise<number | null> {
  try {
    const targets = ['start_watchers.py', 'gmail_watcher.py', 'ralph_wiggum_loop.py'];

    if (IS_WINDOWS) {
      const { stdout } = await execAsync(
        `wmic process where "name='python.exe' or name='python3.exe'" get processid,commandline 2>NUL`
      );
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (targets.some(t => line.includes(t))) {
          const match = line.match(/(\d+)\s*$/);
          if (match) return parseInt(match[1]);
        }
      }
    } else {
      // On Linux: pgrep -f searches command lines
      const pattern = targets.join('|');
      const { stdout } = await execAsync(
        `pgrep -f "${pattern}" 2>/dev/null || true`
      );
      const pid = parseInt(stdout.trim().split('\n')[0]);
      if (!isNaN(pid)) return pid;
    }
  } catch (error) {
    console.error('Failed to find orchestrator process:', error);
  }
  return null;
}

export async function GET() {
  // Read the status file
  const status = readStatusFile();

  // Check if process is actually running
  let isActuallyRunning = false;
  let pid: number | null = null;

  // First check saved PID
  const savedPid = readPid();
  if (savedPid) {
    isActuallyRunning = await isProcessRunning(savedPid);
    if (isActuallyRunning) {
      pid = savedPid;
    } else {
      deletePidFile();
    }
  }

  // If not found via PID, search for process
  if (!isActuallyRunning) {
    pid = await findOrchestratorProcess();
    isActuallyRunning = pid !== null;
    if (pid) {
      savePid(pid);
    }
  }

  // Calculate uptime
  let uptime = '0s';
  if (status?.start_time) {
    const startTime = new Date(status.start_time);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    if (seconds < 60) {
      uptime = `${seconds}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      uptime = `${mins}m ${seconds % 60}s`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      uptime = `${hours}h ${mins}m`;
    } else {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      uptime = `${days}d ${hours}h`;
    }
  }

  // Count active watchers
  let activeWatchers = 0;
  let totalWatchers = 0;
  if (status?.watchers) {
    totalWatchers = Object.keys(status.watchers).length;
    activeWatchers = Object.values(status.watchers).filter(w => w.running).length;
  }

  return NextResponse.json({
    running: isActuallyRunning && (status?.running ?? false),
    pid,
    startTime: status?.start_time || null,
    uptime,
    uptimeSeconds: status?.uptime_seconds || 0,
    watchers: {
      active: activeWatchers,
      total: totalWatchers,
      details: status?.watchers || {}
    },
    webhookServer: status?.webhook_server || false,
    pendingApprovals: status?.pending_approvals || 0,
    lastUpdate: status?.last_update || null,
    statusFileExists: fs.existsSync(STATUS_FILE)
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action } = body;

  // Vercel can't run Python processes — return a helpful message
  if (IS_VERCEL) {
    return NextResponse.json({
      success: false,
      message: 'The AI Employee backend runs on your local machine or HuggingFace Space — it cannot be started from Vercel.'
    }, { status: 503 });
  }

  if (action === 'start') {
    // Check if already running
    const existingPid = await findOrchestratorProcess();
    if (existingPid) {
      return NextResponse.json({
        success: false,
        message: 'AI Employee is already running',
        pid: existingPid
      }, { status: 400 });
    }

    try {
      const candidates = ['start_watchers.py', 'gmail_watcher.py', 'ralph_wiggum_loop.py'];
      let orchestratorScript: string | null = null;
      for (const c of candidates) {
        const p = path.join(PROJECT_ROOT, c);
        if (fs.existsSync(p)) { orchestratorScript = p; break; }
      }

      if (!orchestratorScript) {
        return NextResponse.json({
          success: false,
          message: `Watcher script not found. Searched in: ${PROJECT_ROOT} (expected start_watchers.py, gmail_watcher.py, or ralph_wiggum_loop.py)`
        }, { status: 404 });
      }

      // Ensure logs directory exists
      const logsDir = path.join(process.env.VAULT_PATH || '/tmp/AI_Employee_Vault', 'Logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Start process — command differs on Windows vs Linux
      let child;
      if (IS_WINDOWS) {
        child = spawn('cmd', ['/c', 'start', '/B', 'python', orchestratorScript], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
      } else {
        child = spawn('python3', [orchestratorScript], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: 'ignore'
        });
      }

      child.unref();

      // Wait a moment for the process to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newPid = await findOrchestratorProcess();

      if (newPid) {
        savePid(newPid);
        return NextResponse.json({
          success: true,
          message: 'AI Employee started successfully',
          pid: newPid
        });
      } else {
        return NextResponse.json({
          success: true,
          message: 'AI Employee start command issued. Please refresh to check status.'
        });
      }

    } catch (error) {
      console.error('Failed to start orchestrator:', error);
      return NextResponse.json({
        success: false,
        message: `Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 500 });
    }

  } else if (action === 'stop') {
    try {
      let pid = readPid();
      if (!pid) pid = await findOrchestratorProcess();

      if (!pid) {
        deletePidFile();
        return NextResponse.json({
          success: false,
          message: 'AI Employee is not running'
        }, { status: 400 });
      }

      if (IS_WINDOWS) {
        await execAsync(`taskkill /PID ${pid} /T /F`);
      } else {
        await execAsync(`kill -TERM ${pid} 2>/dev/null || kill -KILL ${pid} 2>/dev/null || true`);
      }

      deletePidFile();

      if (fs.existsSync(STATUS_FILE)) {
        const status = readStatusFile();
        if (status) {
          status.running = false;
          fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
        }
      }

      return NextResponse.json({
        success: true,
        message: 'AI Employee stopped successfully'
      });

    } catch (error) {
      console.error('Failed to stop orchestrator:', error);
      return NextResponse.json({
        success: false,
        message: `Failed to stop: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 500 });
    }

  } else if (action === 'restart') {
    try {
      const pid = await findOrchestratorProcess();
      if (pid) {
        if (IS_WINDOWS) {
          await execAsync(`taskkill /PID ${pid} /T /F`);
        } else {
          await execAsync(`kill -TERM ${pid} 2>/dev/null || kill -KILL ${pid} 2>/dev/null || true`);
        }
        deletePidFile();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const candidates2 = ['start_watchers.py', 'gmail_watcher.py', 'ralph_wiggum_loop.py'];
      let orchestratorScript2: string | null = null;
      for (const c of candidates2) {
        const p = path.join(PROJECT_ROOT, c);
        if (fs.existsSync(p)) { orchestratorScript2 = p; break; }
      }
      if (!orchestratorScript2) {
        return NextResponse.json({
          success: false,
          message: `Watcher script not found. Searched in: ${PROJECT_ROOT}`
        }, { status: 404 });
      }

      let child2;
      if (IS_WINDOWS) {
        child2 = spawn('cmd', ['/c', 'start', '/B', 'python', orchestratorScript2], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
      } else {
        child2 = spawn('python3', [orchestratorScript2], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: 'ignore'
        });
      }

      child2.unref();
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newPid = await findOrchestratorProcess();
      if (newPid) savePid(newPid);

      return NextResponse.json({
        success: true,
        message: 'AI Employee restarted successfully',
        pid: newPid
      });

    } catch (error) {
      console.error('Failed to restart orchestrator:', error);
      return NextResponse.json({
        success: false,
        message: `Failed to restart: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 500 });
    }

  } else {
    return NextResponse.json({
      success: false,
      message: 'Invalid action. Use: start, stop, or restart'
    }, { status: 400 });
  }
}
