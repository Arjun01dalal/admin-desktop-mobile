import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { secureApi } from '@/api/secureClient';
import {
  buildGtelClickToCallBody,
  createGtelCallId,
  deriveGtelActiveCallPhase,
  extractGtelDispositions,
  extractPreviousNoteDetails,
  formatCallbackDueAtIst,
  getNumericExtension,
  gtelActiveCallStatusLabel,
  gtelActiveCallStatusTone,
  isDispositionAlreadySetMessage,
  isNoActiveCallError,
  parseGtelQuickStatus,
  sanitizeGtelPhone,
  type GtelActiveCallPhase,
  type GtelCallQuickStatus,
  type GtelC2cTarget,
  type GtelPreviousNote,
} from '@astro/shared';

import { useGtelAuth } from './useGtelAuth';

type Args = {
  target: GtelC2cTarget;
  onClose: () => void;
  onEnded?: () => void;
};

export type GtelActiveCallController = {
  phase: GtelActiveCallPhase;
  statusTone: string;
  statusLabel: string;
  phoneDisplay: string;
  cxName: string;
  dpId: string;
  balanceRaw: string | number | undefined;
  bonusRaw: string | number | undefined;
  callId: string;
  extension: string;
  elapsed: number;
  preview: boolean;
  dispositions: string[];
  disposition: string;
  notes: string;
  callbackDueAt: string;
  previousNote: GtelPreviousNote | null;
  quickStatus: GtelCallQuickStatus | null;
  dispLoading: boolean;
  hangingUp: boolean;
  redialing: boolean;
  disableRedial: boolean;
  setDisposition: (value: string) => void;
  setNotes: (value: string) => void;
  setCallbackDueAt: (value: string) => void;
  openHangupForm: () => void;
  closeHangupForm: () => void;
  hangUp: () => Promise<void>;
  redial: () => Promise<void>;
  close: () => void;
};

export function useGtelActiveCall({ target, onClose, onEnded }: Args): GtelActiveCallController {
  const { admin, loginExtensionId, canShowMobile } = useGtelAuth();
  const [starting, setStarting] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const [redialing, setRedialing] = useState(false);
  const [showRedial, setShowRedial] = useState(false);
  const [confirmHangup, setConfirmHangup] = useState(false);
  const [callId, setCallId] = useState('');
  const [extension, setExtension] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dispositions, setDispositions] = useState<string[]>([]);
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');
  const [callbackDueAt, setCallbackDueAt] = useState('');
  const [previousNote, setPreviousNote] = useState<GtelPreviousNote | null>(null);
  const [quickStatus, setQuickStatus] = useState<GtelCallQuickStatus | null>(null);
  const [dispLoading, setDispLoading] = useState(false);
  const [active, setActive] = useState<GtelC2cTarget | null>(null);

  const startedRef = useRef(false);
  const endedNotifyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  /** Bumps cancel in-flight poll / hangup / dial work. */
  const genRef = useRef(0);
  const hangupGenRef = useRef(0);

  const loadDispositions = useCallback(async (gen: number) => {
    setDispLoading(true);
    try {
      const res = await secureApi('gtel.dispositions', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setDispositions([]);
        toast.error(res.message || 'Failed to load dispositions');
        return;
      }
      const list = extractGtelDispositions(res.data);
      setDispositions(list);
      if (!list.length) toast.error('No dispositions returned from dialer');
    } catch (err) {
      if (gen !== genRef.current) return;
      setDispositions([]);
      toast.error(err instanceof Error ? err.message : 'Failed to load dispositions');
    } finally {
      if (gen === genRef.current) setDispLoading(false);
    }
  }, []);

  const startCall = useCallback(
    async (next: GtelC2cTarget) => {
      const gen = ++genRef.current;
      const phone = sanitizeGtelPhone(next.phoneNumber);
      const ext =
        getNumericExtension(next.extensionId) ||
        loginExtensionId ||
        getNumericExtension(admin?.extensionId);
      const nextCallId = createGtelCallId();
      const isCampaign = Boolean(next.campaignDataId);
      setStarting(true);
      setActive(next);
      setShowRedial(false);
      setConfirmHangup(false);
      endedNotifyRef.current = false;
      try {
        if (!phone) {
          toast.error('Phone number is required');
          onCloseRef.current();
          return;
        }
        if (!isCampaign && !ext) {
          if (next.isProspect) {
            toast.error('Extension not found for prospect call');
            onCloseRef.current();
            return;
          }
          if (gen !== genRef.current) return;
          setCallId(nextCallId);
          setExtension('—');
          setStartedAt(Date.now());
          setElapsed(0);
          setEnded(false);
          setPreview(true);
          setDisposition('');
          setNotes('');
          setCallbackDueAt('');
          void loadDispositions(gen);
          return;
        }

        const body = buildGtelClickToCallBody({
          callId: nextCallId,
          phone,
          extension: ext,
          subAdminId: String(admin?._id || ''),
          target: next,
        });
        const res = await secureApi('gtel.clickToCall', body);
        if (gen !== genRef.current) return;
        if (!res.ok || res.success === false) {
          toast.error(res.message || 'Call could not be initiated');
          onCloseRef.current();
          return;
        }

        const note = extractPreviousNoteDetails(res.data, body);
        setPreviousNote(note);
        setCallId(nextCallId);
        setExtension(isCampaign ? 'Campaign' : ext);
        setStartedAt(Date.now());
        setElapsed(0);
        setEnded(false);
        setPreview(false);
        setDisposition('');
        setNotes('');
        setCallbackDueAt('');
        setQuickStatus({ callId: nextCallId, answered: false, hangup: false });
        toast.success('Call initiated');
        void loadDispositions(gen);
      } finally {
        if (gen === genRef.current) setStarting(false);
      }
    },
    [admin, loadDispositions, loginExtensionId],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startCall(target);
    return () => {
      genRef.current += 1;
      hangupGenRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!callId || ended || !startedAt) return;
    setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const timer = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callId, ended, startedAt]);

  // Poll quick-status; aborted via gen + cancelled flag.
  useEffect(() => {
    const id = String(callId || '').trim();
    if (!id || ended || preview) return;
    const gen = genRef.current;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await secureApi('gtel.quickStatus', { callId: id });
        if (cancelled || gen !== genRef.current || !res.ok) return;
        const status = parseGtelQuickStatus(res.data, id);
        if (status) setQuickStatus(status);
      } catch {
        /* ignore poll errors */
      }
    };
    void poll();
    const intervalId = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [callId, ended, preview]);

  const hangUp = useCallback(async () => {
    if (!callId) return;
    if (!disposition) {
      toast.error('Please select disposition');
      setConfirmHangup(true);
      return;
    }
    const hangGen = ++hangupGenRef.current;
    setHangingUp(true);
    try {
      if (!preview) {
        const notesTrim = notes.trim();
        const callbackIst = formatCallbackDueAtIst(callbackDueAt);
        if (notesTrim || callbackIst) {
          const metaRes = await secureApi('gtel.updateMetadata', {
            callId,
            ...(notesTrim ? { notes: notesTrim } : {}),
            ...(callbackIst ? { callbackDueAtIST: callbackIst } : {}),
          });
          if (hangGen !== hangupGenRef.current) return;
          if (!metaRes.ok && metaRes.success === false) {
            toast.error(metaRes.message || 'Failed to update call note');
            return;
          }
        }

        const dispRes = await secureApi('gtel.updateDisposition', {
          callId,
          disposition,
        });
        if (hangGen !== hangupGenRef.current) return;
        const alreadySet = isDispositionAlreadySetMessage(dispRes.message);
        if (!dispRes.ok && !alreadySet && dispRes.success === false) {
          toast.error(dispRes.message || 'Failed to update disposition');
          return;
        }

        const statusRes = await secureApi<{ status?: string }>('gtel.callDetails', { callId });
        if (hangGen !== hangupGenRef.current) return;
        const status = String(
          (statusRes.data as { status?: string } | undefined)?.status || '',
        ).toUpperCase();

        if (status !== 'COMPLETED') {
          const hangRes = await secureApi('gtel.hangup', { callId });
          if (hangGen !== hangupGenRef.current) return;
          if (!hangRes.ok || hangRes.success === false) {
            if (isNoActiveCallError(hangRes.message)) {
              if (active?.disableRedial) {
                toast.error(hangRes.message || 'No active call found');
                setEnded(true);
                endedNotifyRef.current = true;
                onCloseRef.current();
                return;
              }
              setShowRedial(true);
              setConfirmHangup(false);
              toast.error(hangRes.message || 'No active call found');
              return;
            }
            toast.error(hangRes.message || 'Hang up failed');
            setEnded(true);
            onCloseRef.current();
            return;
          }
        }
      }

      if (hangGen !== hangupGenRef.current) return;
      setEnded(true);
      toast.success('Call ended');
      endedNotifyRef.current = true;
      onEndedRef.current?.();
      onCloseRef.current();
    } finally {
      if (hangGen === hangupGenRef.current) setHangingUp(false);
    }
  }, [active?.disableRedial, callId, callbackDueAt, disposition, notes, preview]);

  const redial = useCallback(async () => {
    if (active?.disableRedial || !callId || redialing) return;
    const gen = ++genRef.current;
    setRedialing(true);
    try {
      const nextCallId = createGtelCallId();
      const res = await secureApi('gtel.redial', {
        originalCallId: callId,
        callId: nextCallId,
        reason: 'no_active_call',
      });
      if (gen !== genRef.current) return;
      if (!res.ok || res.success === false) {
        toast.error(res.message || 'Redial failed');
        return;
      }
      setCallId(nextCallId);
      setStartedAt(Date.now());
      setElapsed(0);
      setEnded(false);
      setShowRedial(false);
      setConfirmHangup(false);
      setQuickStatus({ callId: nextCallId, answered: false, hangup: false });
      toast.success('Call redialed');
    } finally {
      if (gen === genRef.current) setRedialing(false);
    }
  }, [active?.disableRedial, callId, redialing]);

  const openHangupForm = useCallback(() => {
    if (hangingUp || ended || !callId) return;
    setConfirmHangup(true);
    if (!dispositions.length && !dispLoading) void loadDispositions(genRef.current);
  }, [callId, dispLoading, dispositions.length, ended, hangingUp, loadDispositions]);

  const closeHangupForm = useCallback(() => {
    if (!hangingUp) setConfirmHangup(false);
  }, [hangingUp]);

  const close = useCallback(() => {
    if (endedNotifyRef.current) onEndedRef.current?.();
    onCloseRef.current();
  }, []);

  const phase = deriveGtelActiveCallPhase({
    starting,
    callId,
    ended,
    showRedial,
    confirmHangup,
  });
  const statusTone = gtelActiveCallStatusTone({
    phase,
    answered: quickStatus?.answered,
    hangup: quickStatus?.hangup,
  });
  const statusLabel = gtelActiveCallStatusLabel({
    phase,
    answered: quickStatus?.answered,
    hangup: quickStatus?.hangup,
  });

  return {
    phase,
    statusTone,
    statusLabel,
    phoneDisplay: canShowMobile
      ? active?.phoneNumber || target.phoneNumber || '—'
      : '**********',
    cxName: String(active?.userName || target.userName || '').trim() || '—',
    dpId: String(active?.userId || target.userId || '').trim(),
    balanceRaw: active?.balance ?? target.balance,
    bonusRaw: active?.bonusBalance ?? target.bonusBalance,
    callId,
    extension,
    elapsed,
    preview,
    dispositions,
    disposition,
    notes,
    callbackDueAt,
    previousNote,
    quickStatus,
    dispLoading,
    hangingUp,
    redialing,
    disableRedial: Boolean(active?.disableRedial),
    setDisposition,
    setNotes,
    setCallbackDueAt,
    openHangupForm,
    closeHangupForm,
    hangUp,
    redial,
    close,
  };
}
