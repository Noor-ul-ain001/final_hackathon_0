---
type: ceo_briefing_request
source: odoo_watcher
period_start: 2026-01-12T08:52:32.514425
period_end: 2026-01-19T08:52:32.514439
status: pending
priority: high
auto_generate: True
---

## Weekly CEO Briefing Request

A weekly CEO briefing should be generated for the period:
- **Start:** 2026-01-12T08:52:32.514425
- **End:** 2026-01-19T08:52:32.514439

## Instructions for Claude

Use the `ceo-briefing.skill.md` to generate a comprehensive Monday Morning CEO Briefing.

### Data Sources
1. **Odoo MCP** - Query financial data:
   - `odoo_get_revenue_report` for revenue
   - `odoo_get_expense_report` for expenses
   - `odoo_get_unpaid_invoices` for outstanding AR
   - `odoo_get_aging_report` for AR aging
   - `odoo_get_profit_loss` for P&L summary
   - `odoo_get_cash_flow` for cash flow analysis

2. **Vault Data**:
   - `/Done/` folder for completed tasks
   - `/Dashboard.md` for activity history
   - `/Business_Goals.md` for targets

### Include in Briefing:
1. Revenue summary with target comparison
2. Outstanding invoices with aging breakdown
3. Expense breakdown by category
4. Completed tasks summary
5. Cash flow status
6. Proactive recommendations
7. Upcoming deadlines

## Output Location
Save the briefing to: `/Briefings/2026-01-19_Monday_Briefing.md`
