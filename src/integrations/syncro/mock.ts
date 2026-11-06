import assets from './fixtures/assets.json';
import customers from './fixtures/customers.json';
import invoices from './fixtures/invoices.json';
import schedules from './fixtures/schedules.json';
import { mapAsset, mapCustomer, mapInvoice, mapSchedule } from './mapping';
import type { SyncroClient } from './types';

/**
 * Mock Syncro client backed by JSON fixtures shaped like real API responses.
 * Runs the same mappers as the live client, so the fixtures also test the mapping.
 * All names are fake.
 */
export class MockSyncroClient implements SyncroClient {
  async listCustomers() {
    return customers.customers.map(mapCustomer);
  }

  async listAssets() {
    return assets.assets.map(mapAsset);
  }

  async listRecurringInvoices() {
    return schedules.schedules.map(mapSchedule);
  }

  async listInvoices() {
    return invoices.invoices.map(mapInvoice);
  }
}
