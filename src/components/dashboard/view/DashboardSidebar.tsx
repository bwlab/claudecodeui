import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Star, Check, X, ChevronDown, Folder, FileCode } from 'lucide-react';
import type { Dashboard, RaccoglitoreNode, DashboardProjectAssignment, Raccoglitore } from '../types/dashboard';
import { useDashboardApi } from '../hooks/useDashboardApi';
import { buildTree } from '../utils/tree';
import type { Project } from '../../../types/app';

const DASHBOARD_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6',
];

function colorFor(id: number): string {
  return DASHBOARD_COLORS[id % DASHBOARD_COLORS.length];
}

type DashboardSidebarProps = {
  activeDashboardId: number | null;
  onDashboardSelect: (id: number | null) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  forceCollapsed?: boolean;
  projects?: Project[];
  onProjectSelect?: (project: Project) => void;
  onNavigateToDashboardPath?: (dashboardId: number, path: number[]) => void;
  selectedProjectName?: string | null;
};

type DashboardFullData = {
  raccoglitori: Raccoglitore[];
  assignments: DashboardProjectAssignment[];
};

export default function DashboardSidebar({
  activeDashboardId,
  onDashboardSelect,
  isCollapsed,
  onToggleCollapse,
  forceCollapsed = false,
  projects = [],
  onProjectSelect,
  onNavigateToDashboardPath,
  selectedProjectName = null,
}: DashboardSidebarProps) {
  const api = useDashboardApi();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedDashboards, setExpandedDashboards] = useState<Set<number>>(new Set());
  const [expandedNodeKeys, setExpandedNodeKeys] = useState<Set<string>>(new Set());
  const [dashboardData, setDashboardData] = useState<Map<number, DashboardFullData>>(new Map());
  const [reloadTick, setReloadTick] = useState(0);

  const collapsed = forceCollapsed || isCollapsed;

  useEffect(() => {
    api.getDashboards().then(setDashboards);
  }, [api]);

  // Auto-expand active dashboard
  useEffect(() => {
    if (activeDashboardId !== null) {
      setExpandedDashboards((prev) => {
        if (prev.has(activeDashboardId)) return prev;
        const next = new Set(prev);
        next.add(activeDashboardId);
        return next;
      });
    }
  }, [activeDashboardId]);

  // Fetch data for each expanded dashboard
  useEffect(() => {
    let cancelled = false;
    const toFetch = Array.from(expandedDashboards).filter((id) => !dashboardData.has(id));
    if (toFetch.length === 0) return;
    toFetch.forEach((id) => {
      api.getFullDashboard(id).then((data) => {
        if (cancelled || !data) return;
        setDashboardData((prev) => {
          const next = new Map(prev);
          next.set(id, { raccoglitori: data.raccoglitori, assignments: data.assignments });
          return next;
        });
      });
    });
    return () => { cancelled = true; };
  }, [api, expandedDashboards, dashboardData, reloadTick]);

  const toggleDashboardExpand = useCallback((id: number) => {
    setExpandedDashboards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Force refresh next time this dashboard expands (catch updates)
    setReloadTick((t) => t + 1);
  }, []);

  const toggleNodeExpand = useCallback((key: string) => {
    setExpandedNodeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const dashboard = await api.createDashboard(newName.trim());
    setDashboards((prev) => [...prev, dashboard]);
    setNewName('');
    setIsCreating(false);
    onDashboardSelect(dashboard.id);
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

  if (collapsed) {
    return (
      <aside className="flex h-full w-11 flex-col items-center gap-1 border-r border-border/50 bg-card py-2">
        {dashboards.map((d) => {
          const active = d.id === activeDashboardId;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onDashboardSelect(d.id)}
              title={d.name}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                active ? 'ring-2 ring-primary/50' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: colorFor(d.id) }}
              />
            </button>
          );
        })}
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Espandi"
          className="mt-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r border-border/50 bg-card text-foreground">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Dashboard
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collassa"
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {dashboards.map((d) => {
          const active = d.id === activeDashboardId;
          const isEditing = editingId === d.id;
          const isExpanded = expandedDashboards.has(d.id);
          const data = dashboardData.get(d.id);
          return (
            <div key={d.id} className="mb-0.5">
              <div
                className={`group flex items-center gap-1 rounded-md px-1.5 py-1.5 transition-colors ${
                  active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleDashboardExpand(d.id)}
                  className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  title={isExpanded ? 'Collassa' : 'Espandi'}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                <div
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: colorFor(d.id) }}
                />
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(d.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground outline-none focus:border-primary/60"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(d.id)}
                      className="rounded p-0.5 text-primary hover:bg-accent"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onDashboardSelect(d.id)}
                      className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs"
                    >
                      <span className="truncate">{d.name}</span>
                      {d.is_default === 1 && (
                        <Star className="h-2.5 w-2.5 flex-shrink-0 fill-amber-400 text-amber-400" />
                      )}
                    </button>
                    <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleSetDefault(d.id)}
                        title={d.is_default ? 'Default' : 'Imposta default'}
                        className="rounded p-0.5 hover:bg-accent"
                      >
                        <Star
                          className={`h-3 w-3 ${d.is_default ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(d.id);
                          setEditName(d.name);
                        }}
                        title="Rinomina"
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(d.id)}
                        title="Elimina"
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
              {isExpanded && data && (
                <DashboardTree
                  dashboardId={d.id}
                  data={data}
                  projects={projects}
                  expandedNodeKeys={expandedNodeKeys}
                  onToggleNode={toggleNodeExpand}
                  onNavigateToPath={onNavigateToDashboardPath}
                  onProjectSelect={onProjectSelect}
                  selectedProjectName={selectedProjectName}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border/50 p-2">
        {isCreating ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewName('');
                }
              }}
              placeholder="Nome..."
              className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
            />
            <button
              type="button"
              onClick={handleCreate}
              className="rounded p-1 text-primary hover:bg-accent"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            <span>Nuova</span>
          </button>
        )}
      </div>
    </aside>
  );
}

type DashboardTreeProps = {
  dashboardId: number;
  data: DashboardFullData;
  projects: Project[];
  expandedNodeKeys: Set<string>;
  onToggleNode: (key: string) => void;
  onNavigateToPath?: (dashboardId: number, path: number[]) => void;
  onProjectSelect?: (project: Project) => void;
  selectedProjectName: string | null;
};

function DashboardTree({
  dashboardId,
  data,
  projects,
  expandedNodeKeys,
  onToggleNode,
  onNavigateToPath,
  onProjectSelect,
  selectedProjectName,
}: DashboardTreeProps) {
  const tree = useMemo(() => buildTree(data.raccoglitori, data.assignments), [data]);
  const projectByName = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.name, p);
    return map;
  }, [projects]);

  if (tree.length === 0) {
    return (
      <div className="py-1 pl-6 pr-2 text-[10px] italic text-muted-foreground/70">
        Nessun raccoglitore
      </div>
    );
  }

  return (
    <div className="mt-0.5 mb-1 border-l border-border/50 pl-1 ml-4">
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          dashboardId={dashboardId}
          pathSoFar={[]}
          expandedNodeKeys={expandedNodeKeys}
          onToggleNode={onToggleNode}
          onNavigateToPath={onNavigateToPath}
          onProjectSelect={onProjectSelect}
          projectByName={projectByName}
          selectedProjectName={selectedProjectName}
        />
      ))}
    </div>
  );
}

type TreeNodeProps = {
  node: RaccoglitoreNode;
  dashboardId: number;
  pathSoFar: number[];
  expandedNodeKeys: Set<string>;
  onToggleNode: (key: string) => void;
  onNavigateToPath?: (dashboardId: number, path: number[]) => void;
  onProjectSelect?: (project: Project) => void;
  projectByName: Map<string, Project>;
  selectedProjectName: string | null;
};

function TreeNode({
  node,
  dashboardId,
  pathSoFar,
  expandedNodeKeys,
  onToggleNode,
  onNavigateToPath,
  onProjectSelect,
  projectByName,
  selectedProjectName,
}: TreeNodeProps) {
  const fullPath = useMemo(() => [...pathSoFar, node.id], [pathSoFar, node.id]);
  const key = `${dashboardId}:${fullPath.join('.')}`;
  const hasChildren = node.children.length > 0 || node.directAssignments.length > 0;
  const isOpen = expandedNodeKeys.has(key);

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      >
        <button
          type="button"
          onClick={() => onToggleNode(key)}
          disabled={!hasChildren}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded disabled:opacity-30"
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => onNavigateToPath?.(dashboardId, fullPath)}
          disabled={!onNavigateToPath}
          className="flex min-w-0 flex-1 items-center gap-1 text-left enabled:hover:text-primary"
          title={`Apri ${node.name}`}
        >
          <Folder className="h-3 w-3 flex-shrink-0" style={{ color: node.color }} />
          <span className="truncate">{node.name}</span>
          {node.totalProjectsCount > 0 && (
            <span className="ml-auto rounded-full bg-muted px-1 text-[9px] text-muted-foreground">
              {node.totalProjectsCount}
            </span>
          )}
        </button>
      </div>
      {isOpen && (
        <div className="ml-3 border-l border-border/40 pl-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              dashboardId={dashboardId}
              pathSoFar={fullPath}
              expandedNodeKeys={expandedNodeKeys}
              onToggleNode={onToggleNode}
              onNavigateToPath={onNavigateToPath}
              onProjectSelect={onProjectSelect}
              projectByName={projectByName}
              selectedProjectName={selectedProjectName}
            />
          ))}
          {node.directAssignments.map((a) => {
            const project = projectByName.get(a.project_name);
            if (!project) return null;
            const isSelected = selectedProjectName === project.name;
            return (
              <button
                key={a.id || a.project_name}
                type="button"
                onClick={() => onProjectSelect?.(project)}
                disabled={!onProjectSelect}
                className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition-colors ${
                  isSelected
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground enabled:hover:bg-accent/50 enabled:hover:text-foreground'
                }`}
                title={project.displayName || project.name}
              >
                <span className="h-4 w-4 flex-shrink-0" />
                <FileCode className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{project.displayName || project.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
