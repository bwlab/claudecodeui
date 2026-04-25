# Session Kanban View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Kanban board view of sessions at project level, shown in the main content area when a project is selected but no session is open.

**Architecture:** New `session-kanban` component tree renders in MainContent when `activeTab === 'chat'` and `selectedSession` is null. Backend stores columns, assignments, notes, and labels in SQLite. Drag & drop via `@dnd-kit`.

**Tech Stack:** React, TypeScript, @dnd-kit/core + @dnd-kit/sortable, Express, better-sqlite3, Tailwind CSS

---

## File Structure

### New files

```
src/components/session-kanban/
  types/kanban.ts                          # TypeScript types
  hooks/useSessionKanbanApi.ts             # API calls (CRUD columns, notes, labels)
  hooks/useKanbanState.ts                  # Local board state, drag logic
  view/SessionKanban.tsx                   # Container (fetches data, passes to board)
  view/subcomponents/KanbanBoard.tsx       # DndContext wrapper + columns layout
  view/subcomponents/KanbanColumn.tsx      # Single column (header + cards list)
  view/subcomponents/KanbanColumnHeader.tsx # Title, rename, delete, drag handle
  view/subcomponents/KanbanSessionCard.tsx # Session card (info + notes + labels)
  view/subcomponents/AddColumnButton.tsx   # "+" button to create column
  view/subcomponents/SessionNoteEditor.tsx # Inline note editor popover
  view/subcomponents/LabelManager.tsx      # Create/assign/remove labels
  view/subcomponents/LabelChip.tsx         # Colored label chip

server/routes/kanban.js                    # Express router for kanban API
```

### Modified files

```
server/database/db.js                      # Add kanbanDb export + migration tables
server/index.js                            # Register kanban routes
src/components/main-content/view/MainContent.tsx  # Conditional render SessionKanban
package.json                               # Add @dnd-kit dependencies
```

---

### Task 1: Install @dnd-kit dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd /media/extra/Progetti/claudecodeui
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify installation**

```bash
ls node_modules/@dnd-kit/core/package.json && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @dnd-kit dependencies for session kanban"
```

---

### Task 2: Database schema — migration tables + kanbanDb operations

**Files:**
- Modify: `server/database/db.js` (add tables in `runMigrations()` at line ~155, add `kanbanDb` export)

- [ ] **Step 1: Add migration tables to `runMigrations()`**

In `server/database/db.js`, inside `runMigrations()`, after the existing `session_names` table creation (line ~148), add:

```javascript
    // Kanban board tables
    db.exec(`CREATE TABLE IF NOT EXISTS kanban_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_kanban_columns_project ON kanban_columns(project_name)');

    db.exec(`CREATE TABLE IF NOT EXISTS kanban_session_assignments (
      session_id TEXT NOT NULL,
      column_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id),
      FOREIGN KEY (column_id) REFERENCES kanban_columns(id) ON DELETE CASCADE
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS session_notes (
      session_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      note_text TEXT NOT NULL DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, project_name)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS session_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      label_name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_session_labels_project ON session_labels(project_name)');

    db.exec(`CREATE TABLE IF NOT EXISTS session_label_assignments (
      session_id TEXT NOT NULL,
      label_id INTEGER NOT NULL,
      PRIMARY KEY (session_id, label_id),
      FOREIGN KEY (label_id) REFERENCES session_labels(id) ON DELETE CASCADE
    )`);
```

- [ ] **Step 2: Add `kanbanDb` object**

After the `sessionNamesDb` object (line ~555), add:

```javascript
const kanbanDb = {
  // --- Columns ---
  getColumns: (projectName) => {
    return db.prepare(
      'SELECT id, project_name, column_name, position, is_default FROM kanban_columns WHERE project_name = ? ORDER BY position'
    ).all(projectName);
  },

  createColumn: (projectName, columnName, isDefault = false) => {
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as maxPos FROM kanban_columns WHERE project_name = ?'
    ).get(projectName);
    const position = (maxPos?.maxPos ?? -1) + 1;
    const result = db.prepare(
      'INSERT INTO kanban_columns (project_name, column_name, position, is_default) VALUES (?, ?, ?, ?)'
    ).run(projectName, columnName, position, isDefault ? 1 : 0);
    return { id: result.lastInsertRowid, projectName, columnName: columnName, position, isDefault };
  },

  updateColumn: (columnId, columnName, position) => {
    if (columnName !== undefined && position !== undefined) {
      db.prepare('UPDATE kanban_columns SET column_name = ?, position = ? WHERE id = ?').run(columnName, position, columnId);
    } else if (columnName !== undefined) {
      db.prepare('UPDATE kanban_columns SET column_name = ? WHERE id = ?').run(columnName, columnId);
    } else if (position !== undefined) {
      db.prepare('UPDATE kanban_columns SET position = ? WHERE id = ?').run(position, columnId);
    }
  },

  reorderColumns: (projectName, columnIds) => {
    const stmt = db.prepare('UPDATE kanban_columns SET position = ? WHERE id = ? AND project_name = ?');
    const transaction = db.transaction((ids) => {
      ids.forEach((id, index) => stmt.run(index, id, projectName));
    });
    transaction(columnIds);
  },

  deleteColumn: (columnId) => {
    // Assignments cascade-delete via FK
    db.prepare('DELETE FROM kanban_columns WHERE id = ? AND is_default = 0').run(columnId);
  },

  getDefaultColumn: (projectName) => {
    return db.prepare(
      'SELECT id FROM kanban_columns WHERE project_name = ? AND is_default = 1 LIMIT 1'
    ).get(projectName);
  },

  // --- Session assignments ---
  getAssignments: (projectName) => {
    return db.prepare(`
      SELECT sa.session_id, sa.column_id, sa.position
      FROM kanban_session_assignments sa
      JOIN kanban_columns c ON sa.column_id = c.id
      WHERE c.project_name = ?
      ORDER BY sa.position
    `).all(projectName);
  },

  assignSession: (sessionId, columnId, position) => {
    db.prepare(`
      INSERT INTO kanban_session_assignments (session_id, column_id, position)
      VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET column_id = excluded.column_id, position = excluded.position
    `).run(sessionId, columnId, position);
  },

  // --- Notes ---
  getNotes: (projectName) => {
    return db.prepare(
      'SELECT session_id, note_text, updated_at FROM session_notes WHERE project_name = ?'
    ).all(projectName);
  },

  setNote: (sessionId, projectName, noteText) => {
    db.prepare(`
      INSERT INTO session_notes (session_id, project_name, note_text, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id, project_name) DO UPDATE SET note_text = excluded.note_text, updated_at = CURRENT_TIMESTAMP
    `).run(sessionId, projectName, noteText);
  },

  // --- Labels ---
  getLabels: (projectName) => {
    return db.prepare(
      'SELECT id, label_name, color FROM session_labels WHERE project_name = ? ORDER BY label_name'
    ).all(projectName);
  },

  createLabel: (projectName, labelName, color) => {
    const result = db.prepare(
      'INSERT INTO session_labels (project_name, label_name, color) VALUES (?, ?, ?)'
    ).run(projectName, labelName, color);
    return { id: result.lastInsertRowid, labelName, color };
  },

  updateLabel: (labelId, labelName, color) => {
    db.prepare('UPDATE session_labels SET label_name = ?, color = ? WHERE id = ?').run(labelName, color, labelId);
  },

  deleteLabel: (labelId) => {
    db.prepare('DELETE FROM session_labels WHERE id = ?').run(labelId);
  },

  getLabelAssignments: (projectName) => {
    return db.prepare(`
      SELECT sla.session_id, sla.label_id
      FROM session_label_assignments sla
      JOIN session_labels sl ON sla.label_id = sl.id
      WHERE sl.project_name = ?
    `).all(projectName);
  },

  assignLabel: (sessionId, labelId) => {
    db.prepare(
      'INSERT OR IGNORE INTO session_label_assignments (session_id, label_id) VALUES (?, ?)'
    ).run(sessionId, labelId);
  },

  removeLabel: (sessionId, labelId) => {
    db.prepare(
      'DELETE FROM session_label_assignments WHERE session_id = ? AND label_id = ?'
    ).run(sessionId, labelId);
  },

  // --- Full board (single query batch) ---
  getFullBoard: (projectName) => {
    const columns = kanbanDb.getColumns(projectName);

    // Auto-create default column if none exist
    if (columns.length === 0) {
      const defaultCol = kanbanDb.createColumn(projectName, 'Tutte le sessioni', true);
      columns.push({ ...defaultCol, is_default: 1 });
    }

    const assignments = kanbanDb.getAssignments(projectName);
    const notes = kanbanDb.getNotes(projectName);
    const labels = kanbanDb.getLabels(projectName);
    const labelAssignments = kanbanDb.getLabelAssignments(projectName);

    return { columns, assignments, notes, labels, labelAssignments };
  },
};
```

- [ ] **Step 3: Add `kanbanDb` to exports**

In the `export` block at the bottom of `server/database/db.js` (line ~618), add `kanbanDb`:

```javascript
export {
  db,
  initializeDatabase,
  userDb,
  apiKeysDb,
  credentialsDb,
  notificationPreferencesDb,
  pushSubscriptionsDb,
  sessionNamesDb,
  applyCustomSessionNames,
  appConfigDb,
  githubTokensDb,
  kanbanDb,
};
```

- [ ] **Step 4: Verify server starts**

```bash
cd /media/extra/Progetti/claudecodeui
node -e "import('./server/database/db.js').then(m => { console.log(typeof m.kanbanDb); process.exit(0); })"
```

Expected: `object`

- [ ] **Step 5: Commit**

```bash
git add server/database/db.js
git commit -m "feat(kanban): add database schema and kanbanDb operations"
```

---

### Task 3: Server API routes — `server/routes/kanban.js`

**Files:**
- Create: `server/routes/kanban.js`
- Modify: `server/index.js` (lines ~67, ~405)

- [ ] **Step 1: Create kanban routes file**

Create `server/routes/kanban.js`:

```javascript
import express from 'express';
import { kanbanDb } from '../database/db.js';

const router = express.Router();

// GET full board
router.get('/:projectName/board', (req, res) => {
  try {
    const board = kanbanDb.getFullBoard(req.params.projectName);
    res.json({ success: true, ...board });
  } catch (error) {
    console.error('Error getting kanban board:', error);
    res.status(500).json({ error: 'Failed to get kanban board' });
  }
});

// POST create column
router.post('/:projectName/columns', (req, res) => {
  try {
    const { columnName } = req.body;
    if (!columnName?.trim()) {
      return res.status(400).json({ error: 'Column name is required' });
    }
    const column = kanbanDb.createColumn(req.params.projectName, columnName.trim());
    res.json({ success: true, column });
  } catch (error) {
    console.error('Error creating column:', error);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

// PUT update column
router.put('/:projectName/columns/:id', (req, res) => {
  try {
    const { columnName, position } = req.body;
    kanbanDb.updateColumn(Number(req.params.id), columnName, position);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating column:', error);
    res.status(500).json({ error: 'Failed to update column' });
  }
});

// PUT reorder all columns
router.put('/:projectName/columns-order', (req, res) => {
  try {
    const { columnIds } = req.body;
    if (!Array.isArray(columnIds)) {
      return res.status(400).json({ error: 'columnIds array is required' });
    }
    kanbanDb.reorderColumns(req.params.projectName, columnIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering columns:', error);
    res.status(500).json({ error: 'Failed to reorder columns' });
  }
});

// DELETE column
router.delete('/:projectName/columns/:id', (req, res) => {
  try {
    kanbanDb.deleteColumn(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting column:', error);
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

// PUT assign session to column
router.put('/sessions/:sessionId/assign', (req, res) => {
  try {
    const { columnId, position } = req.body;
    if (columnId === undefined) {
      return res.status(400).json({ error: 'columnId is required' });
    }
    kanbanDb.assignSession(req.params.sessionId, columnId, position ?? 0);
    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning session:', error);
    res.status(500).json({ error: 'Failed to assign session' });
  }
});

// PUT update session note
router.put('/sessions/:sessionId/note', (req, res) => {
  try {
    const { projectName, noteText } = req.body;
    if (!projectName) {
      return res.status(400).json({ error: 'projectName is required' });
    }
    kanbanDb.setNote(req.params.sessionId, projectName, noteText ?? '');
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// POST create label
router.post('/:projectName/labels', (req, res) => {
  try {
    const { labelName, color } = req.body;
    if (!labelName?.trim()) {
      return res.status(400).json({ error: 'Label name is required' });
    }
    const label = kanbanDb.createLabel(req.params.projectName, labelName.trim(), color || '#3b82f6');
    res.json({ success: true, label });
  } catch (error) {
    console.error('Error creating label:', error);
    res.status(500).json({ error: 'Failed to create label' });
  }
});

// PUT update label
router.put('/:projectName/labels/:id', (req, res) => {
  try {
    const { labelName, color } = req.body;
    kanbanDb.updateLabel(Number(req.params.id), labelName, color);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating label:', error);
    res.status(500).json({ error: 'Failed to update label' });
  }
});

// DELETE label
router.delete('/:projectName/labels/:id', (req, res) => {
  try {
    kanbanDb.deleteLabel(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting label:', error);
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

// POST assign label to session
router.post('/sessions/:sessionId/labels', (req, res) => {
  try {
    const { labelId } = req.body;
    if (labelId === undefined) {
      return res.status(400).json({ error: 'labelId is required' });
    }
    kanbanDb.assignLabel(req.params.sessionId, labelId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning label:', error);
    res.status(500).json({ error: 'Failed to assign label' });
  }
});

// DELETE remove label from session
router.delete('/sessions/:sessionId/labels/:labelId', (req, res) => {
  try {
    kanbanDb.removeLabel(req.params.sessionId, Number(req.params.labelId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing label:', error);
    res.status(500).json({ error: 'Failed to remove label' });
  }
});

export default router;
```

- [ ] **Step 2: Register routes in `server/index.js`**

Add import at line ~68 (after `import messagesRoutes`):

```javascript
import kanbanRoutes from './routes/kanban.js';
```

Add route registration at line ~403 (after `app.use('/api/sessions', ...)`):

```javascript
app.use('/api/kanban', authenticateToken, kanbanRoutes);
```

- [ ] **Step 3: Verify server starts**

```bash
cd /media/extra/Progetti/claudecodeui
timeout 5 node server/index.js 2>&1 || true
```

Expected: server starts without errors (times out after 5s which is fine)

- [ ] **Step 4: Commit**

```bash
git add server/routes/kanban.js server/index.js
git commit -m "feat(kanban): add server API routes for kanban board"
```

---

### Task 4: TypeScript types — `src/components/session-kanban/types/kanban.ts`

**Files:**
- Create: `src/components/session-kanban/types/kanban.ts`

- [ ] **Step 1: Create types file**

```typescript
export interface KanbanColumn {
  id: number;
  project_name: string;
  column_name: string;
  position: number;
  is_default: number; // SQLite boolean: 0 | 1
}

export interface KanbanSessionAssignment {
  session_id: string;
  column_id: number;
  position: number;
}

export interface SessionNote {
  session_id: string;
  note_text: string;
  updated_at: string;
}

export interface SessionLabel {
  id: number;
  label_name: string;
  color: string;
}

export interface SessionLabelAssignment {
  session_id: string;
  label_id: number;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  assignments: KanbanSessionAssignment[];
  notes: SessionNote[];
  labels: SessionLabel[];
  labelAssignments: SessionLabelAssignment[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session-kanban/types/kanban.ts
git commit -m "feat(kanban): add TypeScript types for kanban board"
```

---

### Task 5: API hook — `useSessionKanbanApi.ts`

**Files:**
- Create: `src/components/session-kanban/hooks/useSessionKanbanApi.ts`

- [ ] **Step 1: Create API hook**

```typescript
import { useCallback } from 'react';
import { authenticatedFetch } from '../../../utils/api';
import type { KanbanBoard } from '../types/kanban';

export function useSessionKanbanApi(projectName: string) {
  const fetchBoard = useCallback(async (): Promise<KanbanBoard> => {
    const res = await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/board`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  }, [projectName]);

  const createColumn = useCallback(async (columnName: string) => {
    const res = await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/columns`, {
      method: 'POST',
      body: JSON.stringify({ columnName }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.column;
  }, [projectName]);

  const updateColumn = useCallback(async (columnId: number, columnName?: string, position?: number) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/columns/${columnId}`, {
      method: 'PUT',
      body: JSON.stringify({ columnName, position }),
    });
  }, [projectName]);

  const reorderColumns = useCallback(async (columnIds: number[]) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/columns-order`, {
      method: 'PUT',
      body: JSON.stringify({ columnIds }),
    });
  }, [projectName]);

  const deleteColumn = useCallback(async (columnId: number) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/columns/${columnId}`, {
      method: 'DELETE',
    });
  }, [projectName]);

  const assignSession = useCallback(async (sessionId: string, columnId: number, position: number) => {
    await authenticatedFetch(`/api/kanban/sessions/${encodeURIComponent(sessionId)}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ columnId, position }),
    });
  }, []);

  const updateNote = useCallback(async (sessionId: string, noteText: string) => {
    await authenticatedFetch(`/api/kanban/sessions/${encodeURIComponent(sessionId)}/note`, {
      method: 'PUT',
      body: JSON.stringify({ projectName, noteText }),
    });
  }, [projectName]);

  const createLabel = useCallback(async (labelName: string, color: string) => {
    const res = await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labelName, color }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.label;
  }, [projectName]);

  const updateLabel = useCallback(async (labelId: number, labelName: string, color: string) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/labels/${labelId}`, {
      method: 'PUT',
      body: JSON.stringify({ labelName, color }),
    });
  }, [projectName]);

  const deleteLabel = useCallback(async (labelId: number) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/labels/${labelId}`, {
      method: 'DELETE',
    });
  }, [projectName]);

  const assignLabelToSession = useCallback(async (sessionId: string, labelId: number) => {
    await authenticatedFetch(`/api/kanban/sessions/${encodeURIComponent(sessionId)}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labelId }),
    });
  }, []);

  const removeLabelFromSession = useCallback(async (sessionId: string, labelId: number) => {
    await authenticatedFetch(`/api/kanban/sessions/${encodeURIComponent(sessionId)}/labels/${labelId}`, {
      method: 'DELETE',
    });
  }, []);

  return {
    fetchBoard,
    createColumn,
    updateColumn,
    reorderColumns,
    deleteColumn,
    assignSession,
    updateNote,
    createLabel,
    updateLabel,
    deleteLabel,
    assignLabelToSession,
    removeLabelFromSession,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session-kanban/hooks/useSessionKanbanApi.ts
git commit -m "feat(kanban): add API hook for kanban board operations"
```

---

### Task 6: Kanban state hook — `useKanbanState.ts`

**Files:**
- Create: `src/components/session-kanban/hooks/useKanbanState.ts`

- [ ] **Step 1: Create state hook**

```typescript
import { useState, useCallback, useEffect } from 'react';
import type { ProjectSession } from '../../../types/app';
import type {
  KanbanColumn,
  KanbanSessionAssignment,
  SessionNote,
  SessionLabel,
  SessionLabelAssignment,
} from '../types/kanban';
import { useSessionKanbanApi } from './useSessionKanbanApi';

export function useKanbanState(projectName: string, allSessions: ProjectSession[]) {
  const api = useSessionKanbanApi(projectName);

  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [assignments, setAssignments] = useState<KanbanSessionAssignment[]>([]);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [labels, setLabels] = useState<SessionLabel[]>([]);
  const [labelAssignments, setLabelAssignments] = useState<SessionLabelAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const board = await api.fetchBoard();
      setColumns(board.columns);
      setAssignments(board.assignments);
      setNotes(board.notes);
      setLabels(board.labels);
      setLabelAssignments(board.labelAssignments);
    } catch (err) {
      console.error('Failed to fetch kanban board:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [projectName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build a map: columnId -> sessions (sorted by position)
  const getSessionsByColumn = useCallback(() => {
    const assignmentMap = new Map(assignments.map((a) => [a.session_id, a]));
    const defaultCol = columns.find((c) => c.is_default === 1);

    const buckets = new Map<number, { session: ProjectSession; position: number }[]>();
    for (const col of columns) {
      buckets.set(col.id, []);
    }

    for (const session of allSessions) {
      const assignment = assignmentMap.get(session.id);
      if (assignment && buckets.has(assignment.column_id)) {
        buckets.get(assignment.column_id)!.push({ session, position: assignment.position });
      } else if (defaultCol) {
        buckets.get(defaultCol.id)!.push({ session, position: Number.MAX_SAFE_INTEGER });
      }
    }

    // Sort each bucket by position
    for (const [, bucket] of buckets) {
      bucket.sort((a, b) => a.position - b.position);
    }

    return buckets;
  }, [columns, assignments, allSessions]);

  const getNoteForSession = useCallback(
    (sessionId: string) => notes.find((n) => n.session_id === sessionId)?.note_text ?? '',
    [notes],
  );

  const getLabelsForSession = useCallback(
    (sessionId: string) => {
      const assignedIds = labelAssignments.filter((la) => la.session_id === sessionId).map((la) => la.label_id);
      return labels.filter((l) => assignedIds.includes(l.id));
    },
    [labels, labelAssignments],
  );

  // --- Mutations (optimistic update + API call + refresh) ---
  const addColumn = useCallback(async (columnName: string) => {
    await api.createColumn(columnName);
    await refresh();
  }, [api, refresh]);

  const renameColumn = useCallback(async (columnId: number, columnName: string) => {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, column_name: columnName } : c)));
    await api.updateColumn(columnId, columnName);
  }, [api]);

  const removeColumn = useCallback(async (columnId: number) => {
    await api.deleteColumn(columnId);
    await refresh();
  }, [api, refresh]);

  const moveSession = useCallback(async (sessionId: string, targetColumnId: number, targetPosition: number) => {
    // Optimistic update
    setAssignments((prev) => {
      const without = prev.filter((a) => a.session_id !== sessionId);
      return [...without, { session_id: sessionId, column_id: targetColumnId, position: targetPosition }];
    });
    await api.assignSession(sessionId, targetColumnId, targetPosition);
  }, [api]);

  const moveColumn = useCallback(async (columnIds: number[]) => {
    // Optimistic update
    setColumns((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      return columnIds.map((id, i) => ({ ...map.get(id)!, position: i }));
    });
    await api.reorderColumns(columnIds);
  }, [api]);

  const setSessionNote = useCallback(async (sessionId: string, noteText: string) => {
    setNotes((prev) => {
      const without = prev.filter((n) => n.session_id !== sessionId);
      return [...without, { session_id: sessionId, note_text: noteText, updated_at: new Date().toISOString() }];
    });
    await api.updateNote(sessionId, noteText);
  }, [api]);

  const addLabel = useCallback(async (labelName: string, color: string) => {
    await api.createLabel(labelName, color);
    await refresh();
  }, [api, refresh]);

  const editLabel = useCallback(async (labelId: number, labelName: string, color: string) => {
    setLabels((prev) => prev.map((l) => (l.id === labelId ? { ...l, label_name: labelName, color } : l)));
    await api.updateLabel(labelId, labelName, color);
  }, [api]);

  const removeLabel = useCallback(async (labelId: number) => {
    await api.deleteLabel(labelId);
    await refresh();
  }, [api, refresh]);

  const toggleSessionLabel = useCallback(async (sessionId: string, labelId: number) => {
    const exists = labelAssignments.some((la) => la.session_id === sessionId && la.label_id === labelId);
    if (exists) {
      setLabelAssignments((prev) => prev.filter((la) => !(la.session_id === sessionId && la.label_id === labelId)));
      await api.removeLabelFromSession(sessionId, labelId);
    } else {
      setLabelAssignments((prev) => [...prev, { session_id: sessionId, label_id: labelId }]);
      await api.assignLabelToSession(sessionId, labelId);
    }
  }, [api, labelAssignments]);

  return {
    columns,
    labels,
    loading,
    getSessionsByColumn,
    getNoteForSession,
    getLabelsForSession,
    addColumn,
    renameColumn,
    removeColumn,
    moveSession,
    moveColumn,
    setSessionNote,
    addLabel,
    editLabel,
    removeLabel,
    toggleSessionLabel,
    refresh,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session-kanban/hooks/useKanbanState.ts
git commit -m "feat(kanban): add kanban board state management hook"
```

---

### Task 7: UI components — LabelChip, AddColumnButton, SessionNoteEditor

**Files:**
- Create: `src/components/session-kanban/view/subcomponents/LabelChip.tsx`
- Create: `src/components/session-kanban/view/subcomponents/AddColumnButton.tsx`
- Create: `src/components/session-kanban/view/subcomponents/SessionNoteEditor.tsx`

- [ ] **Step 1: Create LabelChip**

```tsx
import { X } from 'lucide-react';

type LabelChipProps = {
  name: string;
  color: string;
  onRemove?: () => void;
};

export default function LabelChip({ name, color, onRemove }: LabelChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-80"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Create AddColumnButton**

```tsx
import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';

type AddColumnButtonProps = {
  onAdd: (name: string) => void;
};

export default function AddColumnButton({ onAdd }: AddColumnButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className="flex h-10 min-w-[220px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Nuova colonna
      </button>
    );
  }

  return (
    <div className="flex min-w-[220px] shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setIsAdding(false); setName(''); }
        }}
        placeholder="Nome colonna..."
        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
      <button type="button" onClick={handleSubmit} className="rounded p-1 hover:bg-accent">
        <Check className="h-4 w-4 text-primary" />
      </button>
      <button type="button" onClick={() => { setIsAdding(false); setName(''); }} className="rounded p-1 hover:bg-accent">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create SessionNoteEditor**

```tsx
import { useState, useRef, useEffect } from 'react';
import { StickyNote, Check, X } from 'lucide-react';

type SessionNoteEditorProps = {
  note: string;
  onSave: (text: string) => void;
};

export default function SessionNoteEditor({ note, onSave }: SessionNoteEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(note);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(note);
  }, [note]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(text.length, text.length);
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    onSave(text);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="flex w-full items-start gap-1 text-left"
      >
        {note ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{note}</p>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            Aggiungi nota...
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
          if (e.key === 'Escape') { setText(note); setIsEditing(false); }
        }}
        rows={3}
        className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex justify-end gap-1">
        <button type="button" onClick={handleSave} className="rounded p-0.5 hover:bg-accent">
          <Check className="h-3.5 w-3.5 text-primary" />
        </button>
        <button type="button" onClick={() => { setText(note); setIsEditing(false); }} className="rounded p-0.5 hover:bg-accent">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/session-kanban/view/subcomponents/LabelChip.tsx \
        src/components/session-kanban/view/subcomponents/AddColumnButton.tsx \
        src/components/session-kanban/view/subcomponents/SessionNoteEditor.tsx
git commit -m "feat(kanban): add LabelChip, AddColumnButton, SessionNoteEditor components"
```

---

### Task 8: UI components — LabelManager

**Files:**
- Create: `src/components/session-kanban/view/subcomponents/LabelManager.tsx`

- [ ] **Step 1: Create LabelManager**

```tsx
import { useState, useRef, useEffect } from 'react';
import { Tag, Plus, Check, Pencil, Trash2, X } from 'lucide-react';
import type { SessionLabel } from '../../types/kanban';
import LabelChip from './LabelChip';

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

type LabelManagerProps = {
  labels: SessionLabel[];
  assignedLabelIds: number[];
  onToggleLabel: (labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
};

export default function LabelManager({
  labels,
  assignedLabelIds,
  onToggleLabel,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
}: LabelManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmitNew = () => {
    if (name.trim()) {
      onCreateLabel(name.trim(), color);
      setName('');
      setColor(PRESET_COLORS[0]);
      setIsCreating(false);
    }
  };

  const handleSubmitEdit = (labelId: number) => {
    if (name.trim()) {
      onEditLabel(labelId, name.trim(), color);
      setName('');
      setEditingId(null);
    }
  };

  const startEdit = (label: SessionLabel) => {
    setEditingId(label.id);
    setName(label.label_name);
    setColor(label.color);
    setIsCreating(false);
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground"
      >
        <Tag className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-2 shadow-lg">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Etichette</div>

          <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {labels.map((label) => {
              const isAssigned = assignedLabelIds.includes(label.id);

              if (editingId === label.id) {
                return (
                  <div key={label.id} className="flex flex-col gap-1 rounded p-1">
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmitEdit(label.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full rounded border border-border bg-background px-2 py-0.5 text-xs outline-none"
                    />
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`h-4 w-4 rounded-full border-2 ${c === color ? 'border-foreground' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => handleSubmitEdit(label.id)} className="rounded p-0.5 hover:bg-accent">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded p-0.5 hover:bg-accent">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={label.id} className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-accent">
                  <button
                    type="button"
                    onClick={() => onToggleLabel(label.id)}
                    className="flex flex-1 items-center gap-1.5"
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isAssigned ? 'border-primary bg-primary' : 'border-border'}`}
                    >
                      {isAssigned && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <LabelChip name={label.label_name} color={label.color} />
                  </button>
                  <button type="button" onClick={() => startEdit(label)} className="hidden rounded p-0.5 hover:bg-background group-hover:block">
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button type="button" onClick={() => onDeleteLabel(label.id)} className="hidden rounded p-0.5 hover:bg-background group-hover:block">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>

          {isCreating ? (
            <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitNew();
                  if (e.key === 'Escape') { setIsCreating(false); setName(''); }
                }}
                placeholder="Nome etichetta..."
                className="w-full rounded border border-border bg-background px-2 py-0.5 text-xs outline-none"
              />
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-4 w-4 rounded-full border-2 ${c === color ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-1">
                <button type="button" onClick={handleSubmitNew} className="rounded p-0.5 hover:bg-accent">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </button>
                <button type="button" onClick={() => { setIsCreating(false); setName(''); }} className="rounded p-0.5 hover:bg-accent">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setIsCreating(true); setName(''); setColor(PRESET_COLORS[0]); }}
              className="mt-2 flex w-full items-center gap-1 border-t border-border pt-2 text-xs text-muted-foreground hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              Nuova etichetta
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session-kanban/view/subcomponents/LabelManager.tsx
git commit -m "feat(kanban): add LabelManager component with create/edit/assign"
```

---

### Task 9: UI components — KanbanSessionCard

**Files:**
- Create: `src/components/session-kanban/view/subcomponents/KanbanSessionCard.tsx`

- [ ] **Step 1: Create KanbanSessionCard**

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock } from 'lucide-react';
import { Badge } from '../../../../shared/view/ui';
import { formatTimeAgo } from '../../../../utils/dateUtils';
import SessionProviderLogo from '../../../llm-logo-provider/SessionProviderLogo';
import type { ProjectSession, SessionProvider } from '../../../../types/app';
import type { SessionLabel } from '../../types/kanban';
import LabelChip from './LabelChip';
import SessionNoteEditor from './SessionNoteEditor';
import LabelManager from './LabelManager';

type KanbanSessionCardProps = {
  session: ProjectSession;
  note: string;
  sessionLabels: SessionLabel[];
  allLabels: SessionLabel[];
  currentTime: Date;
  onSessionClick: (session: ProjectSession) => void;
  onNoteChange: (sessionId: string, text: string) => void;
  onToggleLabel: (sessionId: string, labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
};

export default function KanbanSessionCard({
  session,
  note,
  sessionLabels,
  allLabels,
  currentTime,
  onSessionClick,
  onNoteChange,
  onToggleLabel,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
}: KanbanSessionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id, data: { type: 'session', session } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const title = session.summary || session.title || session.name || session.id;
  const timestamp = session.lastActivity || session.updated_at || session.createdAt || session.created_at;
  const provider = (session.__provider || 'claude') as SessionProvider;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onSessionClick(session)}
    >
      {/* Header: provider + title */}
      <div className="mb-1.5 flex items-start gap-2">
        <SessionProviderLogo provider={provider} size={16} />
        <h4 className="flex-1 truncate text-sm font-medium leading-tight text-foreground">
          {title}
        </h4>
      </div>

      {/* Meta: time + message count */}
      <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
        {timestamp && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(new Date(timestamp), currentTime)}
          </span>
        )}
        {session.messageCount !== undefined && (
          <Badge variant="secondary" className="text-[10px]">
            {session.messageCount}
          </Badge>
        )}
      </div>

      {/* Labels */}
      {sessionLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {sessionLabels.map((label) => (
            <LabelChip
              key={label.id}
              name={label.label_name}
              color={label.color}
              onRemove={() => onToggleLabel(session.id, label.id)}
            />
          ))}
        </div>
      )}

      {/* Note */}
      <div className="mb-1">
        <SessionNoteEditor note={note} onSave={(text) => onNoteChange(session.id, text)} />
      </div>

      {/* Label manager trigger */}
      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
        <LabelManager
          labels={allLabels}
          assignedLabelIds={sessionLabels.map((l) => l.id)}
          onToggleLabel={(labelId) => onToggleLabel(session.id, labelId)}
          onCreateLabel={onCreateLabel}
          onEditLabel={onEditLabel}
          onDeleteLabel={onDeleteLabel}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session-kanban/view/subcomponents/KanbanSessionCard.tsx
git commit -m "feat(kanban): add KanbanSessionCard with drag support, notes, labels"
```

---

### Task 10: UI components — KanbanColumnHeader, KanbanColumn

**Files:**
- Create: `src/components/session-kanban/view/subcomponents/KanbanColumnHeader.tsx`
- Create: `src/components/session-kanban/view/subcomponents/KanbanColumn.tsx`

- [ ] **Step 1: Create KanbanColumnHeader**

```tsx
import { useState } from 'react';
import { GripVertical, Pencil, Trash2, Check, X } from 'lucide-react';
import type { KanbanColumn } from '../../types/kanban';

type KanbanColumnHeaderProps = {
  column: KanbanColumn;
  sessionCount: number;
  dragHandleProps?: Record<string, unknown>;
  onRename: (columnId: number, name: string) => void;
  onDelete: (columnId: number) => void;
};

export default function KanbanColumnHeader({
  column,
  sessionCount,
  dragHandleProps,
  onRename,
  onDelete,
}: KanbanColumnHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(column.column_name);

  const handleSave = () => {
    if (name.trim() && name.trim() !== column.column_name) {
      onRename(column.id, name.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>

      {isEditing ? (
        <div className="flex flex-1 items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setName(column.column_name); setIsEditing(false); }
            }}
            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
          />
          <button type="button" onClick={handleSave} className="rounded p-0.5 hover:bg-accent">
            <Check className="h-3.5 w-3.5 text-primary" />
          </button>
          <button type="button" onClick={() => { setName(column.column_name); setIsEditing(false); }} className="rounded p-0.5 hover:bg-accent">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <>
          <h3 className="flex-1 truncate text-sm font-semibold text-foreground">{column.column_name}</h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {sessionCount}
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover/col:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {!column.is_default && (
            <button
              type="button"
              onClick={() => onDelete(column.id)}
              className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover/col:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create KanbanColumn**

```tsx
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanColumn as KanbanColumnType } from '../../types/kanban';
import type { ProjectSession } from '../../../../types/app';
import type { SessionLabel } from '../../types/kanban';
import KanbanColumnHeader from './KanbanColumnHeader';
import KanbanSessionCard from './KanbanSessionCard';

type KanbanColumnProps = {
  column: KanbanColumnType;
  sessions: ProjectSession[];
  allLabels: SessionLabel[];
  currentTime: Date;
  getNoteForSession: (sessionId: string) => string;
  getLabelsForSession: (sessionId: string) => SessionLabel[];
  onRenameColumn: (columnId: number, name: string) => void;
  onDeleteColumn: (columnId: number) => void;
  onSessionClick: (session: ProjectSession) => void;
  onNoteChange: (sessionId: string, text: string) => void;
  onToggleLabel: (sessionId: string, labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
};

export default function KanbanColumn({
  column,
  sessions,
  allLabels,
  currentTime,
  getNoteForSession,
  getLabelsForSession,
  onRenameColumn,
  onDeleteColumn,
  onSessionClick,
  onNoteChange,
  onToggleLabel,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
}: KanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `column-${column.id}`, data: { type: 'column', column } });

  const { setNodeRef: setDroppableRef } = useDroppable({ id: `droppable-${column.id}`, data: { type: 'column', column } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sessionIds = sessions.map((s) => s.id);

  return (
    <div
      ref={setSortableRef}
      style={style}
      {...attributes}
      className={`group/col flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 ${isDragging ? 'opacity-50' : ''}`}
    >
      <KanbanColumnHeader
        column={column}
        sessionCount={sessions.length}
        dragHandleProps={listeners}
        onRename={onRenameColumn}
        onDelete={onDeleteColumn}
      />

      <div
        ref={setDroppableRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-2"
        style={{ minHeight: '100px' }}
      >
        <SortableContext items={sessionIds} strategy={verticalListSortingStrategy}>
          {sessions.map((session) => (
            <KanbanSessionCard
              key={session.id}
              session={session}
              note={getNoteForSession(session.id)}
              sessionLabels={getLabelsForSession(session.id)}
              allLabels={allLabels}
              currentTime={currentTime}
              onSessionClick={onSessionClick}
              onNoteChange={onNoteChange}
              onToggleLabel={onToggleLabel}
              onCreateLabel={onCreateLabel}
              onEditLabel={onEditLabel}
              onDeleteLabel={onDeleteLabel}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/session-kanban/view/subcomponents/KanbanColumnHeader.tsx \
        src/components/session-kanban/view/subcomponents/KanbanColumn.tsx
git commit -m "feat(kanban): add KanbanColumn and KanbanColumnHeader components"
```

---

### Task 11: UI components — KanbanBoard (DndContext wrapper)

**Files:**
- Create: `src/components/session-kanban/view/subcomponents/KanbanBoard.tsx`

- [ ] **Step 1: Create KanbanBoard**

```tsx
import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { ProjectSession } from '../../../../types/app';
import type { KanbanColumn as KanbanColumnType, SessionLabel } from '../../types/kanban';
import KanbanColumn from './KanbanColumn';
import AddColumnButton from './AddColumnButton';

type KanbanBoardProps = {
  columns: KanbanColumnType[];
  sessionsByColumn: Map<number, { session: ProjectSession; position: number }[]>;
  labels: SessionLabel[];
  currentTime: Date;
  getNoteForSession: (sessionId: string) => string;
  getLabelsForSession: (sessionId: string) => SessionLabel[];
  onAddColumn: (name: string) => void;
  onRenameColumn: (columnId: number, name: string) => void;
  onDeleteColumn: (columnId: number) => void;
  onMoveColumn: (columnIds: number[]) => void;
  onMoveSession: (sessionId: string, columnId: number, position: number) => void;
  onSessionClick: (session: ProjectSession) => void;
  onNoteChange: (sessionId: string, text: string) => void;
  onToggleLabel: (sessionId: string, labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
};

export default function KanbanBoard({
  columns,
  sessionsByColumn,
  labels,
  currentTime,
  getNoteForSession,
  getLabelsForSession,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  onMoveColumn,
  onMoveSession,
  onSessionClick,
  onNoteChange,
  onToggleLabel,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumnForSession = useCallback(
    (sessionId: string): number | undefined => {
      for (const [colId, items] of sessionsByColumn) {
        if (items.some((item) => item.session.id === sessionId)) return colId;
      }
      return undefined;
    },
    [sessionsByColumn],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Only handle session-to-column moves during dragOver
    if (activeData?.type === 'session' && overData?.type === 'column') {
      const activeColumnId = findColumnForSession(String(active.id));
      const overColumnId = overData.column.id;
      if (activeColumnId !== overColumnId) {
        onMoveSession(String(active.id), overColumnId, 0);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Column reorder
    if (activeData?.type === 'column' && overData?.type === 'column') {
      const oldIndex = columns.findIndex((c) => `column-${c.id}` === String(active.id));
      const newIndex = columns.findIndex((c) => `column-${c.id}` === String(over.id));
      if (oldIndex !== newIndex) {
        const reordered = [...columns];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        onMoveColumn(reordered.map((c) => c.id));
      }
      return;
    }

    // Session reorder within or across columns
    if (activeData?.type === 'session') {
      const overColumnId =
        overData?.type === 'column'
          ? overData.column.id
          : findColumnForSession(String(over.id));

      if (overColumnId !== undefined) {
        const items = sessionsByColumn.get(overColumnId) || [];
        const overIndex = items.findIndex((item) => item.session.id === String(over.id));
        const position = overIndex >= 0 ? overIndex : items.length;
        onMoveSession(String(active.id), overColumnId, position);
      }
    }
  };

  const columnIds = columns.map((c) => `column-${c.id}`);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map((column) => {
            const items = sessionsByColumn.get(column.id) || [];
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                sessions={items.map((i) => i.session)}
                allLabels={labels}
                currentTime={currentTime}
                getNoteForSession={getNoteForSession}
                getLabelsForSession={getLabelsForSession}
                onRenameColumn={onRenameColumn}
                onDeleteColumn={onDeleteColumn}
                onSessionClick={onSessionClick}
                onNoteChange={onNoteChange}
                onToggleLabel={onToggleLabel}
                onCreateLabel={onCreateLabel}
                onEditLabel={onEditLabel}
                onDeleteLabel={onDeleteLabel}
              />
            );
          })}
        </SortableContext>

        <AddColumnButton onAdd={onAddColumn} />
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="rounded-lg border border-primary bg-card p-3 opacity-80 shadow-lg">
            <span className="text-sm text-muted-foreground">Trascinamento...</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session-kanban/view/subcomponents/KanbanBoard.tsx
git commit -m "feat(kanban): add KanbanBoard with DndContext and drag handlers"
```

---

### Task 12: Container component — SessionKanban + MainContent integration

**Files:**
- Create: `src/components/session-kanban/view/SessionKanban.tsx`
- Modify: `src/components/main-content/view/MainContent.tsx` (lines ~2, ~112-138)

- [ ] **Step 1: Create SessionKanban container**

```tsx
import { useState, useCallback, useMemo } from 'react';
import type { Project, ProjectSession } from '../../../types/app';
import { useKanbanState } from '../hooks/useKanbanState';
import KanbanBoard from './subcomponents/KanbanBoard';
import { Loader2 } from 'lucide-react';

type SessionKanbanProps = {
  project: Project;
  onSessionClick: (session: ProjectSession) => void;
};

export default function SessionKanban({ project, onSessionClick }: SessionKanbanProps) {
  const [currentTime] = useState(() => new Date());

  const allSessions = useMemo(() => {
    const sessions: ProjectSession[] = [];
    if (project.sessions) sessions.push(...project.sessions.map((s) => ({ ...s, __provider: 'claude' as const })));
    if (project.cursorSessions) sessions.push(...project.cursorSessions.map((s) => ({ ...s, __provider: 'cursor' as const })));
    if (project.codexSessions) sessions.push(...project.codexSessions.map((s) => ({ ...s, __provider: 'codex' as const })));
    if (project.geminiSessions) sessions.push(...project.geminiSessions.map((s) => ({ ...s, __provider: 'gemini' as const })));
    return sessions;
  }, [project.sessions, project.cursorSessions, project.codexSessions, project.geminiSessions]);

  const kanban = useKanbanState(project.name, allSessions);

  const handleSessionClick = useCallback(
    (session: ProjectSession) => {
      onSessionClick(session);
    },
    [onSessionClick],
  );

  if (kanban.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sessionsByColumn = kanban.getSessionsByColumn();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">Sessioni — {project.displayName || project.name}</h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          columns={kanban.columns}
          sessionsByColumn={sessionsByColumn}
          labels={kanban.labels}
          currentTime={currentTime}
          getNoteForSession={kanban.getNoteForSession}
          getLabelsForSession={kanban.getLabelsForSession}
          onAddColumn={kanban.addColumn}
          onRenameColumn={kanban.renameColumn}
          onDeleteColumn={kanban.removeColumn}
          onMoveColumn={kanban.moveColumn}
          onMoveSession={kanban.moveSession}
          onSessionClick={handleSessionClick}
          onNoteChange={kanban.setSessionNote}
          onToggleLabel={kanban.toggleSessionLabel}
          onCreateLabel={kanban.addLabel}
          onEditLabel={kanban.editLabel}
          onDeleteLabel={kanban.removeLabel}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify MainContent.tsx to show SessionKanban**

In `src/components/main-content/view/MainContent.tsx`:

Add import at line 2 (after ChatInterface import):

```typescript
import SessionKanban from '../../session-kanban/view/SessionKanban';
```

Replace lines 112-138 (the chat tab block) with:

```tsx
          <div className={`h-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
            <ErrorBoundary showDetails>
              {selectedSession ? (
                <ChatInterface
                  selectedProject={selectedProject}
                  selectedSession={selectedSession}
                  ws={ws}
                  sendMessage={sendMessage}
                  latestMessage={latestMessage}
                  onFileOpen={handleFileOpen}
                  onInputFocusChange={onInputFocusChange}
                  onSessionActive={onSessionActive}
                  onSessionInactive={onSessionInactive}
                  onSessionProcessing={onSessionProcessing}
                  onSessionNotProcessing={onSessionNotProcessing}
                  processingSessions={processingSessions}
                  onReplaceTemporarySession={onReplaceTemporarySession}
                  onNavigateToSession={onNavigateToSession}
                  onShowSettings={onShowSettings}
                  autoExpandTools={autoExpandTools}
                  showRawParameters={showRawParameters}
                  showThinking={showThinking}
                  autoScrollToBottom={autoScrollToBottom}
                  sendByCtrlEnter={sendByCtrlEnter}
                  externalMessageUpdate={externalMessageUpdate}
                  onShowAllTasks={tasksEnabled ? () => setActiveTab('tasks') : null}
                />
              ) : (
                <SessionKanban
                  project={selectedProject}
                  onSessionClick={(session) => {
                    onNavigateToSession(session.id);
                  }}
                />
              )}
            </ErrorBoundary>
          </div>
```

- [ ] **Step 3: Verify build**

```bash
cd /media/extra/Progetti/claudecodeui
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing ones)

- [ ] **Step 4: Commit**

```bash
git add src/components/session-kanban/view/SessionKanban.tsx \
        src/components/main-content/view/MainContent.tsx
git commit -m "feat(kanban): add SessionKanban container and integrate in MainContent"
```

---

### Task 13: Visual testing + bug fixes

**Files:** Various (fix any issues found)

- [ ] **Step 1: Start dev server**

```bash
cd /media/extra/Progetti/claudecodeui
npm run dev
```

- [ ] **Step 2: Open browser and test**

Navigate to the app URL. Select a project with sessions. Verify:
1. Kanban board appears instead of provider selection when no session is open
2. Default column "Tutte le sessioni" is created with all sessions
3. Cards show title, date, message count, provider icon
4. "+" button creates new columns
5. Cards can be dragged between columns
6. Columns can be reordered
7. Notes can be added/edited on cards
8. Labels can be created and assigned
9. Clicking a card opens the session chat
10. Returning from chat (deselecting session) shows kanban again with state preserved

- [ ] **Step 3: Fix any issues found**

Address any visual, functional, or TypeScript issues.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(kanban): address visual and functional issues from testing"
```

---

### Task 14: Final push to fork

- [ ] **Step 1: Push all commits to bwlab fork**

```bash
git push bwlab feature/session-kanban
```
