import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Project } from '../../../types/app';
import type { Dashboard, Raccoglitore, DashboardProjectAssignment, DashboardViewMode } from '../types/dashboard';
import { useDashboardApi } from './useDashboardApi';

export function useDashboardState(dashboardId: number, projects: Project[]) {
  const api = useDashboardApi();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [raccoglitori, setRaccoglitori] = useState<Raccoglitore[]>([]);
  const [assignments, setAssignments] = useState<DashboardProjectAssignment[]>([]);

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

  const addRaccoglitore = useCallback(async (name: string, color?: string, icon?: string, notes?: string) => {
    if (!dashboard) return;
    const r = await api.createRaccoglitore(dashboard.id, { name, color, icon, notes });
    setRaccoglitori((prev) => [...prev, r]);
  }, [api, dashboard]);

  const updateRaccoglitore = useCallback(async (rid: number, updates: { name?: string; color?: string; icon?: string; notes?: string }) => {
    if (!dashboard) return;
    await api.updateRaccoglitore(dashboard.id, rid, updates);
    setRaccoglitori((prev) => prev.map((r) => r.id === rid ? { ...r, ...updates } : r));
  }, [api, dashboard]);

  const deleteRaccoglitore = useCallback(async (rid: number) => {
    if (!dashboard) return;
    await api.deleteRaccoglitore(dashboard.id, rid);
    setRaccoglitori((prev) => prev.filter((r) => r.id !== rid));
    setAssignments((prev) => prev.filter((a) => a.raccoglitore_id !== rid));
  }, [api, dashboard]);

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
      return reordered;
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
    projectsByRaccoglitore,
    updateViewMode,
    addRaccoglitore,
    moveRaccoglitori,
    updateRaccoglitore,
    deleteRaccoglitore,
    assignProject,
    removeProject,
    reload,
  };
}
