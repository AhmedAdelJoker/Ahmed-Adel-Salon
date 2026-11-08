# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The salon's own team, not the general public:

- **Owner** — full back office: dashboards, financials, payroll, HR, permissions, settings; needs trustworthy numbers and remote oversight.
- **Manager** — daily operations: approvals, attendance, reports, front-of-house oversight.
- **Cashier / front desk** — POS, bookings, schedule, customers, invoices; works fast, under time pressure, often with queues.
- **Barbers** — workstation view: their bookings, clients, earnings, availability; read-mostly, phone-adjacent usage.
- **Accountant** — finance review: reports, invoice adjustment requests, archives.

Customers are not operators. They only touch the product through the public booking/marketing site.

Situation: working on the salon floor or back office, mostly during opening hours, Arabic-speaking, on a Windows PC at the salon; printed paper (invoices, receipts) is part of the job.

## Product Purpose

Salon Pro runs the entire salon in one system: POS and invoicing (with offline queueing and split payments), bookings and schedule, customer records and loyalty, inventory, HR/attendance/payroll, expenses, financial and operational reports, permissions and audit logs — plus a customer-facing public site (booking + marketing) whose content is editable from the same back office.

Success means the salon runs its whole operation — from online booking through chair, till, end-of-day close, and payroll — without leaving the system or stitching together separate tools.

## Positioning

An all-in-one, Arabic-first salon operating system: the complete daily loop — booking → chair → till → payroll → reports — in one place, designed natively for Arabic RTL rather than translated from a foreign product. A neighboring product can copy individual modules; it cannot copy the integrated Arabic-first workflow for a real salon floor, including offline operation on the salon's own machine.

Note (open): the repo indicates this currently serves a single salon (Ahmed Adel Salon, per the repository name) with multi-salon/product generalization as the stated direction. Whether and how it becomes a packaged product for other salons (tenancy, onboarding, licensing) is **not decided** — see Capabilities and Constraints.

## Operating Context

- Front desk / POS during opening hours; barbers at workstations; owner/manager in the back office; accountant for finance.
- Windows desktop at the salon; optional Electron wrapper around the same web build (not a native design language); the public site deploys separately (Netlify/Vercel).
- Printed invoices and receipts; split payments; shifts; manager approval for discounts; offline-first operation with queued invoice replay.
- Business data and uploads live **outside the repository** (`SALON_DATA_DIR` / `Documents/SalonProData`); never committed to git.
- Arabic (ar, RTL) is the default UI language; English (en) is fully supported — `ar` default, both first-class.
- As of Nov 2026 the system runs on seed/demo data; a cutover to a real salon's production data has not happened yet.

## Capabilities and Constraints

Confirmed functionality (from the codebase): POS with offline invoice queue, shifts and sessions, customer typeahead, split payments, manager-approved discounts; bookings and schedule (day/week boards, mini calendar); customers (filters, merge, archive); invoices with archive, month lock and server-side filtering; inventory; HR, attendance, payroll and expenses; financial/operational/employee reports; granular permissions and audit logs; TOTP MFA enforced for owner/admin/manager (7-day grace); Argon2id password hashing; public site with owner-editable catalog (services, barbers, offers, gallery, reviews) and SEO/prerender tooling.

Constraints (confirmed):

- No Docker. Direct run on Windows (`run.ps1`); Python 3.12; Node.js ≥ 20; Vite 8.
- SQLite by default; PostgreSQL optional; schema changes via Alembic migrations.
- Offline operation and real printers/invoices are requirements; internet connectivity is optional, never a prerequisite.
- Business data stays outside the repo; the database and uploads are not version-controlled.
- Security baseline is not to be weakened: Argon2id, TOTP enforcement, audit logging, DB-sourced pricing.
- Bilingual ar/en with ar default and RTL; every new screen must work in both directions.
- WCAG 2.1 AA is the accessibility target (confirmed).
- Backup/restore and data residency are the salon's own machine — plan for local backup, not cloud sync, unless the owner asks.

Undecided / open:

- Multi-tenant packaging for the future multi-salon product phase: tenancy model, onboarding, licensing/pricing — not decided; current reality is one salon.
- Production cutover with real data: not scheduled/confirmed.
- Binding visual-identity commitments beyond Arabic-first RTL + bilingual: none confirmed; the incumbent gold-accent identity is current state, not a lock.

## Brand Commitments

- Name: **Salon Pro** (صالون برو) — used across the README, `public-site/site.config.json`, and the repository.
- Arabic-first and RTL-native; bilingual ar/en with ar as the default locale (`<html lang="ar" dir="rtl">`).
- Copy stays bilingual in parity — the i18n parity test fails the build if a locale drifts; new strings ship in both languages.
- Incumbent visual identity (near-black/near-white surfaces, gold accent `#D4AF37`, serif display type on the public site) is the current state — recorded as evidence, not as a binding commitment.
- Voice: professional, direct Arabic; no invented claims, offers, or numbers.

## Evidence on Hand

- **Seed/demo data only.** No real customer data, real testimonials, publishable reviews, client logos, or case studies exist yet (confirmed). Future work must not fabricate any of these.
- The codebase itself is the strongest evidence: the full ERP module set, the owner-editable public site, and review reports in `docs/` (POS, Bookings, Schedule — Arabic) documenting known gaps.
- `public-site` ships with demo catalog content (`src/lib/mockCatalog.ts`) and stock/placeholder media; treat all of it as demo until the owner supplies real assets.
- Site identity configuration exists at `public-site/site.config.json` (canonical `https://salon-pro.com`, `ar_EG` Open Graph).
- Absences to respect: no "trusted by" claims, no client counts, no ratings, no press — none exist.

## Product Principles

1. **The whole salon in one place** — every workflow stays inside the system; never push staff to a spreadsheet or a second tool.
2. **Arabic-first, RTL-native** — Arabic is the design's native direction, English a first-class equal; RTL is never a mirrored afterthought.
3. **Works where the salon works** — offline-first on the salon's own Windows machine; paper, printers, cash and walk-ins are first-class citizens.
4. **Trustworthy with money and people** — prices from the database, idempotent operations, audit trails, MFA; integrity over convenience, always.
5. **One salon today, many tomorrow** — keep today's single-salon reality simple and solid; don't build tenancy speculatively, and don't paint into a corner either.

## Accessibility & Inclusion

- Target standard: **WCAG 2.1 AA** (confirmed).
- Arabic RTL and English LTR are both supported; keyboard operation, focus visibility, contrast, touch targets and accessible names must hold in both directions.
- Form labels, error messaging and status announcements must be programmatic, not color-only.
- The repo already carries a11y tooling (vitest a11y suite, playwright a11y config, jsx-a11y lint rules); keep it green and extend it as screens change.
