import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { RaccoglitoreNode } from '../../types/dashboard';
import { getAvailableMoveTargets } from '../../utils/tree';

type Props = {
  tree: RaccoglitoreNode[];
  nodeId: number;
  currentParentId: number | null;
  onMove: (parentId: number | null) => Promise<void> | void;
  onClose: () => void;
};

export default function MoveRaccoglitoreDialog({ tree, nodeId, currentParentId, onMove, onClose }: Props) {
  const targets = useMemo(() => getAvailableMoveTargets(tree, nodeId), [tree, nodeId]);
  const [selected, setSelected] = useState<string>(
    currentParentId === null ? 'root' : String(currentParentId),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const parentId = selected === 'root' ? null : Number(selected);
      await onMove(parentId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante lo spostamento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Sposta raccoglitore</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Seleziona la destinazione. Sono esclusi il raccoglitore stesso, i suoi discendenti e i target che supererebbero la profondità massima.
          </p>
          <div className="space-y-1">
            {targets.map((t) => {
              const value = t.id === null ? 'root' : String(t.id);
              const indent = t.id === null ? 0 : (t.depth + 1) * 12;
              return (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                  style={{ paddingLeft: 8 + indent }}
                >
                  <input
                    type="radio"
                    name="move-target"
                    value={value}
                    checked={selected === value}
                    onChange={() => setSelected(value)}
                  />
                  <span>{t.label}</span>
                </label>
              );
            })}
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="rounded border border-border px-3 py-1 text-sm hover:bg-accent">
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Sposta
          </button>
        </div>
      </div>
    </div>
  );
}
