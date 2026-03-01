# Weekly Audit & CEO Briefing Skill

## Description
Generates comprehensive weekly business and accounting audits with CEO briefings. Integrates data from Odoo (financial), Twitter (social), and vault files (tasks/activities) to provide actionable insights and recommendations.

## When to Use
- Every Sunday at 8:00 PM (scheduled)
- On-demand when CEO briefing is requested
- Monthly for comprehensive financial reports
- Quarterly for strategic business reviews

## Input Requirements
- **Odoo MCP Server:** For financial data (revenue, expenses, invoices)
- **Twitter MCP Server:** For social media metrics
- **Vault Access:**
  - `/AI_Employee_Vault/Business_Goals.md`
  - `/AI_Employee_Vault/Tasks/Done/`
  - `/AI_Employee_Vault/Logs/`
  - `/AI_Employee_Vault/Dashboard.md`

## Process Steps

### 1. Data Collection Phase

**Financial Data (Odoo)**
```
Tools:
- odoo_get_revenue_report (last 7 days)
- odoo_get_expense_report (last 7 days)
- odoo_get_unpaid_invoices
- odoo_get_aging_report
- odoo_get_cash_flow
```

**Social Media Data (Twitter)**
```
Tools:
- twitter_get_weekly_summary
- twitter_get_engagement
```

**Task Data (Vault)**
- Scan `/Tasks/Done/` for completed tasks
- Calculate completion times
- Count tasks by category

**Activity Data (Dashboard)**
- Parse Dashboard.md for system activities
- Count emails processed
- Count approvals processed

### 2. Analysis Phase

**Revenue Analysis**
- Compare actual vs. target from Business_Goals.md
- Calculate week-over-week growth
- Identify trends
- Project month-end revenue

**Expense Analysis**
- Calculate total expenses
- Compare vs. budget
- Identify cost-saving opportunities
- Flag anomalies

**Productivity Analysis**
- Tasks completed vs. planned
- Average task completion time
- Identify productivity trends
- Spot inefficiencies

**Social Media Analysis**
- Engagement rate trends
- Top performing content
- Follower growth
- Mention sentiment

### 3. Briefing Generation

**Document Structure**
```markdown
# Monday Morning CEO Briefing
## Week of [Date Range]

### Executive Summary
[3-5 bullet points of key insights]

### Financial Performance
- **Revenue This Week:** $X,XXX
- **MTD Revenue:** $X,XXX (XX% of target)
- **Expenses This Week:** $XXX
- **Net Profit:** $X,XXX
- **Outstanding Invoices:** $X,XXX

### Key Wins
1. [Achievement 1]
2. [Achievement 2]
3. [Achievement 3]

### Bottlenecks & Issues
| Issue | Impact | Suggested Action |
|-------|--------|------------------|
| [Issue] | [Impact] | [Action] |

### Social Media Performance
- **Tweets Posted:** X
- **Total Engagement:** X likes, X retweets
- **Top Tweet:** [content]
- **Follower Growth:** +X

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

### Week Ahead Priorities
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]
```

### 4. Save and Notify

**Save Briefing**
- Location: `/AI_Employee_Vault/Briefings/YYYY-MM-DD_CEO_Briefing.md`
- Include all sections
- Format for readability

**Send Notification**
- Update Dashboard.md
- Create notification action file if configured

## Calculation Formulas

### Revenue Metrics
```
revenue_target_completion = (actual_revenue / monthly_target) * 100
weekly_burn_rate = monthly_target / 4.33
on_track = actual_revenue >= expected_weekly_revenue
week_over_week_growth = ((this_week - last_week) / last_week) * 100
```

### Expense Metrics
```
expense_ratio = (total_expenses / total_revenue) * 100
budget_variance = actual_expenses - budgeted_expenses
subscription_ratio = subscription_costs / total_expenses
```

### Productivity Metrics
```
task_completion_rate = (completed_tasks / planned_tasks) * 100
average_completion_time = sum(completion_times) / count(tasks)
efficiency_score = on_time_tasks / total_tasks
```

### Engagement Metrics
```
engagement_rate = (likes + retweets + replies) / impressions * 100
growth_rate = (new_followers - unfollowers) / previous_followers * 100
```

## Subscription Audit Rules

**Flag for Review if:**
- No usage detected in 30+ days
- Cost increased by > 20% without notification
- Duplicate functionality with another tool
- Not aligned with current business goals
- Not used by any team member in 60+ days

## Recommendation Categories

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

1. **Primary:** Odoo MCP (real-time financial data)
2. **Secondary:** Twitter MCP (social metrics)
3. **Tertiary:** Vault files (tasks, logs, dashboard)
4. **Fallback:** Manual calculation from available data

## Error Handling

### Missing Data Sources
- If Odoo unavailable: Use logs folder, mark section as "Data Incomplete"
- If Twitter unavailable: Note in social section, continue
- If all unavailable: Generate partial report with warning

### Incomplete Data
- Mark affected sections clearly
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

## Integration Points
- **Odoo Accounting Skill:** Financial data
- **Twitter Manager Skill:** Social metrics
- **Ralph Wiggum Loop:** Automated generation
- **Notification Hub:** Delivery
- **Audit Logger:** Activity tracking

## Scheduling

### Weekly (Primary)
- Day: Sunday
- Time: 8:00 PM
- Delivery: Dashboard notification

### Monthly
- Day: Last day of month
- Time: 8:00 PM
- Content: Expanded analysis, trends, forecasts

### Quarterly
- Timing: End of Q1, Q2, Q3, Q4
- Content: Strategic review, goal assessment

## Configuration

### Environment Variables
```
CEO_BRIEFING_SCHEDULE=sunday_20:00
CEO_BRIEFING_SEND_NOTIFICATION=true
CEO_BRIEFING_LOOKBACK_DAYS=7
CEO_BRIEFING_REVENUE_TARGET=10000
CEO_BRIEFING_EXPENSE_BUDGET=3000
```

### Thresholds
```
REVENUE_WARNING_THRESHOLD=0.8    # Alert if < 80% of target
EXPENSE_WARNING_THRESHOLD=1.2   # Alert if > 120% of budget
OVERDUE_ALERT_DAYS=30           # Alert for invoices > 30 days
SUBSCRIPTION_REVIEW_DAYS=30     # Flag unused subscriptions
```

## Success Metrics
- Briefing generated within 5 minutes
- All sections complete (100% data coverage)
- Financial accuracy: 100% match with Odoo
- Delivery on time: Every Sunday by 8 PM
- Actionable recommendations: 3+ per briefing
- Executive summary: < 5 bullet points
