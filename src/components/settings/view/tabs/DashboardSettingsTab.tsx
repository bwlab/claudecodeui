import { useState, useEffect } from 'react';
import { LayoutDashboard, Star, Trash2, Pencil, Plus, Check, X } from 'lucide-react';
import type { Dashboard } from '../../../dashboard/types/dashboard';
import { useDashboardApi } from '../../../dashboard/hooks/useDashboardApi';

export default function DashboardSettingsTab() {
  const api = useDashboardApi();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    api.getDashboards().then((list) => {
      setDashboards(list);
      setLoading(false);
    });
  }, [api]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const d = await api.createDashboard(newName.trim());
    setDashboards((prev) => [...prev, d]);
    setNewName('');
    setIsCreating(false);
  };

  const handleDelete = async (id: number) => {
    await api.deleteDashboard(id);
    setDashboards((prev) => prev.filter((d) => d.id !== id));
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    await api.updateDashboard(id, { name: editName.trim() });
    setDashboards((prev) => prev.map((d) => d.id === id ? { ...d, name: editName.trim() } : d));
    setEditingId(null);
  };

  const handleSetDefault = async (id: number) => {
    const isAlreadyDefault = dashboards.find((d) => d.id === id)?.is_default === 1;
    if (isAlreadyDefault) {
      // Unset default
      await api.setDefaultDashboard(0);
      setDashboards((prev) => prev.map((d) => ({ ...d, is_default: 0 })));
    } else {
      await api.setDefaultDashboard(id);
      setDashboards((prev) => prev.map((d) => ({ ...d, is_default: d.id === id ? 1 : 0 })));
    }
  };

  const defaultDashboard = dashboards.find((d) => d.is_default === 1);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Caricamento...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Default dashboard info */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Dashboard predefinita</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          La dashboard predefinita si apre automaticamente all&apos;avvio di CloudCLI.
        </p>
        <div className="rounded-lg border border-border bg-card p-4">
          {defaultDashboard ? (
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{defaultDashboard.name}</p>
                <p className="text-xs text-muted-foreground">Si apre all&apos;avvio</p>
              </div>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nessuna dashboard predefinita. Seleziona la stella accanto a una dashboard per impostarla.
            </p>
          )}
        </div>
      </div>

      {/* Dashboard list */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Le tue dashboard</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Gestisci le dashboard. Clicca la stella per impostare come predefinita.
        </p>

        {dashboards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <LayoutDashboard className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="mb-1 text-sm font-medium text-foreground">Nessuna dashboard</p>
            <p className="mb-4 text-xs text-muted-foreground">
              Crea la tua prima dashboard per organizzare i progetti.
            </p>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Crea dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dashboards.map((d) => (
              <div
                key={d.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                {editingId === d.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(d.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button type="button" onClick={() => handleRename(d.id)} className="rounded p-1 hover:bg-accent">
                      <Check className="h-4 w-4 text-primary" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded p-1 hover:bg-accent">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">{d.name}</span>
                    <button
                      type="button"
                      onClick={() => handleSetDefault(d.id)}
                      className="rounded p-1 transition-colors hover:bg-accent"
                      title={d.is_default ? 'Rimuovi come predefinita' : 'Imposta come predefinita'}
                    >
                      <Star className={`h-4 w-4 ${d.is_default ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(d.id); setEditName(d.name); }}
                      className="rounded p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      className="rounded p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create new */}
        {!isCreating && dashboards.length > 0 && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/20"
          >
            <Plus className="h-4 w-4" />
            Nuova dashboard
          </button>
        )}

        {isCreating && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
              }}
              placeholder="Nome della dashboard..."
              className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <button type="button" onClick={handleCreate} className="rounded p-1.5 hover:bg-accent">
              <Check className="h-4 w-4 text-primary" />
            </button>
            <button type="button" onClick={() => { setIsCreating(false); setNewName(''); }} className="rounded p-1.5 hover:bg-accent">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
