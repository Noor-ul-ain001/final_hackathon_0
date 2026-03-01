---
moved_from: Needs_Action
moved_to: Approved
moved_at: 2026-02-03T12:51:25.120Z
status: approved
approved_at: 2026-02-03T12:51:25.120Z
---

---
type: ceo_briefing_request
source: odoo_watcher
period_start: 2026-01-18T20:30:36.220847
period_end: 2026-01-25T20:30:36.220862
status: pending
priority: high
auto_generate: True
---

## Weekly CEO Briefing Request

A weekly CEO briefing should be generated for the period:
- **Start:** 2026-01-18T20:30:36.220847
- **End:** 2026-01-25T20:30:36.220862

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
   - `odoo_get_sales_orders` for sales order status

2. **Vault Data**:
   - `/Done/` folder for completed tasks
   - `/Dashboard.md` for activity history
   - `/Business_Goals.md` for targets

### Include in Briefing:
1. Revenue summary with target comparison
2. Outstanding invoices with aging breakdown
3. Expense breakdown by category
4. Sales order pipeline status
5. Purchase order status
6. Completed tasks summary
7. Cash flow status
8. Proactive recommendations
9. Upcoming deadlines

## Output Location
Save the briefing to: `/Briefings/2026-01-25_Monday_Briefing.md`
