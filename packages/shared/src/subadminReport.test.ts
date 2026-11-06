import { describe, expect, it } from 'vitest';
import {
  buildSubadminReportQuery,
  displaySubadminReportValue,
  formatSubadminLoginLabel,
  parseSubadminLogoutReport,
  subadminReportRange,
} from './subadminReport';

describe('subadminReport', () => {
  it('validates date query', () => {
    expect(buildSubadminReportQuery({ startDate: '', endDate: '2026-11-04', page: 1, limit: 50 })).toEqual({
      error: 'Please select from and to date',
    });
    expect(
      buildSubadminReportQuery({
        startDate: '2026-11-05',
        endDate: '2026-11-04',
        page: 1,
        limit: 50,
      }),
    ).toEqual({ error: 'From date cannot be after To date' });
    expect(
      buildSubadminReportQuery({
        startDate: '2026-11-04',
        endDate: '2026-11-04',
        page: 2,
        limit: 25,
      }),
    ).toEqual({ startDate: '2026-11-04', endDate: '2026-11-04', page: 2, limit: 25 });
  });

  it('hides empty / not_assigned values', () => {
    expect(displaySubadminReportValue('not_assigned')).toBe('');
    expect(displaySubadminReportValue('Admin')).toBe('Admin');
  });

  it('formats login label', () => {
    expect(formatSubadminLoginLabel({ loginDate: '2026-11-04', loginTime: '10:00' })).toBe(
      '2026-11-04 · 10:00',
    );
    expect(formatSubadminLoginLabel({ loginDate: null, loginTime: null })).toBe('');
  });

  it('parses API envelope with data + total', () => {
    const parsed = parseSubadminLogoutReport(
      {
        data: [
          {
            subAdminId: 'a1',
            name: 'Ravi',
            mobile: '9999999999',
            role: 'caller',
            loginDate: '2026-11-04',
            loginTime: '09:00',
            automaticLogoutTime: '10:00',
            sessionDuration: '1h',
            nextLoginTime: '11:00',
          },
        ],
        total: 12,
        page: 1,
        limit: 50,
      },
      { page: 1, limit: 50 },
    );
    expect(parsed.total).toBe(12);
    expect(parsed.totalPages).toBe(1);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.name).toBe('Ravi');
  });

  it('computes visible range', () => {
    expect(subadminReportRange(0, 1, 50)).toEqual({ start: 0, end: 0 });
    expect(subadminReportRange(120, 2, 50)).toEqual({ start: 51, end: 100 });
  });
});
