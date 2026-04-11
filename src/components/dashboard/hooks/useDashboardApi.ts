import { useCallback } from 'react';
import { authenticatedFetch } from '../../../utils/api';
import type { Dashboard, Raccoglitore, DashboardViewMode, DashboardSortMode } from '../types/dashboard';

export function useDashboardApi() {
  const getDashboards = useCallback(async (): Promise<Dashboard[]> => {
    const res = await authenticatedFetch('/api/dashboards');
    const data = await res.json();
    return data.dashboards ?? [];
  }, []);

  const getDefaultDashboardId = useCallback(async (): Promise<number | null> => {
    const res = await authenticatedFetch('/api/dashboards/default');
    const data = await res.json();
    return data.dashboardId ?? null;
  }, []);

  const getFullDashboard = useCallback(async (id: number) => {
    const res = await authenticatedFetch(`/api/dashboards/${id}/full`);
    if (!res.ok) return null;
    const data = await res.json();
    return { dashboard: data.dashboard, raccoglitori: data.raccoglitori, assignments: data.assignments };
  }, []);

  const createDashboard = useCallback(async (name: string): Promise<Dashboard> => {
    const res = await authenticatedFetch('/api/dashboards', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    return data.dashboard;
  }, []);

  const updateDashboard = useCallback(async (id: number, updates: { name?: string; sort_mode?: DashboardSortMode; view_mode?: DashboardViewMode }) => {
    await authenticatedFetch(`/api/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }, []);

  const deleteDashboard = useCallback(async (id: number) => {
    await authenticatedFetch(`/api/dashboards/${id}`, { method: 'DELETE' });
  }, []);

  const reorderDashboards = useCallback(async (dashboardIds: number[]) => {
    await authenticatedFetch('/api/dashboards/reorder', {
      method: 'PUT',
      body: JSON.stringify({ dashboardIds }),
    });
  }, []);

  const setDefaultDashboard = useCallback(async (id: number) => {
    await authenticatedFetch(`/api/dashboards/${id}/default`, { method: 'PUT' });
  }, []);

  // --- Raccoglitori ---
  const createRaccoglitore = useCallback(async (dashboardId: number, data: { name: string; color?: string; icon?: string; notes?: string }): Promise<Raccoglitore> => {
    const res = await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await res.json();
    return result.raccoglitore;
  }, []);

  const updateRaccoglitore = useCallback(async (dashboardId: number, rid: number, updates: { name?: string; color?: string; icon?: string; notes?: string }) => {
    await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/${rid}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }, []);

  const deleteRaccoglitore = useCallback(async (dashboardId: number, rid: number) => {
    await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/${rid}`, { method: 'DELETE' });
  }, []);

  const reorderRaccoglitori = useCallback(async (dashboardId: number, raccoglitoreIds: number[]) => {
    await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ raccoglitoreIds }),
    });
  }, []);

  // --- Project assignments ---
  const assignProject = useCallback(async (dashboardId: number, rid: number, projectName: string, position?: number) => {
    await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/${rid}/projects`, {
      method: 'POST',
      body: JSON.stringify({ projectName, position }),
    });
  }, []);

  const removeProject = useCallback(async (dashboardId: number, rid: number, projectName: string) => {
    await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/${rid}/projects/${encodeURIComponent(projectName)}`, {
      method: 'DELETE',
    });
  }, []);

  const reorderProjects = useCallback(async (dashboardId: number, rid: number, projectNames: string[]) => {
    await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/${rid}/projects/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ projectNames }),
    });
  }, []);

  return {
    getDashboards,
    getDefaultDashboardId,
    getFullDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    reorderDashboards,
    setDefaultDashboard,
    createRaccoglitore,
    updateRaccoglitore,
    deleteRaccoglitore,
    reorderRaccoglitori,
    assignProject,
    removeProject,
    reorderProjects,
  };
}
