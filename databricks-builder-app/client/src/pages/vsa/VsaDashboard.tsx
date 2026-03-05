import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { InboxIcon, ListTodo, Package, Users, FileText, ArrowRight } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { fetchVsaTaskStats, fetchVsaTasks } from '@/lib/api';
import type { VsaTask, VsaTaskStats } from '@/lib/types';
import { TaskCard } from '@/components/vsa/TaskCard';

export default function VsaDashboard() {
  const [stats, setStats] = useState<VsaTaskStats | null>(null);
  const [recent, setRecent] = useState<VsaTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchVsaTaskStats(), fetchVsaTasks({ status: 'open' })]).then(([s, tasks]) => {
      setStats(s);
      setRecent(tasks.slice(0, 5));
      setLoading(false);
    });
  }, []);

  const navLinks = [
    { to: '/vsa/emails', icon: InboxIcon, label: 'Email Inbox', desc: 'View & classify incoming emails' },
    { to: '/vsa/tasks', icon: ListTodo, label: 'Task Queue', desc: 'Manage open tasks and drafts' },
    { to: '/vsa/products', icon: Package, label: 'Products', desc: 'Manage spice mix catalog' },
    { to: '/vsa/customers', icon: Users, label: 'Customers', desc: 'Customer directory' },
    { to: '/vsa/templates', icon: FileText, label: 'Email Templates', desc: 'Test email templates' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TopBar />
      <main className="pt-[calc(var(--header-height)+2rem)] px-6 max-w-5xl mx-auto pb-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-heading)] mb-1">
            Virtual Service Assistant
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Classify customer emails and manage service tasks with AI-drafted replies.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Open', value: stats.by_status.open, color: 'text-blue-600' },
              { label: 'In Progress', value: stats.by_status.in_progress, color: 'text-amber-600' },
              { label: 'Resolved', value: stats.by_status.resolved, color: 'text-green-600' },
              { label: 'Total', value: stats.total, color: 'text-[var(--color-text-heading)]' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Type breakdown */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'New Orders', value: stats.by_type.new_order, color: 'bg-purple-50 border-purple-200 text-purple-700' },
              { label: 'Customer Issues', value: stats.by_type.customer_issue, color: 'bg-red-50 border-red-200 text-red-700' },
              { label: 'General Inquiries', value: stats.by_type.general_inquiry, color: 'bg-sky-50 border-sky-200 text-sky-700' },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg border p-4 ${s.color}`}>
                <p className="text-xs font-medium mb-1 opacity-70">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Navigation cards */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Navigation
            </h2>
            <div className="flex flex-col gap-2">
              {navLinks.map(({ to, icon: Icon, label, desc }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/40 hover:bg-[var(--color-bg-secondary)] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-tertiary)] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent-primary)] transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Recent open tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Open Tasks
              </h2>
              <Link to="/vsa/tasks" className="text-xs text-[var(--color-accent-primary)] hover:underline">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="text-sm text-[var(--color-text-muted)]">Loading...</div>
            ) : recent.length === 0 ? (
              <div className="text-sm text-[var(--color-text-muted)]">No open tasks — great job!</div>
            ) : (
              <div className="flex flex-col gap-2">
                {recent.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
