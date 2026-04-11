import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Plus, ChevronDown, Star, Trash2, Pencil, Check, X } from 'lucide-react';
import type { Dashboard } from '../types/dashboard';
import { useDashboardApi } from '../hooks/useDashboardApi';

type DashboardSelectorProps = {
  activeDashboardId: number | null;
  onDashboardSelect: (id: number | null) => void;
};

export default function DashboardSelector({ activeDashboardId, onDashboardSelect }: DashboardSelectorProps) {
  const api = useDashboardApi();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getDashboards().then(setDashboards);
  }, [api]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeDashboard = dashboards.find((d) => d.id === activeDashboardId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const dashboard = await api.createDashboard(newName.trim());
    setDashboards((prev) => [...prev, dashboard]);
    setNewName('');
    setIsCreating(false);
    onDashboardSelect(dashboard.id);
    setIsOpen(false);
  };

  const handleDelete = async (id: number) => {
    await api.deleteDashboard(id);
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    if (activeDashboardId === id) onDashboardSelect(null);
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    await api.updateDashboard(id, { name: editName.trim() });
    setDashboards((prev) => prev.map((d) => (d.id === id ? { ...d, name: editName.trim() } : d)));
    setEditingId(null);
  };

  const handleSetDefault = async (id: number) => {
    await api.setDefaultDashboard(id);
    setDashboards((prev) => prev.map((d) => ({ ...d, is_default: d.id === id ? 1 : 0 })));
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors ${
          activeDashboard
            ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
            : 'border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted'
        }`}
        title="Dashboard"
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        <span className="hidden max-w-[100px] truncate sm:inline">
          {activeDashboard ? activeDashboard.name : 'Dashboard'}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card shadow-lg">
          <div className="p-1">
            {/* No dashboard option */}
            <button
              type="button"
              onClick={() => { onDashboardSelect(null); setIsOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                !activeDashboardId ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <span className="flex-1">Nessuna dashboard</span>
            </button>

            {dashboards.length > 0 && <div className="my-1 border-t border-border/50" />}

            {/* Dashboard list */}
            {dashboards.map((d) => (
              <div
                key={d.id}
                className={`group flex items-center gap-1 rounded-md px-3 py-2 transition-colors ${
                  d.id === activeDashboardId ? 'bg-accent text-foreground' : 'hover:bg-accent/50'
                }`}
              >
                {editingId === d.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(d.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button type="button" onClick={() => handleRename(d.id)} className="rounded p-0.5 hover:bg-accent">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded p-0.5 hover:bg-accent">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { onDashboardSelect(d.id); setIsOpen(false); }}
                      className="flex flex-1 items-center gap-2 text-left text-sm"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{d.name}</span>
                      {d.is_default === 1 && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleSetDefault(d.id)}
                        className="rounded p-0.5 hover:bg-accent"
                        title={d.is_default ? 'Dashboard default' : 'Imposta come default'}
                      >
                        <Star className={`h-3 w-3 ${d.is_default ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(d.id); setEditName(d.name); }}
                        className="rounded p-0.5 hover:bg-accent"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(d.id)}
                        className="rounded p-0.5 hover:bg-accent"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border/50 p-1">
            {isCreating ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
                  }}
                  placeholder="Nome dashboard..."
                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="button" onClick={handleCreate} className="rounded p-1 hover:bg-accent">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuova dashboard
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
