import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'open' | 'in_progress' | 'resolved';
  className?: string;
}

const STATUS_CONFIG = {
  open: { label: 'Open', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  in_progress: { label: 'In Progress', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolved', classes: 'bg-green-100 text-green-700 border-green-200' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}
