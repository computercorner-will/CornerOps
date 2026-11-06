# Build a starter repository: CornerOps

You are a senior full-stack engineer. Generate a complete, working starter repository for an internal web application called **CornerOps**. It is for a small managed IT services provider (MSP) with about 40 business clients and about 430 managed devices. Two developers will maintain it, so favor simple, readable code over clever abstractions.

Do not ask me questions. Where something is ambiguous, choose the simplest reasonable option and list every assumption in an "Assumptions" section at the end of the README.

---

## 1. Context

We already use these tools, and CornerOps must NOT replace them. It reads from them and fills the gaps between them.

- **Syncro**: RMM/PSA (tickets, invoices, recurring invoices, customers, assets). REST API docs: https://api-docs.syncromsp.com/
- **Pax8**: Microsoft 365 license distributor (companies, subscriptions, quantities, costs)
- **Microsoft 365 / Entra ID**: our company identity provider. Staff sign in with their work accounts.
- **TechRepairTracker**: walk-in repair intake and repair billing (no integration in v1)

**First feature (build it fully):** a billing reconciliation and MRR (monthly recurring revenue) dashboard.

**Later modules (navigation placeholders only, labeled "Coming soon"):** Client Health, Onboarding/Offboarding (via Microsoft Graph), SOP Library.

---

## 2. Tech stack (use exactly this)

- Next.js (App Router) + TypeScript in strict mode
- Tailwind CSS + shadcn/ui components
- PostgreSQL + Prisma ORM, with `docker-compose.yml` for local Postgres
- Auth.js (next-auth) with the **Microsoft Entra ID** provider, single-tenant (restricted to our tenant ID). No local passwords and no other sign-in methods.
- Zod for input validation and for validating environment variables at startup
- Vitest for unit tests and one Playwright smoke test
- ESLint + Prettier, using pnpm
- GitHub Actions CI: install, lint, typecheck, test, build
- Use current stable versions and pin them in `package.json`.

Keep the architecture simple: one Next.js app and one database. No microservices, Redis, queues or Kubernetes. It should deploy later to a single VM or to Vercel plus managed Postgres.

---

## 3. Security requirements (non-negotiable)

1. **Never store client passwords, admin credentials, MFA secrets or recovery keys.** The schema must have no field for them.
2. API keys and secrets live only in server-side environment variables. They are never sent to the browser and never logged.
3. All integration calls run server-side only.
4. **Integrations are read-only in v1.** No POST, PUT or DELETE calls to Syncro or Pax8.
5. Role-based access with three roles: `ADMIN`, `TECH`, `READONLY`. New users default to `READONLY`. Admins are bootstrapped from an `ADMIN_EMAILS` environment variable (comma-separated).
6. Every write action in the app, and every sync run, is recorded in an `AuditLog` table.
7. Development uses seeded **fake** data only. Commit `.env.example`, never `.env`. Add `.env*` to `.gitignore` (except the example).
8. Add basic security headers and protect every route except sign-in behind authentication.

---

## 4. Data model (Prisma, at minimum)

Store money as **integer cents** and timestamps in **UTC**.

- `User`: id, email (unique), name, role, createdAt
- `Client`: id, name, industry, status (ACTIVE / INACTIVE), syncroCustomerId (nullable, unique), pax8CompanyId (nullable, unique), notes, createdAt, updatedAt
- `BillingLine`: id, clientId, description, source (SYNCRO / MANUAL), frequency (MONTHLY / ANNUAL), quantity, unitPriceCents, amountCents, externalId (nullable), updatedAt
- `LicenseSubscription`: id, clientId, source (PAX8), productName, sku, quantity, unitCostCents, billingTerm, externalId, updatedAt
- `Device`: id, clientId, syncroAssetId (unique), name, deviceType, lastSeenAt
- `ReconciliationIssue`: id, clientId, type (LICENSE_QTY_MISMATCH / UNBILLED_LICENSE / BELOW_PRICE_FLOOR / NO_BILLING), details (JSON), status (OPEN / RESOLVED / IGNORED), note, resolvedById, resolvedAt, createdAt
- `SyncRun`: id, source (SYNCRO / PAX8), startedAt, finishedAt, status (RUNNING / SUCCESS / FAILED), recordsRead, error
- `AuditLog`: id, userId (nullable for system jobs), action, entity, entityId, before (JSON), after (JSON), createdAt
- `Prospect`: id, company, segment, area, phone, website, priority (A / B / C), status (NOT_CONTACTED / RESEARCHING / CONTACTED / MEETING_SET / ASSESSMENT_DONE / PROPOSAL_SENT / WON / LOST / NOT_A_FIT), owner, lastContactAt, nextStep, notes, createdAt, updatedAt

---

## 5. Integration layer

Create `src/integrations/syncro`, `src/integrations/pax8` and `src/integrations/graph`. Each one gets:

- a TypeScript interface,
- a **mock** implementation backed by JSON fixtures, and
- a **live** implementation.

Choose between them with `INTEGRATIONS_MODE=mock|live`, defaulting to `mock`.

**Syncro (live):** a typed REST client with a configurable `SYNCRO_BASE_URL` and `SYNCRO_API_KEY`. Implement read-only list calls with pagination for customers, assets and invoices/recurring invoices. Follow the official docs linked above. **Do not invent endpoints or field names.** Where you are unsure of a field, map it defensively, add a `// TODO(verify): <doc link>` comment, and cover it with a mock fixture.

**Pax8 (live):** define the interface (list companies, list subscriptions) and a live client skeleton that reads `PAX8_CLIENT_ID` and `PAX8_CLIENT_SECRET`. **Do not guess the authentication flow or endpoints.** Leave them as clearly marked `TODO(verify)` stubs that throw a helpful error, and make the mock implementation fully functional.

**Microsoft Graph:** interface and mock only (placeholder for the later onboarding module).

**Sync job:** a `pnpm sync` script and an admin-only "Run sync" button. Both pull from the integrations into the database using idempotent upserts keyed on external IDs, record a `SyncRun`, write an `AuditLog` entry, and use a small retry-with-backoff helper for rate limits.

---

## 6. Reconciliation logic

Write pure functions in `src/lib/reconcile.ts` with thorough Vitest tests:

- **MRR per client** = sum of monthly billing lines + (sum of annual billing lines ÷ 12)
- **Total MRR**, and the **concentration** of revenue in the top 1 and top 3 clients (as percentages of total MRR)
- **LICENSE_QTY_MISMATCH**: a Pax8 subscription quantity differs from the quantity billed for the matching product. Match on SKU, with a manual mapping table as fallback.
- **UNBILLED_LICENSE**: the client has Pax8 subscriptions but no matching billing line
- **BELOW_PRICE_FLOOR**: the client's monthly managed revenue divided by managed device count is below `PRICE_FLOOR_PER_DEVICE_CENTS`
- **NO_BILLING**: the client has managed devices but no billing lines

Rerunning reconciliation must not duplicate open issues. Update an existing open issue instead.

---

## 7. Pages

1. **Sign in**: a "Sign in with Microsoft" button only
2. **Dashboard**:
   - stat cards for total MRR, active clients, managed devices, open issues, and top-client concentration %
   - a bar chart of MRR by client (top 15)
   - a sortable table of all clients with MRR, device count, MRR per device, and open issues
3. **Clients**: a searchable list, and a detail page showing billing lines, licenses, devices, issues and an activity history from the audit log
4. **Issues**: a queue filterable by type and status. TECH and ADMIN users can resolve or ignore an issue with a required note, which is written to the audit log.
5. **Prospects**:
   - a filterable, sortable table
   - inline editing of status, owner, last contact and next step
   - CSV import using these columns: Company, Segment, Area, Phone, Website, Priority, Notes, Status, Owner, Last contact, Next step
6. **Admin** (ADMIN role only): manage user roles, view sync run history, and trigger a sync
7. **Placeholders**: Client Health, Onboarding, and SOPs pages labeled "Coming soon"

Use a clean, plain business look with a left sidebar for navigation, and support light and dark mode. Format currency as USD.

---

## 8. Seed data

`pnpm db:seed` creates:

- about 10 clients with **obviously fake names**
- billing lines (monthly and annual), Pax8-style subscriptions and devices
- a few deliberate mismatches, so every issue type appears on the dashboard
- 5 sample prospects
- one admin user from `ADMIN_EMAILS`

---

## 9. Deliverables and output format

1. Print the complete file tree first.
2. Then output **every file in full**. No `...` or "rest of file here" placeholders. The only allowed gaps are the clearly marked `TODO(verify)` stubs described above.
3. `README.md` covering:
   - prerequisites
   - setup steps: `pnpm install`, `docker compose up -d`, `prisma migrate dev`, `pnpm db:seed`, `pnpm dev`
   - step-by-step **Microsoft Entra app registration**: redirect URI, which IDs and secrets to copy, which environment variables they go in, and restricting sign-in to our tenant
   - how to switch from mock to live integrations safely
   - the project structure, coding conventions, and how to add a new module
   - an "Assumptions" section
4. `.env.example` listing every variable, with a one-line comment each.
5. All tests must pass, and `pnpm build` must succeed on a fresh clone in mock mode.
