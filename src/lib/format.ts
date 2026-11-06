const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Formats integer cents as USD, e.g. 123456 -> "$1,234.56". */
export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}

/** Formats integer cents as whole USD, e.g. 123456 -> "$1,235". For charts and stat cards. */
export function formatUsdWhole(cents: number): string {
  return usdWhole.format(cents / 100);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Dates are stored in UTC and displayed in UTC so everyone sees the same value. */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '—';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Turns an enum value such as "MEETING_SET" into "Meeting set". */
export function humanize(value: string): string {
  const text = value.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
