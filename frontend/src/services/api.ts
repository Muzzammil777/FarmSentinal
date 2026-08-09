import type { SensorStatus, DetectionStatus, HardwareControlStatus, AppSettings, LogEntry } from '../types';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 
  (import.meta.env.PROD ? 'https://farmsentinal-backend.onrender.com/api' : '/api');

export async function fetchSensorStatus(): Promise<SensorStatus> {
  const res = await fetch(`${API_BASE}/sensors`);
  if (!res.ok) throw new Error('Failed to fetch sensor status');
  return res.json();
}

export async function resetSensorAlert(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/sensors/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset sensor alert');
  return res.json();
}

export async function fetchDetectionStatus(): Promise<DetectionStatus> {
  const res = await fetch(`${API_BASE}/detections`);
  if (!res.ok) throw new Error('Failed to fetch detection status');
  return res.json();
}

export async function fetchControlStatus(): Promise<HardwareControlStatus> {
  const res = await fetch(`${API_BASE}/control/status`);
  if (!res.ok) throw new Error('Failed to fetch control status');
  return res.json();
}

export async function controlLed(state: boolean) {
  const res = await fetch(`${API_BASE}/control/led`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) throw new Error('Failed to toggle LED');
  return res.json();
}

export async function controlBuzzer(state: boolean) {
  const res = await fetch(`${API_BASE}/control/buzzer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) throw new Error('Failed to toggle Buzzer');
  return res.json();
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: AppSettings): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function fetchLogs(): Promise<LogEntry[]> {
  const res = await fetch(`${API_BASE}/logs`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function clearLogs(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/logs/clear`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear logs');
  return res.json();
}
