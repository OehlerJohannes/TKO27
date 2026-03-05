import { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { TaskCard } from '@/components/vsa/TaskCard';
import type { VsaTask } from '@/lib/types';
import { fetchVsaTasks } from '@/lib/api';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved';
type TypeFilter = 'all' | 'new_order' | 'customer_issue' | 'general_inquiry';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'new_order', label: 'Orders' },
  { value: 'customer_issue', label: 'Issues' },
  { value: 'general_inquiry', label: 'Inquiries' },
];

export default function VsaTaskList() {
  const [tasks, setTasks] = useState<VsaTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchVsaTasks({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      task_type: typeFilter !== 'all' ? typeFilter : undefined,
    }).then((t) => { setTasks(t); setLoading(false); });
  }, [statusFilter, typeFilter]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TopBar />
      <main className="pt-[calc(var(--header-height)+2rem)] px-6 max-w-4xl mx-auto pb-16">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--color-text-heading)]">Task Queue</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{tasks.length} tasks</p>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 border-b border-[var(--color-border)] mb-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                statusFilter === tab.value
                  ? 'border-[var(--color-accent-primary)] text-[var(--color-text-heading)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                'px-3 py-1 text-xs rounded-full border font-medium transition-colors',
                typeFilter === f.value
                  ? 'bg-[var(--color-accent-primary)] text-white border-[var(--color-accent-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent-primary)]/50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-text-muted)]">
            <p className="text-sm">No tasks found for the selected filters.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
          </div>
        )}
      </main>
    </div>
  );
}
