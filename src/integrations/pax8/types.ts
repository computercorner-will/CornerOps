/** Normalized, read-only view of the Pax8 data CornerOps needs. */

export interface Pax8Company {
  id: string;
  name: string;
  status: string;
}

export interface Pax8Subscription {
  id: string;
  companyId: string;
  productName: string;
  sku: string;
  quantity: number;
  /** Our cost per unit, in integer cents. */
  unitCostCents: number;
  billingTerm: string;
  status: string;
}

/** Read-only by design: v1 must never create, update or delete anything in Pax8. */
export interface Pax8Client {
  listCompanies(): Promise<Pax8Company[]>;
  listSubscriptions(): Promise<Pax8Subscription[]>;
}
