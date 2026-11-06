import type { Pax8Client, Pax8Company, Pax8Subscription } from './types';

/**
 * Live Pax8 client SKELETON.
 *
 * The authentication flow and endpoints are deliberately NOT implemented: they must be
 * taken from Pax8's official partner API documentation, not guessed. Until then every
 * call throws a helpful error, and INTEGRATIONS_MODE=mock keeps the app fully usable.
 *
 * SECURITY: when implementing, keep this read-only (GET only), keep the client secret and
 * any access token server-side, and never log or include them in error messages.
 */
export class LivePax8Client implements Pax8Client {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async listCompanies(): Promise<Pax8Company[]> {
    // TODO(verify): implement "list companies" from the Pax8 API docs, with pagination,
    // using getAccessToken() and withRetry() from '@/lib/retry'. Map the response to
    // Pax8Company and cover the mapping with a fixture in ./fixtures.
    return this.notImplemented('listCompanies');
  }

  async listSubscriptions(): Promise<Pax8Subscription[]> {
    // TODO(verify): implement "list subscriptions" from the Pax8 API docs, with pagination.
    // Confirm which field holds the SKU and how unit cost and billing term are expressed,
    // then map to Pax8Subscription (costs as integer cents).
    return this.notImplemented('listSubscriptions');
  }

  /**
   * TODO(verify): implement the OAuth client-credentials (or whatever Pax8 documents)
   * token request using this.clientId / this.clientSecret. Cache the token in memory
   * until shortly before it expires. Do not persist it.
   */
  private async getAccessToken(): Promise<string> {
    return this.notImplemented('getAccessToken');
  }

  private notImplemented(method: string): never {
    // Reference the credentials so the skeleton type-checks without exposing them.
    void this.clientId;
    void this.clientSecret;
    void this.getAccessToken;
    throw new Error(
      `Pax8 live integration is not implemented yet (${method}). ` +
        'Implement src/integrations/pax8/live.ts from the official Pax8 API docs ' +
        '(see the TODO(verify) comments), or set INTEGRATIONS_MODE=mock.',
    );
  }
}
