import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const VAULT_PATH = process.env.VAULT_PATH || path.join(process.cwd(), '..', 'AI_Employee_Vault');

function parseMarkdownFrontmatter(content: string) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return { frontmatter: {}, body: content };

  const frontmatterStr = frontmatterMatch[1];
  const frontmatter: Record<string, string> = {};
  frontmatterStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      frontmatter[key.trim()] = valueParts.join(':').trim();
    }
  });

  return {
    frontmatter,
    body: content.slice(frontmatterMatch[0].length).trim()
  };
}

function extractEmailDetails(content: string): { to: string; subject: string; body: string } {
  // Use [\s\S] instead of . with s flag for cross-line matching
  const toMatch = content.match(/## To\s*\n([\s\S]+?)(?=\n##|\n---|$)/);
  const subjectMatch = content.match(/## Subject\s*\n([\s\S]+?)(?=\n##|\n---|$)/);
  const bodyMatch = content.match(/## Body\s*\n([\s\S]*?)(?=\n## |\n---|$)/);

  return {
    to: toMatch ? toMatch[1].trim().split('\n')[0] : '',
    subject: subjectMatch ? subjectMatch[1].trim().split('\n')[0] : '',
    body: bodyMatch ? bodyMatch[1].trim() : ''
  };
}

function getFilesFromFolder(folderName: string) {
  const folderPath = path.join(VAULT_PATH, folderName);
  if (!fs.existsSync(folderPath)) return [];

  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const filePath = path.join(folderPath, filename);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseMarkdownFrontmatter(content);

      // Determine type from filename
      let type = 'unknown';
      if (filename.startsWith('EMAIL_')) type = 'email';
      else if (filename.startsWith('WHATSAPP_')) type = 'whatsapp';
      else if (filename.startsWith('TRANSACTION_')) type = 'transaction';
      else if (filename.startsWith('RESPONSE_')) type = 'response';
      else if (filename.startsWith('APPROVAL_')) type = 'approval';
      else if (filename.startsWith('PLAN_')) type = 'plan';

      // Extract subject from filename or content
      let subject = filename
        .replace(/^(EMAIL_|WHATSAPP_|TRANSACTION_|RESPONSE_|APPROVAL_|PLAN_)/, '')
        .replace(/^\d{8}_\d{6}_/, '')
        .replace(/_/g, ' ')
        .replace('.md', '');

      // For response files, extract the actual email details
      const emailDetails = extractEmailDetails(content);
      if (emailDetails.subject) {
        subject = emailDetails.subject;
      }

      return {
        id: filename,
        filename,
        type,
        subject,
        frontmatter,
        preview: body.slice(0, 200),
        fullContent: content,
        emailBody: emailDetails.body,
        emailTo: emailDetails.to || frontmatter.reply_to || '',
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        size: stats.size,
        folder: folderName
      };
    })
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  return files;
}

function getVaultStats() {
  const folders = ['Needs_Action', 'Pending_Approval', 'Approved', 'Rejected', 'Done', 'Failed', 'Briefings', 'Logs'];
  const stats: Record<string, number> = {};

  folders.forEach(folder => {
    const folderPath = path.join(VAULT_PATH, folder);
    if (fs.existsSync(folderPath)) {
      stats[folder] = fs.readdirSync(folderPath).filter(f => f.endsWith('.md') || f.endsWith('.log') || f.endsWith('.json')).length;
    } else {
      stats[folder] = 0;
    }
  });

  return stats;
}

function getRecentLogs() {
  const logsPath = path.join(VAULT_PATH, 'Logs');
  if (!fs.existsSync(logsPath)) return [];

  const logFiles = fs.readdirSync(logsPath)
    .filter(f => f.endsWith('.log') || f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 5);

  const logs: { filename: string; content: string }[] = [];
  logFiles.forEach(file => {
    const content = fs.readFileSync(path.join(logsPath, file), 'utf-8');
    logs.push({
      filename: file,
      content: content.slice(0, 1000)
    });
  });

  return logs;
}

function getBusinessGoals() {
  const goalsPath = path.join(VAULT_PATH, 'Business_Goals.md');
  if (!fs.existsSync(goalsPath)) return null;

  const content = fs.readFileSync(goalsPath, 'utf-8');
  const { frontmatter, body } = parseMarkdownFrontmatter(content);

  // Parse metrics table
  const metricsMatch = body.match(/\|.*Metric.*\|[\s\S]*?\n\n/);
  const metrics: { metric: string; target: string; current: string; alertThreshold: string; status: string }[] = [];
  if (metricsMatch) {
    const lines = metricsMatch[0].split('\n').filter(l => l.startsWith('|') && !l.includes('---'));
    lines.slice(1).forEach(line => {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 5) {
        metrics.push({
          metric: cells[0],
          target: cells[1],
          current: cells[2],
          alertThreshold: cells[3],
          status: cells[4]
        });
      }
    });
  }

  return {
    frontmatter,
    metrics,
    rawContent: body
  };
}

function getBriefings() {
  const briefingsPath = path.join(VAULT_PATH, 'Briefings');
  if (!fs.existsSync(briefingsPath)) return [];

  return fs.readdirSync(briefingsPath)
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const content = fs.readFileSync(path.join(briefingsPath, filename), 'utf-8');
      const { frontmatter, body } = parseMarkdownFrontmatter(content);
      return {
        filename,
        frontmatter,
        preview: body.slice(0, 500),
        date: filename.match(/\d{4}-\d{2}-\d{2}/)?.[0] || ''
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getAccountingData() {
  const accountingPath = path.join(VAULT_PATH, 'Accounting');
  if (!fs.existsSync(accountingPath)) return { transactions: [], summary: null };

  const files = fs.readdirSync(accountingPath).filter(f => f.endsWith('.md'));
  const transactions: { filename: string; frontmatter: Record<string, string>; content: string }[] = [];

  files.forEach(file => {
    const content = fs.readFileSync(path.join(accountingPath, file), 'utf-8');
    const { frontmatter, body } = parseMarkdownFrontmatter(content);
    transactions.push({
      filename: file,
      frontmatter,
      content: body.slice(0, 300)
    });
  });

  return { transactions };
}

function getAllFolders() {
  // Define folder order for workflow clarity
  const folderOrder = [
    'Needs_Action',
    'Pending_Approval',
    'Approved',
    'Rejected',
    'Done',
    'Failed',
    'Briefings',
    'Logs',
    'Accounting',
    'Processing_Instructions'
  ];

  const entries = fs.readdirSync(VAULT_PATH, { withFileTypes: true });
  const folders: { name: string; fileCount: number; lastModified: string; description: string }[] = [];

  const descriptions: Record<string, string> = {
    'Needs_Action': 'Emails & tasks awaiting processing',
    'Pending_Approval': 'Drafts waiting for your approval',
    'Approved': 'Ready to send',
    'Rejected': 'Items you rejected',
    'Done': 'Completed items',
    'Failed': 'Failed processing attempts',
    'Briefings': 'CEO briefings & reports',
    'Logs': 'System audit logs',
    'Accounting': 'Financial records',
    'Processing_Instructions': 'Templates & guidelines'
  };

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const folderPath = path.join(VAULT_PATH, entry.name);
      const stats = fs.statSync(folderPath);
      const files = fs.readdirSync(folderPath);
      const countFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.log') || f.endsWith('.json'));

      folders.push({
        name: entry.name,
        fileCount: countFiles.length,
        lastModified: stats.mtime.toISOString(),
        description: descriptions[entry.name] || ''
      });
    }
  }

  // Sort by predefined order
  return folders.sort((a, b) => {
    const aIndex = folderOrder.indexOf(a.name);
    const bIndex = folderOrder.indexOf(b.name);
    if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function detectFileType(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('ALERT')) return 'ALERT';
  if (n.includes('RESPONSE') || n.includes('EMAIL')) return 'EMAIL';
  if (n.includes('SOCIAL') || n.includes('TWITTER') || n.includes('LINKEDIN') || n.includes('FACEBOOK')) return 'SOCIAL';
  if (n.includes('AUDIT') || n.includes('TASK')) return 'TASK';
  if (n.includes('PAYMENT') || n.includes('INVOICE') || n.includes('XERO')) return 'FINANCE';
  if (n.includes('BRIEFING') || n.includes('SUMMARY')) return 'BRIEFING';
  return 'OTHER';
}

function getFilesFromFolderWithDetails(
  folderName: string,
  options: { page?: number; limit?: number; search?: string; typeFilter?: string } = {}
) {
  const folderPath = path.join(VAULT_PATH, folderName);
  if (!fs.existsSync(folderPath)) return { items: [], total: 0, page: 1, totalPages: 0 };

  const { page = 1, limit = 20, search = '', typeFilter = '' } = options;
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  const items: {
    id: string;
    name: string;
    type: 'folder' | 'file';
    fileType?: string;
    extension?: string;
    size: string;
    modified: string;
    category: string;
    folder: string;
    preview?: string;
    subject?: string;
    sender?: string;
  }[] = [];

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    const stats = fs.statSync(entryPath);

    if (entry.isDirectory()) {
      items.push({
        id: `${folderName}/${entry.name}`,
        name: entry.name,
        type: 'folder',
        size: '-',
        modified: stats.mtime.toISOString(),
        category: folderName.toLowerCase().replace(/_/g, '-'),
        folder: folderName
      });
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.log') || entry.name.endsWith('.json') || entry.name.endsWith('.csv')) {
      const ext = path.extname(entry.name);
      const sizeKb = (stats.size / 1024).toFixed(1);
      const fileType = detectFileType(entry.name);

      // Extract preview info from markdown files
      let preview = '';
      let subject = '';
      let sender = '';
      if (ext === '.md' && stats.size < 50000) {
        try {
          const content = fs.readFileSync(entryPath, 'utf-8');
          const { frontmatter, body } = parseMarkdownFrontmatter(content);
          sender = frontmatter.reply_to || frontmatter.from || '';
          subject = frontmatter.original_subject || frontmatter.subject || '';
          if (!subject) {
            const emailDetails = extractEmailDetails(content);
            subject = emailDetails.subject || '';
          }
          // Also parse **From** / **Subject** bold fields (gmail_watcher table/inline format)
          if (!sender) {
            const m = content.match(/\*\*From\*\*.*?`([^`]+)`/) ||
                      content.match(/\*\*From\*\*[:\s]+([^\n|`]+)/);
            if (m) sender = m[1].trim();
          }
          if (!subject) {
            const m = content.match(/\*\*Subject\*\*.*?`([^`]+)`/) ||
                      content.match(/\*\*Subject\*\*[:\s]+([^\n|`]+)/);
            if (m) subject = m[1].trim();
          }
          preview = body.replace(/#+\s/g, '').replace(/\|.*\|/g, '').replace(/---/g, '').trim().slice(0, 120);
        } catch { /* skip */ }
      }

      // Clean up subject from filename if still empty
      if (!subject) {
        subject = entry.name
          .replace(/^(RESPONSE_|EMAIL_|ALERT_|SOCIAL_|AUDIT_|TASK_)/, '')
          .replace(/^\d{8}_\d{6}_/, '')
          .replace(/_/g, ' ')
          .replace('.md', '')
          .trim();
      }

      items.push({
        id: `${folderName}/${entry.name}`,
        name: entry.name,
        type: 'file',
        fileType,
        extension: ext,
        size: `${sizeKb} KB`,
        modified: stats.mtime.toISOString(),
        category: folderName.toLowerCase().replace(/_/g, '-'),
        folder: folderName,
        preview,
        subject,
        sender
      });
    }
  }

  // Sort newest first
  let sorted = items.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

  // Apply type filter
  if (typeFilter && typeFilter !== 'ALL') {
    sorted = sorted.filter(i => i.fileType === typeFilter || i.type === 'folder');
  }

  // Apply search
  if (search) {
    const q = search.toLowerCase();
    sorted = sorted.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.subject || '').toLowerCase().includes(q) ||
      (i.sender || '').toLowerCase().includes(q) ||
      (i.preview || '').toLowerCase().includes(q)
    );
  }

  const total = sorted.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paginated = sorted.slice(start, start + limit);

  return { items: paginated, total, page, totalPages };
}

function getFileContent(folder: string, filename: string) {
  const filePath = path.join(VAULT_PATH, folder, filename);
  if (!fs.existsSync(filePath)) {
    return { error: 'File not found' };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content };
  } catch (error) {
    return { error: 'Failed to read file' };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'needs_action':
        return NextResponse.json({ items: getFilesFromFolder('Needs_Action') });

      case 'pending_approval':
        return NextResponse.json({ items: getFilesFromFolder('Pending_Approval') });

      case 'done':
        return NextResponse.json({ items: getFilesFromFolder('Done').slice(0, 20) });

      case 'in_progress':
        return NextResponse.json({ items: getFilesFromFolder('In_Progress') });

      case 'stats':
        return NextResponse.json({ stats: getVaultStats() });

      case 'logs':
        return NextResponse.json({ logs: getRecentLogs() });

      case 'business_goals':
        return NextResponse.json({ goals: getBusinessGoals() });

      case 'briefings':
        return NextResponse.json({ briefings: getBriefings() });

      case 'accounting':
        return NextResponse.json(getAccountingData());

      case 'folders':
        return NextResponse.json({ folders: getAllFolders() });

      case 'folder_stats': {
        const folder = searchParams.get('folder');
        if (!folder) return NextResponse.json({ error: 'Folder required' }, { status: 400 });
        const folderPath = path.join(VAULT_PATH, folder);
        if (!fs.existsSync(folderPath)) return NextResponse.json({ count: 0, types: {}, latest: null });
        let files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
        // For Needs_Action, only count actual email files (exclude ALERT, AUDIT, TASK, etc.)
        if (folder === 'Needs_Action') {
          files = files.filter(f => detectFileType(f) === 'EMAIL');
        }
        const types: Record<string, number> = {};
        let latest: { name: string; modified: string; subject: string } | null = null;
        let latestTime = 0;
        for (const f of files) {
          const t = detectFileType(f);
          types[t] = (types[t] || 0) + 1;
          const mtime = fs.statSync(path.join(folderPath, f)).mtimeMs;
          if (mtime > latestTime) {
            latestTime = mtime;
            latest = {
              name: f,
              modified: new Date(mtime).toISOString(),
              subject: f.replace(/^(RESPONSE_|EMAIL_|ALERT_|SOCIAL_)\d{8}_\d{6}_?/, '').replace(/_/g, ' ').replace('.md', '').trim()
            };
          }
        }
        return NextResponse.json({ count: files.length, types, latest });
      }

      case 'folder': {
        const folder = searchParams.get('folder');
        if (!folder) {
          return NextResponse.json({ error: 'Folder parameter required' }, { status: 400 });
        }
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const typeFilter = searchParams.get('type') || '';
        return NextResponse.json(getFilesFromFolderWithDetails(folder, { page, limit, search, typeFilter }));
      }

      case 'file': {
        const folder = searchParams.get('folder');
        const file = searchParams.get('file');
        if (!folder || !file) {
          return NextResponse.json({ error: 'Folder and file parameters required' }, { status: 400 });
        }
        return NextResponse.json(getFileContent(folder, file));
      }

      case 'approved':
        return NextResponse.json({ items: getFilesFromFolder('Approved') });

      case 'rejected':
        return NextResponse.json({ items: getFilesFromFolder('Rejected') });

      case 'failed':
        return NextResponse.json({ items: getFilesFromFolder('Failed') });

      case 'all':
      default:
        return NextResponse.json({
          stats: getVaultStats(),
          needsAction: getFilesFromFolder('Needs_Action').slice(0, 10),
          pendingApproval: getFilesFromFolder('Pending_Approval').slice(0, 10),
          recentDone: getFilesFromFolder('Done').slice(0, 5),
          inProgress: getFilesFromFolder('In_Progress'),
          businessGoals: getBusinessGoals(),
          briefings: getBriefings().slice(0, 3),
          lastUpdated: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('Vault API Error:', error);
    return NextResponse.json({ error: 'Failed to read vault data' }, { status: 500 });
  }
}
