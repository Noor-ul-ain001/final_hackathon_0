import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const VAULT_PATH = process.env.VAULT_PATH || path.join(process.cwd(), '..', 'AI_Employee_Vault');
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..');
const PENDING_DIR = path.join(VAULT_PATH, 'Pending_Approval');
const APPROVED_DIR = path.join(VAULT_PATH, 'Approved');
const REJECTED_DIR = path.join(VAULT_PATH, 'Rejected');
const DONE_DIR = path.join(VAULT_PATH, 'Done');
const LOGS_DIR = path.join(VAULT_PATH, 'Logs');

interface ApprovalItem {
  code: string;
  filename: string;
  type: string;
  summary: string;
  created: string;
  preview?: string;
  metadata?: Record<string, string>;
}

interface ApprovalStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  completedToday: number;
}

function generateCode(filename: string): string {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const hash = crypto.createHash('md5').update(`${filename}_${today}`).digest('hex');
  return hash.substring(0, 4).toUpperCase();
}

function parseYamlFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const metadata: Record<string, string> = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      metadata[key] = value;
    }
  }

  return metadata;
}

function determineType(filename: string, metadata: Record<string, string>): string {
  const lower = filename.toLowerCase();

  if (lower.includes('email') || lower.includes('response')) return 'EMAIL';
  if (lower.includes('linkedin')) return 'LINKEDIN';
  if (lower.includes('twitter') || lower.includes('tweet')) return 'TWITTER';
  if (lower.includes('facebook')) return 'FACEBOOK';
  if (lower.includes('instagram')) return 'INSTAGRAM';
  if (lower.includes('social') || lower.includes('post')) return 'SOCIAL';
  if (lower.includes('payment')) return 'PAYMENT';
  if (lower.includes('invoice')) return 'INVOICE';

  return metadata.type?.toUpperCase() || 'ACTION';
}

function createSummary(metadata: Record<string, string>, type: string): string {
  if (type === 'EMAIL') {
    const to = metadata.reply_to || metadata.to || 'unknown';
    const subject = metadata.original_subject || metadata.subject || 'No subject';
    return `Email to ${to.substring(0, 25)}... - ${subject.substring(0, 30)}`;
  }

  if (['LINKEDIN', 'TWITTER', 'FACEBOOK', 'INSTAGRAM', 'SOCIAL'].includes(type)) {
    const platform = metadata.platform || type.toLowerCase();
    return `${platform.charAt(0).toUpperCase() + platform.slice(1)} post`;
  }

  if (type === 'PAYMENT') {
    return `Payment $${metadata.amount || '?'} to ${metadata.recipient || 'unknown'}`;
  }

  return metadata.type || 'Action pending';
}

function getPreview(content: string): string {
  // Remove frontmatter and get first 200 chars of content
  const parts = content.split('---');
  const body = parts.length > 2 ? parts.slice(2).join('---').trim() : content;
  return body.substring(0, 200);
}

function ensureDirectories() {
  [PENDING_DIR, APPROVED_DIR, REJECTED_DIR, DONE_DIR, LOGS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function getPendingApprovals(): ApprovalItem[] {
  ensureDirectories();

  const items: ApprovalItem[] = [];

  if (!fs.existsSync(PENDING_DIR)) return items;

  const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.md'));

  for (const filename of files) {
    try {
      const filepath = path.join(PENDING_DIR, filename);
      const stat = fs.statSync(filepath);
      const content = fs.readFileSync(filepath, 'utf-8');
      const metadata = parseYamlFrontmatter(content);
      const type = determineType(filename, metadata);

      items.push({
        code: generateCode(filename),
        filename,
        type,
        summary: createSummary(metadata, type),
        created: stat.ctime.toISOString(),
        preview: getPreview(content),
        metadata
      });
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
    }
  }

  // Sort by creation time (newest first)
  items.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

  return items;
}

function getStats(): ApprovalStats {
  ensureDirectories();

  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(LOGS_DIR, `approvals_${today}.json`);

  let approvedToday = 0;
  let rejectedToday = 0;

  if (fs.existsSync(logFile)) {
    try {
      const logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
      for (const entry of logs) {
        if (entry.action === 'approve') approvedToday++;
        if (entry.action === 'reject') rejectedToday++;
      }
    } catch (error) {
      console.error('Error reading log file:', error);
    }
  }

  // Count completed items today
  let completedToday = 0;
  if (fs.existsSync(DONE_DIR)) {
    const doneFiles = fs.readdirSync(DONE_DIR).filter(f => f.endsWith('.md'));
    for (const filename of doneFiles) {
      try {
        const stat = fs.statSync(path.join(DONE_DIR, filename));
        if (stat.mtime.toISOString().startsWith(today)) {
          completedToday++;
        }
      } catch {}
    }
  }

  return {
    pending: getPendingApprovals().length,
    approvedToday,
    rejectedToday,
    completedToday
  };
}

function logAction(action: string, code: string, filename: string, actor: string = 'dashboard') {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(LOGS_DIR, `approvals_${today}.json`);

  const entry = {
    timestamp: new Date().toISOString(),
    action,
    code,
    filename,
    actor
  };

  try {
    let logs = [];
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
    }
    logs.push(entry);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error writing log:', error);
  }
}

// GET - List pending approvals and stats
export async function GET() {
  try {
    const approvals = getPendingApprovals();
    const stats = getStats();

    return NextResponse.json({
      approvals,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get approvals', details: String(error) },
      { status: 500 }
    );
  }
}

// Trigger action_executor.py to process a specific file in Approved folder
async function triggerActionExecutor(filename: string): Promise<{ executed: boolean; message: string; emailSent?: boolean }> {
  const executorPath = path.join(PROJECT_ROOT, 'action_executor.py');
  if (!fs.existsSync(executorPath)) {
    return { executed: false, message: 'action_executor.py not found' };
  }

  try {
    const { stdout, stderr } = await execAsync(
      `python "${executorPath}" --vault "${VAULT_PATH}" --once`,
      { cwd: PROJECT_ROOT, timeout: 30000 }
    );
    const output = stdout + stderr;
    const emailSent = output.includes('Email sent') || output.includes('email sent');
    return {
      executed: true,
      message: emailSent ? 'Email sent successfully' : 'Action processed',
      emailSent
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { executed: false, message: msg };
  }
}

// POST - Approve or reject an item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, action } = body;

    if (!code || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request. Provide code and action (approve/reject)' },
        { status: 400 }
      );
    }

    // Find file by code
    const approvals = getPendingApprovals();
    const item = approvals.find(a => a.code === code.toUpperCase());

    if (!item) {
      return NextResponse.json(
        { error: `No pending approval found for code: ${code}` },
        { status: 404 }
      );
    }

    const sourcePath = path.join(PENDING_DIR, item.filename);
    const destDir = action === 'approve' ? APPROVED_DIR : REJECTED_DIR;
    const destPath = path.join(destDir, item.filename);

    // Read content and add approval note
    let content = fs.readFileSync(sourcePath, 'utf-8');
    const note = `\n\n---\n*${action === 'approve' ? 'Approved' : 'Rejected'} via dashboard at ${new Date().toISOString()}*\n`;
    content += note;

    // Write to destination and delete source
    fs.writeFileSync(destPath, content);
    fs.unlinkSync(sourcePath);

    // Log the action
    logAction(action, code.toUpperCase(), item.filename);

    // If approved, trigger action executor to send immediately
    let executionResult = null;
    if (action === 'approve') {
      executionResult = await triggerActionExecutor(item.filename);
    }

    return NextResponse.json({
      success: true,
      action,
      code: code.toUpperCase(),
      filename: item.filename,
      message: `${item.type} ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      execution: executionResult
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process approval', details: String(error) },
      { status: 500 }
    );
  }
}
