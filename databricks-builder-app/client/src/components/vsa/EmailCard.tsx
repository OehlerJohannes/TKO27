import type { VsaEmail } from '@/lib/types';
import { cn } from '@/lib/utils';

interface EmailCardProps {
  email: VsaEmail;
  className?: string;
  compact?: boolean;
}

export function EmailCard({ email, className, compact = false }: EmailCardProps) {
  const senderLabel = email.sender_name
    ? `${email.sender_name} <${email.sender_email}>`
    : email.sender_email;

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-0.5">From</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{senderLabel}</p>
        </div>
        {email.received_at && (
          <span className="text-xs text-[var(--color-text-muted)] shrink-0">
            {new Date(email.received_at).toLocaleDateString()}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-[var(--color-text-heading)] mb-2">{email.subject}</p>
      {!compact && (
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
          {email.body}
        </p>
      )}
      {compact && (
        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{email.body}</p>
      )}
    </div>
  );
}
