import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface DraftEditorProps {
  value: string;
  onChange: (v: string) => void;
  onRegenerate?: () => Promise<void>;
  onSave?: () => Promise<void>;
  saving?: boolean;
  className?: string;
  label?: string;
}

export function DraftEditor({
  value,
  onChange,
  onRegenerate,
  onSave,
  saving,
  className,
  label = 'Draft Reply',
}: DraftEditorProps) {
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-[var(--color-text-heading)]">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">{value.length} chars</span>
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="h-7 gap-1 text-xs"
            >
              <RefreshCw className={cn('w-3 h-3', regenerating && 'animate-spin')} />
              Regenerate
            </Button>
          )}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 text-sm text-[var(--color-text-primary)] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30"
        placeholder="Draft reply will appear here..."
      />
      {onSave && (
        <div className="flex justify-end">
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
        </div>
      )}
    </div>
  );
}
