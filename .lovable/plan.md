
## Retail Business Management — Core MVP

A production-ready retail POS + inventory + reporting system for a single store, in Naira (₦), no VAT, with manual payment recording. Built modular so accounting, CRM, and multi-store can be layered on later.

### Tech & infrastructure
- **Lovable Cloud** for auth, Postgres, RLS, edge functions
- React + Tailwind + shadcn/ui, React Router, TanStack Query
- Roles stored in a separate `user_roles` table with a `has_role()` security definer function (no role on profiles — prevents privilege escalation)

### Roles (role-based access)
- **Admin** — full access, user management, settings
- **Manager** — products, inventory, reports, refunds
- **Cashier** — POS only, view own sales

### Modules

**1. Authentication & users**
- Email/password sign-in, session persistence
- Profiles table (name, phone) + `user_roles`
- Admin-only user management page (create staff, assign role, deactivate)

**2. Products & inventory**
- Products: name, SKU, barcode, category, cost price, sell price, stock qty, reorder level, image
- CRUD with search and category filter
- Stock adjustments (manual increment/decrement with reason: restock, damage, correction) — every change written to `stock_movements` for an audit trail
- Low-stock alerts on dashboard and a dedicated list

**3. Point of Sale (cashier screen)**
- Fast keyboard- and barcode-scanner-friendly: focus stays on a search/scan input
- Add by SKU/barcode/name → cart with qty, line total, remove
- Discount per line and per sale (₦ amount or %)
- Payment method selector: Cash / Transfer / POS-card
- Cash tendered → auto-calculates change
- Atomic checkout via edge function: validates stock, decrements inventory, writes `sale` + `sale_items` + `stock_movements` in one transaction
- Printable A80/thermal-friendly receipt (store name, items, totals, payment, cashier, timestamp, sale #)
- Hold/recall sale, void sale (manager+), refund full or partial (manager+ — restocks items)

**4. Sales history**
- Searchable, filterable by date range, cashier, payment method, status (completed/refunded/voided)
- Drill into a sale to view items and reprint receipt

**5. Reports & dashboard**
- Dashboard tiles: today's sales (₦), transactions, items sold, low-stock count
- Charts: sales trend (last 14 days), top-selling products, sales by payment method
- Reports page: daily / weekly / monthly summary, best & slow movers, sales-by-cashier
- CSV export for any report

**6. End-of-day close**
- Cashier closes shift: enter counted cash; system shows expected vs counted, variance is logged
- Manager can view all shift closings

**7. Settings**
- Store profile (name, address, phone, receipt footer, logo)
- Currency fixed to ₦, no tax

### UX & design
- Clean, dense, retail-optimized layout (sidebar nav on desktop, bottom nav on mobile/tablet)
- POS screen tuned for tablet/desktop with large touch targets
- Light theme with a single brand accent; semantic tokens in `index.css` so theming stays consistent
- Toast feedback for every action; optimistic UI on POS for speed

### Reliability & accuracy
- All money stored as integers (kobo) — no floating-point errors
- Checkout, refund, void, and stock adjustments run server-side in edge functions inside a single transaction
- Every inventory and financial change writes an immutable audit record
- RLS on every table; cashiers can only read their own sales, managers/admins see all

### Deliverables in this build
Auth + roles, product/inventory management with stock movements, POS with checkout/receipt/refund/void, sales history, dashboard + reports + CSV export, end-of-day close, store settings, seeded demo data so it's testable on day one.

### Out of scope for this MVP (clean extension points already in place)
Multi-store, expenses & full P&L, CRM/loyalty, supplier/purchase orders, offline mode, online payment gateways. Each maps cleanly onto the existing schema when you're ready.
