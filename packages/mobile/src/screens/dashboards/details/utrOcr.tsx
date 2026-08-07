/**
 * UTR slip OCR — mobile port of the web panel's extractUtr.ts.
 *
 * The web panel runs tesseract.js in the browser; Expo Go has no native OCR
 * module, so we run tesseract.js inside a hidden WebView (CDN build) and pass
 * the picked image in as base64. UTR-extraction regex logic is a 1:1 port.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const cleanUtr = (value: string): string =>
  value.replace(/[^A-Z0-9]/gi, '').toUpperCase();

/** PhonePe/GPay app txn ids (e.g. T260718...) — not bank UTR */
const isAppTransactionId = (value: string): boolean =>
  /^T\d{15,}$/i.test(value) || value.length > 16;

/**
 * Extract bank UTR from GPay / PhonePe / Paytm slip OCR text.
 * Prefers labeled "UTR" / "UPI Ref" — ignores PhonePe Transaction ID.
 */
export function extractUtrFromText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  // 1) Prefer explicitly labeled UTR
  const utrLabelPatterns = [
    /\bUTR\b(?:\s*(?:No\.?|Number|#))?\s*[:\-]?\s*([0-9]{10,22})/i,
    /\bUTR\b(?:\s*(?:No\.?|Number|#))?\s*[:\-]?\s*([A-Z0-9]{10,22})/i,
    /UPI\s*Ref(?:erence)?\s*(?:No\.?)?\s*[:\-]?\s*([0-9]{10,22})/i,
    /UPI\s*Ref(?:erence)?\s*(?:No\.?)?\s*[:\-]?\s*([A-Z0-9]{10,22})/i,
  ];
  for (const pattern of utrLabelPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1] && !isAppTransactionId(match[1])) {
      return cleanUtr(match[1]);
    }
  }

  // 2) Line-based: "UTR" / "UPI Ref" only (skip app txn id rows)
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/PhonePe\s*Transaction|Google\s*Transaction|Paytm\s*(Txn|Transaction)/i.test(line)) {
      continue;
    }
    if (!/\bUTR\b|UPI\s*Ref/i.test(line)) continue;

    const sameLine = line.match(
      /(?:UTR|UPI\s*Ref(?:erence)?(?:\s*No\.?)?)\s*[:\-]?\s*([A-Z0-9]{10,22})/i,
    );
    if (sameLine?.[1] && !isAppTransactionId(sameLine[1])) {
      return cleanUtr(sameLine[1]);
    }
    const nextLine = lines[i + 1] || '';
    const nextMatch = nextLine.match(/^([A-Z0-9]{10,22})$/i);
    if (nextMatch?.[1] && !isAppTransactionId(nextMatch[1])) {
      return cleanUtr(nextMatch[1]);
    }
  }

  // 3) Fallback: 12-digit bank UTR
  const twelveDigitMatches = normalized.match(/\b(\d{12})\b/g) || [];
  if (twelveDigitMatches.length) {
    return twelveDigitMatches[twelveDigitMatches.length - 1];
  }
  return '';
}

type Props = {
  /** base64 image data (no data: prefix), jpeg/png. */
  imageBase64: string;
  onText: (text: string) => void;
  onError: (message: string) => void;
};

/**
 * Invisible WebView that OCRs one image then reports back. Mount it only
 * while a slip is being read; unmount on completion.
 */
export function SlipOcrWebView({ imageBase64, onText, onError }: Props) {
  // Strict allowlist: only valid base64 characters may reach the HTML string,
  // so the interpolation below cannot break out of the script literal.
  const safeBase64 = useMemo(
    () => imageBase64.replace(/[^A-Za-z0-9+/=]/g, ''),
    [imageBase64],
  );
  const html = useMemo(
    () => `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"
  integrity="sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F"
  crossorigin="anonymous"></script>
<script>
(function () {
  function send(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  try {
    if (typeof Tesseract === 'undefined') {
      send({ error: 'OCR library failed to load (check internet)' });
      return;
    }
    Tesseract.recognize('data:image/jpeg;base64,${safeBase64}', 'eng')
      .then(function (res) { send({ text: (res && res.data && res.data.text) || '' }); })
      .catch(function (e) { send({ error: String((e && e.message) || e) }); });
  } catch (e) {
    send({ error: String((e && e.message) || e) });
  }
})();
</script></body></html>`,
    [safeBase64],
  );

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as {
              text?: string;
              error?: string;
            };
            if (data.error) onError(data.error);
            else onText(data.text || '');
          } catch {
            onError('OCR failed');
          }
        }}
        onError={() => onError('OCR failed to load')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { width: 1, height: 1, opacity: 0, position: 'absolute' },
});
