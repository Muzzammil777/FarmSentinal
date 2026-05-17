const STORAGE_KEY = 'niral-dashboard-settings';
const DEFAULT_SENSOR_BASE_URL = 'http://192.168.1.100';
const DEFAULT_CAMERA_BASE_URL = 'http://127.0.0.1:8000';
const LOCAL_CAMERA_FALLBACK_URL = 'http://127.0.0.1:8000';
const DEFAULT_ALERT_THRESHOLD = 100;
const DEFAULT_ESP32_CONTROL_URL = '';

function safeParse(jsonText, fallback) {
  try {
    return JSON.parse(jsonText);
  } catch {
    return fallback;
  }
}

function readSettings() {
  if (typeof window === 'undefined') {
    return {};
  }

  return safeParse(window.localStorage.getItem(STORAGE_KEY) ?? '{}', {});
}

function normalizeBaseUrl(value, fallbackUrl) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return fallbackUrl;
  }

  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/\/+$/, '');
  }

  return `http://${rawValue.replace(/\/+$/, '')}`;
}

export function getDashboardSettings() {
  const storedSettings = readSettings();

  return {
    sensorBaseUrl: normalizeBaseUrl(
      storedSettings.sensorBaseUrl || import.meta.env.VITE_SENSOR_API_BASE_URL,
      DEFAULT_SENSOR_BASE_URL,
    ),
    cameraBaseUrl: normalizeBaseUrl(
      storedSettings.cameraBaseUrl || import.meta.env.VITE_CAMERA_API_BASE_URL,
      DEFAULT_CAMERA_BASE_URL,
    ),
    alertThreshold:
      Number(storedSettings.alertThreshold ?? import.meta.env.VITE_ALERT_THRESHOLD ?? DEFAULT_ALERT_THRESHOLD),
    pollingInterval:
      Number(storedSettings.pollingInterval ?? import.meta.env.VITE_POLLING_INTERVAL ?? 1000),
    perimeterLabel: storedSettings.perimeterLabel || 'North boundary',
    esp32StreamUrl: String(storedSettings.esp32StreamUrl ?? import.meta.env.VITE_ESP32_STREAM_URL ?? 'http://10.120.58.104:81/stream').trim(),
    esp32ControlUrl: normalizeBaseUrl(
      storedSettings.esp32ControlUrl || import.meta.env.VITE_ESP32_CONTROL_URL,
      DEFAULT_ESP32_CONTROL_URL,
    ),
  };
}

export function saveDashboardSettings(settings) {
  if (typeof window === 'undefined') {
    return;
  }

  const mergedSettings = {
    ...getDashboardSettings(),
    ...settings,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSettings));
}

function buildUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl).toString();
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function getUrlOrigin(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function getCameraBaseCandidates() {
  const settings = getDashboardSettings();
  const esp32Origin = getUrlOrigin(settings.esp32StreamUrl);
  const candidates = [LOCAL_CAMERA_FALLBACK_URL, settings.cameraBaseUrl];

  const filtered = candidates.filter((candidate) => {
    const origin = getUrlOrigin(candidate);
    return !origin || origin !== esp32Origin;
  });

  return uniqueList(filtered);
}

async function requestJson(url, options = {}) {
  const { method = 'GET', body } = options;

  console.log('[sensor-api] request', method, url);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(3000), // Fail fast so fallback candidates are tried quickly
    });

    console.log('[sensor-api] response', response.status, response.ok);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log('[sensor-api] payload', data);

    return { data, connected: true };
  } catch (error) {
    console.error('[sensor-api] request failed', url, error);
    throw error;
  }
}

async function fetchJson(url) {
  return requestJson(url);
}

function formatTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeRecentEvents(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.slice(0, 6).map((event, index) => ({
    id: event.id ?? `${index}`,
    label: event.label ?? event.event ?? 'Update received',
    timestamp: event.timestamp ?? event.time ?? formatTimestamp(),
    severity: event.severity ?? 'info',
  }));
}

function normalizeSensorData(payload, connected) {
  const settings = getDashboardSettings();
  const rawDistance = payload.distanceCm ?? payload.distance_cm ?? payload.distance ?? null;
  const parsedDistance = rawDistance === null || rawDistance === undefined || rawDistance === '' ? null : Number(rawDistance);
  const distanceCm = parsedDistance === null || Number.isNaN(parsedDistance) ? null : parsedDistance;
  const alert = Boolean(payload.alert ?? payload.isAlert ?? payload.intrusion ?? payload.triggered ?? false);
  const status = payload.status ?? (connected ? 'online' : 'offline');
  const lastUpdated = formatTimestamp(payload.lastUpdated ?? payload.timestamp ?? payload.updatedAt);
  const alertKey = String(
    payload.alertId ?? payload.alert_id ?? payload.eventId ?? payload.sequence ?? `${alert}-${distanceCm ?? 'null'}-${lastUpdated}`,
  );

  return {
    deviceName: payload.deviceName ?? payload.device_name ?? 'Perimeter Node 01',
    location: payload.location ?? settings.perimeterLabel,
    distanceCm,
    alert,
    batteryPercent: Number(payload.batteryPercent ?? payload.battery ?? 0) || 0,
    signalStrength: Number(payload.signalStrength ?? payload.rssi ?? -60) || -60,
    uptimeHours: Number(payload.uptimeHours ?? payload.uptime ?? 0) || 0,
    temperatureC: Number(payload.temperatureC ?? payload.temperature ?? 0) || 0,
    lastUpdated,
    recentEvents: normalizeRecentEvents(payload.recentEvents),
    status,
    alertKey,
    connected,
  };
}

function normalizeAnimalData(payload, connected) {
  const latestDetection = payload.latestDetection ?? payload.latest_detection ?? payload.detections?.[0] ?? null;
  const detections = Array.isArray(payload.detections)
    ? payload.detections.map((item, index) => ({
        id: item.id ?? `${index}`,
        label: item.label ?? item.species ?? item.animal ?? 'Unknown',
        confidence: Number(item.confidence ?? item.score ?? 0) || 0,
        boundingBox: item.boundingBox ?? item.bounding_box ?? null,
      }))
    : [];
  const activeDetection = latestDetection
    ? {
        label: latestDetection.label ?? latestDetection.species ?? latestDetection.animal ?? 'Unknown',
        confidence: Number(latestDetection.confidence ?? latestDetection.score ?? 0) || 0,
        boundingBox: latestDetection.boundingBox ?? latestDetection.bounding_box ?? null,
      }
    : detections[0] ?? null;
  const confidence = Number(activeDetection?.confidence ?? payload.confidence ?? payload.score ?? 0) || 0;

  return {
    species: activeDetection?.label ?? payload.species ?? payload.animal ?? payload.label ?? 'Unknown',
    confidence,
    detected: Boolean(payload.detected ?? payload.found ?? activeDetection ?? payload.animal),
    threatLevel: payload.threatLevel ?? payload.threat_level ?? 'medium',
    frameUrl: payload.frameUrl ?? payload.frame_url ?? payload.videoFeedUrl ?? payload.video_feed_url ?? '',
    boundingBox: activeDetection?.boundingBox ?? payload.boundingBox ?? payload.bounding_box ?? null,
    lastUpdated: formatTimestamp(payload.processedAt ?? payload.lastUpdated ?? payload.timestamp ?? payload.updatedAt),
    frameIndex: Number(payload.frameIndex ?? payload.frame_index ?? 0) || 0,
    source: payload.source ?? null,
    sourceType: payload.source?.type ?? payload.sourceType ?? payload.source_type ?? 'webcam',
    status: payload.status ?? (connected ? 'streaming' : 'offline'),
    online: Boolean(payload.online ?? connected),
    detectionEnabled: payload.detectionEnabled ?? payload.detection_enabled ?? true,
    detectionCount: Number(payload.detectionCount ?? detections.length ?? 0) || 0,
    detections,
    latestDetection: activeDetection,
    connected,
    note:
      payload.note ??
      (connected
        ? payload.online === false
          ? 'Camera stream is reconnecting.'
          : 'Live camera data received.'
        : 'Using local fallback data.'),
  };
}

async function requestCameraJson(pathname, options = {}) {
  const candidates = getCameraBaseCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const result = await requestJson(buildUrl(baseUrl, pathname), options);
      return { ...result, baseUrl };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to connect to camera backend.');
}

export async function getSensorData() {
  const settings = getDashboardSettings();
  const url = buildUrl(settings.sensorBaseUrl, '/data');
  const { data, connected } = await fetchJson(url);
  return normalizeSensorData(data, connected);
}

export async function resetSensorAlert() {
  const settings = getDashboardSettings();
  const url = buildUrl(settings.sensorBaseUrl, '/reset');

  try {
    console.log('[sensor-api] GET', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    console.log('[sensor-api] response', response.status, response.ok);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return { ok: true, connected: true };
  } catch (error) {
    console.error('[sensor-api] reset failed', url, error);
    return { ok: true, connected: false };
  }
}

export async function getAnimalDetection() {
  const { data, connected, baseUrl } = await requestCameraJson('/detections');
  const normalized = normalizeAnimalData(data, connected);

  return {
    ...normalized,
    cameraBaseUrl: baseUrl,
    frameUrl: normalized.frameUrl || buildUrl(baseUrl, '/video_feed'),
  };
}

export function getCameraStreamUrl() {
  const settings = getDashboardSettings();
  return buildUrl(settings.cameraBaseUrl, '/video_feed');
}

export async function toggleCameraSource() {
  const settings = getDashboardSettings();
  const body = settings.esp32StreamUrl ? { url: settings.esp32StreamUrl } : undefined;
  const { data, connected, baseUrl } = await requestCameraJson('/source/toggle', {
    method: 'POST',
    body,
  });

  return {
    source: data.source ?? null,
    status: data.status ?? 'reconnecting',
    online: Boolean(data.online ?? connected),
    cameraBaseUrl: baseUrl,
    connected,
  };
}

export async function getCameraSource() {
  const { data, connected, baseUrl } = await requestCameraJson('/source');
  return {
    source: data ?? null,
    cameraBaseUrl: baseUrl,
    connected,
  };
}

/**
 * Derives the ESP32-CAM base URL from the configured stream URL.
 * e.g. "http://192.168.1.105:81/stream" → "http://192.168.1.105:81"
 */
export function getEsp32BaseUrl() {
  const { esp32ControlUrl, esp32StreamUrl } = getDashboardSettings();
  const candidate = esp32ControlUrl || esp32StreamUrl;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Toggle the ESP32-CAM onboard flash LED.
 * Calls /flash_on or /flash_off directly on the device.
 */
export async function setEsp32Flash(on) {
  const base = getEsp32BaseUrl();
  if (!base) throw new Error('No ESP32 stream URL configured.');
  const endpoint = on ? '/flash_on' : '/flash_off';
  const url = new URL(`${base}${endpoint}`);
  url.searchParams.set('ts', `${Date.now()}`);
  // mode:'no-cors' — ESP32 doesn't send CORS headers. The request IS received and acted
  // on by the device, but the browser can't read the opaque response. We update the UI
  // optimistically; the physical LED state matches what we sent.
  try {
    await fetch(url.toString(), { mode: 'no-cors' });
    return { ok: true, on };
  } catch {
    return { ok: false, on };
  }
}

/**
 * Toggle the ESP32-CAM buzzer.
 * Calls /buzzer_on or /buzzer_off directly on the device.
 */
export async function setEsp32Buzzer(on) {
  const base = getEsp32BaseUrl();
  if (!base) throw new Error('No ESP32 stream URL configured.');
  const endpoint = on ? '/buzzer_on' : '/buzzer_off';
  // mode:'no-cors' — same reason as setEsp32Flash above.
  const url = new URL(`${base}${endpoint}`);
  url.searchParams.set('ts', `${Date.now()}`);
  try {
    await fetch(url.toString(), { mode: 'no-cors' });
    return { ok: true, on };
  } catch {
    return { ok: false, on };
  }
}

export async function setCameraSource(source) {
  const { data, connected, baseUrl } = await requestCameraJson('/source', {
    method: 'PUT',
    body: source,
  });

  return {
    source: data.source ?? source,
    status: data.status ?? 'reconnecting',
    online: Boolean(data.online ?? connected),
    cameraBaseUrl: baseUrl,
    connected,
  };
}

export async function setDetectionEnabled(enabled) {
  const { data, connected, baseUrl } = await requestCameraJson('/detection', {
    method: 'PUT',
    body: { enabled: Boolean(enabled) },
  });

  return {
    enabled: Boolean(data.enabled),
    status: data.status ?? (Boolean(enabled) ? 'streaming' : 'paused'),
    online: Boolean(data.online ?? connected),
    cameraBaseUrl: baseUrl,
    connected,
  };
}

export async function listEsp32Ports() {
  const { data, connected, baseUrl } = await requestCameraJson('/esp32/ports');
  return {
    ...data,
    connected,
    cameraBaseUrl: baseUrl,
  };
}

export async function flashEsp32Cam({ port, fqbn, streamUrl }) {
  const { data, connected, baseUrl } = await requestCameraJson('/esp32/flash', {
    method: 'POST',
    body: {
      port,
      fqbn: fqbn || undefined,
      stream_url: streamUrl || undefined,
    },
  });

  return {
    ...data,
    connected,
    cameraBaseUrl: baseUrl,
  };
}
