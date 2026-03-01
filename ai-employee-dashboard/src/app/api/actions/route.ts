import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..');
const VAULT_PATH = path.join(PROJECT_ROOT, 'AI_Employee_Vault');

// Email templates for different scenarios
const EMAIL_TEMPLATES = {
  reply: {
    professional: `Dear {recipient},

Thank you for your email regarding {subject}.

{body}

Please let me know if you have any questions or need further clarification.

Best regards,
{sender}`,
    friendly: `Hi {recipient},

Thanks for reaching out about {subject}!

{body}

Let me know if there's anything else I can help with.

Cheers,
{sender}`,
    formal: `Dear {recipient},

I am writing in response to your inquiry about {subject}.

{body}

Should you require any additional information, please do not hesitate to contact me.

Sincerely,
{sender}`
  },
  followup: {
    gentle: `Hi {recipient},

I wanted to follow up on our previous conversation about {subject}.

{body}

Looking forward to hearing from you.

Best,
{sender}`,
    urgent: `Hi {recipient},

I'm following up on {subject} as this matter requires attention.

{body}

Please respond at your earliest convenience.

Thank you,
{sender}`
  },
  introduction: {
    standard: `Hi {recipient},

I hope this email finds you well.

{body}

I would love to schedule a call to discuss how we can work together.

Best regards,
{sender}`
  }
};

// Generate email draft
function generateEmailDraft(params: {
  type: string;
  style: string;
  recipient: string;
  subject: string;
  context: string;
  sender?: string;
}): string {
  const { type, style, recipient, subject, context, sender = '[Your Name]' } = params;

  const templateCategory = EMAIL_TEMPLATES[type as keyof typeof EMAIL_TEMPLATES] || EMAIL_TEMPLATES.reply;
  const templateValues = Object.values(templateCategory);
  const styleKey = style as string;

  // Get template by style or fallback to first available
  let template: string;
  if (styleKey in templateCategory) {
    template = (templateCategory as Record<string, string>)[styleKey];
  } else {
    template = templateValues[0];
  }

  // Generate body based on context
  let body = context;
  if (!body) {
    body = `I wanted to address your points and provide some additional information.

[Your detailed response here]

I believe this approach will help achieve your goals effectively.`;
  }

  return template
    .replace(/{recipient}/g, recipient || '[Recipient Name]')
    .replace(/{subject}/g, subject || '[Subject]')
    .replace(/{body}/g, body)
    .replace(/{sender}/g, sender);
}

// Save email draft to vault
async function saveEmailDraft(draft: string, metadata: Record<string, string>): Promise<{ filename: string; path: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `EMAIL_DRAFT_${timestamp}.md`;
  const filePath = path.join(VAULT_PATH, 'Pending_Approval', filename);

  const markdownContent = `---
type: email_draft
status: pending_approval
created: ${new Date().toISOString()}
to: ${metadata.recipient || 'Unknown'}
subject: ${metadata.subject || 'No Subject'}
email_type: ${metadata.type || 'reply'}
email_style: ${metadata.style || 'professional'}
---

# Email Draft

**To:** ${metadata.recipient || '[Recipient]'}
**Subject:** ${metadata.subject || '[Subject]'}

---

${draft}

---

**Instructions:**
- Move to \`/Approved\` folder to send
- Move to \`/Rejected\` folder to discard
- Edit content directly if changes needed
`;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, markdownContent);

  return { filename, path: filePath };
}

// Trigger CEO Briefing generation
async function triggerCEOBriefing(): Promise<{ success: boolean; message: string; filename?: string }> {
  try {
    // Check if ceo_briefing_generator.py exists
    const generatorPath = path.join(PROJECT_ROOT, 'ceo_briefing_generator.py');
    if (!fs.existsSync(generatorPath)) {
      return {
        success: false,
        message: 'CEO Briefing generator not found'
      };
    }

    // Run the generator
    await execAsync(`python "${generatorPath}"`, {
      cwd: PROJECT_ROOT,
      timeout: 60000 // 60 second timeout
    });

    // Find the generated file
    const briefingsDir = path.join(VAULT_PATH, 'Briefings');
    if (fs.existsSync(briefingsDir)) {
      const files = fs.readdirSync(briefingsDir)
        .filter(f => f.includes('CEO_Briefing') || f.includes('Briefing'))
        .sort((a, b) => {
          const aTime = fs.statSync(path.join(briefingsDir, a)).mtime.getTime();
          const bTime = fs.statSync(path.join(briefingsDir, b)).mtime.getTime();
          return bTime - aTime;
        });

      if (files.length > 0) {
        return {
          success: true,
          message: 'CEO Briefing generated successfully',
          filename: files[0]
        };
      }
    }

    return {
      success: true,
      message: 'CEO Briefing generation completed',
    };

  } catch (error) {
    console.error('CEO Briefing generation error:', error);

    // Create a simple briefing as fallback
    const fallbackBriefing = await createFallbackBriefing();

    return {
      success: true,
      message: 'Generated simplified briefing (generator script error)',
      filename: fallbackBriefing
    };
  }
}

// Create fallback briefing if generator fails
async function createFallbackBriefing(): Promise<string> {
  const timestamp = new Date();
  const filename = `${timestamp.toISOString().split('T')[0]}_Quick_Briefing.md`;
  const filePath = path.join(VAULT_PATH, 'Briefings', filename);

  // Gather stats
  const stats = getVaultStats();

  const content = `---
generated: ${timestamp.toISOString()}
type: quick_briefing
---

# Quick Business Briefing

**Generated:** ${timestamp.toLocaleString()}

## Vault Status

| Metric | Count |
|--------|-------|
| Needs Action | ${stats.needsAction} |
| Pending Approval | ${stats.pendingApproval} |
| In Progress | ${stats.inProgress} |
| Completed | ${stats.done} |
| Failed | ${stats.failed} |

## Quick Summary

- **Total items processed:** ${stats.done}
- **Success rate:** ${stats.done > 0 ? Math.round((stats.done / (stats.done + stats.failed)) * 100) : 0}%
- **Pending items:** ${stats.needsAction + stats.pendingApproval}

## Recommendations

${stats.needsAction > 10 ? '⚠️ High volume of items needing action. Consider batch processing.' : '✅ Action queue is manageable.'}
${stats.failed > 5 ? '⚠️ Several failed items. Review error logs.' : '✅ Failure rate is acceptable.'}
${stats.pendingApproval > 5 ? '⚠️ Multiple items pending approval. Review queue.' : '✅ Approval queue is clear.'}

---

*Generated by AI Employee Dashboard*
`;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content);

  return filename;
}

// Get vault statistics
function getVaultStats(): Record<string, number> {
  const folders = ['Needs_Action', 'Pending_Approval', 'In_Progress', 'Done', 'Failed', 'Approved', 'Rejected'];
  const stats: Record<string, number> = {};

  for (const folder of folders) {
    const folderPath = path.join(VAULT_PATH, folder);
    try {
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md') || f.endsWith('.json'));
        stats[folder.toLowerCase().replace(/_/g, '')] = files.length;
      } else {
        stats[folder.toLowerCase().replace(/_/g, '')] = 0;
      }
    } catch {
      stats[folder.toLowerCase().replace(/_/g, '')] = 0;
    }
  }

  return {
    needsAction: stats.needsaction || 0,
    pendingApproval: stats.pendingapproval || 0,
    inProgress: stats.inprogress || 0,
    done: stats.done || 0,
    failed: stats.failed || 0,
    approved: stats.approved || 0,
    rejected: stats.rejected || 0
  };
}

// Create a task in the vault
async function createTask(params: {
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  source: string;
}): Promise<{ filename: string; path: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `TASK_${timestamp}.md`;
  const filePath = path.join(VAULT_PATH, 'Needs_Action', filename);

  const content = `---
type: task
title: ${params.title}
status: pending
priority: ${params.priority}
created: ${new Date().toISOString()}
source: ${params.source}
---

# ${params.title}

## Description

${params.description}

## Checklist

- [ ] Review task
- [ ] Execute required actions
- [ ] Mark as complete

---

*Created via AI Employee Dashboard*
`;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content);

  return { filename, path: filePath };
}

// Run subscription audit
async function runSubscriptionAudit(): Promise<{ success: boolean; message: string; filename?: string }> {
  const timestamp = new Date();
  const filename = `AUDIT_subscriptions_${timestamp.toISOString().split('T')[0]}.md`;
  const filePath = path.join(VAULT_PATH, 'Briefings', filename);

  // Read business goals for subscription info
  const goalsPath = path.join(VAULT_PATH, 'Business_Goals.md');
  let subscriptionTable = 'No subscription data found.';

  if (fs.existsSync(goalsPath)) {
    const content = fs.readFileSync(goalsPath, 'utf-8');
    const tableMatch = content.match(/\| Software[\s\S]*?\n\n/);
    if (tableMatch) {
      subscriptionTable = tableMatch[0];
    }
  }

  const auditContent = `---
type: subscription_audit
generated: ${timestamp.toISOString()}
---

# Monthly Subscription Audit

**Generated:** ${timestamp.toLocaleString()}

## Current Subscriptions

${subscriptionTable}

## Audit Checklist

- [ ] Review all active subscriptions
- [ ] Check for unused services (no login in 30 days)
- [ ] Verify pricing hasn't increased unexpectedly
- [ ] Look for duplicate functionality
- [ ] Consider annual billing for cost savings

## Recommendations

*Review the subscriptions above and note any that should be:*
- 🔴 Cancelled
- 🟡 Reviewed
- 🟢 Kept as-is

## Action Items

| Subscription | Action | Reason | Est. Savings |
|--------------|--------|--------|--------------|
| [Fill in] | [Keep/Cancel/Downgrade] | [Reason] | $X/month |

---

*Generated by AI Employee - Monthly Audit*
`;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, auditContent);

  return {
    success: true,
    message: 'Subscription audit generated',
    filename
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'generate_email': {
        const { type, style, recipient, subject, context, sender } = body;
        const draft = generateEmailDraft({ type, style, recipient, subject, context, sender });
        const saved = await saveEmailDraft(draft, { type, style, recipient, subject });

        return NextResponse.json({
          success: true,
          draft,
          filename: saved.filename,
          message: 'Email draft saved for approval'
        });
      }

      case 'generate_briefing': {
        const result = await triggerCEOBriefing();
        return NextResponse.json(result);
      }

      case 'quick_briefing': {
        const filename = await createFallbackBriefing();
        return NextResponse.json({
          success: true,
          message: 'Quick briefing generated',
          filename
        });
      }

      case 'subscription_audit': {
        const result = await runSubscriptionAudit();
        return NextResponse.json(result);
      }

      case 'create_task': {
        const { title, description, priority, source } = body;
        const result = await createTask({
          title: title || 'New Task',
          description: description || 'Task description',
          priority: priority || 'normal',
          source: source || 'dashboard'
        });

        return NextResponse.json({
          success: true,
          message: 'Task created',
          filename: result.filename
        });
      }

      case 'get_stats': {
        const stats = getVaultStats();
        return NextResponse.json({
          success: true,
          stats
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Actions API error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  // Return available actions
  return NextResponse.json({
    availableActions: [
      {
        action: 'generate_email',
        description: 'Generate an AI-powered email draft',
        params: ['type', 'style', 'recipient', 'subject', 'context']
      },
      {
        action: 'generate_briefing',
        description: 'Generate a CEO briefing report'
      },
      {
        action: 'quick_briefing',
        description: 'Generate a quick status briefing'
      },
      {
        action: 'subscription_audit',
        description: 'Run a subscription audit'
      },
      {
        action: 'create_task',
        description: 'Create a new task',
        params: ['title', 'description', 'priority', 'source']
      },
      {
        action: 'get_stats',
        description: 'Get vault statistics'
      }
    ]
  });
}
