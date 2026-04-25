import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { NAME_RE, parseFrontmatter, safeFileInDir } from '../utils/markdown-files.js';

const router = express.Router();

const PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');
const PROJECT_NAME_RE = /^[a-zA-Z0-9._-]+$/;
const INDEX_FILENAME = 'MEMORY.md';

function resolveMemoryDir(projectName) {
  if (typeof projectName !== 'string' || !PROJECT_NAME_RE.test(projectName)) return null;
  const candidate = path.join(PROJECTS_ROOT, projectName, 'memory');
  const resolved = path.resolve(candidate);
  const resolvedRoot = path.resolve(PROJECTS_ROOT);
  if (!resolved.startsWith(resolvedRoot + path.sep)) return null;
  return resolved;
}

function listMemoryFiles(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name === INDEX_FILENAME) continue;
    const fileName = entry.name;
    const name = fileName.replace(/\.md$/, '');
    if (!NAME_RE.test(name)) continue;
    const filePath = path.join(baseDir, fileName);
    let frontmatter = {};
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      ({ frontmatter } = parseFrontmatter(raw));
    } catch { /* skip unreadable */ }
    out.push({
      name,
      fileName,
      title: frontmatter.name || name,
      description: frontmatter.description || null,
      type: frontmatter.type || null,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// GET /api/project-memory/:projectName/index
router.get('/:projectName/index', (req, res) => {
  try {
    const baseDir = resolveMemoryDir(req.params.projectName);
    if (!baseDir) return res.status(400).json({ error: 'Invalid project name' });
    if (!fs.existsSync(baseDir)) {
      return res.json({ success: true, exists: false, dir: baseDir, content: null, files: [] });
    }
    const indexPath = path.join(baseDir, INDEX_FILENAME);
    let content = null;
    if (fs.existsSync(indexPath)) {
      try { content = fs.readFileSync(indexPath, 'utf8'); } catch { /* leave null */ }
    }
    const files = listMemoryFiles(baseDir);
    res.json({ success: true, exists: true, dir: baseDir, content, files });
  } catch (error) {
    console.error('Error reading project memory index:', error);
    res.status(500).json({ error: 'Failed to read project memory' });
  }
});

// GET /api/project-memory/:projectName/file?name=<name>
router.get('/:projectName/file', (req, res) => {
  try {
    const baseDir = resolveMemoryDir(req.params.projectName);
    if (!baseDir) return res.status(400).json({ error: 'Invalid project name' });
    if (!fs.existsSync(baseDir)) return res.status(404).json({ error: 'No memory directory for project' });
    const { name } = req.query;
    const filePath = safeFileInDir(baseDir, name);
    if (!filePath) return res.status(400).json({ error: 'Invalid or missing memory file name' });
    const raw = fs.readFileSync(filePath, 'utf8');
    const { frontmatter, body } = parseFrontmatter(raw);
    res.json({ success: true, name, frontmatter, body, filePath });
  } catch (error) {
    console.error('Error reading project memory file:', error);
    res.status(500).json({ error: 'Failed to read memory file' });
  }
});

export default router;
