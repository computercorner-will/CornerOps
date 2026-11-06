# CornerOps

Internal operations app for our MSP. It **reads** from the tools we already use (Syncro, Pax8,
Microsoft 365) and fills the gaps between them. It does not replace them.

**v1 feature:** billing reconciliation and an MRR (monthly recurring revenue) dashboard.
**Coming soon (navigation placeholders):** Client Health, Onboarding/Offboarding, SOP Library.

| Area         | Choice                                                        |
| ------------ | ------------------------------------------------------------- |
| App          | Next.js 16 (App Router) + TypeScript (strict)                 |
| UI           | Tailwind CSS 4 + shadcn/ui components, light/dark mode        |
| Data         | PostgreSQL + Prisma 7 (`docker-compose.yml` for local)        |
| Auth         | Auth.js (next-auth v5) with Microsoft Entra ID, single tenant |
| Validation   | Zod (inputs and environment variables)                        |
| Tests        | Vitest (unit) + Playwright (one smoke test)                   |
| Tooling / CI | pnpm, ESLint, Prettier, GitHub Actions                        |

---

## Prerequisites

- **Node.js 22.12+** (24 recommended)
- **pnpm 10** (`corepack enable` and the version pinned in `package.json` is used automatically)
- **Docker** (for the local Postgres), or any PostgreSQL 15+ you can point `DATABASE_URL` at
- For real sign-in: an **Entra ID app registration** (see below). Not needed to build or run tests.

## Setup

```bash
pnpm install                 # also runs `prisma generate`
cp .env.example .env         # placeholders work for mock mode; fill in Entra values to sign in
docker compose up -d         # local Postgres on localhost:5432
pnpm prisma migrate dev      # create the schema
pnpm db:seed                 # fake demo data (always mock data, never real clients)
pnpm dev                     # http://localhost:3000
```

Other scripts:

| Command                       | What it does                                            |
| ----------------------------- | ------------------------------------------------------- |
| `pnpm lint` / `pnpm format`   | ESLint / Prettier                                       |
| `pnpm typecheck`              | `tsc --noEmit`                                          |
| `pnpm test`                   | Vitest unit tests                                       |
| `pnpm build && pnpm test:e2e` | Production build, then the Playwright smoke test        |
| `pnpm sync`                   | Pull Syncro + Pax8 into the DB and rerun reconciliation |
| `pnpm db:studio`              | Browse the database with Prisma Studio                  |

The first time you run Playwright locally: `pnpm exec playwright install chromium`.

### Seed data

`pnpm db:seed` is safe to rerun. It creates:

- 10 obviously fake clients, all named "… (Demo)", with 123 devices
- monthly and annual billing lines (from mock Syncro recurring invoices) plus one manual line
- Pax8-style license subscriptions and one manual SKU mapping
- 5 sample prospects
- an ADMIN user for every address in `ADMIN_EMAILS`
- deliberate mismatches, so one issue of **each** type is open:

| Client                        | Issue                | Why                                               |
| ----------------------------- | -------------------- | ------------------------------------------------- |
| Bluebird Dental (Demo)        | LICENSE_QTY_MISMATCH | 14 Business Premium seats in Pax8, 12 billed      |
| Cobalt Law Example LLP (Demo) | UNBILLED_LICENSE     | Defender for Business in Pax8, no billing line    |
| Dunder Paper Test Co (Demo)   | BELOW_PRICE_FLOOR    | $1,000/month over 20 devices = $50/device (< $75) |
| Evergreen Vet Sample Clinic   | NO_BILLING           | 5 devices, no billing lines                       |

---

## Microsoft Entra ID app registration

Staff sign in with their work accounts. Only accounts in **our** tenant can sign in.

1. In the [Microsoft Entra admin center](https://entra.microsoft.com), go to
   **Identity → Applications → App registrations → New registration**.
2. **Name:** `CornerOps` (or `CornerOps (dev)` for a separate dev registration).
3. **Supported account types:** _Accounts in this organizational directory only (Single tenant)_.
4. **Redirect URI:** platform **Web**, value:
   - local: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - production: `https://<your-domain>/api/auth/callback/microsoft-entra-id`

   (You can add more redirect URIs later under **Authentication**.)

5. Click **Register**. On the **Overview** page copy:
   - **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - **Directory (tenant) ID** → `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`
6. Go to **Certificates & secrets → Client secrets → New client secret**. Copy the secret
   **Value** (not the Secret ID) right away → `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
   Note the expiry date and rotate before it expires.
7. **API permissions:** the default delegated `User.Read` is enough. (`openid`, `profile` and
   `email` are requested at sign-in.) Grant admin consent if your tenant requires it.
8. Optional but recommended: **Enterprise applications → CornerOps → Properties →
   Assignment required = Yes**, then assign only the staff who should have access.
9. Generate `AUTH_SECRET` with `openssl rand -base64 32` (or `npx auth secret`).
10. Put your own email in `ADMIN_EMAILS` so your first sign-in is an admin.
11. In production, set `AUTH_URL` to the public base URL (e.g. `https://ops.example.com`).

**How the tenant restriction works:** the provider's issuer is pinned to
`https://login.microsoftonline.com/<tenant-id>/v2.0` (the env schema rejects `common` and
`organizations`), and the `signIn` callback also rejects any token whose `tid` claim is not our
tenant. New users start as `READONLY`. An admin can promote them on the **Admin** page.

---

## Switching from mock to live integrations safely

`INTEGRATIONS_MODE=mock` (the default) uses JSON fixtures in `src/integrations/*/fixtures`.
Development uses fake data only.

1. **Syncro first.** Create a Syncro API token with **read-only** permissions:
   Customers List/Search, Assets List/Search, Invoices List/Search, Recurring Invoices List.
   Do not grant any edit or delete permissions.
2. Set in `.env` (never commit it):
   ```
   INTEGRATIONS_MODE=live
   SYNCRO_BASE_URL=https://<subdomain>.syncromsp.com/api/v1
   SYNCRO_API_KEY=<token>
   PAX8_CLIENT_ID=<id>
   PAX8_CLIENT_SECRET=<secret>
   ```
   The app refuses to start in live mode if any of these are missing.
3. **Pax8 is not implemented yet.** `src/integrations/pax8/live.ts` is a skeleton whose methods
   throw a clear error. Implement it from Pax8's official API docs (see the `TODO(verify)`
   comments) before relying on license reconciliation. Until then, a live sync reports
   **Syncro: SUCCESS, Pax8: FAILED**, and the Syncro data is still imported.
4. Review every `TODO(verify)` in `src/integrations/syncro/mapping.ts` and `live.ts` against a
   real response. The places the docs did not confirm are: the asset "last seen" field,
   schedule line-item SKUs and line placement, frequency values, and pagination on `/schedules`.
5. Try it against a **separate database** first (a copy of production, or a fresh dev DB):
   run `pnpm sync`, check the Admin → Sync history, then spot-check a few clients against Syncro.
6. Only then point production at live mode. Syncs are idempotent (upserts on external IDs),
   so rerunning is safe.

Safety rails already in place:

- Integration clients issue **GET requests only**. There are no create/update/delete calls.
- API keys are read from server-side env only. They are never sent to the browser, logged,
  or put in error messages. A unit test checks that the key does not leak into errors.
- Rate limits (429) and 5xx errors retry with exponential backoff that honours `Retry-After`.
- Only one sync can run at a time.
- Every sync run writes a `SyncRun` row and an `AuditLog` entry.

---

## Project structure

```
prisma/
  schema.prisma            data model (money in integer cents, timestamps in UTC)
  migrations/              SQL migrations
  seed.ts                  fake demo data (always uses mock integrations)
prisma.config.ts           Prisma CLI config (schema path, seed command, DATABASE_URL)
scripts/sync.ts            `pnpm sync`
src/
  env.ts                   Zod-validated server environment (fails fast at startup)
  auth.ts                  Auth.js + Entra ID (single tenant), admin bootstrap
  proxy.ts                 protects every route except /signin and /api/auth
  instrumentation.ts       validates env when the server boots
  app/
    signin/                "Sign in with Microsoft"
    api/auth/[...nextauth] Auth.js route handler
    (app)/                 authenticated pages with the sidebar layout
      page.tsx             dashboard (stat cards, MRR chart, client table)
      clients/             list + detail (billing, licenses, devices, issues, activity)
      issues/              issue queue + resolve/ignore server action
      prospects/           pipeline table, inline edit, CSV import
      admin/               user roles, sync history, Run sync
      health/ onboarding/ sops/   "Coming soon" placeholders
  components/              app components; components/ui = shadcn/ui primitives
  integrations/
    index.ts               picks mock or live by INTEGRATIONS_MODE
    syncro/                types, mapping, live REST client, mock + fixtures
    pax8/                  types, live skeleton (TODO(verify)), mock + fixtures
    graph/                 types + mock only (for the onboarding module)
  lib/
    reconcile.ts           PURE reconciliation rules (MRR, concentration, issues, plan)
    run-reconciliation.ts  loads data, applies the reconciliation plan in a transaction
    client-summaries.ts    per-client MRR/device/issue rows for dashboard and lists
    prospect-csv.ts        CSV parsing/validation for prospect import
    issues.ts              issue labels and human-readable descriptions
    audit.ts               writeAudit(): every write goes through here
    session.ts / roles.ts  current user, requireUser / requireRole, role checks
    retry.ts, format.ts, db.ts, utils.ts
  sync/run-sync.ts         Syncro/Pax8 → DB upserts, SyncRun + audit, then reconcile
tests/e2e/smoke.spec.ts    Playwright smoke test
```

## Coding conventions

- **Keep it simple.** One Next.js app, one database. Server components read data directly with
  Prisma. Mutations are **server actions** in an `actions.ts` next to the page.
- **Business rules are pure functions** in `src/lib` with Vitest tests next to them
  (`*.test.ts`). Database and network code stays thin and calls into them.
- **Every write is audited.** Call `writeAudit()` inside the same transaction as the change.
  Use `userId: null` only for system jobs.
- **Every server action checks the role first** with `requireRole([...])` and validates its
  input with Zod. Hiding a button in the UI is not access control.
- **Money is integer cents** (`…Cents` fields). Format only at the edge with `formatUsd()`.
  **Timestamps are UTC** and shown as UTC.
- **Never store credentials.** The schema must not contain client passwords, admin
  credentials, MFA secrets or recovery keys. (Syncro exposes BitLocker recovery-key endpoints;
  we never call them.)
- Integration code is server-only and read-only in v1. Unconfirmed API details are marked
  `// TODO(verify): <doc link>` and covered by a fixture.
- Formatting is Prettier's job. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing.

## Adding a new module

Example: turning "Client Health" from a placeholder into a real module.

1. **Data:** add models to `prisma/schema.prisma`, then run
   `pnpm prisma migrate dev --name client_health`.
2. **Integration (if needed):** add `src/integrations/<name>/` with `types.ts` (interface),
   `mock.ts` + `fixtures/`, and `live.ts`, and wire it into `src/integrations/index.ts`.
3. **Logic:** put rules in `src/lib/<module>.ts` as pure functions, with `<module>.test.ts`.
4. **UI:** replace `src/app/(app)/health/page.tsx`. Put mutations in
   `src/app/(app)/health/actions.ts` using `requireRole` + Zod + `writeAudit`.
5. **Navigation:** move the item from `comingSoonItems` to `mainItems` in
   `src/components/sidebar-nav.tsx`.
6. Add any new env vars to `src/env.ts` **and** `.env.example` (with a one-line comment).

To add shadcn/ui components: `pnpm dlx shadcn@latest add <component>` (`components.json` is
configured for this repo).

## Deployment notes

Deploy to a single VM (`pnpm build && pnpm start` behind a TLS reverse proxy) or to Vercel with
managed Postgres. Run `pnpm prisma migrate deploy` on each release. Schedule `pnpm sync` with
cron (VM) or a scheduled job if you want automatic syncs. It is safe to run repeatedly.

---

## Assumptions

Choices made where the brief was ambiguous:

1. **Versions.** All versions are pinned to the current stable releases as of November 2026,
   except where the latest would break the build:
   - **ESLint 9.39** (ESLint 10 is out, but `eslint-config-next`'s React plugin does not
     support it yet).
   - **TypeScript 6.0** (TypeScript 7 is out, but `typescript-eslint` supports `<6.1`).
   - **next-auth 5.0.0-beta.32**. Auth.js v5 is still published under a beta tag. It is the
     version the Auth.js docs use for the App Router.
   - **Prisma 7.10.1**. npm's `latest` tag currently points at an 8.0 release candidate, which
     we did not use.
   - **pnpm 10.34**.
2. **Sessions** are stateless JWTs (8-hour lifetime) holding only the user ID. The role is read
   from the database on each request, so role changes apply immediately.
3. **Admin bootstrap.** Emails in `ADMIN_EMAILS` are made ADMIN when seeded and promoted on
   sign-in. Removing an email from the list does not demote anyone. Use the Admin page for that.
   The last admin cannot be demoted.
4. **Matching Pax8 companies to clients.** A company matches a client by stored
   `pax8CompanyId`, or else by exact (case-insensitive) name, which is then saved. Unmatched
   companies are counted in the sync's audit entry.
5. **SKU matching.** `BillingLine.sku` (an extra field beyond the brief) holds the product SKU
   when Syncro provides one. Otherwise the `SkuMapping` table maps a Pax8 SKU to a billing-line
   **description** (exact, case-insensitive). Quantities are summed when a client has several
   lines or subscriptions for one SKU.
6. **Managed revenue** for the price floor is the client's MRR **excluding** billing lines matched
   to Pax8 licenses (license resale is mostly pass-through cost). The floor only applies to
   clients with at least one device. A client exactly at the floor is not flagged.
7. **MRR rounding.** Each client's MRR is rounded to the nearest cent after dividing annual lines
   by 12. Dashboard totals cover **active** clients only.
8. **Issue lifecycle.** Each issue has a stable `key` (e.g. `sku:M365-BPREM`, or `client`).
   - On rerun, an open issue with the same client, type and key is **updated**, not duplicated.
   - An **ignored** issue is not recreated.
   - A **resolved** issue that reappears becomes a new open issue.
   - An open issue that is no longer detected is **auto-resolved** with a system note.
9. **Syncro mapping** (details in `TODO(verify)` comments):
   - Recurring invoices are Syncro "schedules".
   - Paused or inactive schedules, schedules with frequencies other than monthly or annual,
     and one-time-charge lines are excluded from MRR.
   - Disabled customers become INACTIVE clients.
   - Syncro lines and devices that disappear from Syncro are deleted locally. MANUAL lines are
     never touched by sync.
   - Invoices are readable through the client but are not stored in v1.
10. **Syncro auth** uses the `Authorization: Bearer` header (the docs also allow an `api_key`
    query parameter, which we avoid because it would leak into URLs and logs).
11. **Prospect CSV import** is all-or-nothing:
    - Any invalid row means nothing is imported.
    - Companies already present (case-insensitive) are skipped.
    - Headers are case-insensitive and column order does not matter. Only Company is required.
    - Blank Priority defaults to C and blank Status to Not contacted.
    - Dates may be `YYYY-MM-DD` or `M/D/YYYY`, and are stored as UTC midnight.
    - Limits: 1 MB and 2,000 rows.
12. **Activity history** on a client page shows audit entries for the client and its issues.
13. **Permissions:** TECH and ADMIN can resolve or ignore issues and edit or import prospects.
    READONLY users can view everything except the Admin page.
14. **Security headers:** a CSP that allows inline scripts (needed by Next.js hydration and the
    theme script), `X-Frame-Options: DENY`, `nosniff`, HSTS, a strict referrer policy and a
    minimal Permissions-Policy. A nonce-based CSP would be stricter but adds complexity.
15. **No web fonts** are loaded (system font stack), which keeps the CSP simple and the build
    offline-friendly.
16. **CI** runs the Playwright smoke test after the build. The smoke test only covers the
    sign-in redirect and security headers, so it needs no database or Microsoft login.
