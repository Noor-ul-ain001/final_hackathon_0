# Approval Handler Skill

## Description
Manages the human-in-the-loop approval workflow for sensitive actions like sending emails, posting on social media, making payments, or any action requiring human oversight. Ensures safe autonomous operation while maintaining human control over critical decisions.

## When to Use
- Before sending any email
- Before posting to LinkedIn or social media
- Before making payments or financial transactions
- Before deleting files or making destructive changes
- For any action flagged as requiring approval in Company Handbook

## Input Requirements
- Files in `/AI_Employee_Vault/Pending_Approval/` folder
- Access to notification system (WhatsApp, email, etc.)
- Approval timeout configuration

## Process Steps

1. **Monitor Pending Approvals**
   - Scan `/Pending_Approval/` folder every 30 seconds
   - Parse each approval request file
   - Check approval metadata and status

2. **Send Notification**
   - Trigger WhatsApp notification (if configured)
   - Include action summary and urgency
   - Provide clear approval instructions
   - Track notification sent status

3. **Wait for Human Decision**
   - Monitor for file movement to `/Approved/` or `/Rejected/`
   - Check for timeout (default: 48 hours)
   - Handle expired approvals

4. **Process Approved Actions**
   - Execute approved action via appropriate MCP/API
   - Log execution result
   - Move to `/Done/` with completion status
   - Update Dashboard

5. **Process Rejections**
   - Move rejected files to `/Rejected/`
   - Log rejection with reason if provided
   - Learn from rejection patterns (future enhancement)
   - Update Dashboard

## Approval Request File Format

```markdown
---
type: [email|linkedin_post|payment|file_operation]
action: [send|post|transfer|delete]
created_at: [YYYY-MM-DD HH:MM:SS]
expires_at: [YYYY-MM-DD HH:MM:SS]
status: pending_approval
priority: [high|normal|low]
estimated_impact: [description]
---

# [Action Type] Approval Request

## Summary
[Brief description of what action will be taken]

## Details
[Complete details of the action with all parameters]

## Reasoning
[Why this action is needed/recommended]

## Risk Assessment
- **Reversibility**: [Can this be undone?]
- **Impact**: [Who/what is affected?]
- **Urgency**: [How time-sensitive?]

## Alternative Actions
[If applicable, what else could be done instead?]

## Notes
[Any additional context or concerns]

---
**To Approve**: Move this file to `/Approved/` folder
**To Reject**: Move this file to `/Rejected/` folder
**To Defer**: Leave in place (auto-expires in 48 hours)
```

## Notification Format

### WhatsApp Notification
```
🔔 AI Employee: Approval Required

Type: [Email/LinkedIn/Payment]
Priority: [High/Normal/Low]
Action: [Brief description]

📝 Review in: AI_Employee_Vault/Pending_Approval/

⏰ Expires: [timestamp]

Reply APPROVE or view file to proceed.
```

### Email Notification (Backup)
```
Subject: [Priority] AI Employee Approval Required

An automated action requires your approval:

Type: [Action Type]
Created: [timestamp]
Expires: [timestamp]

Action Details:
[Summary of action]

To approve or reject, review the file in:
AI_Employee_Vault/Pending_Approval/[filename]

Move to /Approved/ to proceed or /Rejected/ to cancel.
```

## Action Types and Approval Rules

### Email Sending
**Auto-Approve Conditions:**
- Reply to known contact (in address book)
- Response matches template exactly
- Low-risk content (greeting, acknowledgment)
- Recipient in whitelist

**Requires Approval:**
- New recipient
- Financial information included
- Commitments or promises made
- Bulk send (>1 recipient)
- Attachments included

### LinkedIn Posting
**Auto-Approve Conditions:**
- None (always require approval for social media)

**Requires Approval:**
- All posts (reputation risk)

### Payments
**Auto-Approve Conditions:**
- Recurring payment to known vendor (< configured threshold)
- Pre-approved payment schedule

**Requires Approval:**
- All new payments
- Any payment > configured threshold
- Change to payment details
- International transfers

### File Operations
**Auto-Approve Conditions:**
- Create or edit files in designated folders
- Read operations (always allowed)

**Requires Approval:**
- Delete files
- Move files outside vault
- Bulk operations (>10 files)

## Timeout Handling

### Default Timeout: 48 Hours
After timeout period:
1. Move expired approval to `/Expired/` folder
2. Log timeout event
3. Send notification of expiration
4. Do NOT execute action

### Urgent Actions (High Priority)
- Timeout: 4 hours
- Additional notifications every hour
- Escalate after 2 hours

## Priority Levels

### High Priority
- Customer complaints
- Time-sensitive requests
- Revenue-impacting actions
- Security-related actions

**Response Time Expected:** < 2 hours

### Normal Priority
- Standard emails
- Scheduled LinkedIn posts
- Routine tasks

**Response Time Expected:** < 24 hours

### Low Priority
- Non-urgent communications
- Informational updates
- Background tasks

**Response Time Expected:** < 48 hours

## Approval Decision Recording

When human approves/rejects, record:
```yaml
decision:
  timestamp: [YYYY-MM-DD HH:MM:SS]
  action: [approved|rejected]
  decided_by: [human|auto]
  time_to_decision: [seconds]
  notes: [optional human notes]
```

## Safety Guardrails

### Pre-Execution Checks
Before executing approved action:
1. Verify file is in `/Approved/` (not moved back)
2. Check not expired
3. Validate all parameters still valid
4. Verify no conflicts with other pending actions

### Post-Execution Logging
After executing:
1. Log complete action details
2. Record result (success/failure)
3. Save response/confirmation
4. Update all related files
5. Notify human of completion

## Error Handling

### Execution Failures
If approved action fails:
1. Log detailed error
2. Move to `/Failed/` folder
3. Send notification to human
4. DO NOT retry without re-approval
5. Preserve error state for debugging

### Notification Failures
If unable to send notification:
1. Log notification failure
2. Try backup notification method
3. Continue with approval process
4. Alert on next successful notification

### File System Issues
If file operations fail:
1. Retry with exponential backoff (3 attempts)
2. Log all attempts
3. Alert human via notification
4. Preserve system state

## Integration Points
- Monitors: `/AI_Employee_Vault/Pending_Approval/`
- Moves to: `/Approved/`, `/Rejected/`, `/Expired/`, `/Failed/`, `/Done/`
- Notifies via: WhatsApp MCP, Email MCP
- Executes via: Relevant MCP servers (email, LinkedIn, etc.)
- Updates: `/AI_Employee_Vault/Dashboard.md`

## Configuration

### Environment Variables
```
APPROVAL_TIMEOUT_HOURS=48
APPROVAL_URGENT_TIMEOUT_HOURS=4
APPROVAL_CHECK_INTERVAL_SECONDS=30
WHATSAPP_NOTIFICATIONS_ENABLED=true
EMAIL_NOTIFICATIONS_ENABLED=true
AUTO_APPROVE_ENABLED=false
AUTO_APPROVE_THRESHOLD=50
```

### Approval Rules File (Optional)
```yaml
# approval_rules.yaml
email:
  auto_approve_known_contacts: false
  auto_approve_replies: false
  always_require_approval: true

linkedin:
  auto_approve: false
  always_require_approval: true

payment:
  auto_approve: false
  auto_approve_threshold: 0
  always_require_approval: true
```

## Examples

### Example 1: Email Approval Flow

**1. Email Draft Created**
```
File: Pending_Approval/RESPONSE_20260115_103000_client_inquiry.md
Status: Pending Approval
```

**2. Notification Sent**
```
WhatsApp: "🔔 Email draft ready: Client inquiry response. Review to approve."
```

**3. Human Reviews and Approves**
```
Action: Human moves file to Approved/
```

**4. Email Sent**
```
Result: Email sent successfully via Gmail MCP
File moved to: Done/RESPONSE_20260115_103000_client_inquiry.md
Dashboard updated: "✓ SENT: Email reply to client@example.com"
```

### Example 2: LinkedIn Post Approval

**1. Post Created**
```
File: Pending_Approval/LINKEDIN_20260115_090000_project_showcase.md
Status: Pending Approval
Priority: Normal
```

**2. Notification Sent**
```
WhatsApp: "🔔 LinkedIn post draft ready: Project showcase. Review to approve."
```

**3. Human Reviews, Edits, and Approves**
```
Action: Human edits post text, moves to Approved/
```

**4. Post Published**
```
Result: Posted to LinkedIn via LinkedIn MCP
Post URL: https://linkedin.com/posts/...
File moved to: Done/LINKEDIN_20260115_090000_project_showcase.md
```

### Example 3: Expired Approval

**1. Approval Created**
```
Created: 2026-01-15 10:00:00
Expires: 2026-01-17 10:00:00 (48 hours)
```

**2. No Response**
```
Status: Still in Pending_Approval/ after 48 hours
```

**3. Timeout Triggered**
```
Action: File moved to Expired/
Notification: "⚠️ Approval expired: [action]. No action taken."
Dashboard: Logged expiration
```

## Quality Checklist
- [ ] Approval request clearly formatted
- [ ] Risk assessment included
- [ ] Notification sent successfully
- [ ] File properly tracked
- [ ] Timeout monitoring active
- [ ] Execution only after approval
- [ ] Complete logging maintained
- [ ] Human notified of result

## Success Metrics
- Time to approval (track average)
- Approval rate (approved vs rejected)
- Timeout rate (target: < 5%)
- Execution success rate (target: > 99%)
- Notification delivery rate (target: 100%)

## Notes for Improvement
- Implement approval via WhatsApp reply (instead of file move)
- Add approval history and pattern learning
- Create approval statistics dashboard
- Implement conditional auto-approval based on confidence
- Add multi-level approval for high-risk actions
- Create approval templates for common scenarios
- Implement approval delegation (backup approver)
