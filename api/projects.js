const crypto = require('crypto');
const { requireAuth } = require('./_auth');
const DATA_PATH = 'portfolio-data/projects.json';
const blobApi = () => import('@vercel/blob');

async function readProjects() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const { list } = await blobApi();
  const result = await list({ prefix: DATA_PATH, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
  const blob = result.blobs.find((item) => item.pathname === DATA_PATH);
  if (!blob) return [];
  const response = await fetch(`${blob.url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.projects) ? data.projects : [];
}

async function writeProjects(projects) {
  const { put } = await blobApi();
  await put(DATA_PATH, JSON.stringify({ projects, updatedAt: new Date().toISOString() }), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', token: process.env.BLOB_READ_WRITE_TOKEN
  });
}

function cleanProject(input, existingId) {
  const text = (value, max = 500) => String(value || '').trim().slice(0, max);
  return {
    id: existingId || crypto.randomUUID(), title: text(input.title, 100), category: text(input.category, 80),
    description: text(input.description, 500), year: text(input.year, 20) || 'NOW',
    liveUrl: text(input.liveUrl, 500), githubUrl: text(input.githubUrl, 500),
    imageUrl: text(input.imageUrl, 1000), published: input.published !== false, updatedAt: new Date().toISOString()
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') return res.status(200).json({ projects: await readProjects() });
    if (!requireAuth(req, res)) return;
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Project storage has not been connected yet.' });
    const projects = await readProjects();
    if (req.method === 'POST') {
      const project = cleanProject(req.body || {}, req.body?.id);
      if (!project.title || !project.category) return res.status(400).json({ error: 'Title and category are required.' });
      const index = projects.findIndex((item) => item.id === project.id);
      if (index >= 0) projects[index] = project; else projects.unshift(project);
      await writeProjects(projects);
      return res.status(200).json({ project, projects });
    }
    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      const next = projects.filter((item) => item.id !== id);
      if (next.length === projects.length) return res.status(404).json({ error: 'Project not found.' });
      await writeProjects(next);
      return res.status(200).json({ projects: next });
    }
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('projects error', error);
    return res.status(500).json({ error: 'Projects are temporarily unavailable.' });
  }
};
