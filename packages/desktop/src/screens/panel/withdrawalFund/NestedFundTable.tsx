import { Fragment, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { unpackPayload } from '@/screens/panel/transactions/shared';
import type { GatewayGroup, MidReportPayload, TypeGroup } from './types';

type Props = {
  apiData: TypeGroup[];
  startDate: string;
  endDate: string;
  onUpload: (gateway: string, mid: string) => void;
};

type MidCache = { mid: string; payload: MidReportPayload };

function typeTotal(typeItem: TypeGroup): number {
  return typeItem.providers.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
}

function getAllMids(gatewayNames: GatewayGroup[]) {
  const mids = gatewayNames?.flatMap((g) => g.mids || []) || [];
  const map = new Map<string, (typeof mids)[0]>();
  mids.forEach((m) => map.set(m.mid, m));
  return Array.from(map.values());
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

const cellSx = {
  borderColor: 'rgba(255,255,255,0.08)',
  color: '#e8e8ea',
  fontSize: 12,
  py: 1,
} as const;

/** Expandable Type → Provider → MID table (old NestedTable, dark UI). */
export function NestedFundTable({ apiData, startDate, endDate, onUpload }: Props) {
  const navigate = useNavigate();
  const [openTypeIndex, setOpenTypeIndex] = useState<number | null>(null);
  const [openProviderIndex, setOpenProviderIndex] = useState<string | null>(null);
  const [midCache, setMidCache] = useState<MidCache[]>([]);
  const [loadingProviders, setLoadingProviders] = useState<Record<string, boolean>>({});

  const getPayload = useCallback(
    (mid: string) => midCache.find((item) => item.mid === mid)?.payload,
    [midCache],
  );

  const fetchMidData = useCallback(
    async (mid: string) => {
      const res = await secureApi('withdrawalFund.latestReport', {
        mid,
        startDate,
        endDate,
      });
      if (!res.ok) return {};
      return unpackPayload(res.data) as MidReportPayload;
    },
    [startDate, endDate],
  );

  const loadMidReports = useCallback(
    async (gatewayNames: GatewayGroup[]) => {
      const mids = getAllMids(gatewayNames);
      const chunks = chunkArray(mids, 10);
      let finalData: MidCache[] = [];

      for (const chunk of chunks) {
        const batch = await Promise.all(
          chunk.map(async (m) => {
            const existing = midCache.find((item) => item.mid === m.mid);
            if (existing) return existing;
            try {
              const payload = await fetchMidData(m.mid);
              return { mid: m.mid, payload };
            } catch {
              return { mid: m.mid, payload: {} };
            }
          }),
        );
        finalData = [...finalData, ...batch];
      }

      setMidCache((prev) => {
        const map = new Map(prev.map((i) => [i.mid, i]));
        finalData.forEach((i) => map.set(i.mid, i));
        return Array.from(map.values());
      });
    },
    [fetchMidData, midCache],
  );

  const handleProviderClick = async (
    providerKey: string,
    gatewayNames: GatewayGroup[],
  ) => {
    const isOpen = openProviderIndex === providerKey;
    setOpenProviderIndex(isOpen ? null : providerKey);
    if (isOpen) return;
    setLoadingProviders((prev) => ({ ...prev, [providerKey]: true }));
    try {
      await loadMidReports(gatewayNames);
    } catch {
      toast.error('Failed to load MID reports');
    } finally {
      setLoadingProviders((prev) => ({ ...prev, [providerKey]: false }));
    }
  };

  if (!apiData.length) {
    return (
      <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
        No withdrawal fund data for this date range
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        overflowX: 'auto',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 1.5,
        bgcolor: '#121218',
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {[
              '#',
              'Type / Provider / MID',
              'Total Amount',
              'Count',
              'Matched Record',
              'Txn in system not in Acc. Statement',
              'Txn in Acc. Statement not in system',
              'Action',
            ].map((h) => (
              <TableCell
                key={h}
                sx={{
                  ...cellSx,
                  bgcolor: '#ff9f0a',
                  color: '#1a1200',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {apiData.map((typeItem, typeIndex) => {
            const isTypeOpen = openTypeIndex === typeIndex;
            return (
              <Fragment key={typeItem.type}>
                <TableRow
                  hover
                  onClick={() => setOpenTypeIndex(isTypeOpen ? null : typeIndex)}
                  sx={{ cursor: 'pointer', bgcolor: 'rgba(255,159,10,0.08)' }}
                >
                  <TableCell sx={cellSx}>{typeIndex + 1}</TableCell>
                  <TableCell sx={cellSx}>
                    <strong>{String(typeItem.type).toUpperCase()}</strong>{' '}
                    {isTypeOpen ? '▲' : '▼'}
                  </TableCell>
                  <TableCell sx={cellSx}>{typeTotal(typeItem)}</TableCell>
                  <TableCell sx={cellSx}>{typeItem.providers?.length ?? 0}</TableCell>
                  <TableCell sx={cellSx} colSpan={4} />
                </TableRow>

                {isTypeOpen
                  ? typeItem.providers?.map((provider, pIndex) => {
                      const providerKey = `${typeIndex}-${pIndex}`;
                      const isProviderOpen = openProviderIndex === providerKey;
                      const mids = getAllMids(provider.gatewayNames);
                      return (
                        <Fragment key={providerKey}>
                          <TableRow
                            hover
                            onClick={() =>
                              void handleProviderClick(providerKey, provider.gatewayNames)
                            }
                            sx={{ cursor: 'pointer', bgcolor: 'rgba(255,255,255,0.03)' }}
                          >
                            <TableCell sx={cellSx} />
                            <TableCell sx={cellSx}>
                              {provider.withdrewalProviderName}{' '}
                              {isProviderOpen ? '▲' : '▼'}
                            </TableCell>
                            <TableCell sx={cellSx}>{provider.totalAmount}</TableCell>
                            <TableCell sx={cellSx}>{mids.length}</TableCell>
                            <TableCell sx={cellSx} colSpan={4}>
                              {loadingProviders[providerKey] ? (
                                <CircularProgress size={14} sx={{ color: '#ff9f0a' }} />
                              ) : null}
                            </TableCell>
                          </TableRow>

                          {isProviderOpen
                            ? mids.map((mid) => {
                                const payload = getPayload(mid.mid);
                                const summary = payload?.summary;
                                return (
                                  <TableRow key={`${providerKey}-${mid.mid}`} hover>
                                    <TableCell sx={cellSx} />
                                    <TableCell
                                      sx={{ ...cellSx, cursor: 'pointer', color: '#ff9f0a' }}
                                      onClick={() =>
                                        navigate('/withdraw-user-data', {
                                          state: {
                                            mid: mid.mid,
                                            withdrawals: mid.withdrawals,
                                            totalAmount: mid.totalAmount,
                                            providerName: provider.withdrewalProviderName,
                                          },
                                        })
                                      }
                                    >
                                      {mid.mid}
                                    </TableCell>
                                    <TableCell sx={cellSx}>{mid.totalAmount}</TableCell>
                                    <TableCell sx={cellSx}>
                                      {mid.withdrawals?.length || mid.count || 0}
                                    </TableCell>
                                    <TableCell
                                      sx={{ ...cellSx, cursor: 'pointer' }}
                                      onClick={() =>
                                        navigate('/withdraw-user-data', {
                                          state: {
                                            type: 'filterRecord',
                                            key: 'bothInSheetAndDb',
                                            record: payload,
                                          },
                                        })
                                      }
                                    >
                                      {summary?.bothInSheetAndDbCount ?? '—'}
                                    </TableCell>
                                    <TableCell
                                      sx={{ ...cellSx, cursor: 'pointer' }}
                                      onClick={() =>
                                        navigate('/withdraw-user-data', {
                                          state: {
                                            type: 'filterRecord',
                                            key: 'dbButNotInSheet',
                                            record: payload,
                                          },
                                        })
                                      }
                                    >
                                      {summary?.dbButNotInSheetCount ?? '—'}
                                    </TableCell>
                                    <TableCell
                                      sx={{ ...cellSx, cursor: 'pointer' }}
                                      onClick={() =>
                                        navigate('/withdraw-user-data', {
                                          state: {
                                            type: 'filterRecord',
                                            key: 'sheetButNotInDb',
                                            record: payload,
                                          },
                                        })
                                      }
                                    >
                                      {summary?.sheetButNotInDbCount ?? '—'}
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onUpload(
                                            provider.withdrewalProviderName,
                                            mid.mid,
                                          );
                                        }}
                                        sx={{ color: '#ff9f0a' }}
                                      >
                                        <UploadIcon fontSize="small" />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            : null}
                        </Fragment>
                      );
                    })
                  : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
