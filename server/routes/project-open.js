import express from 'express';
import fs from 'fs';
import { spawn } from 'child_process';
import { extractProjectDirectory } from '../projects.js';
import { appConfigDb } from '../database/db.js';

const router = express.Router();

const DEFAULT_IDE_COMMAND = 'code';

// GET /api/project-open/config/ide
router.get('/config/ide', (_req, res) => {
  const stored = appConfigDb.get('ide_command');
  res.json({ success: true, command: stored || DEFAULT_IDE_COMMAND, defaultCommand: DEFAULT_IDE_COMMAND });
});

// PUT /api/project-open/config/ide
router.put('/config/ide', (req, res) => {
  try {
    const { command } = req.body || {};
    if (typeof command !== 'string' || !command.trim()) {
      return res.status(400).json({ error: 'command is required' });
    }
    appConfigDb.set('ide_command', command.trim());
    res.json({ success: true, command: command.trim() });
  } catch (error) {
    console.error('Error saving ide command:', error);
    res.status(500).json({ error: 'Failed to save ide command' });
  }
});

// POST /api/project-open/:projectName/in-file-manager
router.post('/:projectName/in-file-manager', async (req, res) => {
  try {
    const cwd = await extractProjectDirectory(req.params.projectName);
    if (!cwd || !fs.existsSync(cwd)) {
      return res.status(404).json({ error: 'Project path not found' });
    }

    const platform = process.platform;
    let command;
    let args;

    if (platform === 'darwin') {
      command = 'open';
      args = [cwd];
    } else if (platform === 'win32') {
      command = 'explorer';
      args = [cwd];
    } else {
      // Linux / *nix — xdg-open is the cross-DE launcher that respects the user's preferred file manager
      command = 'xdg-open';
      args = [cwd];
    }

    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      child.on('error', (err) => console.error('File manager spawn error:', err));
      child.unref();
    } catch (err) {
      return res.status(500).json({ error: `Failed to launch ${command}: ${err?.message || err}` });
    }

    res.json({ success: true, platform, command, path: cwd });
  } catch (error) {
    console.error('Error opening project in file manager:', error);
    res.status(500).json({ error: 'Failed to open file manager' });
  }
});

// POST /api/project-open/:projectName/in-ide
router.post('/:projectName/in-ide', async (req, res) => {
  try {
    const cwd = await extractProjectDirectory(req.params.projectName);
    if (!cwd || !fs.existsSync(cwd)) {
      return res.status(404).json({ error: 'Project path not found' });
    }

    const storedCommand = appConfigDb.get('ide_command') || DEFAULT_IDE_COMMAND;
    // Support composite command with extra args like "phpstorm --line 1"
    const parts = storedCommand.split(/\s+/).filter(Boolean);
    const command = parts[0];
    const extraArgs = parts.slice(1);

    try {
      const child = spawn(command, [...extraArgs, cwd], { detached: true, stdio: 'ignore' });
      child.on('error', (err) => console.error('IDE spawn error:', err));
      child.unref();
    } catch (err) {
      return res.status(500).json({ error: `Failed to launch ${command}: ${err?.message || err}` });
    }

    res.json({ success: true, command, path: cwd });
  } catch (error) {
    console.error('Error opening project in IDE:', error);
    res.status(500).json({ error: 'Failed to open IDE' });
  }
});

// POST /api/project-open/:projectName/in-terminal
router.post('/:projectName/in-terminal', async (req, res) => {
  try {
    const cwd = await extractProjectDirectory(req.params.projectName);
    if (!cwd || !fs.existsSync(cwd)) {
      return res.status(404).json({ error: 'Project path not found' });
    }

    const platform = process.platform;
    let command;
    let args = [];

    if (platform === 'darwin') {
      command = 'open';
      args = ['-a', 'Terminal', cwd];
    } else if (platform === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', 'cmd', '/K', `cd /d "${cwd}"`];
    } else {
      // Linux — try common terminals in order
      const candidates = [
        { cmd: 'gnome-terminal', buildArgs: (d) => ['--working-directory', d] },
        { cmd: 'konsole', buildArgs: (d) => ['--workdir', d] },
        { cmd: 'xfce4-terminal', buildArgs: (d) => ['--working-directory', d] },
        { cmd: 'tilix', buildArgs: (d) => ['--working-directory', d] },
        { cmd: 'alacritty', buildArgs: (d) => ['--working-directory', d] },
        { cmd: 'kitty', buildArgs: (d) => ['--directory', d] },
        { cmd: 'xterm', buildArgs: (d) => ['-e', `cd "${d}" && bash`] },
      ];
      let chosen = null;
      for (const c of candidates) {
        try {
          const { spawnSync } = await import('child_process');
          const which = spawnSync('which', [c.cmd]);
          if (which.status === 0) {
            chosen = { cmd: c.cmd, args: c.buildArgs(cwd) };
            break;
          }
        } catch { /* continue */ }
      }
      if (!chosen) return res.status(500).json({ error: 'Nessun terminale trovato' });
      command = chosen.cmd;
      args = chosen.args;
    }

    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      child.on('error', (err) => console.error('Terminal spawn error:', err));
      child.unref();
    } catch (err) {
      return res.status(500).json({ error: `Failed to launch ${command}: ${err?.message || err}` });
    }

    res.json({ success: true, platform, command, path: cwd });
  } catch (error) {
    console.error('Error opening project in terminal:', error);
    res.status(500).json({ error: 'Failed to open terminal' });
  }
});

export default router;
