import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, FolderInput, Home, Loader2 } from 'lucide-react';
import { useDashboardApi } from '../../../dashboard/hooks/useDashboardApi';
import { buildTree, getPathToNode } from '../../../dashboard/utils/tree';
import type { DashboardProjectAssignment, RaccoglitoreNode } from '../../../dashboard/types/dashboard';
import AssignProjectDialog from './AssignProjectDialog';

type Props = {
  dashboardId: number | null;
  projectName: string;
  projectDisplayName: string;
  onNavigate?: (dashboardId: number, path: number[]) => void;
};

type ResolvedPath = {
  dashboardName: string;
  tree: RaccoglitoreNode[];
  pathNodes: RaccoglitoreNode[];
  hasAssignment: boolean;
};

export default function ProjectBreadcrumb({ dashboardId, projectName, projectDisplayName, onNavigate }: Props) {
  const api = useDashboardApi();
  const [resolved, setResolved] = useState<ResolvedPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    if (dashboardId === null) return;
    setLoading(true);
    api.getFullDashboard(dashboardId).then((data) => {
      if (cancelled || !data) return;
      const tree = buildTree(data.raccoglitori, data.assignments);
      const assignment = (data.assignments as DashboardProjectAssignment[]).find((a) => a.project_name === projectName);
      if (!assignment) {
        setResolved({ dashboardName: data.dashboard.name, tree, pathNodes: [], hasAssignment: false });
        return;
      }
      const pathIds = getPathToNode(tree, assignment.raccoglitore_id) ?? [];
      const pathNodes: RaccoglitoreNode[] = [];
      let level = tree;
      for (const id of pathIds) {
        const found = level.find(n => n.id === id);
        if (!found) break;
        pathNodes.push(found);
        level = found.children;
      }
      setResolved({ dashboardName: data.dashboard.name, tree, pathNodes, hasAssignment: true });
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, dashboardId, projectName, reloadKey]);

  const segments = useMemo(() => {
    if (!resolved) return [] as { label: string; pathIds: number[]; key: string }[];
    return resolved.pathNodes.map((node, idx, arr) => ({
      label: node.name,
      pathIds: arr.slice(0, idx).map(n => n.id),
      key: arr.slice(0, idx + 1).map(n => n.id).join('.'),
    }));
  }, [resolved]);

  const handleAssign = useCallback(async (targetRid: number) => {
    if (dashboardId === null) return;
    await api.assignProject(dashboardId, targetRid, projectName);
    setReloadKey((k) => k + 1);
  }, [api, dashboardId, projectName]);

  if (dashboardId === null) return null;
  if (loading && !resolved) {
    return (
      <div className="flex items-center gap-1 px-3 py-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }
  if (!resolved) return null;

  const canNavigate = !!onNavigate;
  const handleNavigate = (path: number[]) => {
    if (canNavigate) onNavigate!(dashboardId, path);
  };

  return (
    <>
      <nav className="scrollbar-hide flex min-w-0 flex-wrap items-center gap-0.5 px-3 pb-1 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => handleNavigate([])}
          disabled={!canNavigate}
          className="flex items-center gap-1 rounded px-1 py-0.5 enabled:hover:bg-accent enabled:hover:text-foreground disabled:cursor-default"
          title={canNavigate ? `Apri dashboard ${resolved.dashboardName}` : resolved.dashboardName}
        >
          <Home className="h-3 w-3" />
          <span className="truncate">{resolved.dashboardName}</span>
        </button>
        {segments.map((seg) => (
          <span key={seg.key} className="flex items-center gap-0.5">
            <ChevronRight className="h-3 w-3 shrink-0" />
            <button
              type="button"
              onClick={() => handleNavigate(seg.pathIds)}
              disabled={!canNavigate}
              className="rounded px-1 py-0.5 enabled:hover:bg-accent enabled:hover:text-foreground disabled:cursor-default"
            >
              <span className="truncate">{seg.label}</span>
            </button>
          </span>
        ))}
        <span className="flex items-center gap-0.5">
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="rounded px-1 py-0.5 font-medium text-foreground">{projectDisplayName}</span>
        </span>
        {!resolved.hasAssignment && (
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="ml-1 flex shrink-0 items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
            title="Assegna questo progetto a un raccoglitore"
          >
            <FolderInput className="h-3 w-3" />
            <span>Assegna</span>
          </button>
        )}
      </nav>
      {assignOpen && resolved.hasAssignment === false && (
        <AssignProjectDialog
          projectDisplayName={projectDisplayName}
          dashboardName={resolved.dashboardName}
          tree={resolved.tree}
          onAssign={handleAssign}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </>
  );
}
