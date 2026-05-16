'use strict';

const fs = require('fs');
const path = require('path');

function parseGitlabs(raw) {
  if (!raw || raw === '-') return [];
  return String(raw).split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const idx = line.indexOf('|');
    if (idx <= 0) return null;
    return { url: line.slice(0, idx).trim(), token: line.slice(idx + 1).trim() };
  }).filter(Boolean);
}

function buildGitconfig(username, settings) {
  const s = settings || {};
  const git = s.git || {};
  const name = (git.name || '').trim() || username;
  const email = (git.email || '').trim() || `${username}@localhost`;

  let content = `[user]\n\tname = ${name}\n\temail = ${email}\n`;

  const gitlabs = Array.isArray(s.gitlabs) ? s.gitlabs : [];
  for (const entry of gitlabs) {
    const rawUrl = (entry.url || '').trim().replace(/\/$/, '');
    const token = (entry.token || '').trim();
    if (!rawUrl || !token) continue;
    const authedUrl = rawUrl.replace(/^(https?:\/\/)/, `$1oauth2:${token}@`);
    content += `[url "${authedUrl}/"]\n\tinsteadOf = ${rawUrl}/\n`;
  }

  const proxyUrl = (s.proxyUrl || '').trim();
  const sslNoVerify = !!s.sslNoVerify;
  if (proxyUrl || sslNoVerify) {
    content += `[http]\n`;
    if (proxyUrl) content += `\tproxy = ${proxyUrl}\n`;
    if (sslNoVerify) content += `\tsslVerify = false\n`;
  }

  return content;
}

function writeUserGitconfig(username, settings) {
  const home = `/data/users/${username}`;
  const gitconfigPath = path.join(home, '.gitconfig');
  const content = buildGitconfig(username, settings);
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(gitconfigPath, content, { mode: 0o644 });
  return gitconfigPath;
}

function loadGitSettingsFromDb(db, userId, username) {
  const rows = db.prepare('SELECT key, value FROM user_preferences WHERE user_id = ?').all(userId);
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    git: {
      name: map.git_name ? map.git_name : username,
      email: map.git_email ? map.git_email : `${username}@localhost`
    },
    gitlabs: parseGitlabs(map.git_gitlabs),
    proxyUrl: map.git_proxy || '',
    sslNoVerify: map.git_ssl_noverify === 'true'
  };
}

module.exports = { buildGitconfig, writeUserGitconfig, loadGitSettingsFromDb };
