import { describe, expect, it } from 'vitest';
import {
  buildGtelCallsQuery,
  canConfirmGtelHangup,
  canShowGtelMobile,
  deriveGtelActiveCallPhase,
  emptyGtelFilters,
  formatGtelDuration,
  GTEL_SHOW_MOBILE_OVERRIDE,
  gtelActiveCallStatusLabel,
  gtelActiveCallStatusTone,
  gtelCallMatchesStatus,
  isDispositionAlreadySetMessage,
  maskGtelPhone,
  normalizeGtelCallsPage,
  sanitizeGtelPhone,
} from './gtelCalls';

describe('maskGtelPhone', () => {
  it('masks when not allowed', () => {
    expect(maskGtelPhone('9876543210', false)).toBe('**********');
  });
  it('shows when allowed', () => {
    expect(maskGtelPhone('9876543210', true)).toBe('9876543210');
  });
  it('handles empty', () => {
    expect(maskGtelPhone('', true)).toBe('—');
  });
});

describe('sanitizeGtelPhone', () => {
  it('strips non-digits', () => {
    expect(sanitizeGtelPhone('+91-98765 43210')).toBe('919876543210');
  });
});

describe('formatGtelDuration', () => {
  it('formats seconds', () => {
    expect(formatGtelDuration(65)).toBe('1m 05s');
    expect(formatGtelDuration(9)).toBe('9s');
  });
});

describe('buildGtelCallsQuery', () => {
  it('maps status filter to statusByDialer', () => {
    const q = buildGtelCallsQuery({
      pageNo: 2,
      itemsPerPage: 50,
      filters: { ...emptyGtelFilters('2026-10-22'), status: 'answered', empCode: '101' },
      canShowMobile: true,
      shouldLockEmpCode: false,
      loginEmpCode: '',
      isCaller: false,
      loginExtensionId: '',
    });
    expect(q.pageNo).toBe(2);
    expect(q.statusByDialer).toBe('ANSWER');
    expect(q.empCode).toBe('101');
  });

  it('locks empCode and extension for callers', () => {
    const q = buildGtelCallsQuery({
      pageNo: 1,
      itemsPerPage: 50,
      filters: emptyGtelFilters('2026-10-22', '999'),
      canShowMobile: false,
      shouldLockEmpCode: true,
      loginEmpCode: '999',
      isCaller: true,
      loginExtensionId: '12',
    });
    expect(q.empCode).toBe('999');
    expect(q.extensionId).toBe(12);
    expect(q.extension).toBe('12');
    expect(q.phoneNumber).toBeUndefined();
  });
});

describe('normalizeGtelCallsPage', () => {
  it('reads items + total from payload', () => {
    const page = normalizeGtelCallsPage(
      {
        items: [
          { callId: 'a', empCode: '1', statusByDialer: 'ANSWER' },
          { callId: 'b', empCode: '2', statusByDialer: 'NO ANSWER' },
        ],
        total: 40,
        totalPages: 2,
      },
      20,
    );
    expect(page.rows).toHaveLength(2);
    expect(page.total).toBe(40);
    expect(page.totalPages).toBe(2);
  });

  it('filters by empCode without shrinking reported total', () => {
    const page = normalizeGtelCallsPage(
      {
        items: [
          { callId: 'a', empCode: '1' },
          { callId: 'b', empCode: '2' },
        ],
        total: 100,
      },
      50,
      '1',
    );
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.callId).toBe('a');
    expect(page.total).toBe(100);
  });
});

describe('gtelCallMatchesStatus', () => {
  it('matches answered vs no answer', () => {
    expect(gtelCallMatchesStatus({ statusByDialer: 'ANSWER' }, 'answered')).toBe(true);
    expect(gtelCallMatchesStatus({ statusByDialer: 'NO ANSWER' }, 'answered')).toBe(false);
    expect(gtelCallMatchesStatus({ statusByDialer: 'NO ANSWER' }, 'noAnswer')).toBe(true);
  });
});

describe('canShowGtelMobile', () => {
  it('allows show_mobile responsibility', () => {
    expect(
      canShowGtelMobile({
        Responsibilities: [{ Enum: 'show_mobile' }],
      } as never),
    ).toBe(true);
  });

  it('allows tracked legacy override mobile only', () => {
    expect(canShowGtelMobile({ mobile: GTEL_SHOW_MOBILE_OVERRIDE } as never)).toBe(true);
    expect(canShowGtelMobile({ mobile: '0000000000' } as never)).toBe(false);
  });
});

describe('deriveGtelActiveCallPhase', () => {
  it('prioritizes ended over hangup form', () => {
    expect(
      deriveGtelActiveCallPhase({
        starting: false,
        callId: 'c1',
        ended: true,
        showRedial: false,
        confirmHangup: true,
      }),
    ).toBe('ended');
  });

  it('maps dialing / active / hangupForm / redial', () => {
    expect(
      deriveGtelActiveCallPhase({
        starting: true,
        callId: '',
        ended: false,
        showRedial: false,
        confirmHangup: false,
      }),
    ).toBe('dialing');
    expect(
      deriveGtelActiveCallPhase({
        starting: false,
        callId: 'c1',
        ended: false,
        showRedial: false,
        confirmHangup: false,
      }),
    ).toBe('active');
    expect(
      deriveGtelActiveCallPhase({
        starting: false,
        callId: 'c1',
        ended: false,
        showRedial: false,
        confirmHangup: true,
      }),
    ).toBe('hangupForm');
    expect(
      deriveGtelActiveCallPhase({
        starting: false,
        callId: 'c1',
        ended: false,
        showRedial: true,
        confirmHangup: false,
      }),
    ).toBe('redial');
  });
});

describe('gtelActiveCallStatusTone / label', () => {
  it('uses green when answered', () => {
    expect(
      gtelActiveCallStatusTone({ phase: 'active', answered: true }),
    ).toBe('#22c55e');
    expect(
      gtelActiveCallStatusLabel({ phase: 'active', answered: true }),
    ).toBe('Answered');
  });
});

describe('isDispositionAlreadySetMessage', () => {
  it('detects locked disposition errors', () => {
    expect(isDispositionAlreadySetMessage('Disposition already set')).toBe(true);
    expect(isDispositionAlreadySetMessage('Cannot be changed')).toBe(true);
    expect(isDispositionAlreadySetMessage('ok')).toBe(false);
  });
});

describe('canConfirmGtelHangup', () => {
  it('requires callId + disposition and blocks while hanging up', () => {
    expect(canConfirmGtelHangup({ callId: 'c1', disposition: 'Connected' })).toBe(true);
    expect(canConfirmGtelHangup({ callId: '', disposition: 'Connected' })).toBe(false);
    expect(canConfirmGtelHangup({ callId: 'c1', disposition: '' })).toBe(false);
    expect(
      canConfirmGtelHangup({ callId: 'c1', disposition: 'Connected', hangingUp: true }),
    ).toBe(false);
  });
});
