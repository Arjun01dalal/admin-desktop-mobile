import { useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

type Props = {
  pa?: string;
  pn?: string;
  am?: string | number;
  tn?: string;
  tr?: string;
  size?: number;
};

function buildUpiUrl({ pa, pn, am, tn, tr }: Props): string {
  const params = new URLSearchParams();
  if (pa) params.set('pa', pa);
  if (pn) params.set('pn', pn);
  if (am != null && am !== '') params.set('am', String(am));
  params.set('cu', 'INR');
  if (tn) params.set('tn', tn);
  if (tr) params.set('tr', tr);
  return `upi://pay?${params.toString()}`;
}

/** UPI payment QR — matches old Withdrawal UPIQR.tsx */
export function UpiQr({ pa, pn, am, tn, tr, size = 160 }: Props) {
  const upiUrl = useMemo(() => buildUpiUrl({ pa, pn, am, tn, tr }), [pa, pn, am, tn, tr]);

  if (!pa) {
    return null;
  }

  return <QRCodeCanvas id="upi-qr-canvas" value={upiUrl} size={size} includeMargin />;
}
