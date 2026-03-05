import { cn } from '@/lib/utils';

interface TypeBadgeProps {
  type: 'new_order' | 'customer_issue' | 'general_inquiry';
  className?: string;
}

const TYPE_CONFIG = {
  new_order: { label: 'New Order', classes: 'bg-purple-100 text-purple-700 border-purple-200', icon: '🛒' },
  customer_issue: { label: 'Customer Issue', classes: 'bg-red-100 text-red-700 border-red-200', icon: '⚠️' },
  general_inquiry: { label: 'General Inquiry', classes: 'bg-sky-100 text-sky-700 border-sky-200', icon: '💬' },
};

export function TypeBadge({ type, className }: TypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.general_inquiry;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        config.classes,
        className
      )}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}
