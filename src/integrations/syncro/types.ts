/**
 * Normalized, read-only view of the Syncro data CornerOps needs.
 * Live and mock implementations both return these shapes, so the rest of the app
 * never sees raw Syncro JSON.
 */

export interface SyncroCustomer {
  id: string;
  businessName: string;
  disabled: boolean;
  notes: string | null;
}

export interface SyncroAsset {
  id: string;
  customerId: string;
  name: string;
  assetType: string | null;
  lastSeenAt: Date | null;
}

export interface SyncroRecurringLine {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  /** Product SKU when Syncro provides one; used to match Pax8 subscriptions. */
  sku: string | null;
}

/** A Syncro recurring invoice ("schedule" in the Syncro API). */
export interface SyncroRecurringInvoice {
  id: string;
  customerId: string;
  name: string;
  frequency: 'MONTHLY' | 'ANNUAL' | 'OTHER';
  active: boolean;
  lines: SyncroRecurringLine[];
}

export interface SyncroInvoice {
  id: string;
  customerId: string;
  number: string;
  date: string;
  totalCents: number;
  isPaid: boolean;
}

/** Read-only by design: v1 must never create, update or delete anything in Syncro. */
export interface SyncroClient {
  listCustomers(): Promise<SyncroCustomer[]>;
  listAssets(): Promise<SyncroAsset[]>;
  listRecurringInvoices(): Promise<SyncroRecurringInvoice[]>;
  listInvoices(options?: { sinceUpdatedAt?: Date }): Promise<SyncroInvoice[]>;
}
