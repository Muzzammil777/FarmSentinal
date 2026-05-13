import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, BellOff, Camera as CameraIcon, PauseCircle, PlayCircle, RefreshCw, ScanEye, Zap, ZapOff } from 'lucide-react';
import { motion } from 'motion/react';
import { AppImage } from '../components/AppImage';
import { StatusBadge } from '../components/StatusBadge';
import { getAnimalDetection, getCameraSource, getCameraStreamUrl, getDashboardSettings, setCameraSource, setEsp32Buzzer, setEsp32Flash, setDetectionEnabled as updateDetectionEnabled } from '../services/api';

const ESP_IP = (() => {
  const settings = getDashboardSettings();
  const raw = settings.esp32StreamUrl?.trim() ?? '';
  if (!raw) return '';
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return url.host;
  } catch {
    return raw.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  }
})();

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function findJpegEnd(data: Uint8Array): number {
  for (let i = 0; i < data.length - 1; i += 1) {
    if (data[i] === 0xff && data[i + 1] === 0xd9) return i;
  }
  return -1;
}

async function fetchOneFrame(streamUrl: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(streamUrl, {
    signal,
    headers: { Connection: 'close' },
    cache: 'no-store',
  });

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Stream reader unavailable');
  }

  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);

    const combined = mergeChunks(chunks);
    const jpegEnd = findJpegEnd(combined);
    if (jpegEnd !== -1) {
      await reader.cancel();
      const jpeg = combined.slice(0, jpegEnd + 2);
      const blob = new Blob([jpeg], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    }
  }

  throw new Error('No complete JPEG frame found');
}

interface BoundingBox { x1: number; y1: number; x2: number; y2: number }
interface DetectionItem { id: string; label: string; confidence: number; boundingBox: BoundingBox | null }
interface AnimalDetection {
  species: string;
  confidence: number;
  detected: boolean;
  threatLevel: string;
  frameUrl: string;
  boundingBox: BoundingBox | null;
  lastUpdated: string;
  frameIndex: number;
  source: unknown;
  sourceType: string;
  status: string;
  online: boolean;
  detectionEnabled: boolean;
  detectionCount: number;
  detections: DetectionItem[];
  latestDetection: DetectionItem | null;
  connected: boolean;
  note: string;
  cameraBaseUrl?: string;
}

export function Camera() {
  const [detection, setDetection] = useState<AnimalDetection | null>(null);
  const [detectionEnabled, setDetectionEnabledState] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isTogglingDetection, setIsTogglingDetection] = useState(false);
  const [error, setError] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [buzzerOn, setBuzzerOn] = useState(false);
  const [isTogglingBuzzer, setIsTogglingBuzzer] = useState(false);
  const [snapshotSrc, setSnapshotSrc] = useState('');
  const [isFrozen, setIsFrozen] = useState(false);
  // Refs so cleanup closure always sees the latest values without re-registering the effect
  const flashOnRef = useRef(false);
  const buzzerOnRef = useRef(false);
  const flashRequestRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onlineRef = useRef(true);
  const prevBlobRef = useRef<string | null>(null);
  const detectionEnabledRef = useRef(detectionEnabled);
  const overlayStreamRef = useRef<string>('');
  const freezeRef = useRef(false);
  const autoFlashRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const { esp32StreamUrl } = getDashboardSettings();
  const resolvedEsp32StreamUrl = (() => {
    if (!esp32StreamUrl) return null;
    try {
      const url = new URL(esp32StreamUrl);
      if (!url.pathname || url.pathname === '/') {
        url.pathname = '/stream';
      }
      return url.toString();
    } catch {
      const trimmed = esp32StreamUrl.trim();
      if (!trimmed) return null;
      if (trimmed.includes('/')) return trimmed;
      return `${trimmed.replace(/\/+$/, '')}/stream`;
    }
  })();
  const esp32BaseUrl = (() => {
    if (!resolvedEsp32StreamUrl) return null;
    try {
      const url = new URL(resolvedEsp32StreamUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  })();
  const esp32ControlBaseUrl = (() => {
    if (!resolvedEsp32StreamUrl) return null;
    try {
      const url = new URL(resolvedEsp32StreamUrl);
      const controlPort = url.port === '81' ? '80' : url.port;
      return `${url.protocol}//${url.hostname}${controlPort ? `:${controlPort}` : ''}`;
    } catch {
      return null;
    }
  })();

  const ensureEsp32BackendSource = async () => {
    if (!resolvedEsp32StreamUrl) return;

    try {
      const { source } = await getCameraSource();
      if (source?.type !== 'esp32_cam' || source?.url !== resolvedEsp32StreamUrl) {
        await setCameraSource({ type: 'esp32_cam', url: resolvedEsp32StreamUrl, index: 0 });
      }
    } catch {
      // Best-effort: detection can still fall back if the backend is unavailable.
    }
  };

  const loadDetection = async () => {
    setIsRefreshing(true);
    // Don't clear the error banner on poll — only clear on explicit refresh/action.

    try {
      const result = await getAnimalDetection();
      setDetection(result);
      setDetectionEnabledState(result.detectionEnabled ?? true);
      setError('');
    } catch (loadError) {
      // If the backend is unreachable but we have a direct ESP32 stream URL,
      // show a softer warning rather than blocking the whole page.
      if (esp32StreamUrl) {
        setError('YOLO backend unreachable — showing direct ESP32 stream. Detection data unavailable.');
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load detection data.');
      }
    } finally {
      setIsRefreshing(false);
    }
  };



  const handleToggleDetection = async () => {
    setIsTogglingDetection(true);
    setError('');

    const nextEnabled = !detectionEnabled;
    setDetectionEnabledState(nextEnabled);
    setDetection((current) =>
      current
        ? {
            ...current,
            detectionEnabled: nextEnabled,
            status: nextEnabled ? 'streaming' : 'paused',
            note: nextEnabled ? 'Live camera data received.' : 'Detection paused.',
            detections: nextEnabled ? current.detections : [],
            detectionCount: nextEnabled ? current.detectionCount : 0,
          }
        : current,
    );

    try {
      await updateDetectionEnabled(nextEnabled);
    } catch (toggleError) {
      setDetectionEnabledState(!nextEnabled);
      setDetection((current) =>
        current
          ? {
              ...current,
              detectionEnabled: !nextEnabled,
              status: !nextEnabled ? 'streaming' : 'paused',
            }
          : current,
      );
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update detection state.');
    } finally {
      setIsTogglingDetection(false);
    }
  };

  const sendFlashCommand = async (on: boolean) => {
    setError('');
    setFlashOn(on);
    flashOnRef.current = on;

    flashRequestRef.current?.abort();
    const controller = new AbortController();
    flashRequestRef.current = controller;

    if (!ESP_IP) {
      return;
    }

    const endpoint = on ? 'flash_on' : 'flash_off';
    const url = `http://${ESP_IP}/${endpoint}`;
    const timeoutId = setTimeout(() => controller.abort(), 800);

    try {
      await fetch(url, { signal: controller.signal, cache: 'no-store' });
    } catch {
      // Ignore network aborts/timeouts; ESP32 likely received the command.
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleBuzzerToggle = async () => {
    setIsTogglingBuzzer(true);
    setError('');
    const next = !buzzerOn;
    try {
      setBuzzerOn(next);
      buzzerOnRef.current = next;
      await setEsp32Buzzer(next);
    } catch (err) {
      setBuzzerOn(!next);
      buzzerOnRef.current = !next;
      setError(err instanceof Error ? err.message : 'Buzzer control failed.');
    } finally {
      setIsTogglingBuzzer(false);
    }
  };

  const handleResumeStream = () => {
    freezeRef.current = false;
    setIsFrozen(false);
    if (autoFlashRef.current) {
      autoFlashRef.current = false;
      void sendFlashCommand(false);
    }
  };

  useEffect(() => {
    // Silently tell the backend to start detecting. If it's offline this is a no-op.
    void updateDetectionEnabled(true).catch(() => undefined);

    const initialize = async () => {
      await ensureEsp32BackendSource();
      await loadDetection();
    };

    void initialize();

    return () => {
      void updateDetectionEnabled(false).catch(() => undefined);
      // Ensure flash/buzzer are off when leaving the page (use refs to avoid stale closure)
      if (flashOnRef.current) void setEsp32Flash(false).catch(() => undefined);
      if (buzzerOnRef.current) void setEsp32Buzzer(false).catch(() => undefined);
    };
  }, []);


  const confidencePercent = Math.round((detection?.confidence ?? 0) * 100);
  // Treat as ESP32-CAM if we have a configured URL (even before backend confirms source type)
  const currentSourceType = detection?.sourceType ?? (resolvedEsp32StreamUrl ? 'esp32_cam' : 'webcam');
  const sourceLabel = currentSourceType === 'esp32_cam' ? 'ESP32-CAM' : 'Webcam';
  const detectionCount = detection?.detectionCount ?? 0;
  const detectionState = detection?.detectionEnabled ?? detectionEnabled;
  const isStreamingStatus = detection?.status === 'streaming' || detection?.status === 'online';
  const isOfflineStatus = detection?.status === 'offline' || detection?.status === 'retrying';
  const isOnline = detection?.online ?? (detection?.status ? (!isOfflineStatus && isStreamingStatus) : true);
  // Video stream is decoupled from the Python backend:
  //   - Always render the FastAPI /video_feed proxy to show detection overlays.
  //   - The backend pulls frames from the ESP32 stream URL when configured.
  const overlayStreamUrl = detection?.frameUrl || getCameraStreamUrl();
  const streamBaseUrl = detectionState ? overlayStreamUrl : (resolvedEsp32StreamUrl ?? esp32StreamUrl);

  useEffect(() => {
    onlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    detectionEnabledRef.current = detectionState;
    overlayStreamRef.current = overlayStreamUrl;
  }, [detectionState, overlayStreamUrl]);

  useEffect(() => {
    if (!detectionState) {
      freezeRef.current = false;
      setIsFrozen(false);
      if (autoFlashRef.current) {
        autoFlashRef.current = false;
        void sendFlashCommand(false);
      }
      return;
    }

    const latestLabel = detection?.latestDetection?.label ?? detection?.species ?? '';
    const hasElephant =
      latestLabel.toLowerCase() === 'elephant' ||
      (detection?.detections ?? []).some((item) => item.label?.toLowerCase() === 'elephant');

    if (hasElephant) {
      if (!freezeRef.current) {
        freezeRef.current = true;
        setIsFrozen(true);
      }
      if (!flashOnRef.current) {
        autoFlashRef.current = true;
        void sendFlashCommand(true);
      }
      return;
    }

    if (!freezeRef.current && autoFlashRef.current) {
      autoFlashRef.current = false;
      void sendFlashCommand(false);
    }
  }, [detectionState, detection?.latestDetection, detection?.detections, detection?.species]);

  useEffect(() => {
    aliveRef.current = true;

    const poll = async () => {
      if (!aliveRef.current) return;

      if (pollInFlightRef.current) {
        timerRef.current = setTimeout(poll, 200);
        return;
      }

      if (!onlineRef.current) {
        timerRef.current = setTimeout(poll, 2000);
        return;
      }

      if (freezeRef.current) {
        timerRef.current = setTimeout(poll, 500);
        return;
      }


      const shouldUseOverlay = detectionEnabledRef.current && Boolean(overlayStreamRef.current);
      const streamUrl = shouldUseOverlay
        ? overlayStreamRef.current
        : (ESP_IP ? `http://${ESP_IP}/stream` : '');

      if (!streamUrl) {
        timerRef.current = setTimeout(poll, 2000);
        return;
      }

      const controller = new AbortController();
      const hardTimeout = setTimeout(() => controller.abort(), 4000);

      try {
        pollInFlightRef.current = true;
        const blobUrl = await fetchOneFrame(streamUrl, controller.signal);
        clearTimeout(hardTimeout);

        if (!aliveRef.current) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        if (freezeRef.current) {
          URL.revokeObjectURL(blobUrl);
        } else {
          if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
          prevBlobRef.current = blobUrl;
          setSnapshotSrc(blobUrl);
        }

        timerRef.current = setTimeout(poll, shouldUseOverlay ? 250 : 120);
      } catch {
        clearTimeout(hardTimeout);
        if (!aliveRef.current) return;
        timerRef.current = setTimeout(poll, 1500);
      } finally {
        pollInFlightRef.current = false;
      }
    };

    void poll();

    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
              <ScanEye className="h-4 w-4 text-accent" />
              ESP camera detection
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Camera analysis</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Stream YOLOv8 animal detections from the active camera source and surface the latest result with a clean summary.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadDetection()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => void handleToggleDetection()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              {detectionState ? (
                <PauseCircle className={`h-4 w-4 ${isTogglingDetection ? 'animate-spin' : ''}`} />
              ) : (
                <PlayCircle className={`h-4 w-4 ${isTogglingDetection ? 'animate-spin' : ''}`} />
              )}
              {isTogglingDetection ? 'Updating detection' : detectionState ? 'Stop detection' : 'Start detection'}
            </button>
            <StatusBadge status={detection?.online ? (detection.detected ? 'alert' : 'safe') : 'offline'} />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.26em] text-muted-foreground">Detection result</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Camera snapshot</h2>
              </div>
              <CameraIcon className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-muted/30 p-4">
              <AppImage
                src={snapshotSrc || streamBaseUrl}
                className="h-80 w-full rounded-2xl object-contain bg-black"
                alt="Live camera stream"
              />
            </div>

            {isFrozen ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                <span>Elephant detected — stream paused.</span>
                <button
                  type="button"
                  onClick={handleResumeStream}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-300/80 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                >
                  Resume live
                </button>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/35 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Species</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{detection?.species ?? 'Unknown'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/35 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confidence</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{confidencePercent}%</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/35 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{sourceLabel}</p>
              </div>
            </div>
          </motion.article>

          <div className="space-y-6">
            <motion.article
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.26em] text-muted-foreground">Detection quality</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Model output</h2>
                </div>
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confidence score</span>
                    <span className="font-medium text-foreground">{confidencePercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all"
                      style={{ width: `${Math.max(0, Math.min(confidencePercent, 100))}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bounding box</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {detection?.boundingBox ? JSON.stringify(detection.boundingBox) : 'No box returned'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detections</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{detectionCount} filtered animal{detectionCount === 1 ? '' : 's'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last update</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {detection?.lastUpdated ? new Date(detection.lastUpdated).toLocaleString() : 'Just now'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{detection?.note ?? 'Live camera feed'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stream state</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{detection?.status ?? 'streaming'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detection</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{detectionState ? 'Enabled' : 'Paused'}</p>
                </div>
              </div>
            </motion.article>
          </div>
        </section>

        {/* ESP32-CAM hardware controls — only shown when ESP32 source is active */}
        {currentSourceType === 'esp32_cam' && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.26em] text-muted-foreground">ESP32-CAM</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Hardware controls</h2>
              </div>
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Flash control */}
              <button
                type="button"
                onClick={() => void sendFlashCommand(!flashOn)}
                className={`group flex flex-col items-center gap-4 rounded-2xl border p-6 text-center transition-all ${
                  flashOn
                    ? 'border-amber-400/60 bg-amber-400/10 hover:bg-amber-400/20'
                    : 'border-border bg-muted/30 hover:bg-muted/60'
                }`}
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                    flashOn ? 'bg-amber-400/20 text-amber-400' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {flashOn ? <Zap className="h-7 w-7 fill-amber-400" /> : <ZapOff className="h-7 w-7" />}
                </span>
                <div>
                  <p className={`text-base font-semibold ${flashOn ? 'text-amber-400' : 'text-foreground'}`}>
                    Flash {flashOn ? 'ON' : 'OFF'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {flashOn ? 'Tap to turn flash off' : 'Tap to turn flash on'}
                  </p>
                </div>
              </button>

              {/* Buzzer control */}
              <button
                type="button"
                onClick={() => void handleBuzzerToggle()}
                disabled={isTogglingBuzzer}
                className={`group flex flex-col items-center gap-4 rounded-2xl border p-6 text-center transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  buzzerOn
                    ? 'border-rose-400/60 bg-rose-400/10 hover:bg-rose-400/20'
                    : 'border-border bg-muted/30 hover:bg-muted/60'
                }`}
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                    buzzerOn ? 'bg-rose-400/20 text-rose-400' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {buzzerOn ? <Bell className="h-7 w-7 fill-rose-400" /> : <BellOff className="h-7 w-7" />}
                </span>
                <div>
                  <p className={`text-base font-semibold ${buzzerOn ? 'text-rose-400' : 'text-foreground'}`}>
                    Buzzer {buzzerOn ? 'ON' : 'OFF'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isTogglingBuzzer ? 'Updating…' : buzzerOn ? 'Tap to silence buzzer' : 'Tap to activate buzzer'}
                  </p>
                </div>
              </button>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
