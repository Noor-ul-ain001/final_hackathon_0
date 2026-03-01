# CEO Briefing Generator Skill

## Description
Generates comprehensive weekly business and accounting audits with CEO briefings. Analyzes revenue, expenses, completed tasks, bottlenecks, and provides actionable recommendations for business optimization.

## When to Use
- Every Sunday night (scheduled)
- On-demand when requested
- Monthly for comprehensive reports
- Quarterly for strategic reviews

## Input Requirements
- Access to `/AI_Employee_Vault/Business_Goals.md`
- Access to `/AI_Employee_Vault/Tasks/Done/`
- Access to `/AI_Employee_Vault/Logs/` for Odoo transactions
- Access to `/AI_Employee_Vault/Dashboard.md`
- Access to Odoo MCP for financial data (if configured)

## Process Steps

### 1. Data Collection Phase

**Financial Data**:
- Query Odoo for revenue report (last 7 days)
- Query Odoo for expense report (last 7 days)
- Get unpaid invoices list
- Calculate net revenue
- Identify late payments

**Task Data**:
- Scan `/Tasks/Done/` for completed tasks
- Calculate completion times
- Identify bottlenecks (tasks > expected time)
- Count tasks by category

**Activity Data**:
- Parse Dashboard.md for system activities
- Count emails processed
- Count LinkedIn posts published
- Count approvals processed

**Subscription Audit**:
- Review expenses from Odoo
- Identify recurring subscriptions
- Flag unused subscriptions (per Business_Goals rules)
- Calculate total subscription costs

### 2. Analysis Phase

**Revenue Analysis**:
- Compare actual vs. target (from Business_Goals.md)
- Calculate week-over-week growth
- Identify trends
- Project month-end revenue

**Expense Analysis**:
- Calculate total expenses
- Compare vs. budget
- Identify cost-saving opportunities
- Flag anomalies

**Productivity Analysis**:
- Tasks completed vs. planned
- Average task completion time
- Identify productivity trends
- Spot inefficiencies

**Health Metrics**:
- Email response time (target: < 24 hours)
- Invoice payment rate (target: > 90%)
- Client satisfaction indicators
- System uptime and reliability

### 3. Briefing Generation

**Structure**:
```markdown
# Monday Morning CEO Briefing
## Week of [Date]

### Executive Summary
[3-5 bullet points of key insights]

### Financial Performance
- **Revenue This Week**: $X,XXX
- **MTD Revenue**: $X,XXX (XX% of target)
- **Expenses This Week**: $XXX
- **Net Profit**: $X,XXX
- **Outstanding Invoices**: $X,XXX

### Key Wins
1. [Achievement 1]
2. [Achievement 2]
3. [Achievement 3]

### Bottlenecks & Issues
| Issue | Impact | Suggested Action |
|-------|--------|------------------|
| [Issue] | [Impact] | [Action] |

### Proactive Recommendations
1. **[Category]**: [Recommendation]
   - Why: [Reasoning]
   - Expected Impact: [Impact]
   - Action Required: [Action]

### Subscription Audit
| Service | Cost/Month | Last Used | Recommendation |
|---------|-----------|-----------|----------------|
| [Service] | $XX | [Date] | [Keep/Review/Cancel] |

### Upcoming Deadlines
- [Date]: [Deadline]
- [Date]: [Deadline]

### Week Ahead Priorities
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]
```

### 4. Save and Notify

**Save Briefing**:
- Location: `/AI_Employee_Vault/Briefings/YYYY-MM-DD_Monday_Briefing.md`
- Include all data and charts
- Format for readability

**Send Notification**:
- WhatsApp notification (if configured)
- Email summary (optional)
- Dashboard update

## Calculation Formulas

### Revenue Metrics
```
revenue_target_completion = (actual_revenue / monthly_target) * 100
weekly_burn_rate = (revenue_target / 4.33)
on_track = actual_revenue >= weekly_burn_rate
```

### Expense Metrics
```
expense_ratio = (total_expenses / total_revenue) * 100
subscription_ratio = (subscription_costs / total_expenses) * 100
```

### Productivity Metrics
```
task_completion_rate = (completed_tasks / planned_tasks) * 100
average_completion_time = sum(completion_times) / count(tasks)
bottleneck_threshold = average_completion_time * 1.5
```

## Subscription Audit Rules

Flag for review if:
- No usage detected in 30+ days
- Cost increased by > 20% without notification
- Duplicate functionality with another tool
- Not aligned with current business goals
- Not used by any team member in 60+ days

## Proactive Recommendation Categories

### Cost Optimization
- Unused subscriptions
- Volume discounts available
- Cheaper alternatives
- Consolidation opportunities

### Revenue Optimization
- Follow-up on overdue invoices
- Upsell opportunities
- Pricing optimization
- New service offerings

### Productivity Optimization
- Process automation opportunities
- Task delegation suggestions
- Tool consolidation
- Workflow improvements

### Risk Mitigation
- Cash flow warnings
- Client churn risks
- Compliance issues
- Security concerns

## Data Sources Priority

1. **Primary**: Odoo MCP (real-time financial data)
2. **Secondary**: Logs folder (transaction logs)
3. **Tertiary**: Dashboard.md (activity history)
4. **Fallback**: Manual calculation from vault files

## Error Handling

### Missing Data
- If Odoo unavailable: Use logs folder
- If logs missing: Use Dashboard history
- If all unavailable: Generate report with available data + warning

### Incomplete Data
- Mark sections as "Data Incomplete"
- Explain what's missing
- Suggest data collection improvement

## Output Quality Checklist
- [ ] All financial numbers verified
- [ ] Trends calculated correctly
- [ ] Recommendations are actionable
- [ ] Priorities clearly stated
- [ ] Subscription audit complete
- [ ] Executive summary concise (< 5 points)
- [ ] No confidential data exposed
- [ ] Formatted for easy reading
- [ ] Saved to correct location
- [ ] Notification sent

## Example Briefing

```markdown
# Monday Morning CEO Briefing
## Week of January 8-14, 2026

### Executive Summary
- ✅ Strong revenue week: $2,450 (ahead of target)
- ⚠️ One client invoice overdue by 5 days
- 🎯 Completed 12/15 planned tasks
- 💡 Opportunity: Cancel unused Notion subscription ($15/mo)
- 📈 LinkedIn engagement up 40% from last week

### Financial Performance
- **Revenue This Week**: $2,450
- **MTD Revenue**: $4,500 (45% of $10,000 target) ✅ On track
- **Expenses This Week**: $287
- **Net Profit**: $2,163
- **Outstanding Invoices**: $1,200 (1 overdue)

**Week-over-Week**: +12% revenue growth

### Key Wins
1. Closed Project Alpha milestone 2 ahead of schedule
2. Signed new client (Project Beta, $3,500 value)
3. LinkedIn post reached 450+ views (best performance yet)

### Bottlenecks & Issues
| Issue | Impact | Suggested Action |
|-------|--------|------------------|
| Client B proposal delayed 3 days | Low | Schedule dedicated time to complete |
| Invoice #1234 overdue by 5 days | Medium | Send follow-up email today |

### Proactive Recommendations

1. **Cost Optimization**: Cancel Notion Subscription
   - Why: No team activity detected in 45 days
   - Expected Impact: Save $180/year
   - Action Required: Review and cancel if confirmed

2. **Revenue**: Follow up on Invoice #1234
   - Why: 5 days overdue, client previously paid on time
   - Expected Impact: Collect $500
   - Action Required: Automated email sent, consider phone call

3. **Content Strategy**: Replicate LinkedIn Success
   - Why: "Behind-the-scenes" post had 3x normal engagement
   - Expected Impact: 40% increase in lead generation
   - Action Required: Create more process/project updates

### Subscription Audit
| Service | Cost/Month | Last Used | Recommendation |
|---------|-----------|-----------|----------------|
| Notion | $15 | 45 days ago | ❌ Cancel |
| Claude Code | $20 | Today | ✅ Keep |
| LinkedIn Premium | $30 | Today | ✅ Keep |
| Google Workspace | $12 | Today | ✅ Keep |

**Total Monthly Subscriptions**: $77 → Potential savings: $15/mo

### Upcoming Deadlines
- Jan 15: Project Alpha final delivery (tomorrow!)
- Jan 22: Invoice #1235 due
- Jan 31: Quarterly tax prep deadline

### Week Ahead Priorities
1. Complete and deliver Project Alpha
2. Follow up on overdue invoice
3. Start Project Beta discovery phase
4. Create 3 LinkedIn posts (Mon/Wed/Fri)
5. Review and cancel Notion subscription

---
*Generated by AI Employee CEO Briefing System*
*Data sources: Odoo accounting, Task logs, Dashboard analytics*
*Next briefing: January 22, 2026*
```

## Integration Points
- Reads from: `/AI_Employee_Vault/Business_Goals.md`, `/Tasks/Done/`, `/Logs/`, `/Dashboard.md`
- Queries: Odoo MCP (financial data)
- Writes to: `/AI_Employee_Vault/Briefings/`
- Notifies via: WhatsApp MCP

## Configuration

### Environment Variables
```
CEO_BRIEFING_SCHEDULE=sunday_20:00
CEO_BRIEFING_SEND_NOTIFICATION=true
CEO_BRIEFING_INCLUDE_CHARTS=false
CEO_BRIEFING_LOOKBACK_DAYS=7
```

### Scheduling
Run weekly on Sunday 8:00 PM:
```bash
# Windows Task Scheduler
# Or add to crontab (Linux/Mac):
0 20 * * 0 cd /path/to/AI_Employee && python ceo_briefing_generator.py
```

## Success Metrics
- Briefing generated within 5 minutes
- All sections complete (100% data coverage)
- Recommendations are actionable (specific actions provided)
- Financial accuracy (100% match with Odoo)
- Delivery on time (every Sunday by 8 PM)

## Notes for Improvement
- Add visual charts (revenue trends, expense breakdown)
- Implement predictive analytics (forecast next month)
- Add competitor tracking section
- Include team performance metrics (if team grows)
- Add AI confidence scores for recommendations
- Integrate with email for automatic sending
