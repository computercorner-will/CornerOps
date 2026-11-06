/**
 * Pure billing-reconciliation functions. No database or network access here, so
 * everything is easy to unit test. Money is always integer cents.
 */

export type BillingFrequency = 'MONTHLY' | 'ANNUAL';

export type IssueType =
  'LICENSE_QTY_MISMATCH' | 'UNBILLED_LICENSE' | 'BELOW_PRICE_FLOOR' | 'NO_BILLING';

export interface BillingLineInput {
  description: string;
  sku: string | null;
  frequency: BillingFrequency;
  quantity: number;
  amountCents: number;
}

export interface LicenseInput {
  sku: string;
  productName: string;
  quantity: number;
}

export interface SkuMappingInput {
  pax8Sku: string;
  billingDescription: string;
}

export interface ClientReconInput {
  clientId: string;
  billingLines: BillingLineInput[];
  licenses: LicenseInput[];
  deviceCount: number;
}

export interface ReconcileOptions {
  mappings: SkuMappingInput[];
  priceFloorPerDeviceCents: number;
}

export interface DetectedIssue {
  clientId: string;
  type: IssueType;
  /** Identity of the finding within the client, e.g. "sku:ABC" or "client". */
  key: string;
  details: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// MRR
// ---------------------------------------------------------------------------

/** MRR = sum of monthly lines + (sum of annual lines / 12), rounded to the nearest cent. */
export function clientMrrCents(lines: Pick<BillingLineInput, 'frequency' | 'amountCents'>[]) {
  let monthly = 0;
  let annual = 0;
  for (const line of lines) {
    if (line.frequency === 'MONTHLY') monthly += line.amountCents;
    else annual += line.amountCents;
  }
  return Math.round(monthly + annual / 12);
}

export function totalMrrCents(clientMrrs: number[]): number {
  return clientMrrs.reduce((sum, mrr) => sum + mrr, 0);
}

/** Share of total MRR held by the largest 1 and 3 clients, as percentages (0–100). */
export function revenueConcentration(clientMrrs: number[]): { top1Pct: number; top3Pct: number } {
  const total = totalMrrCents(clientMrrs);
  if (total <= 0) return { top1Pct: 0, top3Pct: 0 };
  const sorted = [...clientMrrs].sort((a, b) => b - a);
  const top1 = sorted[0] ?? 0;
  const top3 = sorted.slice(0, 3).reduce((sum, mrr) => sum + mrr, 0);
  return { top1Pct: (top1 / total) * 100, top3Pct: (top3 / total) * 100 };
}

// ---------------------------------------------------------------------------
// Matching licenses to billing lines
// ---------------------------------------------------------------------------

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Billing lines that bill for a Pax8 SKU. Matches on the line's SKU first; if no line
 * carries the SKU, falls back to the manual mapping table (by billing description).
 */
export function findBillingLinesForSku<T extends BillingLineInput>(
  sku: string,
  lines: T[],
  mappings: SkuMappingInput[],
): T[] {
  const target = normalize(sku);
  const bySku = lines.filter((line) => line.sku !== null && normalize(line.sku) === target);
  if (bySku.length > 0) return bySku;

  const mapping = mappings.find((m) => normalize(m.pax8Sku) === target);
  if (!mapping) return [];
  const description = normalize(mapping.billingDescription);
  return lines.filter((line) => normalize(line.description) === description);
}

/** Groups subscriptions by SKU, summing quantities (a client can have several per SKU). */
export function groupLicensesBySku(licenses: LicenseInput[]): LicenseInput[] {
  const groups = new Map<string, LicenseInput>();
  for (const license of licenses) {
    const key = normalize(license.sku);
    const existing = groups.get(key);
    if (existing) existing.quantity += license.quantity;
    else groups.set(key, { ...license });
  }
  return [...groups.values()];
}

// ---------------------------------------------------------------------------
// Issue detection
// ---------------------------------------------------------------------------

export function detectClientIssues(
  client: ClientReconInput,
  options: ReconcileOptions,
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const licenseLines = new Set<BillingLineInput>();

  for (const license of groupLicensesBySku(client.licenses)) {
    const matches = findBillingLinesForSku(license.sku, client.billingLines, options.mappings);
    matches.forEach((line) => licenseLines.add(line));
    const key = `sku:${license.sku.toUpperCase()}`;

    if (matches.length === 0) {
      issues.push({
        clientId: client.clientId,
        type: 'UNBILLED_LICENSE',
        key,
        details: {
          sku: license.sku,
          productName: license.productName,
          pax8Quantity: license.quantity,
        },
      });
      continue;
    }

    const billedQuantity = matches.reduce((sum, line) => sum + line.quantity, 0);
    if (billedQuantity !== license.quantity) {
      issues.push({
        clientId: client.clientId,
        type: 'LICENSE_QTY_MISMATCH',
        key,
        details: {
          sku: license.sku,
          productName: license.productName,
          pax8Quantity: license.quantity,
          billedQuantity,
          difference: license.quantity - billedQuantity,
        },
      });
    }
  }

  if (client.deviceCount > 0 && client.billingLines.length === 0) {
    issues.push({
      clientId: client.clientId,
      type: 'NO_BILLING',
      key: 'client',
      details: { deviceCount: client.deviceCount },
    });
  } else if (client.deviceCount > 0) {
    // Managed revenue excludes license resale lines, which are mostly pass-through cost.
    const managedLines = client.billingLines.filter((line) => !licenseLines.has(line));
    const managedMrrCents = clientMrrCents(managedLines);
    const perDeviceCents = managedMrrCents / client.deviceCount;
    if (perDeviceCents < options.priceFloorPerDeviceCents) {
      issues.push({
        clientId: client.clientId,
        type: 'BELOW_PRICE_FLOOR',
        key: 'client',
        details: {
          managedMrrCents,
          deviceCount: client.deviceCount,
          perDeviceCents: Math.round(perDeviceCents),
          floorCents: options.priceFloorPerDeviceCents,
        },
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Planning database changes (idempotent reruns)
// ---------------------------------------------------------------------------

export interface ExistingIssue {
  id: string;
  clientId: string;
  type: IssueType;
  key: string;
  status: 'OPEN' | 'RESOLVED' | 'IGNORED';
}

export interface IssuePlan {
  create: DetectedIssue[];
  update: { id: string; details: DetectedIssue['details'] }[];
  /** Open issues that were not detected this run (the underlying problem was fixed). */
  autoResolve: string[];
}

const identity = (issue: { clientId: string; type: IssueType; key: string }) =>
  `${issue.clientId}|${issue.type}|${issue.key}`;

/**
 * Decides what to write so that rerunning reconciliation never duplicates an open issue:
 * - detected + already OPEN    -> update the existing issue's details
 * - detected + already IGNORED -> leave it alone (someone decided it is fine)
 * - detected + otherwise       -> create a new OPEN issue
 * - OPEN but no longer detected -> auto-resolve
 */
export function planIssueChanges(detected: DetectedIssue[], existing: ExistingIssue[]): IssuePlan {
  const open = new Map<string, ExistingIssue>();
  const ignored = new Set<string>();
  for (const issue of existing) {
    if (issue.status === 'OPEN') open.set(identity(issue), issue);
    if (issue.status === 'IGNORED') ignored.add(identity(issue));
  }

  const plan: IssuePlan = { create: [], update: [], autoResolve: [] };
  const seen = new Set<string>();

  for (const issue of detected) {
    const id = identity(issue);
    if (seen.has(id)) continue;
    seen.add(id);

    const match = open.get(id);
    if (match) plan.update.push({ id: match.id, details: issue.details });
    else if (!ignored.has(id)) plan.create.push(issue);
  }

  for (const [id, issue] of open) {
    if (!seen.has(id)) plan.autoResolve.push(issue.id);
  }

  return plan;
}
