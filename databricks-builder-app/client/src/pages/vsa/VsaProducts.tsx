import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { VsaProduct } from '@/lib/types';
import { createVsaProduct, deleteVsaProduct, fetchVsaProducts, updateVsaProduct } from '@/lib/api';

const EMPTY: Omit<VsaProduct, 'id' | 'created_at'> = {
  name: '', description: null, ingredients: null, price: null, unit: null, stock: 100,
};

export default function VsaProducts() {
  const [products, setProducts] = useState<VsaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    fetchVsaProducts().then((p) => { setProducts(p); setLoading(false); });
  }, []);

  function startNew() {
    setForm({ ...EMPTY });
    setEditId('new');
  }

  function startEdit(p: VsaProduct) {
    setForm({ name: p.name, description: p.description, ingredients: p.ingredients, price: p.price, unit: p.unit, stock: p.stock });
    setEditId(p.id);
  }

  async function handleSave() {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      if (editId === 'new') {
        const p = await createVsaProduct(form);
        setProducts((prev) => [p, ...prev]);
        toast.success('Product created');
      } else if (editId) {
        const p = await updateVsaProduct(editId, form);
        setProducts((prev) => prev.map((x) => x.id === editId ? p : x));
        toast.success('Product updated');
      }
      setEditId(null);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVsaProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Product deleted');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TopBar />
      <main className="pt-[calc(var(--header-height)+2rem)] px-6 max-w-4xl mx-auto pb-16">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[var(--color-text-heading)]">Products</h1>
          <Button onClick={startNew} className="gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
        </div>

        {/* New/edit inline form */}
        {editId && (
          <div className="rounded-lg border border-[var(--color-accent-primary)]/40 bg-[var(--color-bg-secondary)] p-4 mb-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{editId === 'new' ? 'New Product' : 'Edit Product'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Unit (e.g. 100g bag)" value={form.unit ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value || null })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Price (€)" value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: e.target.value ? parseFloat(e.target.value) : null })} />
              <Input type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} />
            </div>
            <Input placeholder="Ingredients (comma-separated)" value={form.ingredients ?? ''} onChange={(e) => setForm({ ...form, ingredients: e.target.value || null })} />
            <textarea
              rows={2}
              placeholder="Description"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value || null })}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
              <Button size="sm" onClick={handleSave}><Check className="w-4 h-4 mr-1" /> Save</Button>
            </div>
          </div>
        )}

        {loading ? <p className="text-sm text-[var(--color-text-muted)]">Loading...</p> : (
          <div className="flex flex-col gap-2">
            {products.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[var(--color-text-heading)]">{p.name}</span>
                    {p.unit && <span className="text-xs text-[var(--color-text-muted)]">{p.unit}</span>}
                    {p.price != null && <span className="text-xs font-medium text-green-600">€{p.price}</span>}
                    <span className="text-xs text-[var(--color-text-muted)]">Stock: {p.stock}</span>
                  </div>
                  {p.description && <p className="text-xs text-[var(--color-text-muted)] line-clamp-1">{p.description}</p>}
                  {p.ingredients && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">🌿 {p.ingredients}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(p)} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
