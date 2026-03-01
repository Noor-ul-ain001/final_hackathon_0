---
moved_from: Needs_Action
moved_to: Approved
moved_at: 2026-01-23T11:07:24.550Z
status: approved
approved_at: 2026-01-23T11:07:24.550Z
---

# New Email Received

---
received_at: 2026-01-23 16:05:26
email_id: 19bea87aa6561247
source: Gmail
type: email
status: needs_review
trigger_keyword: urgent
---

## Email Details

**From**: Noor ul ain <noorul01ain@gmail.com>
**To**: awaismudasir10@gmail.com
**Subject**: Re: Re: Your Message
**Date**: Fri, 23 Jan 2026 16:05:06 +0500

## Email Body

```
invoice urgent

On Fri, Jan 23, 2026 at 3:51 PM <awaismudasir10@gmail.com> wrote:

> [Your drafted response here]
>

```

## Instructions for Claude

This email requires processing. Please:

1. **Analyze** the email content and determine intent
2. **Extract** key information (sender details, request type, urgency)
3. **Draft** an appropriate response following company tone and style
4. **Create** a response file in `/Pending_Approval` with:
   - Subject line for reply
   - Full response text
   - Recipient email address
   - Any context/notes
5. **Update** Dashboard.md with this activity
6. **Notify** via WhatsApp that approval is needed

### Response Template to Create

Save to: `AI_Employee_Vault/Pending_Approval/RESPONSE_20260123_160526_[subject].md`

```markdown
---
email_id: 19bea87aa6561247
reply_to: Noor ul ain <noorul01ain@gmail.com>
original_subject: Re: Re: Your Message
created_at: [timestamp]
status: pending_approval
---

# Email Response Draft

## To
Noor ul ain <noorul01ain@gmail.com>

## Subject
Re: Re: Re: Your Message

## Body
[Your drafted response here]

## Notes
[Any context or considerations for human reviewer]

---
To approve: Move this file to /Approved
To reject: Delete this file or move to /Done
```

---
*Created by Gmail Watcher*
