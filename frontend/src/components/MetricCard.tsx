import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: string;
  status?: 'normal' | 'warning' | 'alert' | 'info';
}

const STATUS_STYLES = {
  normal: 'border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 via-card to-card',
  warning: 'border-amber-500/15 bg-gradient-to-br from-amber-500/10 via-card to-card',
  alert: 'border-rose-500/15 bg-gradient-to-br from-rose-500/10 via-card to-card',
  info: 'border-sky-500/15 bg-gradient-to-br from-sky-500/10 via-card to-card',
} as const;

const ICON_STYLES = {
  normal: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  alert: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
} as const;

export function MetricCard({ title, value, icon: Icon, subtitle, trend, status = 'normal' }: MetricCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur-sm ${STATUS_STYLES[status]}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.45),transparent_42%)]" />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${ICON_STYLES[status]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend ? (
            <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {trend}
            </span>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
    </motion.article>
  );
}
