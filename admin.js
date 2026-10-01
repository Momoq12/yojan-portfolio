const $ = (selector) => document.querySelector(selector);
const state = { projects: [], imageUrl: '', imageFile: null, files: [], fileHead: '', currentFile: '', originalFileContent: '', newFile: false };

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Something went wrong.');
  return payload;
}
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);

function renderList() {
  $('#project-count').textContent = state.projects.length; $('#empty').hidden = state.projects.length > 0;
  $('#project-items').innerHTML = state.projects.map((project) => `<article class="project-item" data-id="${project.id}">${project.imageUrl ? `<img src="${project.imageUrl}" alt="">` : '<span class="thumb-empty"></span>'}<div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.category)} · ${escapeHtml(project.year)}</p></div><span class="status ${project.published ? 'live' : ''}" title="${project.published ? 'Shown' : 'Hidden'}"></span></article>`).join('');
  document.querySelectorAll('.project-item').forEach((item) => item.addEventListener('click', () => editProject(item.dataset.id)));
}
function resetEditor() {
  $('#project-form').reset(); $('#project-id').value = ''; $('#published').checked = true; state.imageUrl = ''; state.imageFile = null;
  $('#image-preview').removeAttribute('src'); $('#dropzone').classList.remove('has-image'); $('#form-title').textContent = 'New project';
  $('#delete-project').hidden = true; $('#form-message').textContent = ''; $('#project-form').classList.add('open');
}
function editProject(id) {
  const project = state.projects.find((item) => item.id === id); if (!project) return; resetEditor();
  $('#project-id').value = project.id; $('#title').value = project.title; $('#year').value = project.year || ''; $('#category').value = project.category;
  $('#description').value = project.description || ''; $('#live-url').value = project.liveUrl || ''; $('#github-url').value = project.githubUrl || '';
  $('#published').checked = project.published !== false; state.imageUrl = project.imageUrl || '';
  if (state.imageUrl) { $('#image-preview').src = state.imageUrl; $('#dropzone').classList.add('has-image'); }
  $('#form-title').textContent = 'Edit project'; $('#delete-project').hidden = false;
  document.querySelectorAll('.project-item').forEach((item) => item.classList.toggle('active', item.dataset.id === id));
  $('#project-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const fileAsDataUrl = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
function setBusy(busy, text = '') { $('#save-project').disabled = busy; $('#save-project').textContent = busy ? text : 'Save project'; }

$('#image').addEventListener('change', () => { const file = $('#image').files[0]; if (!file) return; if (file.size > 3 * 1024 * 1024) { $('#form-message').textContent = 'Choose an image smaller than 3 MB.'; return; } state.imageFile = file; $('#image-preview').src = URL.createObjectURL(file); $('#dropzone').classList.add('has-image'); });
$('#project-form').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#form-message').textContent = '';
  try {
    setBusy(true, state.imageFile ? 'Uploading image…' : 'Saving…');
    if (state.imageFile) { const data = await fileAsDataUrl(state.imageFile); const upload = await request('/api/upload', { method: 'POST', body: JSON.stringify({ data, type: state.imageFile.type, name: state.imageFile.name }) }); state.imageUrl = upload.url; }
    setBusy(true, 'Saving…');
    const payload = await request('/api/projects', { method: 'POST', body: JSON.stringify({ id: $('#project-id').value || undefined, title: $('#title').value, year: $('#year').value, category: $('#category').value, description: $('#description').value, liveUrl: $('#live-url').value, githubUrl: $('#github-url').value, imageUrl: state.imageUrl, published: $('#published').checked }) });
    state.projects = payload.projects; renderList(); resetEditor(); $('#save-state').textContent = 'Saved just now';
  } catch (error) { $('#form-message').textContent = error.message; } finally { setBusy(false); }
});
$('#delete-project').addEventListener('click', async () => { const id = $('#project-id').value; if (!id || !confirm('Delete this project from your portfolio?')) return; try { const payload = await request(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); state.projects = payload.projects; renderList(); resetEditor(); } catch (error) { $('#form-message').textContent = error.message; } });
$('#new-project').addEventListener('click', resetEditor); $('#close-editor').addEventListener('click', () => $('#project-form').classList.remove('open'));
$('#logout').addEventListener('click', async () => { await request('/api/auth', { method: 'DELETE' }); location.reload(); });
$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await request('/api/auth', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) }); await start(); } catch (error) { $('#login-message').textContent = error.message; } });

let htmlLoaded = false;

async function loadHtmlEditor(force = false) {
  if (htmlLoaded && !force) return;
  $('#html-state').textContent = 'Loading current HTML…';
  $('#html-message').textContent = '';
  try {
    const saved = await request('/api/site-html');
    if (saved.html) {
      $('#html-source').value = saved.html;
      $('#html-state').textContent = `Published ${new Date(saved.updatedAt).toLocaleString()}`;
    } else {
      const response = await fetch('/');
      const source = await response.text();
      const documentCopy = new DOMParser().parseFromString(source, 'text/html');
      $('#html-source').value = documentCopy.querySelector('main')?.innerHTML.trim() || '';
      $('#html-state').textContent = 'Using deployed HTML';
    }
    htmlLoaded = true;
  } catch (error) {
    $('#html-state').textContent = 'Could not load HTML';
    $('#html-message').textContent = error.message;
  }
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', async () => {
  const view = button.dataset.view;
  $('#projects-view').hidden = view !== 'projects';
  $('#html-view').hidden = view !== 'html';
  $('#files-view').hidden = view !== 'files';
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
  if (view === 'html') await loadHtmlEditor();
  if (view === 'files' && !state.files.length) await loadFiles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));

$('#preview-html').addEventListener('click', () => {
  const html = $('#html-source').value;
  $('#html-preview').srcdoc = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/extras.css"><link rel="stylesheet" href="/music.css"></head><body><main>${html}</main></body></html>`;
  $('#preview-panel').hidden = false;
  $('#preview-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#close-preview').addEventListener('click', () => { $('#preview-panel').hidden = true; });

$('#save-html').addEventListener('click', async () => {
  const button = $('#save-html'); button.disabled = true; button.textContent = 'Publishing…'; $('#html-message').textContent = '';
  try {
    const result = await request('/api/site-html', { method: 'PUT', body: JSON.stringify({ html: $('#html-source').value }) });
    $('#html-state').textContent = `Published ${new Date(result.updatedAt).toLocaleString()}`;
    $('#html-message').textContent = 'Your website HTML is live.';
  } catch (error) { $('#html-message').textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Publish HTML'; }
});

$('#restore-html').addEventListener('click', async () => {
  if (!confirm('Restore the HTML from the deployed website? Your dashboard version will be removed.')) return;
  $('#html-message').textContent = '';
  try { await request('/api/site-html', { method: 'DELETE' }); htmlLoaded = false; await loadHtmlEditor(true); $('#html-message').textContent = 'Deployed HTML restored.'; }
  catch (error) { $('#html-message').textContent = error.message; }
});

function fileIsDirty() { return !$('#file-editor').hidden && $('#file-source').value !== state.originalFileContent; }

function renderFiles() {
  const query = $('#file-search').value.trim().toLowerCase();
  const visible = state.files.filter((file) => file.path.toLowerCase().includes(query));
  $('#file-list').innerHTML = visible.length ? visible.map((file) => `<button class="file-row ${file.path === state.currentFile ? 'active' : ''}" data-path="${escapeHtml(file.path)}" ${file.editable ? '' : 'disabled'} title="${file.editable ? escapeHtml(file.path) : 'Protected or non-text file'}"><span>${file.editable ? '◇' : '·'}</span><span>${escapeHtml(file.path)}</span></button>`).join('') : '<p class="file-loading">No matching files.</p>';
  document.querySelectorAll('.file-row:not(:disabled)').forEach((button) => button.addEventListener('click', () => openFile(button.dataset.path)));
}

async function loadFiles() {
  $('#file-list').innerHTML = '<p class="file-loading">Loading folder…</p>';
  try {
    const payload = await request('/api/files');
    state.files = payload.files;
    state.fileHead = payload.head;
    renderFiles();
  } catch (error) {
    $('#file-list').innerHTML = `<p class="file-loading">${escapeHtml(error.message)}</p>`;
  }
}

async function openFile(path) {
  if (fileIsDirty() && !confirm('Discard your unsaved changes and open another file?')) return;
  $('#file-message').textContent = 'Loading file…';
  try {
    const file = await request(`/api/files?path=${encodeURIComponent(path)}`);
    state.currentFile = file.path;
    state.originalFileContent = file.content;
    state.newFile = false;
    $('#file-source').value = file.content;
    $('#file-path-label').textContent = file.path;
    $('#file-mode').textContent = 'Editing';
    $('#file-empty').hidden = true;
    $('#file-editor').hidden = false;
    $('#delete-file').hidden = false;
    $('#rename-file').hidden = false;
    $('#file-message').textContent = '';
    renderFiles();
  } catch (error) { $('#file-message').textContent = error.message; }
}

async function commitFiles(changes, successMessage) {
  const button = $('#save-file');
  button.disabled = true;
  button.textContent = 'Saving…';
  $('#file-message').textContent = '';
  try {
    const result = await request('/api/files', { method: 'POST', body: JSON.stringify({ changes, expectedHead: state.fileHead, message: $('#commit-message').value }) });
    $('#file-message').innerHTML = `${escapeHtml(successMessage)} <a href="${result.url}" target="_blank" rel="noopener">View commit</a>.`;
    state.files = [];
    await loadFiles();
    return true;
  } catch (error) {
    $('#file-message').textContent = error.message;
    return false;
  } finally {
    button.disabled = false;
    button.textContent = 'Save to GitHub';
  }
}

$('#file-search').addEventListener('input', renderFiles);
$('#refresh-files').addEventListener('click', async () => { if (!fileIsDirty() || confirm('Discard unsaved changes and refresh the folder?')) { state.currentFile = ''; state.files = []; $('#file-editor').hidden = true; $('#file-empty').hidden = false; await loadFiles(); } });
$('#new-file').addEventListener('click', () => {
  if (fileIsDirty() && !confirm('Discard your unsaved changes and create a new file?')) return;
  const path = prompt('Enter the new file path, for example pages/about.html');
  if (!path) return;
  state.currentFile = path.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  state.originalFileContent = '';
  state.newFile = true;
  $('#file-source').value = '';
  $('#file-path-label').textContent = state.currentFile;
  $('#file-mode').textContent = 'New file';
  $('#file-empty').hidden = true;
  $('#file-editor').hidden = false;
  $('#delete-file').hidden = true;
  $('#rename-file').hidden = true;
  $('#file-message').textContent = 'Add the file contents, then save it to GitHub.';
});
$('#save-file').addEventListener('click', async () => {
  if (!state.currentFile) return;
  const content = $('#file-source').value;
  if (!state.newFile && content === state.originalFileContent) { $('#file-message').textContent = 'No changes to save.'; return; }
  const saved = await commitFiles([{ path: state.currentFile, content }], state.newFile ? 'File created' : 'Changes saved');
  if (saved) await openFile(state.currentFile);
});
$('#rename-file').addEventListener('click', async () => {
  if (!state.currentFile) return;
  const nextPath = prompt('Enter the new file path', state.currentFile);
  if (!nextPath) return;
  const normalized = nextPath.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized === state.currentFile) return;
  if (!confirm(`Rename “${state.currentFile}” to “${normalized}”?`)) return;
  const oldPath = state.currentFile;
  const content = $('#file-source').value;
  const saved = await commitFiles([{ path: normalized, content }, { path: oldPath, content: null }], 'File renamed');
  if (saved) await openFile(normalized);
});
$('#delete-file').addEventListener('click', async () => {
  if (!state.currentFile || !confirm(`Permanently delete “${state.currentFile}” from the repository? The Git history will still contain it.`)) return;
  const path = state.currentFile;
  const saved = await commitFiles([{ path, content: null }], 'File deleted');
  if (saved) { state.currentFile = ''; state.originalFileContent = ''; $('#file-editor').hidden = true; $('#file-empty').hidden = false; renderFiles(); }
});

async function start() {
  if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') && new URLSearchParams(location.search).has('preview')) {
    $('#login-panel').hidden = true; $('#app').hidden = false; renderList(); resetEditor(); return;
  }
  try { const auth = await request('/api/auth'); if (!auth.configured) { $('#login-panel').hidden = false; $('#login-message').textContent = 'Storage and dashboard access will be connected before deployment.'; return; } if (!auth.authenticated) { $('#login-panel').hidden = false; $('#app').hidden = true; return; } $('#login-panel').hidden = true; $('#app').hidden = false; const payload = await request('/api/projects'); state.projects = payload.projects; renderList(); resetEditor(); } catch (error) { $('#login-panel').hidden = false; $('#login-message').textContent = error.message; }
}
start();
