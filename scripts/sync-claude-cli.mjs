#!/usr/bin/env node
/**
 * Sync Cursor skills/commands/MCP config into Claude Code CLI layout.
 *
 * Project:
 *   .agents/skills/*     -> .claude/skills/*
 *   .cursor/commands/*   -> .claude/commands/*
 *   ~/.cursor/mcp.json   -> .mcp.json (+ optional gitkraken)
 *
 * User (optional, --user):
 *   ~/.cursor/skills-cursor/* -> ~/.claude/skills/cursor-*
 *   ~/.agents/skills/*        -> ~/.claude/skills/*
 */

import { cp, lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const syncUser = args.has('--user') || !args.has('--project-only');
const copyFallback = args.has('--copy');

function commandExists(name) {
  try {
    execSync(process.platform === 'win32' ? `where ${name}` : `command -v ${name}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function removeIfExists(path) {
  if (await exists(path)) {
    await rm(path, { recursive: true, force: true });
  }
}

async function linkOrCopyDir(src, dest) {
  await mkdir(dirname(dest), { recursive: true });
  await removeIfExists(dest);

  if (copyFallback) {
    await cp(src, dest, { recursive: true });
    return 'copy';
  }

  const linkTarget = relative(dirname(dest), src);

  try {
    await symlink(linkTarget, dest, process.platform === 'win32' ? 'junction' : 'dir');
    return 'link';
  } catch {
    await cp(src, dest, { recursive: true });
    return 'copy';
  }
}

async function linkOrCopyFile(src, dest) {
  await mkdir(dirname(dest), { recursive: true });
  await removeIfExists(dest);

  if (copyFallback) {
    await cp(src, dest);
    return 'copy';
  }

  const linkTarget = relative(dirname(dest), src);

  try {
    await symlink(linkTarget, dest, 'file');
    return 'link';
  } catch {
    await cp(src, dest);
    return 'copy';
  }
}

async function syncSkillDirs(sourceRoot, targetRoot, { prefix = '' } = {}) {
  if (!(await exists(sourceRoot))) {
    return [];
  }

  await mkdir(targetRoot, { recursive: true });
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const src = join(sourceRoot, entry.name);
    const skillFile = join(src, 'SKILL.md');
    if (!(await exists(skillFile))) continue;

    const destName = prefix ? `${prefix}${entry.name}` : entry.name;
    const dest = join(targetRoot, destName);
    const mode = await linkOrCopyDir(src, dest);
    results.push({ name: destName, mode, src, dest });
  }

  return results;
}

async function syncCommandFiles(sourceRoot, targetRoot) {
  if (!(await exists(sourceRoot))) {
    return [];
  }

  await mkdir(targetRoot, { recursive: true });
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const src = join(sourceRoot, entry.name);
    const dest = join(targetRoot, entry.name);
    const mode = await linkOrCopyFile(src, dest);
    results.push({ name: entry.name, mode, src, dest });
  }

  return results;
}

async function buildMcpJson() {
  const cursorMcpPath = join(homedir(), '.cursor', 'mcp.json');
  let base = { mcpServers: {} };

  if (await exists(cursorMcpPath)) {
    base = JSON.parse(await readFile(cursorMcpPath, 'utf8'));
  } else {
    base.mcpServers['chrome-devtools'] = {
      command: 'npx',
      args: ['-y', 'chrome-devtools-mcp@latest', '--isolated=true'],
      type: 'stdio',
    };
  }

  for (const server of Object.values(base.mcpServers)) {
    if (!server.type) server.type = 'stdio';
  }

  if (commandExists('gk') && !base.mcpServers.gitkraken) {
    base.mcpServers.gitkraken = {
      command: 'gk',
      args: ['mcp'],
      type: 'stdio',
    };
  }

  const outPath = join(repoRoot, '.mcp.json');
  await writeFile(outPath, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
  return { outPath, servers: Object.keys(base.mcpServers), hasGk: commandExists('gk') };
}

async function main() {
  const projectSkills = await syncSkillDirs(
    join(repoRoot, '.agents', 'skills'),
    join(repoRoot, '.claude', 'skills'),
  );

  const projectCommands = await syncCommandFiles(
    join(repoRoot, '.cursor', 'commands'),
    join(repoRoot, '.claude', 'commands'),
  );

  const mcp = await buildMcpJson();

  let userSkills = [];
  let userCursorSkills = [];

  if (syncUser) {
    userSkills = await syncSkillDirs(join(homedir(), '.agents', 'skills'), join(homedir(), '.claude', 'skills'));
    userCursorSkills = await syncSkillDirs(
      join(homedir(), '.cursor', 'skills-cursor'),
      join(homedir(), '.claude', 'skills'),
      { prefix: 'cursor-' },
    );
  }

  console.log('Claude CLI sync complete\n');
  console.log(`Project skills (${projectSkills.length}):`);
  for (const s of projectSkills) console.log(`  ${s.name} (${s.mode})`);

  console.log(`\nProject commands (${projectCommands.length}):`);
  for (const c of projectCommands) console.log(`  /${c.name.replace(/\.md$/, '')} (${c.mode})`);

  console.log(`\nMCP servers -> ${mcp.outPath}:`);
  for (const name of mcp.servers) console.log(`  ${name}`);
  if (!mcp.hasGk) {
    console.log('  (gitkraken skipped — install gk CLI + gk auth login to enable)');
  }

  if (syncUser) {
    console.log(`\nUser skills (${userSkills.length + userCursorSkills.length}):`);
    for (const s of [...userSkills, ...userCursorSkills]) {
      console.log(`  ${s.name} (${s.mode}) -> ~/.claude/skills/${s.name}`);
    }
  }

  console.log('\nRestart Claude Code in this repo to pick up changes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
