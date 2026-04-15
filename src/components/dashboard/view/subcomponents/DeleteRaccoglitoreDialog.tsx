import { useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  name: string;
  hasChildren: boolean;
  onConfirm: (options: { reparent: boolean }) => Promise<void> | void;
  onClose: () => void;
};

export default function DeleteRaccoglitoreDialog({ name, hasChildren, onConfirm, onClose }: Props) {
  const [mode, setMode] = useState<'cascade' | 'reparent'>(hasChildren ? 'reparent' : 'cascade');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm({ reparent: mode === 'reparent' });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Elimina raccoglitore</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-foreground">
            Eliminare <strong>{name}</strong>?
          </p>
          {hasChildren && (
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-2 rounded p-2 text-sm hover:bg-accent">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={mode === 'reparent'}
                  onChange={() => setMode('reparent')}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Sposta le sottocartelle al livello superiore</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Elimina solo questo raccoglitore. I figli diventano fratelli (o nuovi root se eri al primo livello).
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded p-2 text-sm hover:bg-accent">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={mode === 'cascade'}
                  onChange={() => setMode('cascade')}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-destructive">Elimina tutto (raccoglitore e sottocartelle)</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Azione irreversibile. Gli assegnamenti progetti vengono rimossi.
                  </span>
                </span>
              </label>
            </div>
          )}
          {!hasChildren && (
            <p className="mt-2 text-xs text-muted-foreground">
              Verranno rimossi gli assegnamenti progetti a questo raccoglitore.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="rounded border border-border px-3 py-1 text-sm hover:bg-accent">
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="rounded bg-destructive px-3 py-1 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
}
