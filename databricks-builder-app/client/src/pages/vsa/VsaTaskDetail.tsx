import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/vsa/StatusBadge';
import { TypeBadge } from '@/components/vsa/TypeBadge';
import { EmailCard } from '@/components/vsa/EmailCard';
import { DraftEditor } from '@/components/vsa/DraftEditor';
import type { VsaOrder, VsaTask } from '@/lib/types';
import { createVsaOrder, fetchVsaTask, regenerateVsaReply, updateVsaOrderStatus, updateVsaTask } from '@/lib/api';
import { cn } from '@/lib/utils';

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
const ORDER_STATUS_NEXT: Record<string, string> = {
  pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered',
};
const ORDER_STATUS_NEXT_LABEL: Record<string, string> = {
  pending: 'Confirm Order', confirmed: 'Mark Shipped', shipped: 'Mark Delivered',
};

const STATUS_CYCLE: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'open',
};

const STATUS_BUTTON_LABEL: Record<string, string> = {
  open: 'Mark In Progress',
  in_progress: 'Mark Resolved',
  resolved: 'Re-open',
};

export default function VsaTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<VsaTask | null>(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emailCollapsed, setEmailCollapsed] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchVsaTask(id).then((t) => {
      setTask(t);
      setDraft(t.draft_reply ?? '');
      setProblem(t.problem_summary ?? '');
      setSolution(t.solution_summary ?? '');
      setLoading(false);
    });
  }, [id]);

  async function handleSaveDraft() {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await updateVsaTask(task.id, {
        draft_reply: draft,
        problem_summary: problem,
        solution_summary: solution,
      });
      setTask(updated);
      toast.success('Draft saved');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange() {
    if (!task) return;
    const next = STATUS_CYCLE[task.status] ?? 'open';
    try {
      const updated = await updateVsaTask(task.id, { status: next });
      setTask(updated);
      toast.success(`Status updated to ${next}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleRegenerate() {
    if (!task) return;
    const updated = await regenerateVsaReply(task.id);
    setTask(updated);
    setDraft(updated.draft_reply ?? '');
    setProblem(updated.problem_summary ?? '');
    setSolution(updated.solution_summary ?? '');
    toast.success('Reply regenerated');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <TopBar />
        <div className="pt-[calc(var(--header-height)+4rem)] text-center text-sm text-[var(--color-text-muted)]">Loading...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <TopBar />
        <div className="pt-[calc(var(--header-height)+4rem)] text-center text-sm text-[var(--color-text-muted)]">Task not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TopBar />
      <main className="pt-[calc(var(--header-height)+1.5rem)] px-6 max-w-5xl mx-auto pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/vsa/tasks')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <TypeBadge type={task.task_type} />
            <StatusBadge status={task.status} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleStatusChange}>
              {STATUS_BUTTON_LABEL[task.status] ?? 'Update'}
            </Button>
          </div>
        </div>

        {task.task_type === 'new_order' && (
          <OrderTaskView
            task={task}
            draft={draft}
            setDraft={setDraft}
            onSaveDraft={handleSaveDraft}
            onRegenerate={handleRegenerate}
            saving={saving}
            onOrderCreated={() => fetchVsaTask(task.id).then(setTask)}
          />
        )}
        {task.task_type === 'general_inquiry' && (
          <GeneralInquiryView
            task={task}
            draft={draft}
            setDraft={setDraft}
            onSaveDraft={handleSaveDraft}
            onRegenerate={handleRegenerate}
            saving={saving}
          />
        )}
        {task.task_type === 'customer_issue' && (
          <CustomerIssueView
            task={task}
            draft={draft}
            setDraft={setDraft}
            problem={problem}
            setProblem={setProblem}
            solution={solution}
            setSolution={setSolution}
            onSaveDraft={handleSaveDraft}
            onRegenerate={handleRegenerate}
            saving={saving}
            emailCollapsed={emailCollapsed}
            setEmailCollapsed={setEmailCollapsed}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Order view
// ---------------------------------------------------------------------------
function OrderTaskView({
  task, draft, setDraft, onSaveDraft, onRegenerate, saving, onOrderCreated,
}: {
  task: VsaTask;
  draft: string;
  setDraft: (v: string) => void;
  onSaveDraft: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  saving: boolean;
  onOrderCreated: (order: VsaOrder) => void;
}) {
  const [order, setOrder] = useState<VsaOrder | null>(task.order ?? null);
  const [showForm, setShowForm] = useState(false);
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState(task.customer?.address ?? '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateOrder() {
    setSubmitting(true);
    try {
      const created = await createVsaOrder({
        task_id: task.id,
        quantity: qty,
        delivery_address: address || null,
        notes: notes || null,
      });
      setOrder(created);
      setShowForm(false);
      onOrderCreated(created);
      toast.success('Order created');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }

  async function handleAdvanceStatus() {
    if (!order) return;
    const next = ORDER_STATUS_NEXT[order.status];
    if (!next) return;
    try {
      const updated = await updateVsaOrderStatus(order.id, next);
      setOrder(updated);
      toast.success(`Order ${next}`);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="flex flex-col gap-5">
      {task.email && <EmailCard email={task.email} className="bg-[var(--color-bg-secondary)]" />}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Customer card */}
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-heading)] mb-3">Customer</h3>
          {task.customer ? (
            <dl className="flex flex-col gap-1.5 text-sm">
              <InfoRow label="Name" value={task.customer.name} />
              <InfoRow label="Email" value={task.customer.email} />
              <InfoRow label="Phone" value={task.customer.phone ?? <MissingBadge />} />
              <InfoRow label="Address" value={task.customer.address ?? <MissingBadge />} />
              {task.customer.company && <InfoRow label="Company" value={task.customer.company} />}
            </dl>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              Customer not found in database. Draft asks for their details.
            </div>
          )}
        </div>

        {/* Product card */}
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-heading)] mb-3">Product</h3>
          {task.product ? (
            <dl className="flex flex-col gap-1.5 text-sm">
              <InfoRow label="Name" value={task.product.name} />
              {task.product.price != null && <InfoRow label="Price" value={`€${task.product.price} / ${task.product.unit}`} />}
              <InfoRow label="Stock" value={String(task.product.stock)} />
              {task.product.description && (
                <div>
                  <dt className="text-xs text-[var(--color-text-muted)]">Description</dt>
                  <dd className="text-[var(--color-text-primary)] text-xs mt-0.5">{task.product.description}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No product matched from email.</p>
          )}
        </div>
      </div>

      {/* Order panel */}
      {order ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-heading)] flex items-center gap-2">
              <span>Order</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600')}>
                {order.status}
              </span>
            </h3>
            {ORDER_STATUS_NEXT[order.status] && (
              <Button size="sm" onClick={handleAdvanceStatus}>
                {ORDER_STATUS_NEXT_LABEL[order.status]}
              </Button>
            )}
          </div>
          <dl className="flex flex-col gap-1.5 text-sm">
            <InfoRow label="Qty" value={String(order.quantity)} />
            {order.unit_price != null && (
              <InfoRow label="Unit price" value={`€${order.unit_price}`} />
            )}
            {order.total_price != null && (
              <InfoRow label="Total" value={<span className="font-semibold text-green-600">€{order.total_price.toFixed(2)}</span>} />
            )}
            {order.delivery_address && <InfoRow label="Ship to" value={order.delivery_address} />}
            {order.notes && <InfoRow label="Notes" value={order.notes} />}
          </dl>
        </div>
      ) : task.customer ? (
        showForm ? (
          <div className="rounded-lg border border-[var(--color-accent-primary)]/40 bg-[var(--color-bg-secondary)] p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Create Order</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Quantity</label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              {task.product?.price != null && (
                <div className="flex items-end pb-2">
                  <span className="text-sm text-green-600 font-semibold">
                    Total: €{(task.product.price * qty).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Delivery address</label>
              <Input placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateOrder} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Order'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowForm(true)} className="self-start gap-2">
            <span>Create Order</span>
          </Button>
        )
      ) : null}

      <DraftEditor
        value={draft}
        onChange={setDraft}
        onSave={onSaveDraft}
        onRegenerate={onRegenerate}
        saving={saving}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// General Inquiry view
// ---------------------------------------------------------------------------
function GeneralInquiryView({
  task, draft, setDraft, onSaveDraft, onRegenerate, saving,
}: {
  task: VsaTask;
  draft: string;
  setDraft: (v: string) => void;
  onSaveDraft: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-[var(--color-text-heading)]">
        {task.email?.subject ?? 'General Inquiry'}
      </h2>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Original Email
          </p>
          {task.email && <EmailCard email={task.email} />}
        </div>
        <div>
          <DraftEditor
            value={draft}
            onChange={setDraft}
            onSave={onSaveDraft}
            onRegenerate={onRegenerate}
            saving={saving}
            label="Suggested Reply"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer Issue view
// ---------------------------------------------------------------------------
function CustomerIssueView({
  task, draft, setDraft, problem, setProblem, solution, setSolution,
  onSaveDraft, onRegenerate, saving, emailCollapsed, setEmailCollapsed,
}: {
  task: VsaTask;
  draft: string;
  setDraft: (v: string) => void;
  problem: string;
  setProblem: (v: string) => void;
  solution: string;
  setSolution: (v: string) => void;
  onSaveDraft: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  saving: boolean;
  emailCollapsed: boolean;
  setEmailCollapsed: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Collapsible original email */}
      {task.email && (
        <div>
          <button
            onClick={() => setEmailCollapsed(!emailCollapsed)}
            className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] mb-2 hover:text-[var(--color-text-primary)]"
          >
            {emailCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            Original Email
          </button>
          {!emailCollapsed && <EmailCard email={task.email} />}
        </div>
      )}

      {/* Problem + Solution cards */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-2">Problem</h3>
          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            rows={4}
            className="w-full bg-white/70 rounded border border-red-200 text-sm p-2 focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
          />
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-sm font-semibold text-green-700 mb-2">Proposed Solution</h3>
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            rows={4}
            className="w-full bg-white/70 rounded border border-green-200 text-sm p-2 focus:outline-none focus:ring-1 focus:ring-green-300 resize-none"
          />
        </div>
      </div>

      <DraftEditor
        value={draft}
        onChange={setDraft}
        onSave={onSaveDraft}
        onRegenerate={onRegenerate}
        saving={saving}
        label="Draft Reply"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-xs text-[var(--color-text-muted)] w-16 shrink-0 pt-0.5">{label}</dt>
      <dd className="text-[var(--color-text-primary)] text-xs">{value}</dd>
    </div>
  );
}

function MissingBadge() {
  return <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded text-xs">Missing</span>;
}
