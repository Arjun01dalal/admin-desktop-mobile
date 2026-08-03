import { toast } from 'react-toastify';

type CopyOptions = {
  /** Toast message on success. Defaults to "Copied". */
  successMessage?: string;
  /** Skip success toast. */
  silent?: boolean;
};

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
  }
  return ok;
}

/**
 * Copy text to the system clipboard.
 * Works in Electron (via main-process clipboard) and browsers (Clipboard API + fallback).
 * Reuse from any screen / component.
 */
export async function copyToClipboard(
  text: string,
  options: CopyOptions = {},
): Promise<boolean> {
  const value = String(text ?? '');
  if (!value) {
    if (!options.silent) toast.error('Nothing to copy');
    return false;
  }

  try {
    const viaElectron = await window.gcalc?.copyText?.(value);
    if (viaElectron?.ok) {
      if (!options.silent) toast.success(options.successMessage ?? 'Copied');
      return true;
    }
  } catch {
    /* try browser APIs next */
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      if (!options.silent) toast.success(options.successMessage ?? 'Copied');
      return true;
    }
  } catch {
    /* try execCommand fallback */
  }

  try {
    if (fallbackCopy(value)) {
      if (!options.silent) toast.success(options.successMessage ?? 'Copied');
      return true;
    }
  } catch {
    /* handled below */
  }

  if (!options.silent) toast.error('Failed to copy');
  return false;
}
