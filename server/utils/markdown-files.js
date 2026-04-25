import path from 'path';
import fs from 'fs';

export const NAME_RE = /^[a-zA-Z0-9_-]+$/;

export function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fm[kv[1]] = value;
  }
  return { frontmatter: fm, body: m[2] };
}

export function splitRawFrontmatter(raw) {
  const m = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
  if (!m) return { frontmatterRaw: '', body: raw };
  return { frontmatterRaw: m[1], body: m[2] };
}

export function safeFileInDir(baseDir, rawName, { extension = '.md', nameRe = NAME_RE } = {}) {
  if (typeof rawName !== 'string' || !nameRe.test(rawName)) return null;
  const filePath = path.join(baseDir, `${rawName}${extension}`);
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) return null;
  if (!fs.existsSync(resolved)) return null;
  try {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) {
      const realTarget = fs.realpathSync(resolved);
      if (!realTarget.startsWith(resolvedBase + path.sep)) return null;
    }
  } catch { return null; }
  return resolved;
}
