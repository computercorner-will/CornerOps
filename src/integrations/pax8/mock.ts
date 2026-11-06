import companies from './fixtures/companies.json';
import subscriptions from './fixtures/subscriptions.json';
import type { Pax8Client, Pax8Company, Pax8Subscription } from './types';

/** Fully functional mock Pax8 client backed by JSON fixtures. All names are fake. */
export class MockPax8Client implements Pax8Client {
  async listCompanies(): Promise<Pax8Company[]> {
    return companies.companies.map((company) => ({ ...company }));
  }

  async listSubscriptions(): Promise<Pax8Subscription[]> {
    return subscriptions.subscriptions.map((subscription) => ({ ...subscription }));
  }
}
