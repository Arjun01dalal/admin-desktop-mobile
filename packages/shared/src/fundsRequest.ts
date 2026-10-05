/**
 * Funds payin (`all-payment`) should include paymentGateway only for
 * WhatsApp-type names (whatsapp, whatsapp-UP-RAJ, …).
 */
export function whatsappPaymentGatewayName(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value.toLowerCase().startsWith('whatsapp')) return value;
  }
  return undefined;
}
