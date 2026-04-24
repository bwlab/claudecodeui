import { useCallback, useMemo } from 'react';
import { authenticatedFetch } from '../../../utils/api';
import type { Dashboard, Raccoglitore, DashboardViewMode, DashboardSortMode, FullWorkspace } from '../types/dashboard';
import type { SessionProvider } from '../../../types/app';

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

  const getWorkspace = useCallback(async (): Promise<FullWorkspace | null> => {
    const res = await authenticatedFetch('/api/dashboards/workspace');
    if (!res.ok) return null;
    const data = await res.json();
    return {
      dashboards: data.dashboards ?? [],
      raccoglitori: data.raccoglitori ?? [],
      assignments: data.assignments ?? [],
      favoriteProjectNames: data.favoriteProjectNames ?? [],
    };
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
  const createRaccoglitore = useCallback(async (dashboardId: number, data: { name: string; color?: string; icon?: string; notes?: string; parent_id?: number | null }): Promise<Raccoglitore> => {
    const res = await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result?.error || 'Failed to create raccoglitore');
    return result.raccoglitore;
  }, []);

  const updateRaccoglitore = useCallback(async (dashboardId: number, rid: number, updates: { name?: string; color?: string; icon?: string; notes?: string }) => {
    await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/${rid}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }, []);

  const moveRaccoglitore = useCallback(async (dashboardId: number, rid: number, payload: { parent_id: number | null; position?: number | null }): Promise<Raccoglitore> => {
    const res = await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/${rid}/move`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result?.error || 'Failed to move raccoglitore');
    return result.raccoglitore;
  }, []);

  const deleteRaccoglitore = useCallback(async (dashboardId: number, rid: number, options?: { reparent?: boolean }) => {
    const qs = options?.reparent ? '?reparent=true' : '';
    await authenticatedFetch(`/api/dashboards/${dashboardId}/raccoglitori/${rid}${qs}`, { method: 'DELETE' });
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

  const setAssignmentFavorite = useCallback(async (dashboardId: number, rid: number, projectName: string, isFavorite: boolean) => {
    const res = await authenticatedFetch(
      `/api/dashboards/${dashboardId}/raccoglitori/${rid}/projects/${encodeURIComponent(projectName)}/favorite`,
      { method: 'PATCH', body: JSON.stringify({ is_favorite: isFavorite }) },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || 'Failed to toggle favorite');
    }
  }, []);

  const renameProject = useCallback(async (projectName: string, displayName: string) => {
    const res = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/rename`,
      { method: 'PUT', body: JSON.stringify({ displayName }) },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || 'Rename fallito');
    }
  }, []);

  const deleteProject = useCallback(async (projectName: string) => {
    const res = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || 'Eliminazione progetto fallita');
    }
  }, []);

  const deleteSession = useCallback(async (projectName: string, sessionId: string, provider: SessionProvider) => {
    if (provider === 'cursor') throw new Error('Eliminazione sessioni Cursor non supportata dal provider.');
    const url = provider === 'claude'
      ? `/api/projects/${encodeURIComponent(projectName)}/sessions/${encodeURIComponent(sessionId)}`
      : provider === 'codex'
        ? `/api/codex/sessions/${encodeURIComponent(sessionId)}`
        : `/api/gemini/sessions/${encodeURIComponent(sessionId)}`;
    const res = await authenticatedFetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || 'Eliminazione sessione fallita');
    }
  }, []);

  const setProjectFavorite = useCallback(async (projectName: string, isFavorite: boolean) => {
    const res = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/favorite`,
      { method: 'PATCH', body: JSON.stringify({ is_favorite: isFavorite }) },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || 'Failed to toggle favorite');
    }
  }, []);

  return useMemo(() => ({
    getDashboards,
    getDefaultDashboardId,
    getFullDashboard,
    getWorkspace,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    reorderDashboards,
    setDefaultDashboard,
    createRaccoglitore,
    updateRaccoglitore,
    moveRaccoglitore,
    deleteRaccoglitore,
    reorderRaccoglitori,
    assignProject,
    removeProject,
    reorderProjects,
    setAssignmentFavorite,
    setProjectFavorite,
    renameProject,
    deleteProject,
    deleteSession,
  }), [
    getDashboards, getDefaultDashboardId, getFullDashboard, getWorkspace,
    createDashboard, updateDashboard, deleteDashboard,
    reorderDashboards, setDefaultDashboard,
    createRaccoglitore, updateRaccoglitore, moveRaccoglitore, deleteRaccoglitore, reorderRaccoglitori,
    assignProject, removeProject, reorderProjects,
    setAssignmentFavorite, setProjectFavorite,
    renameProject, deleteProject, deleteSession,
  ]);
}
