import pdfToText from "react-pdftotext";
import { createWorker } from "tesseract.js";

const cleanUtr = (value: string): string =>
  value.replace(/[^A-Z0-9]/gi, "").toUpperCase();

/** PhonePe/GPay app txn ids (e.g. T260718...) — not bank UTR */
const isAppTransactionId = (value: string): boolean =>
  /^T\d{15,}$/i.test(value) || value.length > 16;

/**
 * Extract bank UTR from GPay / PhonePe / Paytm slip OCR text.
 * Prefers labeled "UTR" / "UPI Ref" — ignores PhonePe Transaction ID.
 */
export const extractUtrFromText = (text: string): string => {
  const normalized = text.replace(/\s+/g, " ").trim();

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

    if (
      /PhonePe\s*Transaction|Google\s*Transaction|Paytm\s*(Txn|Transaction)/i.test(
        line,
      )
    ) {
      continue;
    }
    if (!/\bUTR\b|UPI\s*Ref/i.test(line)) continue;

    const sameLine = line.match(
      /(?:UTR|UPI\s*Ref(?:erence)?(?:\s*No\.?)?)\s*[:\-]?\s*([A-Z0-9]{10,22})/i,
    );
    if (sameLine?.[1] && !isAppTransactionId(sameLine[1])) {
      return cleanUtr(sameLine[1]);
    }

    const nextLine = lines[i + 1] || "";
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

  return "";
};

const readTextFromImage = async (file: File): Promise<string> => {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text || "";
  } finally {
    await worker.terminate();
  }
};

export const isUtrSlipFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  const isPdf = fileName.endsWith(".pdf");
  const isImage =
    /\.(png|jpe?g|webp|heic)$/i.test(fileName) ||
    file.type.startsWith("image/");
  return isPdf || isImage;
};

/** Read UTR from GPay / PhonePe / Paytm screenshot (or PDF). */
export const readUtrFromSlip = async (file: File): Promise<string> => {
  const fileName = file.name.toLowerCase();
  const isPdf = fileName.endsWith(".pdf");
  const text = isPdf ? await pdfToText(file) : await readTextFromImage(file);
  return extractUtrFromText(text);
};
