import { useEffect, useState } from 'react';
import { Bot, FileText, Brain, Pencil, Save, X, ExternalLink } from 'lucide-react';
import { authenticatedFetch } from '../../../utils/api';
import MarkdownPreview from '../../code-editor/view/subcomponents/markdown/MarkdownPreview';
import MemoryPanel from './MemoryPanel';

export interface AgentViewerProps {
  scope: 'global' | 'project';
  agentName: string;
  projectName?: string;
}

interface AgentContent {
  name: string;
  frontmatter: Record<string, string>;
  body: string;
  filePath: string;
}

export default function AgentViewer({ scope, agentName, projectName }: AgentViewerProps) {
  const [data, setData] = useState<AgentContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMemory, setShowMemory] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [openingFile, setOpeningFile] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const canShowMemory = scope === 'project' && !!projectName;
  const contentUrl = scope === 'global'
    ? `/api/project-agents/global/content?name=${encodeURIComponent(agentName)}`
    : `/api/project-agents/${encodeURIComponent(projectName ?? '')}/content?name=${encodeURIComponent(agentName)}`;
  const saveUrl = scope === 'global'
    ? `/api/project-agents/global/content`
    : `/api/project-agents/${encodeURIComponent(projectName ?? '')}/content`;

  useEffect(() => {
    if (!canShowMemory && showMemory) setShowMemory(false);
  }, [canShowMemory, showMemory]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setEditing(false);
    setDraft('');
    setSaveError(null);
    setOpenError(null);
    setRevealError(null);

    authenticatedFetch(contentUrl)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setData({
          name: json.name,
          frontmatter: json.frontmatter || {},
          body: json.body || '',
          filePath: json.filePath,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [contentUrl]);

  function startEdit() {
    if (!data) return;
    setDraft(data.body);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft('');
    setSaveError(null);
  }

  async function saveEdit() {
    if (!data) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authenticatedFetch(saveUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agentName, body: draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData({
        name: json.name,
        frontmatter: json.frontmatter || {},
        body: json.body || '',
        filePath: json.filePath,
      });
      setEditing(false);
      setDraft('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function openInEditor() {
    if (!data) return;
    setOpeningFile(true);
    setOpenError(null);
    try {
      const res = await authenticatedFetch('/api/project-open/file-in-ide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: data.filePath, projectName: scope === 'project' ? projectName : undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpeningFile(false);
    }
  }

  async function revealInFileManager() {
    if (!data) return;
    setRevealing(true);
    setRevealError(null);
    try {
      const res = await authenticatedFetch('/api/project-open/file-in-file-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: data.filePath, projectName: scope === 'project' ? projectName : undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevealing(false);
    }
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">Caricamento agente…</div>;
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-[color:var(--heritage-b,#E30613)]">
        Errore: {error}
      </div>
    );
  }
  if (!data) return null;

  const { frontmatter, body, filePath } = data;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="border-b border-border/40 bg-muted/30 px-6 py-3">
        <div className="flex items-start gap-3">
          <div className="border-[color:var(--heritage-a,#F5D000)]/50 bg-[color:var(--heritage-a,#F5D000)]/10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
            <Bot className="h-4 w-4 text-[color:var(--heritage-a,#F5D000)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
                {frontmatter.name || data.name}
              </h1>
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {scope === 'global' ? 'globale' : 'progetto'}
              </span>
            </div>
            <dl className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {frontmatter.model && (
                <div className="flex gap-1">
                  <dt className="font-semibold">model:</dt>
                  <dd>{frontmatter.model}</dd>
                </div>
              )}
              {filePath && (
                <button
                  type="button"
                  onClick={revealInFileManager}
                  disabled={revealing}
                  className="hover:text-foreground inline-flex min-w-0 items-center gap-1 font-mono underline-offset-2 hover:underline disabled:opacity-50"
                  title="Apri cartella nell'esplora risorse del sistema"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{filePath}</span>
                </button>
              )}
            </dl>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!editing && (
              <button
                type="button"
                onClick={startEdit}
                className="hover:bg-muted/60 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors"
                title="Modifica testo agente"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifica
              </button>
            )}
            {editing && (
              <>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="border-[color:var(--heritage-a,#F5D000)]/60 bg-[color:var(--heritage-a,#F5D000)]/20 hover:bg-[color:var(--heritage-a,#F5D000)]/30 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                  title="Salva modifiche"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Salvataggio…' : 'Salva'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="hover:bg-muted/60 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors disabled:opacity-50"
                  title="Annulla modifiche"
                >
                  <X className="h-3.5 w-3.5" />
                  Annulla
                </button>
              </>
            )}
            <button
              type="button"
              onClick={openInEditor}
              disabled={openingFile}
              className="hover:bg-muted/60 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors disabled:opacity-50"
              title="Apri file con editor esterno (IDE configurato)"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Apri
            </button>
            {canShowMemory && (
              <button
                type="button"
                onClick={() => setShowMemory((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                  showMemory
                    ? 'border-[color:var(--heritage-a,#F5D000)]/60 bg-[color:var(--heritage-a,#F5D000)]/10 text-foreground'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/60'
                }`}
                title={showMemory ? 'Nascondi memoria progetto' : 'Mostra memoria progetto'}
                aria-pressed={showMemory}
              >
                <Brain className="h-3.5 w-3.5" />
                Memoria
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {(frontmatter.description || frontmatter.tools || openError || revealError || saveError) && (
            <section className="border-b border-border/40 bg-muted/10 px-6 py-4">
              {frontmatter.description && (
                <p className="text-sm text-muted-foreground">{frontmatter.description}</p>
              )}
              {frontmatter.tools && (
                <dl className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-1">
                    <dt className="font-semibold">tools:</dt>
                    <dd className="truncate">{frontmatter.tools}</dd>
                  </div>
                </dl>
              )}
              {openError && (
                <p className="mt-2 text-xs text-[color:var(--heritage-b,#E30613)]">Apertura editor: {openError}</p>
              )}
              {revealError && (
                <p className="mt-2 text-xs text-[color:var(--heritage-b,#E30613)]">Apertura cartella: {revealError}</p>
              )}
              {saveError && (
                <p className="mt-2 text-xs text-[color:var(--heritage-b,#E30613)]">Salvataggio: {saveError}</p>
              )}
            </section>
          )}
          {editing ? (
            <div className="flex flex-1 flex-col px-6 py-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                className="border-border/60 bg-background min-h-[20rem] flex-1 resize-y rounded-md border p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--heritage-a,#F5D000)]/50"
              />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none px-6 py-5">
              <MarkdownPreview content={body} />
            </div>
          )}
        </div>
        {showMemory && canShowMemory && (
          <div className="flex w-[28rem] min-w-[20rem] shrink-0">
            <MemoryPanel projectName={projectName!} />
          </div>
        )}
      </div>
    </div>
  );
}
