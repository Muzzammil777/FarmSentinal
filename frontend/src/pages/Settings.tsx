import { useState } from 'react';
import { CheckCircle2, Save, Server, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDashboardSettings, saveDashboardSettings } from '../services/api';

export function Settings() {
  const initialSettings = getDashboardSettings();
  const [sensorBaseUrl, setSensorBaseUrl] = useState(initialSettings.sensorBaseUrl);
  const [cameraBaseUrl, setCameraBaseUrl] = useState(initialSettings.cameraBaseUrl);
  const [esp32StreamUrl, setEsp32StreamUrl] = useState(initialSettings.esp32StreamUrl ?? '');
  const [alertThreshold, setAlertThreshold] = useState(initialSettings.alertThreshold);
  const [pollingInterval, setPollingInterval] = useState(initialSettings.pollingInterval);
  const [perimeterLabel, setPerimeterLabel] = useState(initialSettings.perimeterLabel);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveDashboardSettings({
      sensorBaseUrl,
      cameraBaseUrl,
      esp32StreamUrl,
      alertThreshold: Number(alertThreshold),
      pollingInterval: Number(pollingInterval),
      perimeterLabel,
    });

    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
            <Server className="h-4 w-4 text-accent" />
            Device configuration
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Settings</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Configure the sensor and camera endpoints, along with polling and alert thresholds.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sensor node</h2>
                <p className="mt-1 text-sm text-muted-foreground">Distance readings and reset commands.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Sensor base URL</span>
                <input
                  type="url"
                  value={sensorBaseUrl}
                  onChange={(event) => setSensorBaseUrl(event.target.value)}
                  placeholder="http://192.168.1.100"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Alert threshold</span>
                <input
                  type="number"
                  value={alertThreshold}
                  onChange={(event) => setAlertThreshold(Number(event.target.value))}
                  min="0"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Polling interval (ms)</span>
                <input
                  type="number"
                  value={pollingInterval}
                  onChange={(event) => setPollingInterval(Number(event.target.value))}
                  min="1000"
                  step="500"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
                <Video className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Camera node</h2>
                <p className="mt-1 text-sm text-muted-foreground">FastAPI endpoint for YOLO detections and the live annotated stream.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Camera API base URL</span>
                <input
                  type="url"
                  value={cameraBaseUrl}
                  onChange={(event) => setCameraBaseUrl(event.target.value)}
                  placeholder="http://127.0.0.1:8000"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">ESP32 stream URL</span>
                <input
                  type="url"
                  value={esp32StreamUrl}
                  onChange={(event) => setEsp32StreamUrl(event.target.value)}
                  placeholder="http://10.120.58.104/stream"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Perimeter label</span>
                <input
                  type="text"
                  value={perimeterLabel}
                  onChange={(event) => setPerimeterLabel(event.target.value)}
                  placeholder="North boundary"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Saving these settings stores them locally so the dashboard can pick them up without a rebuild.
              </div>
            </div>
          </motion.article>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-95"
          >
            <Save className="h-4 w-4" />
            Save settings
          </button>

          <AnimatePresence>
            {saved ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4" />
                Settings saved
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
