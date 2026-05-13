import { memo, useMemo } from 'react';
import { Activity, Clock3, Radar, RefreshCw, Signal, Thermometer, TriangleAlert, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { IntrusionAlertModal } from '../components/IntrusionAlertModal';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { useSensorData } from '../hooks/useSensorData';

function formatTime(value: string | number | null | undefined) {
  if (!value) {
    return 'Just now';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Sparkline({ points }: { points: number[] }) {
  if (!points.length) {
    return <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">Waiting for live sensor readings.</div>;
  }

  const width = 640;
  const height = 180;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((point: number, index: number) => {
      const x = index * step;
      const normalized = height - ((point - min) / range) * (height - 24) - 12;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${normalized.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible rounded-2xl border border-border bg-muted/20 p-3">
      <defs>
        <linearGradient id="sensor-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgb(16 185 129)" />
          <stop offset="100%" stopColor="rgb(14 165 233)" />
        </linearGradient>
        <linearGradient id="sensor-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(16,185,129,0.24)" />
          <stop offset="100%" stopColor="rgba(14,165,233,0.02)" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#sensor-fill)" />
      <path d={path} fill="none" stroke="url(#sensor-line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DashboardHeader = memo(function DashboardHeader({
  refresh,
  isRefreshing,
  connectionStatus,
}: {
  refresh: () => void;
  isRefreshing: boolean;
  connectionStatus: 'safe' | 'alert' | 'offline';
}) {
  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
          <Radar className="h-4 w-4 text-accent" />
          ESP8266 perimeter monitoring
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Operations dashboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Monitor distance readings, device health, and alert state from the field controller in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <RefreshCw className={`h-4 w-4 transition-transform duration-300 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </button>
        <StatusBadge status={connectionStatus} />
      </div>
    </section>
  );
});

const LiveSensorSection = memo(function LiveSensorSection({
  sensorData,
  history,
  activeAlert,
  isAlertOpen,
  error,
  isDeviceOffline,
  refresh,
  acknowledgeAlert,
  closeAlert,
}: {
  sensorData: any;
  history: Array<{ value: number; timestamp: string }>;
  activeAlert: any;
  isAlertOpen: boolean;
  error: string;
  isDeviceOffline: boolean;
  refresh: () => void;
  acknowledgeAlert: () => void | Promise<void>;
  closeAlert: () => void;
}) {
  const trendPoints = useMemo(() => history.map((item) => item.value), [history]);
  const recentEvents = sensorData?.recentEvents?.length
    ? sensorData.recentEvents
    : [
        { id: 'event-1', label: 'Waiting for telemetry from the sensor node.', timestamp: new Date().toISOString(), severity: 'info' },
      ];

  const connectionStatus = isDeviceOffline ? 'offline' : sensorData?.connected ? 'safe' : 'offline';
  const latestReading = sensorData?.distanceCm;
  const distanceLabel =
    error && !sensorData ? 'No Data' : latestReading === null || latestReading === undefined ? 'No Signal' : `${latestReading} cm`;
  const sensorSummary = isDeviceOffline ? 'Device Offline' : sensorData?.note ?? 'Live device telemetry';

  return (
    <>
      <IntrusionAlertModal open={isAlertOpen} reading={activeAlert} onAcknowledge={acknowledgeAlert} onClose={closeAlert} />

      {error ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm transition-colors duration-300 ${
            isDeviceOffline ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200' : 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200'
          }`}
        >
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Distance"
          value={distanceLabel}
          subtitle="Latest ultrasonic reading"
          icon={TriangleAlert}
          status={sensorData?.alert ? 'alert' : isDeviceOffline ? 'alert' : latestReading !== null && latestReading < 150 ? 'warning' : 'normal'}
          trend={sensorData?.alert ? 'Trigger' : isDeviceOffline ? 'Offline' : 'Live'}
        />
        <MetricCard
          title="Connection"
          value={isDeviceOffline ? 'Device Offline' : sensorData?.connected ? 'Online' : 'Offline'}
          subtitle={sensorData?.deviceName ?? 'Perimeter node'}
          icon={Activity}
          status={connectionStatus === 'offline' ? 'alert' : 'normal'}
          trend={sensorData?.lastUpdated ? formatTime(sensorData.lastUpdated) : '—'}
        />
        <MetricCard
          title="Battery"
          value={isDeviceOffline ? '—' : `${sensorData?.batteryPercent ?? 0}%`}
          subtitle="Estimated remaining charge"
          icon={Zap}
          status={isDeviceOffline ? 'alert' : (sensorData?.batteryPercent ?? 0) < 25 ? 'warning' : 'info'}
          trend={isDeviceOffline ? 'No link' : 'Power'}
        />
        <MetricCard
          title="Signal"
          value={isDeviceOffline ? 'No Signal' : `${sensorData?.signalStrength ?? 0} dBm`}
          subtitle="Wireless strength"
          icon={Signal}
          status="info"
          trend={isDeviceOffline ? 'Offline' : sensorData?.temperatureC ? `${sensorData.temperatureC}°C` : 'Stable'}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.26em] text-muted-foreground">Live telemetry</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Reading trend</h2>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last updated</p>
              <p className="mt-1 text-sm font-medium text-foreground">{sensorData?.lastUpdated ? formatTime(sensorData.lastUpdated) : '—'}</p>
            </div>
          </div>

          <div className="mt-5">
            <Sparkline points={trendPoints} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/35 p-4 transition-colors duration-300">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
              <p className="mt-2 text-sm font-medium text-foreground">{sensorData?.location ?? 'North boundary'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/35 p-4 transition-colors duration-300">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Uptime</p>
              <p className="mt-2 text-sm font-medium text-foreground">{sensorData?.uptimeHours ? `${sensorData.uptimeHours} h` : '—'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/35 p-4 transition-colors duration-300">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Temperature</p>
              <p className="mt-2 text-sm font-medium text-foreground">{sensorData?.temperatureC ? `${sensorData.temperatureC}°C` : '—'}</p>
            </div>
          </div>
        </motion.article>

        <div className="space-y-6">
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.26em] text-muted-foreground">Device status</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Edge controller</h2>
              </div>
              <StatusBadge status={connectionStatus} />
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-border bg-muted/35 p-4 transition-colors duration-300">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Node</p>
                <p className="mt-2 text-sm font-medium text-foreground">{sensorData?.deviceName ?? 'Perimeter Node 01'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/35 p-4 transition-colors duration-300">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alert threshold</p>
                <p className="mt-2 text-sm font-medium text-foreground">100 cm default</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/35 p-4 transition-colors duration-300">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connection note</p>
                <p className="mt-2 text-sm font-medium text-foreground">{sensorSummary}</p>
              </div>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.26em] text-muted-foreground">Recent events</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Telemetry log</h2>
              </div>
              <Clock3 className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="mt-5 space-y-3">
              {recentEvents.map((event: { id: string; label: string; timestamp: string; severity: string }) => (
                <div key={event.id} className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 transition-colors duration-300">
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      event.severity === 'alert' ? 'bg-rose-500' : event.severity === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTime(event.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.article>
        </div>
      </section>
    </>
  );
});

export function Dashboard() {
  const {
    sensorData: rawSensorData,
    history,
    activeAlert,
    isAlertOpen,
    isRefreshing,
    error,
    isDeviceOffline,
    refresh,
    acknowledgeAlert,
    closeAlert,
  } = useSensorData();

  const sensorData = rawSensorData as {
    connected: boolean;
    alert: boolean;
    distanceCm: number | null;
    deviceName: string;
    location: string;
    batteryPercent: number;
    signalStrength: number;
    uptimeHours: number;
    temperatureC: number;
    lastUpdated: string;
    recentEvents: Array<{ id: string; label: string; timestamp: string; severity: string }>;
    status: string;
    alertKey: string;
    note: string;
  } | null;

  const connectionStatus = isDeviceOffline ? 'offline' : sensorData?.connected ? 'safe' : 'offline';
  const alertStatus = sensorData?.alert ? 'alert' : isDeviceOffline ? 'offline' : 'safe';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <DashboardHeader
          refresh={refresh}
          isRefreshing={isRefreshing}
          connectionStatus={connectionStatus}
        />

        <LiveSensorSection
          sensorData={sensorData}
          history={history}
          activeAlert={activeAlert}
          isAlertOpen={isAlertOpen}
          error={error}
          isDeviceOffline={isDeviceOffline}
          refresh={refresh}
          acknowledgeAlert={acknowledgeAlert}
          closeAlert={closeAlert}
        />
      </div>
    </div>
  );

}
