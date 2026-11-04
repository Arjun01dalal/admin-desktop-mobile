import { describe, expect, it } from 'vitest';
import {
  aggregateUniquePendingGatewayCounts,
  assembleUniquePendingSummary,
  buildCallerWiseUniquePending,
  buildUniquePendingSummaryPayload,
  countUniquePendingByRegion,
  diffUniquePendingApproved,
  filterCallerWisePendingItems,
  filterCallerWiseUniquePendingRows,
  filterUniquePendingDisplay,
  filterUniquePendingList,
  isSouthState,
  matchesUniquePendingRegion,
  mergeUniquePendingByState,
  normalizeUniquePendingEmpCode,
  paginateUniquePendingRows,
  sumCallerWiseUniquePendingTotals,
  uniquePendingPaymentMethod,
} from './uniquePendingDeposit';

describe('uniquePendingDeposit helpers', () => {
  it('builds summary payload and omits empty filter keys', () => {
    expect(
      buildUniquePendingSummaryPayload('', '', { userId: 'u1', amount: '100' }, '2026-11-02'),
    ).toEqual({
      startDate: '2026-11-02',
      endDate: '2026-11-02',
      filter: { userId: 'u1', amount: 100 },
    });
  });

  it('diffs approved as max(0, all - pending)', () => {
    expect(diffUniquePendingApproved(10, 3)).toBe(7);
    expect(diffUniquePendingApproved(2, 5)).toBe(0);
  });

  it('classifies south / north region', () => {
    expect(isSouthState('Tamil Nadu')).toBe(true);
    expect(isSouthState('Maharashtra')).toBe(false);
    expect(matchesUniquePendingRegion({ userState: 'Kerala' }, 'south')).toBe(true);
    expect(matchesUniquePendingRegion({ userState: 'Kerala' }, 'north')).toBe(false);
    expect(matchesUniquePendingRegion({ state: 'Delhi' }, 'north')).toBe(true);
  });

  it('aggregates gateway counts and region counts', () => {
    const rows = [
      { paymentGatewayName: 'A', userState: 'Kerala' },
      { paymentGatewayName: 'A', userState: 'Delhi' },
      { paymentGatewayName: 'B', userState: 'Goa' },
      { paymentGatewayName: '', userState: 'Karnataka' },
    ];
    expect(aggregateUniquePendingGatewayCounts(rows)).toEqual([
      { name: 'A', count: 2 },
      { name: 'B', count: 1 },
      { name: 'Unknown', count: 1 },
    ]);
    expect(countUniquePendingByRegion(rows)).toEqual({ south: 2, north: 2 });
  });

  it('filters list by accessible states + empCode and display by gateway/region', () => {
    const rows = [
      { userState: 'Kerala', empCode: 'E1', paymentGatewayName: 'G1' },
      { userState: 'Delhi', empCode: 'E2', paymentGatewayName: 'G2' },
      { state: 'Karnataka', empCode: 'E11', paymentGatewayName: 'G1' },
    ];
    expect(filterUniquePendingList(rows, { accessibleStates: ['kerala'], empCode: '' })).toHaveLength(
      1,
    );
    expect(filterUniquePendingList(rows, { empCode: 'e1' })).toHaveLength(2);
    expect(
      filterUniquePendingDisplay(rows, { gatewayName: 'G1', region: 'south' }),
    ).toHaveLength(2);
  });

  it('merges byState pending + all into approved columns', () => {
    const merged = mergeUniquePendingByState(
      [
        { state: 'Kerala', uniqueRequestCount: 2, totalAmount: 200, uniqueCustomerCount: 1 },
        { state: 'Delhi', uniqueRequestCount: 1, totalAmount: 50, uniqueCustomerCount: 1 },
      ],
      [
        { state: 'Kerala', uniqueRequestCount: 5, totalAmount: 500, uniqueCustomerCount: 3 },
        { state: 'Delhi', uniqueRequestCount: 1, totalAmount: 50, uniqueCustomerCount: 1 },
      ],
    );
    expect(merged[0].state).toBe('Kerala');
    expect(merged[0].approvedTxnCount).toBe(3);
    expect(merged[0].approvedTotalAmount).toBe(300);
    expect(merged[1].approvedTxnCount).toBe(0);
  });

  it('paginates and clamps page', () => {
    const rows = [1, 2, 3, 4, 5];
    expect(paginateUniquePendingRows(rows, 2, 2)).toEqual({
      pageRows: [3, 4],
      totalPages: 3,
      total: 5,
      safePage: 2,
    });
    expect(paginateUniquePendingRows(rows, 99, 2).safePage).toBe(3);
  });

  it('assembles dual-summary payload into view model', () => {
    const view = assembleUniquePendingSummary({
      pendingData: {
        payload: {
          list: [
            {
              _id: '1',
              orderId: 'o1',
              paymentGatewayName: 'PayU',
              userState: 'Kerala',
              empCode: 'E1',
            },
            {
              _id: '2',
              orderId: 'o2',
              paymentGatewayName: 'PayU',
              userState: 'Delhi',
              empCode: 'E9',
            },
          ],
          uniqueRequestCount: 2,
          totalAmount: 300,
          uniqueCustomerCount: 2,
          byState: [
            { state: 'Kerala', uniqueRequestCount: 1, totalAmount: 100, uniqueCustomerCount: 1 },
            { state: 'Delhi', uniqueRequestCount: 1, totalAmount: 200, uniqueCustomerCount: 1 },
          ],
        },
      },
      allData: {
        payload: {
          uniqueRequestCount: 5,
          totalAmount: 800,
          uniqueCustomerCount: 4,
          byState: [
            { state: 'Kerala', uniqueRequestCount: 3, totalAmount: 400, uniqueCustomerCount: 2 },
            { state: 'Delhi', uniqueRequestCount: 2, totalAmount: 400, uniqueCustomerCount: 2 },
          ],
        },
      },
      accessibleStates: ['kerala'],
    });

    expect(view.rows).toHaveLength(1);
    expect(view.approved).toEqual({
      uniqueRequestCount: 3,
      totalAmount: 500,
      uniqueCustomerCount: 2,
    });
    expect(view.gatewayCounts).toEqual([{ name: 'PayU', count: 1 }]);
    expect(view.regionCounts).toEqual({ south: 1, north: 0 });
    expect(view.byState.find((r) => r.state === 'Kerala')?.approvedTxnCount).toBe(2);
  });

  it('formats payment method label', () => {
    expect(uniquePendingPaymentMethod('PayU', 12)).toBe('PayU - 12');
    expect(uniquePendingPaymentMethod('', '')).toBe('—');
  });

  it('builds caller-wise unique pending rows sorted by pending desc', () => {
    expect(normalizeUniquePendingEmpCode('')).toBe('Unassigned');
    const bundle = buildCallerWiseUniquePending(
      [
        { _id: 'p1', empCode: '001', amount: 100 },
        { _id: 'p2', empCode: '002', amount: 50 },
        { _id: 'p3', empCode: '001', amount: 25 },
      ],
      [
        { _id: 'a1', empCode: '001', amount: 100 },
        { _id: 'a2', empCode: '001', amount: 25 },
        { _id: 'a3', empCode: '001', amount: 10 },
        { _id: 'a4', empCode: '002', amount: 50 },
        { _id: 'a5', empCode: '003', amount: 90 },
      ],
      { '001': 'Alice', '2': 'Bob' },
    );
    expect(bundle.rows[0]).toMatchObject({
      empCode: '001',
      callerName: 'Alice',
      pending: 2,
      pendingAmount: 125,
      successful: 3,
      approved: 1,
    });
    expect(bundle.rows.find((r) => r.empCode === '002')?.callerName).toBe('Bob');
    expect(bundle.pendingByEmpCode['001']).toHaveLength(2);
    expect(sumCallerWiseUniquePendingTotals(bundle.rows).pending).toBe(3);
    expect(filterCallerWiseUniquePendingRows(bundle.rows, 'ali')).toHaveLength(1);
    expect(
      filterCallerWisePendingItems(bundle.pendingByEmpCode['001'], '100', { canShowMobile: false }),
    ).toHaveLength(1);
  });
});
