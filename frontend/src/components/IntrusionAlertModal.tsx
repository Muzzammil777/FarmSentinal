import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Loader2, MapPin, ShieldCheck, X } from 'lucide-react';

interface IntrusionAlertModalProps {
  open: boolean;
  reading?: {
    distanceCm?: number;
    location?: string;
    deviceName?: string;
    capturedAt?: string;
  } | null;
  isResetting?: boolean;
  onAcknowledge: () => void | Promise<void>;
  onClose: () => void;
}

export function IntrusionAlertModal({
  open,
  reading,
  isResetting = false,
  onAcknowledge,
  onClose,
}: IntrusionAlertModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-xl -translate-y-1/2"
          >
            <div className="overflow-hidden rounded-3xl border border-rose-500/20 bg-card shadow-2xl shadow-rose-950/20">
              <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-5 text-white sm:px-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_35%)]" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                      <AlertTriangle className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-100/90">Intrusion detected</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Perimeter breach reported</h2>
                      <p className="mt-2 max-w-md text-sm text-rose-50/90">
                        {reading?.distanceCm != null
                          ? `Object detected at ${reading.distanceCm} cm — within the 45 cm threshold. Acknowledge to reset the ESP8266.`
                          : 'The sensor threshold was crossed. Acknowledge the event to send a reset command to the ESP8266.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-white/15 bg-white/10 p-2 transition hover:bg-white/20"
                    aria-label="Close alert dialog"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:px-6">
                <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">Detected at</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-amber-700 dark:text-amber-300">
                    {reading?.distanceCm != null ? `${reading.distanceCm} cm` : '—'}
                  </p>
                  <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">Threshold: ≤ 45 cm</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
                  <p className="mt-2 text-base font-medium text-foreground">{reading?.location ?? 'Perimeter zone'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{reading?.deviceName ?? 'Field controller'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Captured at</p>
                  <p className="mt-2 text-base font-medium text-foreground">{reading?.capturedAt ?? 'Just now'}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border px-5 py-5 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Keep open
                </button>
                <button
                  type="button"
                  onClick={onAcknowledge}
                  disabled={isResetting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {isResetting ? 'Resetting...' : 'Acknowledge and reset'}
                </button>
              </div>
            </div>
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}
