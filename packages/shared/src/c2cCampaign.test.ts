import { describe, expect, it } from 'vitest';
import {
  buildC2cCampaignListQuery,
  extractC2cCampaignList,
  formatC2cAssignedLabel,
  isC2cLeadCampaign,
  normalizeC2cCampaign,
} from './c2cCampaign';

describe('isC2cLeadCampaign', () => {
  it('detects isLead flag', () => {
    expect(isC2cLeadCampaign({ isLead: true })).toBe(true);
    expect(isC2cLeadCampaign({ isLead: false })).toBe(false);
    expect(isC2cLeadCampaign(null)).toBe(false);
  });
});

describe('normalizeC2cCampaign', () => {
  it('marks type=lead as isLead', () => {
    const campaign = normalizeC2cCampaign({
      _id: 'abc',
      campaignName: 'Lead A',
      type: 'lead',
      isActive: true,
      callers: [],
      data: { total: 1, pending: 1, assigned: 0, completed: 0 },
    });
    expect(campaign.isLead).toBe(true);
    expect(campaign._id).toBe('abc');
  });
});

describe('formatC2cAssignedLabel', () => {
  it('formats object assignee', () => {
    expect(formatC2cAssignedLabel({ name: 'Arjun', empCode: '701' })).toBe('Arjun (701)');
  });
  it('returns empty for missing', () => {
    expect(formatC2cAssignedLabel(null)).toBe('');
  });
});

describe('extractC2cCampaignList', () => {
  it('normalizes nested data list + total', () => {
    const parsed = extractC2cCampaignList({
      data: {
        items: [
          {
            _id: 'c1',
            campaignName: 'Zone A',
            isActive: true,
            callers: [],
            data: { total: 3, pending: 1, assigned: 1, completed: 1 },
          },
        ],
        total: 12,
      },
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?._id).toBe('c1');
    expect(parsed.total).toBe(12);
  });
});

describe('buildC2cCampaignListQuery', () => {
  it('includes search and isActive when set', () => {
    const q = buildC2cCampaignListQuery({
      pageNo: 3,
      itemsPerPage: 25,
      search: 'zone',
      isActive: true,
    });
    expect(q).toEqual({
      pageNo: 3,
      itemsPerPage: 25,
      search: 'zone',
      isActive: true,
    });
  });
});
