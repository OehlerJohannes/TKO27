import { Link } from 'react-router-dom';
import type { VsaTask } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { TypeBadge } from './TypeBadge';

interface TaskCardProps {
  task: VsaTask;
}

export function TaskCard({ task }: TaskCardProps) {
  const email = task.email;
  const subject = email?.subject ?? '(no subject)';
  const sender = email?.sender_name ?? email?.sender_email ?? 'Unknown';

  return (
    <Link
      to={`/vsa/tasks/${task.id}`}
      className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 hover:border-[var(--color-accent-primary)]/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={task.task_type} />
          <StatusBadge status={task.status} />
        </div>
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">
          {task.created_at ? new Date(task.created_at).toLocaleDateString() : ''}
        </span>
      </div>
      <p className="text-sm font-semibold text-[var(--color-text-heading)] mb-1 line-clamp-1">
        {subject}
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">From: {sender}</p>
      {task.problem_summary && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1">
          {task.problem_summary}
        </p>
      )}
    </Link>
  );
}
