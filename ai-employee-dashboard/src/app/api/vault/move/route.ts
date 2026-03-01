import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const VAULT_PATH = process.env.VAULT_PATH || path.join(process.cwd(), '..', 'AI_Employee_Vault');
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..');

interface MoveRequest {
  filename: string;
  fromFolder: string;
  toFolder: string;
  updateFrontmatter?: boolean;
}

function updateFileFrontmatter(filePath: string, updates: Record<string, string>): string {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if file has frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    // Add frontmatter if none exists
    const frontmatter = Object.entries(updates)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    return `---\n${frontmatter}\n---\n\n${content}`;
  }

  // Update existing frontmatter
  let frontmatterStr = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length).trim();

  for (const [key, value] of Object.entries(updates)) {
    const keyRegex = new RegExp(`^${key}:.*$`, 'm');
    if (keyRegex.test(frontmatterStr)) {
      frontmatterStr = frontmatterStr.replace(keyRegex, `${key}: ${value}`);
    } else {
      frontmatterStr += `\n${key}: ${value}`;
    }
  }

  return `---\n${frontmatterStr}\n---\n\n${body}`;
}

export async function POST(request: Request) {
  try {
    const body: MoveRequest = await request.json();
    const { filename, fromFolder, toFolder, updateFrontmatter = true } = body;

    // Validate input
    if (!filename || !fromFolder || !toFolder) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: filename, fromFolder, toFolder' },
        { status: 400 }
      );
    }

    // Construct paths
    const sourcePath = path.join(VAULT_PATH, fromFolder, filename);
    const destFolder = path.join(VAULT_PATH, toFolder);
    const destPath = path.join(destFolder, filename);

    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json(
        { success: false, error: `Source file not found: ${sourcePath}` },
        { status: 404 }
      );
    }

    // Ensure destination folder exists
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    // Check if destination file already exists
    if (fs.existsSync(destPath)) {
      return NextResponse.json(
        { success: false, error: `Destination file already exists: ${destPath}` },
        { status: 409 }
      );
    }

    // Update frontmatter if requested
    if (updateFrontmatter && filename.endsWith('.md')) {
      const timestamp = new Date().toISOString();
      const updates: Record<string, string> = {
        moved_from: fromFolder,
        moved_to: toFolder,
        moved_at: timestamp,
      };

      // Add status based on destination folder
      if (toFolder === 'Approved') {
        updates.status = 'approved';
        updates.approved_at = timestamp;
      } else if (toFolder === 'Rejected') {
        updates.status = 'rejected';
        updates.rejected_at = timestamp;
      } else if (toFolder === 'Done') {
        updates.status = 'done';
        updates.completed_at = timestamp;
      } else if (toFolder === 'Failed') {
        updates.status = 'failed';
        updates.failed_at = timestamp;
      }

      const updatedContent = updateFileFrontmatter(sourcePath, updates);
      fs.writeFileSync(destPath, updatedContent);
      fs.unlinkSync(sourcePath);
    } else {
      // Simple move without frontmatter update
      fs.renameSync(sourcePath, destPath);
    }

    // If moved to Approved, trigger action executor to send immediately
    let execution = null;
    if (toFolder === 'Approved') {
      const executorPath = path.join(PROJECT_ROOT, 'action_executor.py');
      if (fs.existsSync(executorPath)) {
        try {
          const { stdout, stderr } = await execAsync(
            `python "${executorPath}" --vault "${VAULT_PATH}" --once`,
            { cwd: PROJECT_ROOT, timeout: 30000 }
          );
          const output = stdout + stderr;
          execution = { triggered: true, emailSent: output.includes('Email sent') };
        } catch {
          execution = { triggered: false };
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `File moved from ${fromFolder} to ${toFolder}`,
      newPath: destPath,
      execution,
    });

  } catch (error) {
    console.error('Vault move error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to move file'
      },
      { status: 500 }
    );
  }
}
