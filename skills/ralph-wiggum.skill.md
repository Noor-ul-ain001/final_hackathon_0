# Ralph Wiggum Autonomous Task Skill

## Description
Manages autonomous multi-step task execution through the Ralph Wiggum Loop. Handles task decomposition, step execution, approval gates, error recovery, and human intervention requests for complex workflows.

## When to Use
- Executing multi-step business workflows
- Automating repetitive task sequences
- Processing tasks that require approval gates
- Handling complex tasks that span multiple systems
- When tasks need decomposition into manageable steps

## Key Concepts

### Task States
| State | Description |
|-------|-------------|
| `PENDING` | Task waiting to be started |
| `IN_PROGRESS` | Task currently executing |
| `AWAITING_APPROVAL` | Waiting for human approval |
| `APPROVED` | Approval received, ready to continue |
| `COMPLETED` | All steps finished successfully |
| `FAILED` | Task failed after retries |
| `CANCELLED` | Task cancelled by human |

### Step Types
| Type | Description | Requires Approval |
|------|-------------|-------------------|
| `READ_DATA` | Read from vault/files | No |
| `ANALYZE` | Analyze content | No |
| `DRAFT` | Create draft content | No |
| `API_CALL` | Call external API | Sometimes |
| `MCP_CALL` | Call MCP server tool | Sometimes |
| `SEND` | Send email/message | Yes |
| `POST` | Post to social media | Yes |
| `CREATE_INVOICE` | Create invoice in Odoo | Yes (if >$100) |
| `UPDATE_FILE` | Update vault file | No |
| `NOTIFY` | Send notification | No |

## Task Decomposition Patterns

### Email Reply Task
```
1. ANALYZE: Analyze email content and context
2. DRAFT: Draft reply based on analysis
3. SEND: Send email reply (requires approval)
```

### Social Media Post Task
```
1. READ_DATA: Gather context and trending topics
2. DRAFT: Draft tweet content
3. POST: Post to Twitter (requires approval)
```

### Invoice Creation Task
```
1. ANALYZE: Validate invoice data
2. CREATE_INVOICE: Create invoice in Odoo (requires approval if >$100)
3. NOTIFY: Notify relevant parties
```

### CEO Briefing Task
```
1. MCP_CALL: Collect financial data from Odoo
2. MCP_CALL: Collect social media metrics from Twitter
3. ANALYZE: Analyze data and generate insights
4. DRAFT: Generate briefing document
5. UPDATE_FILE: Save and distribute briefing
```

### Expense Recording Task
```
1. ANALYZE: Validate expense data
2. MCP_CALL: Create expense in Odoo (requires approval if >$100)
3. UPDATE_FILE: Log expense to audit trail
```

## Process Steps

### Starting a Task

1. **Scan for Tasks**
   - Check Needs_Action folder for action files
   - Check Tasks/Pending for queued tasks
   - Parse task metadata and content

2. **Decompose Task**
   - Identify task type from metadata
   - Apply appropriate decomposition pattern
   - Generate unique task and step IDs
   - Set approval requirements

3. **Initialize Execution**
   - Move task to In_Progress
   - Log task start to audit trail
   - Update dashboard

### Executing Steps

1. **Check Approval**
   - If step requires approval, create approval request
   - Wait for approval before proceeding
   - Handle rejections gracefully

2. **Execute Action**
   - Call appropriate MCP tool or function
   - Capture results or errors
   - Log execution to audit trail

3. **Handle Results**
   - On success: Mark step complete, proceed to next
   - On failure: Retry with backoff (up to 3 times)
   - On final failure: Mark task failed, request intervention

### Approval Workflow

1. **Create Approval Request**
   ```markdown
   # Approval Required

   **Task:** [Task Title]
   **Step:** [Step Description]
   **Action Type:** [Action Type]

   ## Details
   [Step parameters]

   ## Actions
   - Reply "APPROVED" to proceed
   - Reply "REJECTED" to cancel
   - Reply "MODIFY: <changes>" to adjust
   ```

2. **Monitor for Response**
   - Check approval file for status changes
   - Handle approved/rejected/modified responses
   - Timeout after 24 hours (configurable)

3. **Process Response**
   - APPROVED: Continue execution
   - REJECTED: Cancel task or step
   - MODIFIED: Update parameters and retry

## Error Handling

### Transient Errors
- Network timeouts
- API rate limits
- Service unavailability

**Recovery:** Retry with exponential backoff (1s, 2s, 4s... up to 60s)

### Authentication Errors
- Expired tokens
- Invalid credentials
- Permission denied

**Recovery:** Alert human, pause task, wait for credential refresh

### Logic Errors
- Invalid data
- Unexpected state
- Missing dependencies

**Recovery:** Create intervention request, provide context

### System Errors
- Crashes
- Disk full
- Memory issues

**Recovery:** Trip circuit breaker, alert human, restart component

## Intervention Requests

When Ralph gets stuck, an intervention request is created:

```markdown
# Ralph Wiggum Intervention Required

The autonomous task execution loop encountered an error that requires human attention.

## Error Details
- **Task ID:** [task_id]
- **Step ID:** [step_id]
- **Error Type:** [error_type]
- **Error Message:** [error_message]

## Task Context
[Task details and history]

## Recommended Actions
1. Review the error and task context
2. Check system logs for more details
3. Decide whether to:
   - **Retry:** Mark as `status: retry`
   - **Skip:** Mark as `status: skip`
   - **Cancel:** Mark as `status: cancel`
   - **Modify:** Update parameters and mark as `status: modified`
```

## Configuration Options

### Environment Variables
```
DRY_RUN=true              # Simulate without side effects
AUTO_EXECUTE=false        # Execute without manual trigger
CHECK_INTERVAL=30         # Seconds between task scans
APPROVAL_TIMEOUT=86400    # Approval timeout in seconds
AUTO_APPROVAL_THRESHOLD=100  # Amount for auto-approval
MAX_RETRIES=3             # Maximum retry attempts
```

### Vault Folders
```
/Tasks/Pending/     - Tasks waiting to start
/Tasks/In_Progress/ - Tasks currently executing
/Tasks/Done/        - Completed tasks
/Tasks/Failed/      - Failed tasks
/Needs_Action/      - Approval requests
```

## Integration Points
- Odoo Accounting Skill (financial operations)
- Twitter Manager Skill (social media operations)
- Email Processor Skill (email operations)
- CEO Briefing Skill (reporting operations)
- Error Recovery System (error handling)
- Audit Logger (activity tracking)

## Best Practices

### Task Design
- Keep tasks focused on single objectives
- Use clear, descriptive step names
- Set appropriate approval gates
- Include rollback steps for critical operations

### Monitoring
- Check dashboard for active tasks
- Review failed tasks promptly
- Monitor circuit breaker status
- Track approval response times

### Maintenance
- Clear completed tasks periodically
- Archive old task logs
- Update decomposition patterns as needed
- Review and tune thresholds

## Success Metrics
- Task completion rate: > 95%
- Average task duration: < 5 minutes
- Approval response time: < 1 hour
- Retry success rate: > 80%
- Intervention rate: < 5%
