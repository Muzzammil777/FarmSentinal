import { Activity, AlertTriangle, CheckCircle2, CircleOff } from 'lucide-react';

interface StatusBadgeProps {
  status: 'safe' | 'alert' | 'offline' | 'analyzing' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG = {
  safe: {
    icon: CheckCircle2,
    label: 'Normal',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alert',
    className: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  offline: {
    icon: CircleOff,
    label: 'Offline',
    className: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
  analyzing: {
    icon: Activity,
    label: 'Analyzing',
    className: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
} as const;

const SIZE_STYLES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
} as const;

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-medium ${config.className} ${SIZE_STYLES[size]}`}
    >
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </span>
  );
}
