import { describe, expect, it, vi } from 'vitest';
import { LiveSyncroClient } from './live';
import { mapAsset, mapCustomer, mapFrequency, mapInvoice, mapSchedule } from './mapping';
import { MockSyncroClient } from './mock';

describe('Syncro mapping', () => {
  it('maps a customer, preferring business_name', () => {
    expect(
      mapCustomer({ id: 7, business_name: 'Acme', fullname: 'Pat Example', disabled: false }),
    ).toEqual({ id: '7', businessName: 'Acme', disabled: false, notes: null });
  });

  it('falls back to fullname for individual customers', () => {
    expect(mapCustomer({ id: 8, business_name: null, fullname: 'Pat Example' }).businessName).toBe(
      'Pat Example',
    );
  });

  it('rejects records without an id', () => {
    expect(() => mapCustomer({ business_name: 'No id' })).toThrow(/missing an id/);
  });

  it('maps an asset, reading customer_id from the nested customer if needed', () => {
    const asset = mapAsset({
      id: 1,
      name: 'WS-01',
      customer: { id: 42 },
      asset_type: 'Syncro Device',
      updated_at: '2026-10-01T12:00:00Z',
    });
    expect(asset).toEqual({
      id: '1',
      customerId: '42',
      name: 'WS-01',
      assetType: 'Syncro Device',
      lastSeenAt: new Date('2026-10-01T12:00:00Z'),
    });
  });

  it('maps schedule frequencies defensively', () => {
    expect(mapFrequency('Monthly')).toBe('MONTHLY');
    expect(mapFrequency('Annually')).toBe('ANNUAL');
    expect(mapFrequency('Yearly')).toBe('ANNUAL');
    expect(mapFrequency('Daily')).toBe('OTHER');
    expect(mapFrequency(undefined)).toBe('OTHER');
  });

  it('maps a schedule with string quantities and skips one-time charges', () => {
    const schedule = mapSchedule({
      id: 3,
      customer_id: 9,
      frequency: 'Monthly',
      name: 'Monthly services',
      paused: false,
      lines: [
        { id: 1, name: 'Managed IT', quantity: '12.0', retail_cents: 9500 },
        { id: 2, name: 'M365 BP', quantity: '5.0', price_retail: 26.4, vendor_product_name: 'BP' },
        { id: 3, name: 'Setup fee', quantity: '1.0', retail_cents: 50000, one_time_charge: true },
      ],
    });
    expect(schedule).toEqual({
      id: '3',
      customerId: '9',
      name: 'Monthly services',
      frequency: 'MONTHLY',
      active: true,
      lines: [
        { id: '1', name: 'Managed IT', quantity: 12, unitPriceCents: 9500, sku: null },
        { id: '2', name: 'M365 BP', quantity: 5, unitPriceCents: 2640, sku: 'BP' },
      ],
    });
  });

  it('treats paused schedules as inactive', () => {
    expect(mapSchedule({ id: 1, customer_id: 1, paused: true }).active).toBe(false);
  });

  it('maps invoice totals from decimal strings to cents', () => {
    expect(
      mapInvoice({ id: 1, customer_id: 2, number: '100', total: '125.50', is_paid: true }),
    ).toMatchObject({ id: '1', customerId: '2', totalCents: 12550, isPaid: true });
  });
});

describe('MockSyncroClient', () => {
  it('returns the fixture data through the real mappers', async () => {
    const client = new MockSyncroClient();
    const customers = await client.listCustomers();
    const assets = await client.listAssets();
    const schedules = await client.listRecurringInvoices();
    expect(customers.length).toBeGreaterThan(5);
    expect(customers.every((c) => c.businessName.includes('(Demo)'))).toBe(true);
    expect(assets.length).toBeGreaterThan(50);
    expect(schedules.some((s) => s.frequency === 'ANNUAL')).toBe(true);
  });
});

describe('LiveSyncroClient', () => {
  const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      ...init,
    });

  it('follows pagination, sends the bearer token and only uses GET', async () => {
    const fetchFn = vi.fn<typeof fetch>(async (input) => {
      const page = new URL(String(input)).searchParams.get('page');
      return json({
        customers: [{ id: Number(page), business_name: `Customer ${page}` }],
        meta: { total_pages: 2, page: Number(page) },
      });
    });

    const client = new LiveSyncroClient(
      'https://demo.syncromsp.com/api/v1/',
      'secret-key',
      fetchFn,
    );
    const customers = await client.listCustomers();

    expect(customers.map((c) => c.businessName)).toEqual(['Customer 1', 'Customer 2']);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    for (const [input, init] of fetchFn.mock.calls) {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/api/v1/customers');
      expect(url.searchParams.get('include_disabled')).toBe('true');
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    }
  });

  it('stops paging on an empty page when there is no meta block', async () => {
    const fetchFn = vi.fn<typeof fetch>(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get('page'));
      return json({ schedules: page === 1 ? [{ id: 1, customer_id: 1, lines: [] }] : [] });
    });
    const client = new LiveSyncroClient('https://demo.syncromsp.com/api/v1', 'k', fetchFn);
    await expect(client.listRecurringInvoices()).resolves.toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not leak the API key in error messages', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({ error: 'nope' }, { status: 401 }));
    const client = new LiveSyncroClient(
      'https://demo.syncromsp.com/api/v1',
      'super-secret',
      fetchFn,
    );
    const error = await client.listAssets().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).message)).toContain('HTTP 401');
    expect(String((error as Error).message)).not.toContain('super-secret');
  });
});
