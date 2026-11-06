import type {
  SyncroAsset,
  SyncroCustomer,
  SyncroInvoice,
  SyncroRecurringInvoice,
  SyncroRecurringLine,
} from './types';

/**
 * Defensive mappers from raw Syncro JSON to our normalized types.
 * Field names come from the official API docs: https://api-docs.syncromsp.com/
 * Anything marked TODO(verify) was not confirmed against a real account.
 * Shared by the live client and the mock client, so the JSON fixtures exercise them too.
 */

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw =>
  value !== null && typeof value === 'object' ? (value as Raw) : {};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : typeof value === 'number'
      ? String(value)
      : null;

/** Syncro sends some numbers as strings, e.g. quantity "10.0". */
const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asDate = (value: unknown): Date | null => {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const requireId = (raw: Raw, what: string): string => {
  const id = asString(raw.id);
  if (!id) throw new Error(`Syncro ${what} is missing an id`);
  return id;
};

export function mapCustomer(value: unknown): SyncroCustomer {
  const raw = asRecord(value);
  return {
    id: requireId(raw, 'customer'),
    // Business customers have business_name; individuals fall back to fullname.
    businessName:
      asString(raw.business_name) ??
      asString(raw.business_then_name) ??
      asString(raw.fullname) ??
      'Unnamed customer',
    disabled: raw.disabled === true,
    notes: asString(raw.notes),
  };
}

export function mapAsset(value: unknown): SyncroAsset {
  const raw = asRecord(value);
  const customerId = asString(raw.customer_id) ?? asString(asRecord(raw.customer).id);
  if (!customerId) throw new Error('Syncro asset is missing customer_id');
  return {
    id: requireId(raw, 'asset'),
    customerId,
    name: asString(raw.name) ?? 'Unnamed device',
    assetType: asString(raw.asset_type),
    // TODO(verify): the asset list example in https://api-docs.syncromsp.com/ has no
    // "last seen" field. We try properties.last_seen / rmm_store.updated_at and fall back
    // to the asset's updated_at. Confirm against a real RMM-managed asset.
    lastSeenAt:
      asDate(asRecord(raw.properties).last_seen) ??
      asDate(asRecord(raw.rmm_store).updated_at) ??
      asDate(raw.updated_at),
  };
}

export function mapRecurringLine(value: unknown): SyncroRecurringLine {
  const raw = asRecord(value);
  const retailCents = asNumber(raw.retail_cents);
  const priceRetail = asNumber(raw.price_retail);
  return {
    id: requireId(raw, 'schedule line item'),
    name: asString(raw.name) ?? asString(raw.description) ?? 'Line item',
    quantity: Math.round(asNumber(raw.quantity) ?? 0),
    unitPriceCents: retailCents ?? (priceRetail !== null ? Math.round(priceRetail * 100) : 0),
    // TODO(verify): schedule line items expose product_id but no SKU. We use an explicit
    // "sku" field if present, otherwise vendor_product_name; otherwise matching falls back
    // to the SkuMapping table. https://api-docs.syncromsp.com/ (Schedule > line items)
    sku: asString(raw.sku) ?? asString(raw.vendor_product_name),
  };
}

/**
 * TODO(verify): the docs show frequency values such as "Daily" but do not list every value.
 * We treat anything containing "month" as monthly and "year"/"annual" as annual.
 * https://api-docs.syncromsp.com/ (Schedule)
 */
export function mapFrequency(value: unknown): SyncroRecurringInvoice['frequency'] {
  const text = (asString(value) ?? '').toLowerCase();
  if (text.includes('month')) return 'MONTHLY';
  if (text.includes('year') || text.includes('annual')) return 'ANNUAL';
  return 'OTHER';
}

export function mapSchedule(value: unknown): SyncroRecurringInvoice {
  const raw = asRecord(value);
  const customerId = asString(raw.customer_id);
  if (!customerId) throw new Error('Syncro schedule is missing customer_id');
  // TODO(verify): the list example returns "lines": []. Confirm the key and whether line
  // items are populated in GET /schedules or only in GET /schedules/{id}.
  const rawLines = Array.isArray(raw.lines)
    ? raw.lines
    : Array.isArray(raw.schedule_line_items)
      ? raw.schedule_line_items
      : [];
  return {
    id: requireId(raw, 'schedule'),
    customerId,
    name: asString(raw.name) ?? asString(raw.generated_invoice_name) ?? 'Recurring invoice',
    frequency: mapFrequency(raw.frequency),
    active: raw.paused !== true && (asString(raw.subscription_status) ?? 'active') === 'active',
    lines: rawLines
      .map((line) => asRecord(line))
      // one_time_charge lines are billed once, so they are not recurring revenue.
      .filter((line) => line.one_time_charge !== true)
      .map(mapRecurringLine),
  };
}

export function mapInvoice(value: unknown): SyncroInvoice {
  const raw = asRecord(value);
  return {
    id: requireId(raw, 'invoice'),
    customerId: asString(raw.customer_id) ?? '',
    number: asString(raw.number) ?? '',
    date: asString(raw.date) ?? '',
    // "total" is a decimal string in dollars, e.g. "125.50".
    totalCents: Math.round((asNumber(raw.total) ?? 0) * 100),
    isPaid: raw.is_paid === true,
  };
}
