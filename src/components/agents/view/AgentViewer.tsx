import { useEffect, useState } from 'react';
import { Bot, FileText } from 'lucide-react';
import { authenticatedFetch } from '../../../utils/api';
import MarkdownPreview from '../../code-editor/view/subcomponents/markdown/MarkdownPreview';

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    const url = scope === 'global'
      ? `/api/project-agents/global/content?name=${encodeURIComponent(agentName)}`
      : `/api/project-agents/${encodeURIComponent(projectName ?? '')}/content?name=${encodeURIComponent(agentName)}`;

    authenticatedFetch(url)
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

    return () => {
      cancelled = true;
    };
  }, [scope, agentName, projectName]);

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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border/40 bg-muted/30 px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="border-[color:var(--heritage-a,#F5D000)]/50 bg-[color:var(--heritage-a,#F5D000)]/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
            <Bot className="h-5 w-5 text-[color:var(--heritage-a,#F5D000)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold">{frontmatter.name || data.name}</h1>
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {scope === 'global' ? 'globale' : 'progetto'}
              </span>
            </div>
            {frontmatter.description && (
              <p className="mt-1 text-sm text-muted-foreground">{frontmatter.description}</p>
            )}
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {frontmatter.model && (
                <div className="flex gap-1">
                  <dt className="font-semibold">model:</dt>
                  <dd>{frontmatter.model}</dd>
                </div>
              )}
              {frontmatter.tools && (
                <div className="flex gap-1">
                  <dt className="font-semibold">tools:</dt>
                  <dd className="truncate">{frontmatter.tools}</dd>
                </div>
              )}
              {filePath && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <dd className="truncate font-mono">{filePath}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </header>
      <div className="prose prose-sm dark:prose-invert max-w-none px-6 py-5">
        <MarkdownPreview content={body} />
      </div>
    </div>
  );
}
