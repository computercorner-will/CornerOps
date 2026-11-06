import { describe, expect, it } from 'vitest';
import { describeIssue } from './issues';

describe('describeIssue', () => {
  it('describes a license quantity mismatch', () => {
    expect(
      describeIssue('LICENSE_QTY_MISMATCH', {
        sku: 'BP',
        productName: 'Business Premium',
        pax8Quantity: 14,
        billedQuantity: 12,
      }),
    ).toBe('Business Premium (BP): Pax8 has 14, billing has 12.');
  });

  it('describes an unbilled license', () => {
    expect(
      describeIssue('UNBILLED_LICENSE', { sku: 'DEF', productName: 'Defender', pax8Quantity: 9 }),
    ).toBe('Defender (DEF): 9 in Pax8 with no matching billing line.');
  });

  it('describes a price floor issue in USD', () => {
    expect(
      describeIssue('BELOW_PRICE_FLOOR', {
        perDeviceCents: 5000,
        managedMrrCents: 100000,
        deviceCount: 20,
        floorCents: 7500,
      }),
    ).toBe('$50.00 per device ($1,000.00 across 20 devices) is below the $75.00 floor.');
  });

  it('describes a client with no billing', () => {
    expect(describeIssue('NO_BILLING', { deviceCount: 5 })).toBe(
      '5 managed devices but no billing lines.',
    );
  });

  it('tolerates malformed details', () => {
    expect(describeIssue('NO_BILLING', null)).toBe('0 managed devices but no billing lines.');
  });
});
