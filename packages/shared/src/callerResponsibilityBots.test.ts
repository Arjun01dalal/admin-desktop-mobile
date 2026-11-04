import { describe, expect, it } from 'vitest';
import {
  automationBotCallsTotals,
  displayedActiveBotUsersCount,
  filterActiveBotUsers,
  getUniquePendingDepositBotCount,
  visibleActiveBotSummary,
} from './callerResponsibilityBots';
import {
  buildDepositByEmpcodeOfficeBody,
  filterCallerResponsibilityRows,
  isDubaiOrMysoreOffice,
  isGtelAssignedCxRole,
  matchesCallerHeadName,
  officeLocationsForRole,
  DUBAI_MYSORE_ROLE_ID,
  BOT_MANAGEMENT_ROLE_ID,
} from './callerRoles';

describe('callerResponsibilityBots display math', () => {
  const summary = [
    { bot: 'new_user', count: 3 },
    { bot: 'unique_pending_deposit', count: 5 },
    { bot: 'unique_pending_deposit_ondemand', count: 4 },
    { bot: 'active', count: 2 },
  ];

  it('subtracts unique_pending bots from total', () => {
    expect(getUniquePendingDepositBotCount(summary)).toBe(5);
    expect(displayedActiveBotUsersCount(20, summary)).toBe(11);
    expect(displayedActiveBotUsersCount(3, summary)).toBe(0);
  });

  it('hides unique_pending bots from chips', () => {
    expect(visibleActiveBotSummary(summary).map((b) => b.bot)).toEqual(['new_user', 'active']);
  });

  it('aggregates automation call totals', () => {
    expect(
      automationBotCallsTotals({
        startDate: '01/11/2026',
        endDate: '01/11/2026',
        total: 10,
        bots: [
          { bot: 'a', successful: 4, unsuccessful: 1, total: 5 },
          { bot: 'b', successful: 3, unsuccessful: 2, total: 5 },
        ],
      }),
    ).toEqual({ successful: 7, unsuccessful: 3, total: 10 });
  });

  it('filters bot users by botType + previous activity date', () => {
    const rows = [
      { botType: 'a', lastSecondActivity: '2026-11-01T10:00:00.000Z' },
      { botType: 'b', lastSecondActivity: '2026-11-01T10:00:00.000Z' },
      { botType: 'a', lastSecondActivity: '2026-10-30T10:00:00.000Z' },
    ];
    expect(
      filterActiveBotUsers(rows, { botType: 'a', previousActivityDate: '2026-11-01' }),
    ).toHaveLength(1);
  });
});

describe('callerRoles CR helpers', () => {
  it('detects Dubai/Mysore offices and role office list', () => {
    expect(isDubaiOrMysoreOffice('Dubai')).toBe(true);
    expect(isDubaiOrMysoreOffice('Myshore')).toBe(true);
    expect(isDubaiOrMysoreOffice('Nagpur')).toBe(false);
    expect(officeLocationsForRole(DUBAI_MYSORE_ROLE_ID)).toEqual(['Dubai', 'Mysore']);
  });

  it('matches caller head names', () => {
    expect(matchesCallerHeadName('Alice|Bob', 'bob')).toBe(true);
    expect(matchesCallerHeadName('not assigned', 'bob')).toBe(false);
  });

  it('detects assigned-CX by role name', () => {
    expect(isGtelAssignedCxRole('x', null, 'Caller Head New And Dialer Data')).toBe(true);
    expect(isGtelAssignedCxRole(BOT_MANAGEMENT_ROLE_ID)).toBe(true);
    expect(isGtelAssignedCxRole('other', null, 'full_access')).toBe(false);
  });

  it('builds deposit body without callerHead when assignedOnly', () => {
    expect(
      buildDepositByEmpcodeOfficeBody({
        startDate: '2026-11-01',
        endDate: '2026-11-01',
        assignedOnly: true,
        callerHead: 'Alice',
        isCallerHead: true,
        loginName: 'Alice',
        officeLocation: 'Dubai',
      }),
    ).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      officeLocation: 'Dubai',
    });
  });

  it('filters caller rows for assigned + dubai/mysore', () => {
    const rows = [
      { empCode: '1', callerHead: 'Alice', officeLocation: 'Dubai', block: false },
      { empCode: '2', callerHead: 'Bob', officeLocation: 'Dubai', block: false },
      { empCode: '3', callerHead: 'Alice', officeLocation: 'Nagpur', block: false },
      { empCode: '4', callerHead: 'Alice', officeLocation: 'Dubai', block: true },
    ];
    expect(
      filterCallerResponsibilityRows({
        rows,
        isCaller: false,
        limitToDubaiMysore: true,
        assignedOnly: true,
        assignedNames: ['Alice'],
      }).map((r) => r.empCode),
    ).toEqual(['1']);
  });
});
