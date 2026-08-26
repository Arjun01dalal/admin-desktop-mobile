/**
 * In-app push toast: separate title / body, optional image, short chime.
 * Native OS notification is still shown from Electron main.
 */
import { toast } from 'react-toastify';
import type { PushNotificationPayload } from '@/types/gcalc';

/** Built-in push sound (Vite public/ → /sounds/notify.mp3). */
const NOTIFY_SOUND_URL = '/sounds/notify.mp3';

let sharedAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

function getNotifyAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio(NOTIFY_SOUND_URL);
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

/** Call after first user gesture so later pushes can autoplay. */
export function unlockNotificationAudio() {
  if (audioUnlocked) return;
  try {
    const audio = getNotifyAudio();
    audio.volume = 0.001;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        audioUnlocked = true;
      })
      .catch(() => {
        // ignore
      });
  } catch {
    // ignore
  }
}

function extractImageUrl(payload: PushNotificationPayload): string {
  const data = payload.data || {};
  const candidates = [
    payload.imageUrl,
    data.image,
    data.imageUrl,
    data.image_url,
    data.picture,
    data.icon,
    data.photo,
  ];
  for (const raw of candidates) {
    const url = String(raw || '').trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return '';
}

function playNotificationChime() {
  try {
    const audio = getNotifyAudio();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    const play = audio.play();
    if (play && typeof play.catch === 'function') {
      void play.catch(() => {
        playSynthFallback();
      });
    }
  } catch {
    playSynthFallback();
  }
}

function playSynthFallback() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume?.();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.exponentialRampToValueAtTime(0.55, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.35, now + 0.25);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    master.connect(ctx.destination);

    const freqs = [880, 1175, 1397];
    freqs.forEach((freq, i) => {
      const start = now + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.7, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.3);
    });

    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        // ignore
      }
    }, 900);
  } catch {
    // ignore
  }
}

export function showPushToast(payload: PushNotificationPayload, opts?: { playSound?: boolean }) {
  const title = String(payload?.title || 'Notification').trim() || 'Notification';
  const body = String(payload?.body || '').trim();
  const imageUrl = extractImageUrl(payload);

  if (opts?.playSound !== false) {
    playNotificationChime();
  }

  toast(
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        minWidth: 0,
        maxWidth: 360,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          width={52}
          height={52}
          style={{
            borderRadius: 10,
            objectFit: 'cover',
            flexShrink: 0,
            background: 'rgba(255,255,255,0.08)',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1.3,
            marginBottom: body ? 4 : 0,
            wordBreak: 'break-word',
          }}
        >
          {title}
        </div>
        {body ? (
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.35,
              opacity: 0.92,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {body}
          </div>
        ) : null}
      </div>
    </div>,
    {
      autoClose: 9000,
      type: 'default',
      position: 'bottom-right',
      icon: imageUrl ? false : undefined,
    },
  );
}
