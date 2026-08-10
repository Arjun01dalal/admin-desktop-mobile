import React, { useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";

function buildUpiUrl({ pa, pn, am, tn, tr }: any) {
  const params = new URLSearchParams();
  params.set("pa", pa);
  if (pn) params.set("pn", pn);
  if (am) params.set("am", String(am));
  params.set("cu", "INR");
  if (tn) params.set("tn", tn);
  if (tr) params.set("tr", tr);
  return `upi://pay?${params.toString()}`;
}

const UpiQr = (props: any) => {
  const upiUrl = useMemo(() => buildUpiUrl(props), [props]);

  return (
    <QRCodeCanvas id="upi-qr-canvas" value={upiUrl} size={150} includeMargin />
  );
};

export default UpiQr;
