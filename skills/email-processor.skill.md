# Email Processor Skill

## Description
Processes incoming emails from the Needs_Action folder, analyzes content, determines appropriate response type, and drafts professional email replies following company guidelines.

## When to Use
- When new email files appear in `/AI_Employee_Vault/Needs_Action/`
- When manually triggered to process pending emails
- As part of the automated email response workflow

## Input Requirements
- Email files in `/AI_Employee_Vault/Needs_Action/` with proper metadata (from, subject, content)
- Access to `/AI_Employee_Vault/Company_Handbook.md` for response guidelines

## Process Steps

1. **Read Pending Emails**
   - Scan `/AI_Employee_Vault/Needs_Action/` for email files
   - Parse email metadata (sender, subject, timestamp)
   - Extract email content

2. **Analyze Email**
   - Identify email type (inquiry, request, complaint, greeting, etc.)
   - Determine urgency level
   - Check for spam or irrelevant content
   - Identify key points that need addressing

3. **Draft Response**
   - Follow Company_Handbook.md guidelines for tone and structure
   - Address all points from the original email
   - Include proper greeting, body, and closing
   - Match formality level of the sender
   - Add appropriate call-to-action if needed

4. **Create Response File**
   - Generate response file in `/AI_Employee_Vault/Pending_Approval/`
   - Use filename format: `RESPONSE_[timestamp]_[email_id].md`
   - Include all required metadata (reply_to, subject, original_email_id)
   - Add notes section with reasoning and concerns

5. **Update Dashboard**
   - Log activity in `/AI_Employee_Vault/Dashboard.md`
   - Update pending approval count
   - Record timestamp of processing

## Response Template

```markdown
---
email_id: [original_email_id]
reply_to: [sender_email@example.com]
original_subject: [subject]
created_at: [YYYY-MM-DD HH:MM:SS]
status: pending_approval
priority: [high|normal|low]
---

# Email Response Draft

## To
[sender_email@example.com]

## Subject
Re: [original subject]

## Body
[Complete email response ready to send]

## Notes
[Context, reasoning, concerns, alternative approaches]

---
To approve: Move this file to /Approved
To reject: Delete or move to /Done
```

## Response Quality Checklist
- [ ] Greeting included
- [ ] All points from original email addressed
- [ ] Clear and professional tone
- [ ] Proper grammar and spelling
- [ ] Appropriate closing and signature
- [ ] Call-to-action if needed
- [ ] No financial commitments without approval flag
- [ ] No confidential information shared

## Special Handling

### Spam/Irrelevant
- Do not draft response
- Create note in `/Done/` folder
- Move original to `/Done/`

### Requires Business Decision
- Draft holding response acknowledging receipt
- Flag in notes that human decision needed
- Explain what decision is required

### Urgent/High Priority
- Set priority: high in metadata
- Process immediately
- Include urgency note for reviewer

## Error Handling
- If email file is malformed, log error and move to `/Failed/`
- If unable to parse content, create manual review flag
- If response generation fails, retry once, then escalate

## Success Criteria
- Response file created in `/Pending_Approval/`
- Response follows all handbook guidelines
- All metadata properly formatted
- Dashboard updated with activity
- Original email moved to processing folder

## Examples

### Example 1: Customer Inquiry
**Input:** Customer asking about product pricing

**Action:** Draft professional response with pricing info, call-to-action to schedule call

**Output:** Response file in Pending_Approval with pricing details and CTA

### Example 2: Complaint
**Input:** Customer complaint about service issue

**Action:** Draft empathetic response, acknowledge issue, offer solution

**Output:** High-priority response with solution and timeline

### Example 3: Greeting
**Input:** Casual "Hi, just checking in" email

**Action:** Draft friendly response matching tone

**Output:** Low-priority casual response

## Integration Points
- Reads from: `/AI_Employee_Vault/Needs_Action/`
- Writes to: `/AI_Employee_Vault/Pending_Approval/`
- Updates: `/AI_Employee_Vault/Dashboard.md`
- References: `/AI_Employee_Vault/Company_Handbook.md`

## Configuration
No additional configuration required. Follows rules defined in Company_Handbook.md.

## Notes for Improvement
- Consider adding sentiment analysis for better tone matching
- Implement learning from approved vs. rejected responses
- Add template library for common response types
- Integrate with CRM for customer history context
