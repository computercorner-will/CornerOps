import Papa from 'papaparse';

export const PROSPECT_STATUSES = [
  'NOT_CONTACTED',
  'RESEARCHING',
  'CONTACTED',
  'MEETING_SET',
  'ASSESSMENT_DONE',
  'PROPOSAL_SENT',
  'WON',
  'LOST',
  'NOT_A_FIT',
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const PROSPECT_PRIORITIES = ['A', 'B', 'C'] as const;
export type ProspectPriority = (typeof PROSPECT_PRIORITIES)[number];

/** Expected CSV columns, in order. Header matching is case-insensitive. */
export const PROSPECT_CSV_COLUMNS = [
  'Company',
  'Segment',
  'Area',
  'Phone',
  'Website',
  'Priority',
  'Notes',
  'Status',
  'Owner',
  'Last contact',
  'Next step',
] as const;

export interface ProspectRow {
  company: string;
  segment: string | null;
  area: string | null;
  phone: string | null;
  website: string | null;
  priority: ProspectPriority;
  notes: string | null;
  status: ProspectStatus;
  owner: string | null;
  lastContactAt: Date | null;
  nextStep: string | null;
}

export interface CsvError {
  /** 1-based line number in the file (the header is line 1). */
  line: number;
  message: string;
}

export const MAX_IMPORT_ROWS = 2000;

const blankToNull = (value: string | undefined) => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

/** Accepts "MEETING_SET", "Meeting set", "meeting-set"; blank means NOT_CONTACTED. */
export function parseStatus(value: string | undefined): ProspectStatus | null {
  const text = (value ?? '').trim();
  if (text === '') return 'NOT_CONTACTED';
  const normalized = text.toUpperCase().replace(/[\s-]+/g, '_');
  return (PROSPECT_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as ProspectStatus)
    : null;
}

/** Accepts A/B/C (any case); blank means C. */
export function parsePriority(value: string | undefined): ProspectPriority | null {
  const text = (value ?? '').trim().toUpperCase();
  if (text === '') return 'C';
  return (PROSPECT_PRIORITIES as readonly string[]).includes(text)
    ? (text as ProspectPriority)
    : null;
}

/** Accepts YYYY-MM-DD or M/D/YYYY. Returns midnight UTC, or undefined if invalid. */
export function parseDate(value: string | undefined): Date | null | undefined {
  const text = (value ?? '').trim();
  if (text === '') return null;
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (us) [year, month, day] = [Number(us[3]), Number(us[1]), Number(us[2])];
  else return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : undefined;
}

/**
 * Parses a prospects CSV. Returns every valid row plus a list of errors; callers should
 * import nothing when there are errors, so a file is either fully imported or not at all.
 */
export function parseProspectCsv(text: string): { rows: ProspectRow[]; errors: CsvError[] } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const errors: CsvError[] = [];
  const headers = parsed.meta.fields ?? [];
  if (!headers.includes('company')) {
    return { rows: [], errors: [{ line: 1, message: 'Missing required "Company" column.' }] };
  }
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [{ line: 1, message: `Too many rows (max ${MAX_IMPORT_ROWS}).` }],
    };
  }

  const rows: ProspectRow[] = [];
  parsed.data.forEach((record, index) => {
    const line = index + 2;
    const company = blankToNull(record['company']);
    const priority = parsePriority(record['priority']);
    const status = parseStatus(record['status']);
    const lastContactAt = parseDate(record['last contact']);

    if (!company) errors.push({ line, message: 'Company is required.' });
    if (!priority) errors.push({ line, message: `Invalid priority "${record['priority']}".` });
    if (!status) errors.push({ line, message: `Invalid status "${record['status']}".` });
    if (lastContactAt === undefined) {
      errors.push({ line, message: `Invalid last contact date "${record['last contact']}".` });
    }
    if (!company || !priority || !status || lastContactAt === undefined) return;

    rows.push({
      company,
      segment: blankToNull(record['segment']),
      area: blankToNull(record['area']),
      phone: blankToNull(record['phone']),
      website: blankToNull(record['website']),
      priority,
      notes: blankToNull(record['notes']),
      status,
      owner: blankToNull(record['owner']),
      lastContactAt,
      nextStep: blankToNull(record['next step']),
    });
  });

  return { rows, errors };
}
