import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import { extractProjectDirectory } from '../projects.js';
import { appConfigDb } from '../database/db.js';

const router = express.Router();

const DEFAULT_IDE_COMMAND = 'code';

function detectLinuxTerminal() {
  // 1. User preference from DB
  const stored = appConfigDb.get('terminal_command');
  if (stored) return stored.trim();
  // 2. $TERMINAL env var
  if (process.env.TERMINAL) return process.env.TERMINAL;
  // 3. Debian/Ubuntu alternatives system
  try {
    const w = spawnSync('which', ['x-terminal-emulator']);
    if (w.status === 0) return 'x-terminal-emulator';
  } catch { /* ignore */ }
  // 4. Detection list
  const candidates = ['tilix', 'konsole', 'xfce4-terminal', 'alacritty', 'kitty', 'gnome-terminal', 'xterm'];
  for (const c of candidates) {
    try {
      const w = spawnSync('which', [c]);
      if (w.status === 0) return c;
    } catch { /* continue */ }
  }
  return null;
}

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

// GET /api/project-open/config/terminal
router.get('/config/terminal', (_req, res) => {
  const stored = appConfigDb.get('terminal_command');
  res.json({ success: true, command: stored || '' });
});

// PUT /api/project-open/config/terminal (accept empty string to reset to auto-detect)
router.put('/config/terminal', (req, res) => {
  try {
    const { command } = req.body || {};
    if (typeof command !== 'string') {
      return res.status(400).json({ error: 'command must be a string' });
    }
    appConfigDb.set('terminal_command', command.trim());
    res.json({ success: true, command: command.trim() });
  } catch (error) {
    console.error('Error saving terminal command:', error);
    res.status(500).json({ error: 'Failed to save terminal command' });
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

function buildClaudeCommand(options = {}) {
  const parts = ['claude'];
  const { resume, continueSession, permissionMode, model, verbose, debug } = options;

  if (continueSession) {
    parts.push('--continue');
  } else if (resume) {
    // Safely escape the session id (should be a UUID, no shell metachars but safe anyway)
    parts.push('--resume', JSON.stringify(resume));
  }

  if (permissionMode) {
    if (permissionMode === 'bypassPermissions') {
      parts.push('--dangerously-skip-permissions');
    } else if (permissionMode !== 'default') {
      parts.push('--permission-mode', permissionMode);
    }
  }

  if (model) parts.push('--model', JSON.stringify(model));
  if (verbose) parts.push('--verbose');
  if (debug) parts.push('--debug');

  return parts.join(' ');
}

/**
 * Writes a wrapper shell script that runs the claude command as a login shell
 * (so PATH from ~/.zshrc / ~/.bashrc is loaded), then keeps the terminal open.
 * Returns the absolute path of the script.
 */
function writeClaudeLauncherScript(cwd, claudeCmd) {
  const userShell = process.env.SHELL || '/bin/bash';
  const scriptPath = path.join(os.tmpdir(), `cloudcli-claude-${crypto.randomBytes(6).toString('hex')}.sh`);
  // Use #!/bin/bash to spawn the user's shell as a login shell via exec.
  // The inner command is passed to the user shell with -l so .zshrc/.bashrc are sourced.
  const escaped = claudeCmd.replace(/"/g, '\\"');
  const content = `#!/bin/bash
# Auto-generated by CloudCLI — launches claude with the user's login shell
cd ${JSON.stringify(cwd)}
exec "${userShell}" -l -c "${escaped}; exec \\"${userShell}\\""
`;
  fs.writeFileSync(scriptPath, content, { mode: 0o755 });
  // Best-effort auto-cleanup after 60s
  setTimeout(() => { try { fs.unlinkSync(scriptPath); } catch { /* ignore */ } }, 60000);
  return scriptPath;
}

/**
 * Returns argv for launching <terminalCmd> at <cwd> running the given <scriptPath>.
 * The script handles login shell / PATH / keep-open by itself, so we just need
 * each terminal's flag to run an executable without extra quoting gymnastics.
 */
function buildLinuxTerminalArgsForScript(terminalCmd, cwd, scriptPath) {
  switch (terminalCmd) {
    case 'gnome-terminal':
      return ['--working-directory', cwd, '--', scriptPath];
    case 'konsole':
      return ['--workdir', cwd, '-e', scriptPath];
    case 'xfce4-terminal':
      return ['--working-directory', cwd, '-x', scriptPath];
    case 'tilix':
      return ['--working-directory', cwd, '-e', scriptPath];
    case 'alacritty':
      return ['--working-directory', cwd, '-e', scriptPath];
    case 'kitty':
      return ['--directory', cwd, scriptPath];
    case 'xterm':
      return ['-e', scriptPath];
    default:
      // x-terminal-emulator fallback: most accept -e with a single command
      return ['-e', scriptPath];
  }
}


// POST /api/project-open/:projectName/in-terminal-with-claude — body: { resume, continueSession, permissionMode, model, verbose, debug }
router.post('/:projectName/in-terminal-with-claude', async (req, res) => {
  try {
    const cwd = await extractProjectDirectory(req.params.projectName);
    if (!cwd || !fs.existsSync(cwd)) {
      return res.status(404).json({ error: 'Project path not found' });
    }

    const claudeCmd = buildClaudeCommand(req.body || {});
    const platform = process.platform;

    if (platform === 'darwin') {
      // Use osascript to open a new Terminal.app window with the command
      const script = `tell application "Terminal" to do script "cd ${JSON.stringify(cwd).replace(/"/g, '\\"')} && ${claudeCmd.replace(/"/g, '\\"')}"`;
      const child = spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' });
      child.on('error', (err) => console.error('osascript error:', err));
      child.unref();
      return res.json({ success: true, platform, command: claudeCmd, path: cwd });
    }

    if (platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', 'cmd', '/K', `cd /d "${cwd}" && ${claudeCmd}`], { detached: true, stdio: 'ignore' });
      child.on('error', (err) => console.error('cmd error:', err));
      child.unref();
      return res.json({ success: true, platform, command: claudeCmd, path: cwd });
    }

    // Linux — pick a terminal (user pref, $TERMINAL, x-terminal-emulator, detection)
    const chosen = detectLinuxTerminal();
    if (!chosen) return res.status(500).json({ error: 'Nessun terminale trovato' });

    // Build a wrapper script to avoid quoting/escaping issues across terminals
    const scriptPath = writeClaudeLauncherScript(cwd, claudeCmd);
    const args = buildLinuxTerminalArgsForScript(chosen, cwd, scriptPath);
    const child = spawn(chosen, args, { detached: true, stdio: 'ignore' });
    child.on('error', (err) => console.error('Terminal spawn error:', err));
    child.unref();

    res.json({ success: true, platform, terminal: chosen, command: claudeCmd, path: cwd, script: scriptPath });
  } catch (error) {
    console.error('Error opening terminal with claude:', error);
    res.status(500).json({ error: 'Failed to open terminal' });
  }
});

export default router;
