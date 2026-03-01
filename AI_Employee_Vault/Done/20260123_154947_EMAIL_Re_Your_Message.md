---
moved_from: Needs_Action
moved_to: Approved
moved_at: 2026-01-23T10:51:30.958Z
status: approved
approved_at: 2026-01-23T10:51:30.958Z
---

# New Email Received

---
received_at: 2026-01-23 15:49:47
email_id: 19bea796246ff487
source: Gmail
type: email
status: needs_review
trigger_keyword: urgent
---

## Email Details

**From**: Noor ul ain <noorul01ain@gmail.com>
**To**: awaismudasir10@gmail.com
**Subject**: Re: Your Message
**Date**: Fri, 23 Jan 2026 15:49:29 +0500

## Email Body

```
urgent invoice payment

On Sat, Jan 17, 2026 at 3:01 PM <awaismudasir10@gmail.com> wrote:

> Hello,
>
> Thank you for your email. I received your message and am reviewing it.
>
> Best regards,
> AI Employee
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

Save to: `AI_Employee_Vault/Pending_Approval/RESPONSE_20260123_154947_[subject].md`

```markdown
---
email_id: 19bea796246ff487
reply_to: Noor ul ain <noorul01ain@gmail.com>
original_subject: Re: Your Message
created_at: [timestamp]
status: pending_approval
---

# Email Response Draft

## To
Noor ul ain <noorul01ain@gmail.com>

## Subject
Re: Re: Your Message

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
