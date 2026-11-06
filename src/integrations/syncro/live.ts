import { HttpError, withRetry } from '@/lib/retry';
import { mapAsset, mapCustomer, mapInvoice, mapSchedule } from './mapping';
import type {
  SyncroAsset,
  SyncroClient,
  SyncroCustomer,
  SyncroInvoice,
  SyncroRecurringInvoice,
} from './types';

/**
 * Read-only Syncro REST client. Docs: https://api-docs.syncromsp.com/
 * - Base URL: https://{subdomain}.syncromsp.com/api/v1
 * - Auth: "Authorization: Bearer <api key>"
 * - Pagination: ?page=N, response meta.total_pages
 *
 * SECURITY: this class only ever issues GET requests. Do not add POST/PUT/DELETE in v1.
 * The API key is never logged or included in error messages.
 */

type FetchFn = typeof fetch;

interface PageMeta {
  total_pages?: number;
  page?: number;
}

/** Hard stop so a misbehaving API can never loop forever. */
const MAX_PAGES = 500;

export class LiveSyncroClient implements SyncroClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async listCustomers(): Promise<SyncroCustomer[]> {
    // include_disabled lets us mark clients inactive instead of silently dropping them.
    const rows = await this.getAllPages('/customers', 'customers', { include_disabled: 'true' });
    return rows.map(mapCustomer);
  }

  async listAssets(): Promise<SyncroAsset[]> {
    const rows = await this.getAllPages('/customer_assets', 'assets');
    return rows.map(mapAsset);
  }

  async listRecurringInvoices(): Promise<SyncroRecurringInvoice[]> {
    // Recurring invoices are called "schedules" in the Syncro API.
    const rows = await this.getAllPages('/schedules', 'schedules');
    return rows.map(mapSchedule);
  }

  async listInvoices(options: { sinceUpdatedAt?: Date } = {}): Promise<SyncroInvoice[]> {
    const params: Record<string, string> = {};
    if (options.sinceUpdatedAt) params.since_updated_at = options.sinceUpdatedAt.toISOString();
    const rows = await this.getAllPages('/invoices', 'invoices', params);
    return rows.map(mapInvoice);
  }

  /** Follows ?page=N until meta.total_pages is reached (or a page comes back empty). */
  private async getAllPages(
    path: string,
    key: string,
    params: Record<string, string> = {},
  ): Promise<unknown[]> {
    const all: unknown[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await this.get(path, { ...params, page: String(page) });
      const rows = body[key];
      if (!Array.isArray(rows)) {
        throw new Error(`Syncro ${path} response has no "${key}" array`);
      }
      all.push(...rows);

      const meta = (body.meta ?? {}) as PageMeta;
      const totalPages = typeof meta.total_pages === 'number' ? meta.total_pages : undefined;
      if (rows.length === 0 || (totalPages !== undefined && page >= totalPages)) break;
      // TODO(verify): /schedules example has no meta block. Without meta we keep paging
      // until an empty page. https://api-docs.syncromsp.com/ (Schedule)
    }
    return all;
  }

  private async get(
    path: string,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

    return withRetry(async () => {
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after'));
        throw new HttpError(
          response.status,
          `Syncro GET ${path} failed with HTTP ${response.status}`,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
        );
      }
      return (await response.json()) as Record<string, unknown>;
    });
  }
}
