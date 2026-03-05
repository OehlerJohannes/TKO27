import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { VsaEmailTemplate } from '@/lib/types';
import { createVsaTemplate, deleteVsaTemplate, fetchVsaTemplates, updateVsaTemplate } from '@/lib/api';
import { cn } from '@/lib/utils';

const EMPTY: Omit<VsaEmailTemplate, 'id' | 'created_at'> = {
  subject: '', body: '', hint_category: null, description: null,
};

const CATEGORY_COLORS: Record<string, string> = {
  order: 'bg-purple-100 text-purple-700',
  customer_issue: 'bg-red-100 text-red-700',
  general_question: 'bg-sky-100 text-sky-700',
};

const CATEGORIES = ['order', 'customer_issue', 'general_question'];

export default function VsaTemplates() {
  const [templates, setTemplates] = useState<VsaEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchVsaTemplates().then((t) => { setTemplates(t); setLoading(false); });
  }, []);

  function startNew() { setForm({ ...EMPTY }); setEditId('new'); }
  function startEdit(t: VsaEmailTemplate) {
    setForm({ subject: t.subject, body: t.body, hint_category: t.hint_category, description: t.description });
    setEditId(t.id);
  }

  async function handleSave() {
    if (!form.subject || !form.body) { toast.error('Subject and body are required'); return; }
    try {
      if (editId === 'new') {
        const t = await createVsaTemplate(form);
        setTemplates((prev) => [t, ...prev]);
        toast.success('Template created');
      } else if (editId) {
        const t = await updateVsaTemplate(editId, form);
        setTemplates((prev) => prev.map((x) => x.id === editId ? t : x));
        toast.success('Template updated');
      }
      setEditId(null);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVsaTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('Template deleted');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TopBar />
      <main className="pt-[calc(var(--header-height)+2rem)] px-6 max-w-4xl mx-auto pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-heading)]">Email Templates</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Use these to test email classification</p>
          </div>
          <Button onClick={startNew} className="gap-2"><Plus className="w-4 h-4" /> Add Template</Button>
        </div>

        {editId && (
          <div className="rounded-lg border border-[var(--color-accent-primary)]/40 bg-[var(--color-bg-secondary)] p-4 mb-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{editId === 'new' ? 'New Template' : 'Edit Template'}</h3>
            <Input placeholder="Subject *" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Category hint</label>
                <select
                  value={form.hint_category ?? ''}
                  onChange={(e) => setForm({ ...form, hint_category: e.target.value || null })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">-- none --</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Input placeholder="Description" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value || null })} />
            </div>
            <textarea
              rows={8}
              placeholder="Email body *"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30 resize-y"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
              <Button size="sm" onClick={handleSave}><Check className="w-4 h-4 mr-1" /> Save</Button>
            </div>
          </div>
        )}

        {loading ? <p className="text-sm text-[var(--color-text-muted)]">Loading...</p> : (
          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {t.hint_category && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[t.hint_category] ?? 'bg-gray-100 text-gray-600')}>
                          {t.hint_category}
                        </span>
                      )}
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{t.subject}</span>
                    </div>
                    {t.description && <p className="text-xs text-[var(--color-text-muted)]">{t.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(t); }} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {expanded === t.id && (
                  <div className="px-4 pb-4 border-t border-[var(--color-border)]">
                    <pre className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap mt-3 font-sans leading-relaxed">{t.body}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
