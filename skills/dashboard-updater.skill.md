# Dashboard Updater Skill

## Description
Maintains the AI Employee Dashboard by logging all system activities, updating status counts, and providing real-time visibility into operations. Acts as the central monitoring and reporting interface.

## When to Use
- After every significant system action
- After processing emails
- After posting to LinkedIn
- After approval/rejection of tasks
- On system startup
- During periodic health checks

## Input Requirements
- Access to `/AI_Employee_Vault/Dashboard.md`
- Activity information (timestamp, action, result)
- Current system status data

## Process Steps

1. **Read Current Dashboard**
   - Load existing Dashboard.md
   - Parse current status and activity log
   - Get current counts for each folder

2. **Update System Status**
   - Check watcher status (running/stopped)
   - Update last activity timestamp
   - Update tier information if changed
   - Refresh workflow status

3. **Count Pending Items**
   - Count files in `/Needs_Action/`
   - Count files in `/Pending_Approval/`
   - Count files in `/Approved/`
   - Count files in `/Done/` (today)

4. **Add Activity Entry**
   - Format activity with timestamp
   - Include action type and details
   - Add to recent activity log
   - Keep last 100 entries

5. **Write Updated Dashboard**
   - Maintain dashboard structure
   - Update all sections
   - Preserve formatting
   - Commit changes

## Dashboard Structure

```markdown
# AI Employee Dashboard

---
last_updated: [YYYY-MM-DD HH:MM:SS]
status: [active|paused|error]
tier: [Bronze|Silver|Gold|Platinum]
---

## System Status
- **Gmail Watcher**: [Active|Stopped|Error]
- **LinkedIn Poster**: [Active|Stopped|Disabled]
- **File Watcher**: [Active|Stopped|Error]
- **Email Sender**: [Active|Stopped|Error]
- **Claude Processor**: [Running|Idle|Error]
- **Last Activity**: [timestamp] - [description]

## Workflow Status

```
[Visual representation of current workflow]
```

### Current Counts
- **Needs Action**: X items waiting for processing
- **Pending Approval**: X items waiting for review
- **Approved**: X items ready to execute
- **Done Today**: X items completed

## Recent Activity
- [timestamp] [Component]: [Activity description]
- [timestamp] [Component]: [Activity description]
[...keep last 100 entries]

## Setup Checklist
- [x/] Component 1
- [x/] Component 2
[...]

## Next Steps
1. [Action item 1]
2. [Action item 2]
[...]

---
*This dashboard is updated automatically by Claude Code*
```

## Activity Log Format

### Standard Entry Format
```
- [YYYY-MM-DD HH:MM:SS] [Component]: [Action description]
```

### Components
- `GmailWatcher`: Email monitoring activities
- `EmailProcessor`: Email analysis and drafting
- `EmailSender`: Email sending actions
- `LinkedInPoster`: LinkedIn posting activities
- `FileWatcher`: File system monitoring
- `ApprovalHandler`: Approval workflow actions
- `System`: General system events

### Activity Types

**Email Processing:**
```
- [timestamp] GmailWatcher: Checked Gmail, found X new unread emails
- [timestamp] EmailProcessor: Processed email "subject" from Sender
- [timestamp] EmailProcessor: Draft created for "subject"
- [timestamp] EmailSender: Sent email "subject" to recipient@email.com
```

**LinkedIn Posting:**
```
- [timestamp] LinkedInPoster: Created post draft "Post Title"
- [timestamp] LinkedInPoster: Posted to LinkedIn - [post URL]
- [timestamp] LinkedInPoster: Post approved by human
```

**Approval Workflow:**
```
- [timestamp] ApprovalHandler: New item pending approval: [item name]
- [timestamp] ApprovalHandler: Item approved: [item name]
- [timestamp] ApprovalHandler: Item rejected: [item name]
```

**System Events:**
```
- [timestamp] System: Watchers started
- [timestamp] System: System upgraded to [Tier]
- [timestamp] System: Configuration updated
- [timestamp] System: Error recovered: [error description]
```

## Update Triggers

### High Priority (Update Immediately)
- Email sent successfully
- Error occurred
- System state changed (active ↔ paused)
- Approval required notification

### Normal Priority (Update Within 1 Minute)
- Email processed and drafted
- File moved between folders
- Watcher check completed
- Count updates

### Low Priority (Update Within 5 Minutes)
- Periodic health checks
- Routine status updates

## Count Update Logic

```python
def update_counts():
    counts = {
        'needs_action': count_files('AI_Employee_Vault/Needs_Action'),
        'pending_approval': count_files('AI_Employee_Vault/Pending_Approval'),
        'approved': count_files('AI_Employee_Vault/Approved'),
        'done_today': count_files_today('AI_Employee_Vault/Done')
    }
    return counts
```

## Status Indicators

### Watcher Status
- **Active**: Running and checking regularly
- **Stopped**: Not running (manual stop or error)
- **Error**: Encountered error, needs attention

### Overall System Status
- **active**: All components working normally
- **degraded**: Some components having issues but core functions working
- **error**: Critical component failure, manual intervention needed
- **paused**: Intentionally paused by user

## Error Handling

### Dashboard Write Failures
- Log error to separate log file
- Retry up to 3 times with exponential backoff
- If still failing, alert user via WhatsApp
- Continue operations (don't block other functions)

### Count Failures
- Use last known counts
- Add note to activity log about count error
- Retry on next update cycle

### File Lock Issues
- Wait up to 10 seconds for file to become available
- If still locked, skip this update
- Try again on next cycle

## Performance Considerations

### Optimization Strategies
- Keep activity log to max 100 entries (trim older ones)
- Use atomic writes (write to temp file, then rename)
- Cache counts between updates when possible
- Batch multiple updates within 5 seconds into single write

### Resource Limits
- Dashboard file should not exceed 50KB
- Activity log trimmed to last 100 entries
- Update frequency: max once per 5 seconds

## Integration Points
- Reads from: `/AI_Employee_Vault/Dashboard.md`
- Writes to: `/AI_Employee_Vault/Dashboard.md`
- Monitors: All vault folders for counts
- Triggered by: All other skills and watchers

## API

### Update Activity
```python
update_dashboard_activity(
    component="EmailProcessor",
    action="Processed email",
    details="Draft created for 'Project inquiry'",
    timestamp="2026-01-15 10:30:00"
)
```

### Update Status
```python
update_system_status(
    component="GmailWatcher",
    status="active",
    last_check="2026-01-15 10:30:00"
)
```

### Update Counts
```python
update_counts(
    needs_action=5,
    pending_approval=2,
    approved=0,
    done_today=10
)
```

## Configuration
No additional configuration required. Uses standard vault paths.

## Quality Checklist
- [ ] Activity logged with correct timestamp
- [ ] Counts accurately reflect folder states
- [ ] Status indicators correctly updated
- [ ] Dashboard file formatted correctly
- [ ] Recent activity limited to 100 entries
- [ ] No file corruption or lock issues
- [ ] Update completed within 1 second

## Examples

### Example 1: Email Processed
**Input:**
```
component: "EmailProcessor"
action: "processed"
details: "Draft created for 'Partnership inquiry' from John Doe"
```

**Dashboard Update:**
```
- [2026-01-15 10:30:15] EmailProcessor: Draft created for "Partnership inquiry" from John Doe
Current Counts:
- Pending Approval: 3 items (was 2)
```

### Example 2: System Error
**Input:**
```
component: "GmailWatcher"
action: "error"
details: "Connection timeout after 30s"
```

**Dashboard Update:**
```
System Status:
- **Gmail Watcher**: Error (Connection timeout)

Recent Activity:
- [2026-01-15 10:32:45] GmailWatcher: Error - Connection timeout after 30s
- [2026-01-15 10:32:50] System: Retrying Gmail connection...
```

### Example 3: Daily Summary Update
**Input:**
```
action: "daily_summary"
```

**Dashboard Update:**
```
## Today's Summary (2026-01-15)
- Emails processed: 12
- Emails sent: 8
- LinkedIn posts: 1
- Approvals pending: 2
- System uptime: 14 hours

Recent Activity:
- [2026-01-15 23:59:59] System: Daily summary generated
```

## Notes for Improvement
- Add trend analysis (e.g., "Processing 20% faster than yesterday")
- Implement dashboard visualization (charts/graphs)
- Add performance metrics (response time, success rate)
- Create weekly/monthly summary reports
- Add predictive alerts (e.g., "High email volume expected tomorrow")
- Implement dashboard access via web interface (Gold/Platinum tier)
