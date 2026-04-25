import { useEffect, useMemo, useState } from 'react';
import { Brain, FileText, ChevronLeft } from 'lucide-react';
import { authenticatedFetch } from '../../../utils/api';
import MarkdownPreview from '../../code-editor/view/subcomponents/markdown/MarkdownPreview';

export interface MemoryPanelProps {
  projectName: string;
}

interface MemoryFile {
  name: string;
  fileName: string;
  title: string;
  description: string | null;
  type: string | null;
}

interface MemoryIndex {
  exists: boolean;
  content: string | null;
  files: MemoryFile[];
}

interface MemoryFileContent {
  name: string;
  frontmatter: Record<string, string>;
  body: string;
  filePath: string;
}

export default function MemoryPanel({ projectName }: MemoryPanelProps) {
  const [index, setIndex] = useState<MemoryIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);

  const [selected, setSelected] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<MemoryFileContent | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIndexLoading(true);
    setIndexError(null);
    setIndex(null);
    setSelected(null);
    setFileContent(null);
    setFileError(null);

    authenticatedFetch(`/api/project-memory/${encodeURIComponent(projectName)}/index`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setIndex({ exists: !!json.exists, content: json.content ?? null, files: json.files ?? [] });
      })
      .catch((err) => {
        if (cancelled) return;
        setIndexError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIndexLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectName]);

  useEffect(() => {
    if (!selected) { setFileContent(null); return; }
    let cancelled = false;
    setFileLoading(true);
    setFileError(null);
    setFileContent(null);

    authenticatedFetch(
      `/api/project-memory/${encodeURIComponent(projectName)}/file?name=${encodeURIComponent(selected)}`
    )
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setFileContent({
          name: json.name,
          frontmatter: json.frontmatter || {},
          body: json.body || '',
          filePath: json.filePath,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setFileError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectName, selected]);

  const header = (
    <header className="border-b border-border/40 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2">
        {selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="hover:bg-muted/60 -ml-1 flex h-7 w-7 items-center justify-center rounded"
            title="Torna all'indice"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : (
          <Brain className="h-4 w-4 text-[color:var(--heritage-a,#F5D000)]" />
        )}
        <h2 className="text-sm font-semibold">
          {selected ? (fileContent?.frontmatter.name || selected) : 'Memoria progetto'}
        </h2>
      </div>
      {selected && fileContent?.frontmatter.description && (
        <p className="mt-1 text-xs text-muted-foreground">{fileContent.frontmatter.description}</p>
      )}
    </header>
  );

  const indexBody = useMemo(() => {
    if (indexLoading) return <div className="p-4 text-sm text-muted-foreground">Caricamento memoria…</div>;
    if (indexError) {
      return <div className="p-4 text-sm text-[color:var(--heritage-b,#E30613)]">Errore: {indexError}</div>;
    }
    if (!index || !index.exists) {
      return <div className="p-4 text-sm text-muted-foreground">Nessuna memoria registrata per questo progetto.</div>;
    }
    return (
      <div className="flex flex-col gap-4 p-4">
        {index.content && (
          <section>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownPreview content={index.content} />
            </div>
          </section>
        )}
        {index.files.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">File</h3>
            <ul className="flex flex-col gap-1">
              {index.files.map((f) => (
                <li key={f.fileName}>
                  <button
                    type="button"
                    onClick={() => setSelected(f.name)}
                    className="hover:bg-muted/60 group flex w-full items-start gap-2 rounded px-2 py-1.5 text-left"
                  >
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.title}</div>
                      {f.description && (
                        <div className="truncate text-xs text-muted-foreground">{f.description}</div>
                      )}
                    </div>
                    {f.type && (
                      <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {f.type}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }, [indexLoading, indexError, index]);

  const fileBody = useMemo(() => {
    if (fileLoading) return <div className="p-4 text-sm text-muted-foreground">Caricamento file…</div>;
    if (fileError) {
      return <div className="p-4 text-sm text-[color:var(--heritage-b,#E30613)]">Errore: {fileError}</div>;
    }
    if (!fileContent) return null;
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none p-4">
        <MarkdownPreview content={fileContent.body} />
      </div>
    );
  }, [fileLoading, fileError, fileContent]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border/40 bg-background">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected ? fileBody : indexBody}
      </div>
    </div>
  );
}
