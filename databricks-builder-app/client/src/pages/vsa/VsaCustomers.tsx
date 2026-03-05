import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { VsaCustomer } from '@/lib/types';
import { createVsaCustomer, deleteVsaCustomer, fetchVsaCustomers, updateVsaCustomer } from '@/lib/api';

const EMPTY: Omit<VsaCustomer, 'id' | 'created_at'> = {
  name: '', email: '', phone: null, address: null, company: null,
};

export default function VsaCustomers() {
  const [customers, setCustomers] = useState<VsaCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    fetchVsaCustomers().then((c) => { setCustomers(c); setLoading(false); });
  }, []);

  function startNew() { setForm({ ...EMPTY }); setEditId('new'); }
  function startEdit(c: VsaCustomer) {
    setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address, company: c.company });
    setEditId(c.id);
  }

  async function handleSave() {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return; }
    try {
      if (editId === 'new') {
        const c = await createVsaCustomer(form);
        setCustomers((prev) => [c, ...prev]);
        toast.success('Customer created');
      } else if (editId) {
        const c = await updateVsaCustomer(editId, form);
        setCustomers((prev) => prev.map((x) => x.id === editId ? c : x));
        toast.success('Customer updated');
      }
      setEditId(null);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVsaCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      toast.success('Customer deleted');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TopBar />
      <main className="pt-[calc(var(--header-height)+2rem)] px-6 max-w-4xl mx-auto pb-16">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[var(--color-text-heading)]">Customers</h1>
          <Button onClick={startNew} className="gap-2"><Plus className="w-4 h-4" /> Add Customer</Button>
        </div>

        {editId && (
          <div className="rounded-lg border border-[var(--color-accent-primary)]/40 bg-[var(--color-bg-secondary)] p-4 mb-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{editId === 'new' ? 'New Customer' : 'Edit Customer'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} />
              <Input placeholder="Company" value={form.company ?? ''} onChange={(e) => setForm({ ...form, company: e.target.value || null })} />
            </div>
            <Input placeholder="Address" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value || null })} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
              <Button size="sm" onClick={handleSave}><Check className="w-4 h-4 mr-1" /> Save</Button>
            </div>
          </div>
        )}

        {loading ? <p className="text-sm text-[var(--color-text-muted)]">Loading...</p> : (
          <div className="flex flex-col gap-2">
            {customers.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[var(--color-text-heading)]">{c.name}</span>
                    {c.company && <span className="text-xs text-[var(--color-text-muted)]">{c.company}</span>}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">{c.email}</p>
                  {c.phone && <p className="text-xs text-[var(--color-text-muted)]">{c.phone}</p>}
                  {c.address ? (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{c.address}</p>
                  ) : (
                    <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">No address</span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(c)} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
