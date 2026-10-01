const { requireAuth } = require('./_auth');

const OWNER = 'Momoq12';
const REPO = 'yojan-portfolio';
const BRANCH = 'main';
const MAX_FILE_SIZE = 1024 * 1024;
const BLOCKED_PARTS = new Set(['.git', '.vercel', 'node_modules', '.npm-cache']);
const BLOCKED_FILES = new Set(['.env', '.env.local', '.env.production', '.env.development']);
const TEXT_EXTENSIONS = new Set(['', '.css', '.csv', '.html', '.htm', '.js', '.json', '.jsx', '.md', '.mjs', '.cjs', '.svg', '.txt', '.ts', '.tsx', '.xml', '.yaml', '.yml', '.toml', '.gitignore']);

function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured.');
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'yojan-portfolio-admin', ...(options.headers || {}) }
  });
}

function normalizePath(value) {
  const path = String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!path || path.includes('\0') || path.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Choose a valid file path.');
  return path;
}

function isProtected(path) {
  const parts = path.toLowerCase().split('/');
  const name = parts[parts.length - 1];
  return parts.some((part) => BLOCKED_PARTS.has(part)) || BLOCKED_FILES.has(name) || name.startsWith('.env.');
}

function isEditable(path, size = 0) {
  if (isProtected(path) || size > MAX_FILE_SIZE) return false;
  const name = path.split('/').pop().toLowerCase();
  const dot = name.lastIndexOf('.');
  const extension = dot === -1 ? '' : name.slice(dot);
  return TEXT_EXTENSIONS.has(extension) || name === 'license';
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 || response.status === 403 ? 'GitHub rejected the token. Check that it can read and write this repository.' : payload.message || 'GitHub request failed.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function getHead() { return readJson(await github(`/git/ref/heads/${BRANCH}`)); }

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    if (req.method === 'GET' && req.query?.path) {
      const path = normalizePath(req.query.path);
      if (!isEditable(path)) return res.status(403).json({ error: 'This file is protected or is not an editable text file.' });
      const file = await readJson(await github(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${BRANCH}`));
      if (file.type !== 'file' || !isEditable(path, file.size)) return res.status(415).json({ error: 'This file cannot be edited in the dashboard.' });
      return res.status(200).json({ path, content: Buffer.from(file.content, 'base64').toString('utf8'), sha: file.sha, size: file.size });
    }
    if (req.method === 'GET') {
      const head = await getHead();
      const tree = await readJson(await github(`/git/trees/${head.object.sha}?recursive=1`));
      const files = tree.tree.filter((item) => item.type === 'blob').map((item) => ({ path: item.path, size: item.size || 0, editable: isEditable(item.path, item.size || 0), protected: isProtected(item.path) })).sort((a, b) => a.path.localeCompare(b.path));
      return res.status(200).json({ files, head: head.object.sha, branch: BRANCH, truncated: Boolean(tree.truncated) });
    }
    if (req.method === 'POST') {
      const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
      if (!changes.length || changes.length > 20) return res.status(400).json({ error: 'Include between 1 and 20 file changes.' });
      const normalized = changes.map((change) => {
        const path = normalizePath(change.path);
        if (!isEditable(path)) throw new Error(`The file “${path}” is protected or unsupported.`);
        if (change.content !== null && typeof change.content !== 'string') throw new Error('File content must be text.');
        if (change.content !== null && Buffer.byteLength(change.content, 'utf8') > MAX_FILE_SIZE) throw new Error(`The file “${path}” is larger than 1 MB.`);
        return { path, content: change.content };
      });
      if (new Set(normalized.map((item) => item.path.toLowerCase())).size !== normalized.length) return res.status(400).json({ error: 'A file path was included more than once.' });
      const head = await getHead();
      if (req.body.expectedHead && req.body.expectedHead !== head.object.sha) return res.status(409).json({ error: 'The repository changed since you opened it. Reload the files before saving.' });
      const baseCommit = await readJson(await github(`/git/commits/${head.object.sha}`));
      const treeItems = [];
      for (const change of normalized) {
        if (change.content === null) treeItems.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
        else {
          const blob = await readJson(await github('/git/blobs', { method: 'POST', body: JSON.stringify({ content: Buffer.from(change.content).toString('base64'), encoding: 'base64' }) }));
          treeItems.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
        }
      }
      const newTree = await readJson(await github('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems }) }));
      const message = String(req.body.message || 'Update website files from dashboard').trim().slice(0, 120);
      const commit = await readJson(await github('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [head.object.sha] }) }));
      await readJson(await github(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) }));
      return res.status(200).json({ ok: true, commit: commit.sha, url: commit.html_url });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(status).json({ error: error.message || 'Could not update the repository.' });
  }
};
