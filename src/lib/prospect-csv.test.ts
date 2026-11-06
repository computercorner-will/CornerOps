import { describe, expect, it } from 'vitest';
import { parseDate, parsePriority, parseProspectCsv, parseStatus } from './prospect-csv';

const header =
  'Company,Segment,Area,Phone,Website,Priority,Notes,Status,Owner,Last contact,Next step';

describe('parseProspectCsv', () => {
  it('parses a valid file with every column', () => {
    const csv = [
      header,
      'Example Dental (Demo),Dental,Northside,555-0101,https://dental.example,A,Two offices,Meeting set,Alex,2026-10-15,Send proposal',
    ].join('\n');
    const { rows, errors } = parseProspectCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        company: 'Example Dental (Demo)',
        segment: 'Dental',
        area: 'Northside',
        phone: '555-0101',
        website: 'https://dental.example',
        priority: 'A',
        notes: 'Two offices',
        status: 'MEETING_SET',
        owner: 'Alex',
        lastContactAt: new Date('2026-10-15T00:00:00Z'),
        nextStep: 'Send proposal',
      },
    ]);
  });

  it('applies defaults for blank optional fields', () => {
    const { rows, errors } = parseProspectCsv(`${header}\nSolo Shop (Demo),,,,,,,,,,`);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      company: 'Solo Shop (Demo)',
      priority: 'C',
      status: 'NOT_CONTACTED',
      segment: null,
      lastContactAt: null,
    });
  });

  it('matches headers case-insensitively, ignores column order and strips a BOM', () => {
    const csv = '\uFEFFstatus,COMPANY,priority\ncontacted,Reordered (Demo),b';
    const { rows, errors } = parseProspectCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      company: 'Reordered (Demo)',
      status: 'CONTACTED',
      priority: 'B',
    });
  });

  it('handles quoted fields with commas', () => {
    const csv = `${header}\n"Comma, Inc (Demo)",,,,,A,"Notes, with commas",,,,`;
    const { rows } = parseProspectCsv(csv);
    expect(rows[0]?.company).toBe('Comma, Inc (Demo)');
    expect(rows[0]?.notes).toBe('Notes, with commas');
  });

  it('reports errors with line numbers', () => {
    const csv = [header, ',,,,,A,,,,,', 'Bad (Demo),,,,,Z,,Maybe,,13/45/2026,'].join('\n');
    const { rows, errors } = parseProspectCsv(csv);
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      { line: 2, message: 'Company is required.' },
      { line: 3, message: 'Invalid priority "Z".' },
      { line: 3, message: 'Invalid status "Maybe".' },
      { line: 3, message: 'Invalid last contact date "13/45/2026".' },
    ]);
  });

  it('requires a Company column', () => {
    expect(parseProspectCsv('Name,Status\nX,Won').errors).toEqual([
      { line: 1, message: 'Missing required "Company" column.' },
    ]);
  });

  it('skips blank lines', () => {
    const { rows } = parseProspectCsv(`${header}\n\nOne (Demo),,,,,,,,,,\n\n`);
    expect(rows).toHaveLength(1);
  });
});

describe('field parsers', () => {
  it('parses statuses in several spellings', () => {
    expect(parseStatus('PROPOSAL_SENT')).toBe('PROPOSAL_SENT');
    expect(parseStatus('Proposal sent')).toBe('PROPOSAL_SENT');
    expect(parseStatus('not-a-fit')).toBe('NOT_A_FIT');
    expect(parseStatus('')).toBe('NOT_CONTACTED');
    expect(parseStatus('unknown')).toBeNull();
  });

  it('parses priorities', () => {
    expect(parsePriority('a')).toBe('A');
    expect(parsePriority(undefined)).toBe('C');
    expect(parsePriority('D')).toBeNull();
  });

  it('parses ISO and US dates as UTC and rejects impossible dates', () => {
    expect(parseDate('2026-02-03')).toEqual(new Date('2026-02-03T00:00:00Z'));
    expect(parseDate('2/3/2026')).toEqual(new Date('2026-02-03T00:00:00Z'));
    expect(parseDate('')).toBeNull();
    expect(parseDate('2026-02-30')).toBeUndefined();
    expect(parseDate('yesterday')).toBeUndefined();
  });
});
