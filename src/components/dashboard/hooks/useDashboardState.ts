import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Project } from '../../../types/app';
import type { Dashboard, Raccoglitore, DashboardProjectAssignment, DashboardViewMode, RaccoglitoreNode } from '../types/dashboard';
import { useDashboardApi } from './useDashboardApi';
import { buildTree, findNodeByPath, getChildrenAtPath, validatePath } from '../utils/tree';

const pathStorageKey = (dashboardId: number) => `dashboard:${dashboardId}:path`;

function loadStoredPath(dashboardId: number): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(pathStorageKey(dashboardId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'number')) return parsed;
  } catch { /* ignore */ }
  return [];
}

function saveStoredPath(dashboardId: number, path: number[]) {
  if (typeof window === 'undefined') return;
  try {
    if (path.length === 0) window.localStorage.removeItem(pathStorageKey(dashboardId));
    else window.localStorage.setItem(pathStorageKey(dashboardId), JSON.stringify(path));
  } catch { /* ignore */ }
}

export function useDashboardState(dashboardId: number, projects: Project[]) {
  const api = useDashboardApi();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [raccoglitori, setRaccoglitori] = useState<Raccoglitore[]>([]);
  const [assignments, setAssignments] = useState<DashboardProjectAssignment[]>([]);
  const [currentPath, setCurrentPathState] = useState<number[]>(() => loadStoredPath(dashboardId));
  const dashboardIdRef = useRef(dashboardId);

  useEffect(() => {
    if (dashboardIdRef.current !== dashboardId) {
      dashboardIdRef.current = dashboardId;
      setCurrentPathState(loadStoredPath(dashboardId));
    }
  }, [dashboardId]);

  // Listen for external path change requests (e.g. from sidebar tree clicks)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { dashboardId?: number; path?: number[] } | undefined;
      if (!detail || detail.dashboardId !== dashboardId) return;
      const nextPath = Array.isArray(detail.path) ? detail.path : [];
      setCurrentPathState(nextPath);
      saveStoredPath(dashboardId, nextPath);
    };
    window.addEventListener('dashboard-set-path', handler);
    return () => window.removeEventListener('dashboard-set-path', handler);
  }, [dashboardId]);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getFullDashboard(dashboardId);
    if (data) {
      setDashboard(data.dashboard);
      setRaccoglitori(data.raccoglitori);
      setAssignments(data.assignments);
    }
    setLoading(false);
  }, [api, dashboardId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.name, p);
    return map;
  }, [projects]);

  const tree = useMemo<RaccoglitoreNode[]>(
    () => buildTree(raccoglitori, assignments),
    [raccoglitori, assignments],
  );

  // Validate/truncate path whenever tree changes.
  // Skip while data is loading or the dataset is empty — otherwise a fresh mount
  // with tree=[] would wrongly truncate a valid stored path before reload() completes.
  useEffect(() => {
    if (loading) return;
    if (currentPath.length === 0) return;
    if (raccoglitori.length === 0) return;
    const valid = validatePath(tree, currentPath);
    if (valid.length !== currentPath.length) {
      setCurrentPathState(valid);
      saveStoredPath(dashboardId, valid);
    }
  }, [loading, raccoglitori.length, tree, currentPath, dashboardId]);

  const setCurrentPath = useCallback((pathOrUpdater: number[] | ((prev: number[]) => number[])) => {
    setCurrentPathState(prev => {
      const next = typeof pathOrUpdater === 'function' ? pathOrUpdater(prev) : pathOrUpdater;
      saveStoredPath(dashboardId, next);
      return next;
    });
  }, [dashboardId]);

  const drillInto = useCallback((raccoglitoreId: number) => {
    setCurrentPath(prev => [...prev, raccoglitoreId]);
  }, [setCurrentPath]);

  const drillUp = useCallback(() => {
    setCurrentPath(prev => prev.slice(0, -1));
  }, [setCurrentPath]);

  const drillToRoot = useCallback(() => {
    setCurrentPath([]);
  }, [setCurrentPath]);

  const currentNode = useMemo<RaccoglitoreNode | null>(
    () => (currentPath.length === 0 ? null : findNodeByPath(tree, currentPath)),
    [tree, currentPath],
  );

  const currentChildren = useMemo<RaccoglitoreNode[]>(
    () => getChildrenAtPath(tree, currentPath),
    [tree, currentPath],
  );

  const pathNodes = useMemo<RaccoglitoreNode[]>(() => {
    const out: RaccoglitoreNode[] = [];
    let level: RaccoglitoreNode[] = tree;
    for (const id of currentPath) {
      const found = level.find(n => n.id === id);
      if (!found) break;
      out.push(found);
      level = found.children;
    }
    return out;
  }, [tree, currentPath]);

  const projectsByRaccoglitore = useMemo(() => {
    const buckets = new Map<number, Project[]>();
    for (const r of raccoglitori) buckets.set(r.id, []);

    const sorted = [...assignments].sort((a, b) => a.position - b.position);
    for (const a of sorted) {
      const project = projectMap.get(a.project_name);
      if (project) {
        buckets.get(a.raccoglitore_id)?.push(project);
      }
    }
    return buckets;
  }, [raccoglitori, assignments, projectMap]);

  const updateViewMode = useCallback(async (mode: DashboardViewMode) => {
    if (!dashboard) return;
    await api.updateDashboard(dashboard.id, { view_mode: mode });
    setDashboard((prev) => prev ? { ...prev, view_mode: mode } : prev);
  }, [api, dashboard]);

  const addRaccoglitore = useCallback(async (
    name: string,
    options?: { color?: string; icon?: string; notes?: string; parent_id?: number | null },
  ) => {
    if (!dashboard) return;
    const parent_id = options?.parent_id ?? (currentPath.length > 0 ? currentPath[currentPath.length - 1] : null);
    const r = await api.createRaccoglitore(dashboard.id, {
      name,
      color: options?.color,
      icon: options?.icon,
      notes: options?.notes,
      parent_id,
    });
    setRaccoglitori((prev) => [...prev, r]);
  }, [api, dashboard, currentPath]);

  const updateRaccoglitore = useCallback(async (rid: number, updates: { name?: string; color?: string; icon?: string; notes?: string }) => {
    if (!dashboard) return;
    await api.updateRaccoglitore(dashboard.id, rid, updates);
    setRaccoglitori((prev) => prev.map((r) => r.id === rid ? { ...r, ...updates } : r));
  }, [api, dashboard]);

  const moveRaccoglitore = useCallback(async (rid: number, parent_id: number | null, position?: number | null) => {
    if (!dashboard) return;
    try {
      await api.moveRaccoglitore(dashboard.id, rid, { parent_id, position: position ?? null });
      await reload();
    } catch (err) {
      console.error('moveRaccoglitore failed', err);
      throw err;
    }
  }, [api, dashboard, reload]);

  const deleteRaccoglitore = useCallback(async (rid: number, options?: { reparent?: boolean }) => {
    if (!dashboard) return;
    await api.deleteRaccoglitore(dashboard.id, rid, options);
    await reload();
  }, [api, dashboard, reload]);

  const assignProject = useCallback(async (rid: number, projectName: string) => {
    if (!dashboard) return;
    await api.assignProject(dashboard.id, rid, projectName);
    setAssignments((prev) => [...prev.filter((a) => !(a.raccoglitore_id === rid && a.project_name === projectName)), {
      id: 0, raccoglitore_id: rid, project_name: projectName, position: prev.length,
    }]);
  }, [api, dashboard]);

  const removeProject = useCallback(async (rid: number, projectName: string) => {
    if (!dashboard) return;
    await api.removeProject(dashboard.id, rid, projectName);
    setAssignments((prev) => prev.filter((a) => !(a.raccoglitore_id === rid && a.project_name === projectName)));
  }, [api, dashboard]);

  const moveProjectAssignment = useCallback(async (fromRid: number, toRid: number, projectName: string) => {
    if (!dashboard) return;
    if (fromRid === toRid) return;
    await api.removeProject(dashboard.id, fromRid, projectName);
    await api.assignProject(dashboard.id, toRid, projectName);
    setAssignments((prev) => {
      const filtered = prev.filter((a) => !(a.raccoglitore_id === fromRid && a.project_name === projectName));
      const existingTarget = filtered.some((a) => a.raccoglitore_id === toRid && a.project_name === projectName);
      if (existingTarget) return filtered;
      return [...filtered, { id: 0, raccoglitore_id: toRid, project_name: projectName, position: filtered.length }];
    });
  }, [api, dashboard]);

  const moveRaccoglitori = useCallback(async (raccoglitoreIds: number[]) => {
    if (!dashboard) return;
    // Optimistic local reorder
    setRaccoglitori((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      const reordered = raccoglitoreIds
        .map((id, idx) => {
          const r = byId.get(id);
          return r ? { ...r, position: idx } : null;
        })
        .filter(Boolean) as typeof prev;
      // Keep raccoglitori not in the reordered list (different parent) untouched
      const reorderedIds = new Set(raccoglitoreIds);
      const unchanged = prev.filter(r => !reorderedIds.has(r.id));
      return [...reordered, ...unchanged];
    });
    try {
      await api.reorderRaccoglitori(dashboard.id, raccoglitoreIds);
    } catch (err) {
      console.error('reorderRaccoglitori failed, reloading', err);
      await reload();
    }
  }, [api, dashboard, reload]);

  return {
    loading,
    dashboard,
    raccoglitori,
    assignments,
    tree,
    currentPath,
    currentNode,
    currentChildren,
    pathNodes,
    setCurrentPath,
    drillInto,
    drillUp,
    drillToRoot,
    projectsByRaccoglitore,
    updateViewMode,
    addRaccoglitore,
    moveRaccoglitori,
    moveRaccoglitore,
    updateRaccoglitore,
    deleteRaccoglitore,
    assignProject,
    removeProject,
    moveProjectAssignment,
    reload,
  };
}
