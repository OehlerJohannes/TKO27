import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import type { VsaEmailTemplate } from '@/lib/types';
import { createVsaEmail, createVsaEmailFromTemplate } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface NewEmailModalProps {
  templates: VsaEmailTemplate[];
  onCreated: () => void;
  onClose: () => void;
}

type Tab = 'write' | 'template';

const CATEGORY_COLORS: Record<string, string> = {
  order: 'bg-purple-100 text-purple-700',
  customer_issue: 'bg-red-100 text-red-700',
  general_question: 'bg-sky-100 text-sky-700',
};

export function NewEmailModal({ templates, onCreated, onClose }: NewEmailModalProps) {
  const [tab, setTab] = useState<Tab>('write');
  const [loading, setLoading] = useState(false);

  // Write tab state
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  async function handleWrite() {
    if (!senderEmail || !subject || !body) {
      toast.error('Please fill in sender email, subject and body');
      return;
    }
    setLoading(true);
    try {
      await createVsaEmail({ sender_name: senderName || null, sender_email: senderEmail, subject, body });
      toast.success('Email added to inbox');
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFromTemplate(templateId: string) {
    setLoading(true);
    try {
      await createVsaEmailFromTemplate(templateId);
      toast.success('Email created from template');
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[var(--color-bg-elevated)] rounded-xl shadow-2xl border border-[var(--color-border)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text-heading)]">New Email</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)] px-5">
          {(['write', 'template'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-[var(--color-accent-primary)] text-[var(--color-text-heading)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {t === 'write' ? 'Write Email' : 'From Template'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'write' ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-muted)] mb-1 block">Sender name</label>
                  <Input placeholder="e.g. John Smith" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-muted)] mb-1 block">Sender email *</label>
                  <Input placeholder="john@example.com" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)] mb-1 block">Subject *</label>
                <Input placeholder="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)] mb-1 block">Body *</label>
                <textarea
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email body..."
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30 resize-y"
                />
              </div>
              <Button onClick={handleWrite} disabled={loading} className="self-end">
                {loading ? 'Adding...' : 'Add to Inbox'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {templates.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">No templates found. Create some in the Templates section.</p>
              )}
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {t.hint_category && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[t.hint_category] ?? 'bg-gray-100 text-gray-600')}>
                          {t.hint_category}
                        </span>
                      )}
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{t.subject}</span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-[var(--color-text-muted)]">{t.description}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => handleFromTemplate(t.id)}>
                    Use
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
