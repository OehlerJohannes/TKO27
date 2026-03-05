import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { NewEmailModal } from '@/components/vsa/NewEmailModal';
import type { VsaEmail, VsaEmailTemplate } from '@/lib/types';
import { classifyVsaEmail, deleteVsaEmail, fetchVsaEmails, fetchVsaTemplates } from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  classified: 'bg-green-100 text-green-700',
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  order: 'bg-purple-100 text-purple-700',
  customer_issue: 'bg-red-100 text-red-700',
  general_question: 'bg-sky-100 text-sky-700',
};

export default function VsaInbox() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<VsaEmail[]>([]);
  const [templates, setTemplates] = useState<VsaEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    const [e, t] = await Promise.all([fetchVsaEmails(), fetchVsaTemplates()]);
    setEmails(e);
    setTemplates(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClassify(emailId: string) {
    setClassifying(emailId);
    try {
      const task = await classifyVsaEmail(emailId);
      toast.success('Email classified — task created');
      navigate(`/vsa/tasks/${task.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setClassifying(null);
    }
  }

  async function handleDelete(emailId: string) {
    try {
      await deleteVsaEmail(emailId);
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      toast.success('Email deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TopBar />
      <main className="pt-[calc(var(--header-height)+2rem)] px-6 max-w-4xl mx-auto pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-heading)]">Email Inbox</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{emails.length} emails</p>
          </div>
          <Button onClick={() => setShowModal(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Email
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>
        ) : emails.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-text-muted)]">
            <p className="text-sm">No emails yet. Add one or pick a template.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {emails.map((email) => (
              <div
                key={email.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[email.status] ?? 'bg-gray-100 text-gray-600')}>
                        {email.status}
                      </span>
                      {email.classification && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CLASSIFICATION_COLORS[email.classification] ?? 'bg-gray-100')}>
                          {email.classification}
                        </span>
                      )}
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {email.received_at ? new Date(email.received_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-heading)] mb-0.5">{email.subject}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {email.sender_name ? `${email.sender_name} <${email.sender_email}>` : email.sender_email}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 line-clamp-2">{email.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {email.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleClassify(email.id)}
                        disabled={classifying === email.id}
                        className="gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        {classifying === email.id ? 'Classifying...' : 'Classify'}
                      </Button>
                    )}
                    <button
                      onClick={() => handleDelete(email.id)}
                      className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewEmailModal
          templates={templates}
          onCreated={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
