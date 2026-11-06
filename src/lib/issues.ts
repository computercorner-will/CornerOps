import { formatUsd } from '@/lib/format';
import type { IssueType } from '@/lib/reconcile';

export const ISSUE_TYPES: IssueType[] = [
  'LICENSE_QTY_MISMATCH',
  'UNBILLED_LICENSE',
  'BELOW_PRICE_FLOOR',
  'NO_BILLING',
];

export const ISSUE_STATUSES = ['OPEN', 'RESOLVED', 'IGNORED'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  LICENSE_QTY_MISMATCH: 'License quantity mismatch',
  UNBILLED_LICENSE: 'Unbilled license',
  BELOW_PRICE_FLOOR: 'Below price floor',
  NO_BILLING: 'No billing',
};

const num = (details: Record<string, unknown>, key: string) =>
  typeof details[key] === 'number' ? (details[key] as number) : 0;
const str = (details: Record<string, unknown>, key: string) =>
  typeof details[key] === 'string' ? (details[key] as string) : '';

/** One-line, human-readable explanation of an issue's details JSON. */
export function describeIssue(type: IssueType, raw: unknown): string {
  const details = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  switch (type) {
    case 'LICENSE_QTY_MISMATCH':
      return `${str(details, 'productName')} (${str(details, 'sku')}): Pax8 has ${num(details, 'pax8Quantity')}, billing has ${num(details, 'billedQuantity')}.`;
    case 'UNBILLED_LICENSE':
      return `${str(details, 'productName')} (${str(details, 'sku')}): ${num(details, 'pax8Quantity')} in Pax8 with no matching billing line.`;
    case 'BELOW_PRICE_FLOOR':
      return `${formatUsd(num(details, 'perDeviceCents'))} per device (${formatUsd(num(details, 'managedMrrCents'))} across ${num(details, 'deviceCount')} devices) is below the ${formatUsd(num(details, 'floorCents'))} floor.`;
    case 'NO_BILLING':
      return `${num(details, 'deviceCount')} managed devices but no billing lines.`;
  }
}
