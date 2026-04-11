# Session Kanban View

## Obiettivo

Fornire una vista Kanban delle sessioni a livello di progetto nella main content area. Quando un progetto è selezionato ma nessuna sessione è aperta, al posto della schermata "Choose Your AI Assistant" l'utente vede una board Kanban con le sessioni come card, organizzabili in colonne personalizzabili tramite drag & drop.

## Comportamento

### Attivazione

La vista Kanban appare nella main content area quando:
- Un progetto è selezionato nella sidebar
- Nessuna sessione è attualmente aperta

Cliccando su una card sessione si apre la chat di quella sessione (comportamento identico al click nella sidebar).

### Colonne

- Al primo accesso a un progetto, viene creata automaticamente una colonna **"Tutte le sessioni"** contenente tutte le sessioni esistenti.
- L'utente può:
  - **Creare** nuove colonne (bottone "+" a destra dell'ultima colonna)
  - **Rinominare** una colonna (click sul titolo o icona edit)
  - **Eliminare** una colonna (le sessioni tornano in "Tutte le sessioni")
  - **Riordinare** le colonne tramite drag & drop dell'header
- Le sessioni non assegnate a nessuna colonna finiscono automaticamente in "Tutte le sessioni" (incluse le sessioni create dopo il setup iniziale della board).
- La colonna "Tutte le sessioni" (flag `is_default`) non è eliminabile ma è rinominabile.

### Card sessione

Ogni card mostra:

| Campo | Fonte | Note |
|-------|-------|------|
| Titolo | session.summary | Troncato con ellipsis se lungo |
| Data | session.timestamp | Formato relativo (es. "3 min fa") |
| Messaggi | session.messageCount | Badge numerico |
| Provider | session.__provider | Icona (Claude, Cursor, Codex, Gemini) |
| Stato | session attiva/completata/errore | Indicatore visuale |
| Note | Nuovo campo | Testo libero, editabile inline sulla card |
| Etichette | Nuovo campo | Tag colorati, selezionabili da un pool per progetto |

### Drag & drop

- Le card sessione sono trascinabili tra colonne.
- Le card sono riordinabili all'interno della stessa colonna.
- Le colonne sono riordinabili tramite drag del loro header.
- Libreria: `@dnd-kit/core` + `@dnd-kit/sortable`.

### Etichette

- Ogni progetto ha un pool di etichette condivise tra le sessioni.
- Un'etichetta ha: `name` (stringa) e `color` (hex o preset palette).
- L'utente può creare/modificare/eliminare etichette dal pool del progetto.
- Ogni sessione può avere zero o più etichette assegnate.
- Le etichette appaiono come chip colorati sulla card.

### Note

- Campo testo libero associato a una sessione.
- Editabile con click diretto sulla card (inline) o tramite un popover/modal.
- Nessun limite di lunghezza, ma sulla card viene troncato a 2-3 righe con expand.

## Architettura

### Nuovi componenti

```
src/components/session-kanban/
  view/
    SessionKanban.tsx              # Container principale
    subcomponents/
      KanbanBoard.tsx              # Board con colonne, gestisce dnd context
      KanbanColumn.tsx             # Singola colonna (header + lista card)
      KanbanColumnHeader.tsx       # Titolo colonna, azioni (rename, delete), drag handle
      KanbanSessionCard.tsx        # Card sessione con info, note, etichette
      AddColumnButton.tsx          # Bottone "+" per nuova colonna
      SessionNoteEditor.tsx        # Editor inline/popover per le note
      LabelManager.tsx             # UI per creare/assegnare etichette
      LabelChip.tsx                # Singolo chip etichetta colorato
  hooks/
    useKanbanState.ts              # Stato locale board: colonne, posizioni, drag
    useSessionKanbanApi.ts         # CRUD verso API server (colonne, note, etichette)
  types/
    kanban.ts                      # Tipi TypeScript
```

### Integrazione in MainContent

In `MainContent.tsx`, quando `activeTab === 'chat'` e nessuna sessione è selezionata, renderizzare `<SessionKanban>` invece di `<ChatInterface>` con la schermata provider.

```tsx
{activeTab === 'chat' && !selectedSession && <SessionKanban project={selectedProject} />}
{activeTab === 'chat' && selectedSession && <ChatInterface ... />}
```

### Tipi

```typescript
interface KanbanColumn {
  id: number;
  projectName: string;
  name: string;
  position: number;
}

interface KanbanSessionAssignment {
  sessionId: string;
  columnId: number;
  position: number;
}

interface SessionNote {
  sessionId: string;
  projectName: string;
  text: string;
  updatedAt: string;
}

interface SessionLabel {
  id: number;
  projectName: string;
  name: string;
  color: string;
}

interface SessionLabelAssignment {
  sessionId: string;
  labelId: number;
}
```

## Persistenza

### Nuove tabelle SQLite (auth.db)

```sql
CREATE TABLE kanban_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_kanban_columns_project ON kanban_columns(project_name);

CREATE TABLE kanban_session_assignments (
  session_id TEXT NOT NULL,
  column_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id),
  FOREIGN KEY (column_id) REFERENCES kanban_columns(id) ON DELETE CASCADE
);

CREATE TABLE session_notes (
  session_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  note_text TEXT NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, project_name)
);

CREATE TABLE session_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  label_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_session_labels_project ON session_labels(project_name);

CREATE TABLE session_label_assignments (
  session_id TEXT NOT NULL,
  label_id INTEGER NOT NULL,
  PRIMARY KEY (session_id, label_id),
  FOREIGN KEY (label_id) REFERENCES session_labels(id) ON DELETE CASCADE
);
```

### Nuove API server

```
GET    /api/kanban/:projectName/board          # Colonne + assegnazioni + note + etichette
POST   /api/kanban/:projectName/columns        # Crea colonna
PUT    /api/kanban/:projectName/columns/:id    # Rinomina/riordina colonna
DELETE /api/kanban/:projectName/columns/:id    # Elimina colonna

PUT    /api/kanban/sessions/:sessionId/assign  # Assegna sessione a colonna + posizione
PUT    /api/kanban/sessions/:sessionId/note    # Aggiorna nota sessione
POST   /api/kanban/sessions/:sessionId/labels  # Assegna etichetta a sessione
DELETE /api/kanban/sessions/:sessionId/labels/:labelId  # Rimuovi etichetta

POST   /api/kanban/:projectName/labels         # Crea etichetta nel pool progetto
PUT    /api/kanban/:projectName/labels/:id     # Modifica etichetta
DELETE /api/kanban/:projectName/labels/:id     # Elimina etichetta
```

Route file: `server/routes/kanban.js`

### Nuovi DB operations

File: `server/database/db.js` — nuovo export `kanbanDb` con metodi per CRUD colonne, assegnazioni, note, etichette.

## Migrazione

Le tabelle vengono create nella funzione `runMigrations()` in `server/database/db.js`, seguendo il pattern esistente con `CREATE TABLE IF NOT EXISTS`.

## Stile

- Coerente con il design system esistente (Tailwind CSS, variabili CSS del tema).
- Card con bordo e ombra leggera, hover state visibile.
- Colonne con sfondo leggermente diverso dal background principale.
- Drag placeholder visibile durante il trascinamento.
- Responsive: su schermi piccoli le colonne scrollano orizzontalmente.

## Dipendenze

- `@dnd-kit/core` — gestione drag & drop
- `@dnd-kit/sortable` — sorting nelle liste
- `@dnd-kit/utilities` — utility CSS transform

Nessun'altra dipendenza esterna richiesta.

## Fuori scope

- Filtri o ricerca all'interno della Kanban (iterazione futura).
- Assegnazione automatica a colonne basata su regole.
- Sincronizzazione real-time multi-utente (sistema single-user).
- Export/import della configurazione Kanban.
