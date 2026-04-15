import express from 'express';
import { dashboardDb } from '../database/db.js';

const router = express.Router();

// GET list dashboards for current user
router.get('/', (req, res) => {
  try {
    const dashboards = dashboardDb.getDashboards(req.user.id);
    res.json({ success: true, dashboards });
  } catch (error) {
    console.error('Error getting dashboards:', error);
    res.status(500).json({ error: 'Failed to get dashboards' });
  }
});

// GET default dashboard id
router.get('/default', (req, res) => {
  try {
    const row = dashboardDb.getDefaultDashboard(req.user.id);
    res.json({ success: true, dashboardId: row?.id ?? null });
  } catch (error) {
    console.error('Error getting default dashboard:', error);
    res.status(500).json({ error: 'Failed to get default dashboard' });
  }
});

// GET full dashboard (raccoglitori + assignments)
router.get('/:id/full', (req, res) => {
  try {
    const data = dashboardDb.getFullDashboard(Number(req.params.id), req.user.id);
    if (!data) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('Error getting full dashboard:', error);
    res.status(500).json({ error: 'Failed to get full dashboard' });
  }
});

// POST create dashboard
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Dashboard name is required' });
    }
    const dashboard = dashboardDb.createDashboard(req.user.id, name.trim());
    res.json({ success: true, dashboard });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

// PUT update dashboard
router.put('/:id', (req, res) => {
  try {
    const { name, sort_mode, view_mode } = req.body;
    dashboardDb.updateDashboard(Number(req.params.id), req.user.id, { name, sort_mode, view_mode });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating dashboard:', error);
    res.status(500).json({ error: 'Failed to update dashboard' });
  }
});

// DELETE dashboard
router.delete('/:id', (req, res) => {
  try {
    dashboardDb.deleteDashboard(Number(req.params.id), req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    res.status(500).json({ error: 'Failed to delete dashboard' });
  }
});

// PUT reorder dashboards
router.put('/reorder', (req, res) => {
  try {
    const { dashboardIds } = req.body;
    if (!Array.isArray(dashboardIds)) {
      return res.status(400).json({ error: 'dashboardIds array is required' });
    }
    dashboardDb.reorderDashboards(req.user.id, dashboardIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering dashboards:', error);
    res.status(500).json({ error: 'Failed to reorder dashboards' });
  }
});

// PUT set default dashboard
router.put('/:id/default', (req, res) => {
  try {
    dashboardDb.setDefaultDashboard(req.user.id, Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting default dashboard:', error);
    res.status(500).json({ error: 'Failed to set default dashboard' });
  }
});

// --- Raccoglitori ---

// POST create raccoglitore
router.post('/:id/raccoglitori', (req, res) => {
  try {
    const { name, color, icon, notes, parent_id } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Raccoglitore name is required' });
    }
    const raccoglitore = dashboardDb.createRaccoglitore(Number(req.params.id), {
      name: name.trim(), color, icon, notes,
      parent_id: parent_id ?? null,
    });
    res.json({ success: true, raccoglitore });
  } catch (error) {
    console.error('Error creating raccoglitore:', error);
    const msg = error?.message || 'Failed to create raccoglitore';
    const code = /not found|different dashboard|depth/i.test(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  }
});

// PATCH move raccoglitore (change parent and/or position)
router.patch('/:id/raccoglitori/:rid/move', (req, res) => {
  try {
    const { parent_id, position } = req.body;
    const raccoglitore = dashboardDb.moveRaccoglitore(Number(req.params.rid), {
      parent_id: parent_id ?? null,
      position: position ?? null,
    });
    res.json({ success: true, raccoglitore });
  } catch (error) {
    console.error('Error moving raccoglitore:', error);
    const msg = error?.message || 'Failed to move raccoglitore';
    const code = /not found|descendant|dashboards|depth/i.test(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  }
});

// PUT update raccoglitore
router.put('/:id/raccoglitori/:rid', (req, res) => {
  try {
    const { name, color, icon, notes } = req.body;
    dashboardDb.updateRaccoglitore(Number(req.params.rid), { name, color, icon, notes });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating raccoglitore:', error);
    res.status(500).json({ error: 'Failed to update raccoglitore' });
  }
});

// DELETE raccoglitore (optional ?reparent=true moves children up one level)
router.delete('/:id/raccoglitori/:rid', (req, res) => {
  try {
    const reparent = req.query.reparent === 'true' || req.query.reparent === '1';
    dashboardDb.deleteRaccoglitore(Number(req.params.rid), { reparent });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting raccoglitore:', error);
    res.status(500).json({ error: 'Failed to delete raccoglitore' });
  }
});

// PUT reorder raccoglitori
router.put('/:id/raccoglitori/reorder', (req, res) => {
  try {
    const { raccoglitoreIds } = req.body;
    if (!Array.isArray(raccoglitoreIds)) {
      return res.status(400).json({ error: 'raccoglitoreIds array is required' });
    }
    dashboardDb.reorderRaccoglitori(Number(req.params.id), raccoglitoreIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering raccoglitori:', error);
    res.status(500).json({ error: 'Failed to reorder raccoglitori' });
  }
});

// --- Project assignments ---

// POST assign project to raccoglitore
router.post('/:id/raccoglitori/:rid/projects', (req, res) => {
  try {
    const { projectName, position } = req.body;
    if (!projectName?.trim()) {
      return res.status(400).json({ error: 'projectName is required' });
    }
    dashboardDb.assignProject(Number(req.params.rid), projectName.trim(), position ?? 0);
    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning project:', error);
    res.status(500).json({ error: 'Failed to assign project' });
  }
});

// DELETE remove project from raccoglitore
router.delete('/:id/raccoglitori/:rid/projects/:projectName', (req, res) => {
  try {
    dashboardDb.removeProject(Number(req.params.rid), req.params.projectName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing project:', error);
    res.status(500).json({ error: 'Failed to remove project' });
  }
});

// PUT reorder projects in raccoglitore
router.put('/:id/raccoglitori/:rid/projects/reorder', (req, res) => {
  try {
    const { projectNames } = req.body;
    if (!Array.isArray(projectNames)) {
      return res.status(400).json({ error: 'projectNames array is required' });
    }
    dashboardDb.reorderProjects(Number(req.params.rid), projectNames);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering projects:', error);
    res.status(500).json({ error: 'Failed to reorder projects' });
  }
});

export default router;
