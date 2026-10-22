/**
 * Lead sheet upload — admin-panel-domains LeadSheetUpload parity.
 */
import { useCallback, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { type C2cCampaignLeadInput } from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { orangeBtnSx, fieldSx } from '@/screens/panel/transactions/shared';

type Props = {
  campaignId: string;
  onUploaded?: () => void;
};

const MOBILE_HEADERS = new Set([
  'mobile',
  'mobileno',
  'mobilenumber',
  'phone',
  'phoneno',
  'phonenumber',
  'contact',
]);
const NAME_HEADERS = new Set(['name', 'customername', 'fullname']);
const SOURCE_HEADERS = new Set(['source']);

const headerKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const cellText = (value: unknown) => {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(Math.trunc(value));
  }
  return String(value).trim();
};

export function parseLeadSheet(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) return { leads: [] as C2cCampaignLeadInput[], skipped: 0 };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: false,
  });
  const rows = matrix.filter((row) => row.some((cell) => cellText(cell)));
  if (!rows.length) return { leads: [] as C2cCampaignLeadInput[], skipped: 0 };

  const headerCells = rows[0].map(headerKey);
  const headerMobileIdx = headerCells.findIndex((key) => MOBILE_HEADERS.has(key));
  const hasHeader = headerMobileIdx >= 0;
  const mobileIdx = hasHeader ? headerMobileIdx : 0;
  const nameIdx = hasHeader ? headerCells.findIndex((key) => NAME_HEADERS.has(key)) : 1;
  const sourceIdx = hasHeader
    ? headerCells.findIndex((key) => SOURCE_HEADERS.has(key))
    : 2;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const leads: C2cCampaignLeadInput[] = [];
  let skipped = 0;
  dataRows.forEach((row) => {
    const mobile = cellText(row[mobileIdx]);
    if (!mobile) {
      if (row.some((cell) => cellText(cell))) skipped += 1;
      return;
    }
    const lead: C2cCampaignLeadInput = { mobile };
    const name = nameIdx >= 0 ? cellText(row[nameIdx]) : '';
    const rowSource = sourceIdx >= 0 ? cellText(row[sourceIdx]) : '';
    if (name) lead.name = name;
    if (rowSource) lead.source = rowSource;
    leads.push(lead);
  });

  return { leads, skipped };
}

const readFile = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('Could not read the sheet'));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read the sheet'));
    reader.readAsArrayBuffer(file);
  });

export function LeadSheetUpload({ campaignId, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState('');
  const [leads, setLeads] = useState<C2cCampaignLeadInput[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setSource('');
    setFileName('');
    setLeads([]);
    setSkipped(0);
    setDragOver(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    reset();
  };

  const onFile = useCallback(async (file?: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!/\.(xlsx|xls|csv)$/.test(lower)) {
      toast.error('Upload an .xlsx, .xls, or .csv sheet');
      return;
    }
    try {
      const buffer = await readFile(file);
      const parsed = parseLeadSheet(buffer);
      setFileName(file.name);
      setLeads(parsed.leads);
      setSkipped(parsed.skipped);
      if (!parsed.leads.length) {
        toast.error('No rows with mobile found. Mobile is required.');
      }
    } catch (err) {
      setLeads([]);
      setSkipped(0);
      setFileName('');
      toast.error(err instanceof Error ? err.message : 'Could not read the sheet');
    }
  }, []);

  const submit = async () => {
    if (!campaignId) return;
    if (!leads.length) {
      toast.error('Upload a sheet with at least one mobile');
      return;
    }
    const batchSource = source.trim();
    setSaving(true);
    try {
      const res = await secureApi('campaign.createLeads', {
        campaignId,
        ...(batchSource ? { source: batchSource } : {}),
        leads,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to upload leads');
        return;
      }
      toast.success(res.message || 'Leads uploaded');
      setOpen(false);
      reset();
      onUploaded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload leads');
    } finally {
      setSaving(false);
    }
  };

  const preview = leads.slice(0, 6);
  const hasFile = Boolean(fileName);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
        onClick={() => setOpen(true)}
        sx={{
          textTransform: 'none',
          fontWeight: 700,
          borderColor: alpha('#ff9f0a', 0.45),
          color: '#ff9f0a',
          '&:hover': { borderColor: '#ff9f0a', bgcolor: alpha('#ff9f0a', 0.08) },
        }}
      >
        Upload leads
      </Button>

      <Dialog
        open={open}
        onClose={close}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            position: 'relative',
            pr: 6,
            py: 1.75,
            borderBottom: '1px solid',
            borderColor: 'divider',
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? `linear-gradient(135deg, ${alpha('#ff9f0a', 0.12)}, transparent 70%)`
                : `linear-gradient(135deg, ${alpha('#ff9f0a', 0.1)}, transparent 70%)`,
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>
            Upload leads
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
            Import a sheet into this lead campaign
          </Typography>
          <IconButton
            aria-label="Close"
            size="small"
            onClick={close}
            disabled={saving}
            sx={{ position: 'absolute', right: 10, top: 12 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ '&&': { pt: 3 }, px: 3, pb: 1.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label="mobile · required"
                sx={{
                  height: 24,
                  fontWeight: 700,
                  fontSize: 11,
                  bgcolor: alpha('#ff9f0a', 0.16),
                  color: '#ff9f0a',
                  border: `1px solid ${alpha('#ff9f0a', 0.35)}`,
                }}
              />
              <Chip
                size="small"
                label="name · optional"
                sx={{
                  height: 24,
                  fontWeight: 600,
                  fontSize: 11,
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                }}
              />
              <Chip
                size="small"
                label="source · optional"
                sx={{
                  height: 24,
                  fontWeight: 600,
                  fontSize: 11,
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                }}
              />
            </Stack>

            <Box
              sx={{
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha('#ff9f0a', 0.06),
              }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#ff9f0a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  mb: 0.75,
                }}
              >
                Sheet format
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, lineHeight: 1.5 }}>
                Headers (recommended): <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>mobile</Box>,{' '}
                <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>name</Box>,{' '}
                <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>source</Box>.
                Only mobile is required. Without headers, order is mobile → name → source. Files: .xlsx / .xls / .csv.
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  mt: 1,
                  px: 1.25,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  fontSize: 11,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  color: 'text.primary',
                  lineHeight: 1.45,
                  overflowX: 'auto',
                }}
              >
                {`mobile,name,source
9876543210,Rahul,MD
9123456780,,FB Ads`}
              </Box>
            </Box>

            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'text.primary',
                  mb: 0.35,
                }}
              >
                Batch source
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.25, lineHeight: 1.4 }}
              >
                Optional. Applied only to rows that do not already have a source in the sheet.
              </Typography>
              <TextField
                size="small"
                placeholder="e.g. MD, FB Ads"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: false }}
                sx={{
                  ...fieldSx,
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.paper',
                    borderRadius: 1.5,
                    '& fieldset': {
                      borderColor: 'divider',
                    },
                    '&:hover fieldset': {
                      borderColor: alpha('#ff9f0a', 0.55),
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#ff9f0a',
                      borderWidth: 1.5,
                    },
                  },
                  '& .MuiOutlinedInput-input': {
                    py: 1.1,
                    fontSize: 13,
                    fontWeight: 600,
                  },
                }}
              />
            </Box>

            <Box
              component="label"
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                void onFile(e.dataTransfer.files?.[0]);
              }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                minHeight: 132,
                px: 2,
                py: 2.5,
                borderRadius: 2,
                cursor: 'pointer',
                textAlign: 'center',
                border: '1.5px dashed',
                borderColor: dragOver || hasFile ? '#ff9f0a' : 'divider',
                bgcolor: dragOver
                  ? alpha('#ff9f0a', 0.1)
                  : hasFile
                    ? alpha('#ff9f0a', 0.06)
                    : 'action.hover',
                transition: 'border-color 120ms ease, background-color 120ms ease',
                '&:hover': {
                  borderColor: '#ff9f0a',
                  bgcolor: alpha('#ff9f0a', 0.08),
                },
              }}
            >
              <input
                ref={fileRef}
                hidden
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              {hasFile ? (
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 32, color: '#ff9f0a' }} />
              ) : (
                <UploadFileOutlinedIcon
                  sx={{ fontSize: 34, color: dragOver ? '#ff9f0a' : 'text.secondary' }}
                />
              )}
              {hasFile ? (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 13, wordBreak: 'break-all' }}>
                    {fileName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Click or drop another file to replace
                  </Typography>
                </>
              ) : (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
                    Drop sheet here, or click to browse
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    .xlsx · .xls · .csv
                  </Typography>
                </>
              )}
            </Box>

            {hasFile ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={`${leads.length} ready`}
                  sx={{
                    height: 26,
                    fontWeight: 800,
                    bgcolor: alpha('#4ade80', 0.14),
                    color: '#4ade80',
                    border: `1px solid ${alpha('#4ade80', 0.35)}`,
                  }}
                />
                {skipped ? (
                  <Chip
                    size="small"
                    label={`${skipped} skipped (no mobile)`}
                    sx={{
                      height: 26,
                      fontWeight: 700,
                      bgcolor: alpha('#ff9f0a', 0.12),
                      color: '#ff9f0a',
                      border: `1px solid ${alpha('#ff9f0a', 0.3)}`,
                    }}
                  />
                ) : null}
              </Stack>
            ) : null}

            {preview.length ? (
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'background.default',
                }}
              >
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 800 }}>Preview</Typography>
                  <Typography variant="caption" color="text.secondary">
                    First {preview.length} rows
                  </Typography>
                </Box>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <Box
                    component="table"
                    sx={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      '& th, & td': {
                        px: 1.5,
                        py: 0.85,
                        fontSize: 12,
                        textAlign: 'left',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      },
                      '& th': {
                        position: 'sticky',
                        top: 0,
                        bgcolor: 'background.paper',
                        color: 'text.secondary',
                        fontWeight: 800,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      },
                      '& td': { color: 'text.primary', fontWeight: 500 },
                      '& tbody tr:hover td': { bgcolor: alpha('#ff9f0a', 0.05) },
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Mobile</th>
                        <th>Name</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, index) => (
                        <tr key={`${row.mobile}-${index}`}>
                          <td>{row.mobile}</td>
                          <td>{row.name || '—'}</td>
                          <td>{row.source || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                </Box>
                {leads.length > preview.length ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', px: 1.5, py: 1 }}
                  >
                    +{leads.length - preview.length} more will upload
                  </Typography>
                ) : null}
              </Box>
            ) : null}
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            py: 1.75,
            borderTop: '1px solid',
            borderColor: 'divider',
            gap: 1,
          }}
        >
          <Button
            onClick={close}
            disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 700, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !leads.length}
            sx={{ ...orangeBtnSx, minWidth: 120 }}
          >
            {saving ? 'Uploading…' : `Upload${leads.length ? ` (${leads.length})` : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
