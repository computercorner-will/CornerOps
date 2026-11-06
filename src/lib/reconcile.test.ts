import { describe, expect, it } from 'vitest';
import {
  type BillingLineInput,
  type ClientReconInput,
  type DetectedIssue,
  type ExistingIssue,
  clientMrrCents,
  detectClientIssues,
  findBillingLinesForSku,
  groupLicensesBySku,
  planIssueChanges,
  revenueConcentration,
  totalMrrCents,
} from './reconcile';

const line = (overrides: Partial<BillingLineInput> = {}): BillingLineInput => ({
  description: 'Managed services',
  sku: null,
  frequency: 'MONTHLY',
  quantity: 1,
  amountCents: 0,
  ...overrides,
});

const options = { mappings: [], priceFloorPerDeviceCents: 7500 };

const client = (overrides: Partial<ClientReconInput> = {}): ClientReconInput => ({
  clientId: 'c1',
  billingLines: [],
  licenses: [],
  deviceCount: 0,
  ...overrides,
});

describe('clientMrrCents', () => {
  it('returns 0 for no lines', () => {
    expect(clientMrrCents([])).toBe(0);
  });

  it('sums monthly lines', () => {
    expect(clientMrrCents([line({ amountCents: 100_000 }), line({ amountCents: 25_050 })])).toBe(
      125_050,
    );
  });

  it('divides annual lines by 12', () => {
    expect(clientMrrCents([line({ frequency: 'ANNUAL', amountCents: 120_000 })])).toBe(10_000);
  });

  it('combines monthly and annual lines and rounds to the nearest cent', () => {
    const lines = [
      line({ amountCents: 50_000 }),
      line({ frequency: 'ANNUAL', amountCents: 10_000 }), // 833.33...
      line({ frequency: 'ANNUAL', amountCents: 10_001 }), // together 1666.75 -> rounded once
    ];
    expect(clientMrrCents(lines)).toBe(51_667);
  });
});

describe('totalMrrCents and revenueConcentration', () => {
  it('totals client MRR', () => {
    expect(totalMrrCents([100, 200, 300])).toBe(600);
    expect(totalMrrCents([])).toBe(0);
  });

  it('computes top-1 and top-3 concentration as percentages', () => {
    const result = revenueConcentration([10_000, 50_000, 20_000, 10_000, 10_000]);
    expect(result.top1Pct).toBeCloseTo(50);
    expect(result.top3Pct).toBeCloseTo(80);
  });

  it('handles fewer than three clients', () => {
    expect(revenueConcentration([30_000, 10_000])).toEqual({ top1Pct: 75, top3Pct: 100 });
  });

  it('returns zeros when there is no revenue', () => {
    expect(revenueConcentration([])).toEqual({ top1Pct: 0, top3Pct: 0 });
    expect(revenueConcentration([0, 0])).toEqual({ top1Pct: 0, top3Pct: 0 });
  });
});

describe('findBillingLinesForSku', () => {
  const lines = [
    line({ description: 'M365 Business Premium', sku: 'cfq7ttc0lcck', quantity: 10 }),
    line({ description: 'Exchange Online Plan 1 (per user)', quantity: 4 }),
  ];

  it('matches on SKU case-insensitively', () => {
    expect(findBillingLinesForSku('CFQ7TTC0LCCK', lines, [])).toEqual([lines[0]]);
  });

  it('falls back to the manual mapping table by description', () => {
    const mappings = [
      { pax8Sku: 'CFQ7TTC0LH16', billingDescription: 'exchange online plan 1 (per user)' },
    ];
    expect(findBillingLinesForSku('CFQ7TTC0LH16', lines, mappings)).toEqual([lines[1]]);
  });

  it('prefers a SKU match over the mapping table', () => {
    const mappings = [
      { pax8Sku: 'CFQ7TTC0LCCK', billingDescription: 'Exchange Online Plan 1 (per user)' },
    ];
    expect(findBillingLinesForSku('CFQ7TTC0LCCK', lines, mappings)).toEqual([lines[0]]);
  });

  it('returns nothing when there is no match', () => {
    expect(findBillingLinesForSku('UNKNOWN', lines, [])).toEqual([]);
  });
});

describe('groupLicensesBySku', () => {
  it('sums quantities of subscriptions with the same SKU', () => {
    const grouped = groupLicensesBySku([
      { sku: 'A', productName: 'Product A', quantity: 3 },
      { sku: 'a', productName: 'Product A', quantity: 2 },
      { sku: 'B', productName: 'Product B', quantity: 1 },
    ]);
    expect(grouped).toEqual([
      { sku: 'A', productName: 'Product A', quantity: 5 },
      { sku: 'B', productName: 'Product B', quantity: 1 },
    ]);
  });

  it('does not mutate the input', () => {
    const input = [
      { sku: 'A', productName: 'Product A', quantity: 3 },
      { sku: 'A', productName: 'Product A', quantity: 2 },
    ];
    groupLicensesBySku(input);
    expect(input[0]?.quantity).toBe(3);
  });
});

describe('detectClientIssues', () => {
  const healthyLines = [
    line({ description: 'Managed services', quantity: 10, amountCents: 100_000 }),
    line({ description: 'M365 Business Premium', sku: 'BP', quantity: 10, amountCents: 22_000 }),
  ];

  it('returns no issues for a correctly billed client', () => {
    const result = detectClientIssues(
      client({
        billingLines: healthyLines,
        licenses: [{ sku: 'BP', productName: 'Business Premium', quantity: 10 }],
        deviceCount: 10,
      }),
      options,
    );
    expect(result).toEqual([]);
  });

  it('flags LICENSE_QTY_MISMATCH when Pax8 quantity differs from billed quantity', () => {
    const result = detectClientIssues(
      client({
        billingLines: healthyLines,
        licenses: [{ sku: 'BP', productName: 'Business Premium', quantity: 12 }],
        deviceCount: 10,
      }),
      options,
    );
    expect(result).toEqual([
      {
        clientId: 'c1',
        type: 'LICENSE_QTY_MISMATCH',
        key: 'sku:BP',
        details: {
          sku: 'BP',
          productName: 'Business Premium',
          pax8Quantity: 12,
          billedQuantity: 10,
          difference: 2,
        },
      },
    ]);
  });

  it('sums quantities across several billing lines for the same SKU', () => {
    const result = detectClientIssues(
      client({
        billingLines: [
          ...healthyLines,
          line({ description: 'M365 BP (new hires)', sku: 'BP', quantity: 2, amountCents: 4_400 }),
        ],
        licenses: [{ sku: 'BP', productName: 'Business Premium', quantity: 12 }],
        deviceCount: 10,
      }),
      options,
    );
    expect(result).toEqual([]);
  });

  it('flags UNBILLED_LICENSE when no billing line matches a subscription', () => {
    const result = detectClientIssues(
      client({
        billingLines: healthyLines,
        licenses: [
          { sku: 'BP', productName: 'Business Premium', quantity: 10 },
          { sku: 'DEF', productName: 'Defender for Business', quantity: 5 },
        ],
        deviceCount: 10,
      }),
      options,
    );
    expect(result).toEqual([
      {
        clientId: 'c1',
        type: 'UNBILLED_LICENSE',
        key: 'sku:DEF',
        details: { sku: 'DEF', productName: 'Defender for Business', pax8Quantity: 5 },
      },
    ]);
  });

  it('uses the mapping table for license matching', () => {
    const result = detectClientIssues(
      client({
        billingLines: [
          line({ description: 'Managed services', quantity: 10, amountCents: 100_000 }),
          line({ description: 'Email security', quantity: 7, amountCents: 2_100 }),
        ],
        licenses: [{ sku: 'EOP1', productName: 'Exchange Online Plan 1', quantity: 7 }],
        deviceCount: 10,
      }),
      { ...options, mappings: [{ pax8Sku: 'EOP1', billingDescription: 'Email Security' }] },
    );
    expect(result).toEqual([]);
  });

  it('flags NO_BILLING when a client has devices but no billing lines', () => {
    const result = detectClientIssues(client({ deviceCount: 4 }), options);
    expect(result).toEqual([
      { clientId: 'c1', type: 'NO_BILLING', key: 'client', details: { deviceCount: 4 } },
    ]);
  });

  it('does not flag NO_BILLING or price floor when a client has no devices', () => {
    expect(detectClientIssues(client(), options)).toEqual([]);
  });

  it('flags BELOW_PRICE_FLOOR using managed revenue only (license lines excluded)', () => {
    const result = detectClientIssues(
      client({
        billingLines: [
          line({ description: 'Managed services', quantity: 10, amountCents: 50_000 }),
          line({ description: 'M365 BP', sku: 'BP', quantity: 10, amountCents: 220_000 }),
        ],
        licenses: [{ sku: 'BP', productName: 'Business Premium', quantity: 10 }],
        deviceCount: 10,
      }),
      options,
    );
    expect(result).toEqual([
      {
        clientId: 'c1',
        type: 'BELOW_PRICE_FLOOR',
        key: 'client',
        details: {
          managedMrrCents: 50_000,
          deviceCount: 10,
          perDeviceCents: 5_000,
          floorCents: 7500,
        },
      },
    ]);
  });

  it('includes annual managed lines (÷12) in the price floor check', () => {
    // 60,000/month + 120,000/year (= 10,000/month) = 70,000 / 10 devices = 7,000 < 7,500
    const result = detectClientIssues(
      client({
        billingLines: [
          line({ amountCents: 60_000 }),
          line({ frequency: 'ANNUAL', amountCents: 120_000 }),
        ],
        deviceCount: 10,
      }),
      options,
    );
    expect(result.map((issue) => issue.type)).toEqual(['BELOW_PRICE_FLOOR']);
  });

  it('does not flag a client exactly at the floor', () => {
    const result = detectClientIssues(
      client({ billingLines: [line({ amountCents: 75_000 })], deviceCount: 10 }),
      options,
    );
    expect(result).toEqual([]);
  });
});

describe('planIssueChanges', () => {
  const detected = (overrides: Partial<DetectedIssue> = {}): DetectedIssue => ({
    clientId: 'c1',
    type: 'UNBILLED_LICENSE',
    key: 'sku:DEF',
    details: { pax8Quantity: 5 },
    ...overrides,
  });
  const existing = (overrides: Partial<ExistingIssue> = {}): ExistingIssue => ({
    id: 'i1',
    clientId: 'c1',
    type: 'UNBILLED_LICENSE',
    key: 'sku:DEF',
    status: 'OPEN',
    ...overrides,
  });

  it('creates issues that do not exist yet', () => {
    expect(planIssueChanges([detected()], [])).toEqual({
      create: [detected()],
      update: [],
      autoResolve: [],
    });
  });

  it('updates an existing open issue instead of duplicating it', () => {
    const plan = planIssueChanges([detected({ details: { pax8Quantity: 6 } })], [existing()]);
    expect(plan).toEqual({
      create: [],
      update: [{ id: 'i1', details: { pax8Quantity: 6 } }],
      autoResolve: [],
    });
  });

  it('is idempotent: running the same plan twice produces only updates', () => {
    const first = planIssueChanges([detected()], []);
    expect(first.create).toHaveLength(1);
    const second = planIssueChanges([detected()], [existing()]);
    expect(second.create).toHaveLength(0);
    expect(second.update).toHaveLength(1);
  });

  it('does not recreate an issue that someone ignored', () => {
    expect(planIssueChanges([detected()], [existing({ status: 'IGNORED' })])).toEqual({
      create: [],
      update: [],
      autoResolve: [],
    });
  });

  it('creates a new issue when a previously resolved problem comes back', () => {
    const plan = planIssueChanges([detected()], [existing({ status: 'RESOLVED' })]);
    expect(plan.create).toHaveLength(1);
  });

  it('auto-resolves open issues that are no longer detected', () => {
    const plan = planIssueChanges([], [existing(), existing({ id: 'i2', status: 'RESOLVED' })]);
    expect(plan.autoResolve).toEqual(['i1']);
  });

  it('treats the same key for different clients or types as different issues', () => {
    const plan = planIssueChanges(
      [detected({ clientId: 'c2' }), detected({ type: 'LICENSE_QTY_MISMATCH' })],
      [existing()],
    );
    expect(plan.create).toHaveLength(2);
    expect(plan.autoResolve).toEqual(['i1']);
  });

  it('collapses duplicate detections in the same run', () => {
    const plan = planIssueChanges([detected(), detected()], []);
    expect(plan.create).toHaveLength(1);
  });
});
