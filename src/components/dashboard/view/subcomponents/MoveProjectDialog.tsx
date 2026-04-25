import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { RaccoglitoreNode } from '../../types/dashboard';

type Props = {
  projectDisplayName: string;
  tree: RaccoglitoreNode[];
  currentRaccoglitoreId: number;
  onMove: (targetRaccoglitoreId: number) => Promise<void> | void;
  onClose: () => void;
};

type TreeOption = {
  id: number;
  label: string;
  depth: number;
};

function flattenOptions(roots: RaccoglitoreNode[]): TreeOption[] {
  const out: TreeOption[] = [];
  const walk = (nodes: RaccoglitoreNode[], prefix: string) => {
    for (const n of nodes) {
      const label = prefix ? `${prefix} / ${n.name}` : n.name;
      out.push({ id: n.id, label, depth: n.depth });
      walk(n.children, label);
    }
  };
  walk(roots, '');
  return out;
}

export default function MoveProjectDialog({ projectDisplayName, tree, currentRaccoglitoreId, onMove, onClose }: Props) {
  const options = useMemo(() => flattenOptions(tree), [tree]);
  const [selected, setSelected] = useState<number>(currentRaccoglitoreId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (selected === currentRaccoglitoreId) {
      onClose();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onMove(selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante lo spostamento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Sposta progetto</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Seleziona il raccoglitore di destinazione per <strong>{projectDisplayName}</strong>.
          </p>
          <div className="space-y-1">
            {options.map((opt) => {
              const isCurrent = opt.id === currentRaccoglitoreId;
              const indent = (opt.depth) * 12;
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent ${
                    isCurrent ? 'text-muted-foreground' : ''
                  }`}
                  style={{ paddingLeft: 8 + indent }}
                >
                  <input
                    type="radio"
                    name="project-move-target"
                    checked={selected === opt.id}
                    onChange={() => setSelected(opt.id)}
                  />
                  <span className="truncate">
                    {opt.label}
                    {isCurrent && <span className="ml-2 text-[10px] uppercase">attuale</span>}
                  </span>
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
            disabled={submitting || selected === currentRaccoglitoreId}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Sposta
          </button>
        </div>
      </div>
    </div>
  );
}
