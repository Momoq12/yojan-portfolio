const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

const links = [...document.querySelectorAll('nav a')];
const sections = [...document.querySelectorAll('main section[id]')];
const sectionObserver = new IntersectionObserver((entries) => {
  const active = entries.find((entry) => entry.isIntersecting);
  if (!active) return;
  links.forEach((link) => link.toggleAttribute('aria-current', link.hash === `#${active.target.id}`));
}, { rootMargin: '-40% 0px -50% 0px' });
sections.forEach((section) => sectionObserver.observe(section));

const themeSwitch = document.querySelector('#theme-switch');
const themeLabel = themeSwitch?.querySelector('.switch-label');
const savedTheme = localStorage.getItem('yojan-theme');
if (savedTheme === 'day') document.body.classList.add('day');

function syncThemeControl() {
  if (!themeSwitch || !themeLabel) return;
  const isDay = document.body.classList.contains('day');
  themeSwitch.setAttribute('aria-pressed', String(isDay));
  themeSwitch.setAttribute('aria-label', `Switch to ${isDay ? 'night' : 'day'} theme`);
  themeLabel.textContent = isDay ? 'Day' : 'Night';
  document.querySelector('meta[name="theme-color"]').content = isDay ? '#d8d5cc' : '#070809';
}

themeSwitch?.addEventListener('click', () => {
  document.body.classList.toggle('day');
  localStorage.setItem('yojan-theme', document.body.classList.contains('day') ? 'day' : 'night');
  syncThemeControl();
});
syncThemeControl();

const projectList = document.querySelector('#project-list');

function projectMarkup(project, index) {
  const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
  const destination = project.liveUrl || project.githubUrl || '';
  const tag = destination ? 'a' : 'article';
  const linkAttributes = destination ? ` href="${escapeText(destination)}" target="_blank" rel="noreferrer"` : '';
  const image = project.imageUrl
    ? `<span class="project-image"><img src="${escapeText(project.imageUrl)}" alt="" loading="lazy"></span>`
    : '<span class="project-image project-image-empty" aria-hidden="true"></span>';
  return `<${tag} class="project reveal visible"${linkAttributes}>
    <span class="project-no">${String(index + 1).padStart(2, '0')}</span>
    <div><p>${escapeText(project.category)}</p><h3>${escapeText(project.title)}</h3>${project.description ? `<span class="project-description">${escapeText(project.description)}</span>` : ''}</div>
    ${image}<span class="project-year">${escapeText(project.year || 'NOW')}</span><span class="project-arrow">${destination ? '↗' : ''}</span>
  </${tag}>`;
}

async function loadProjects() {
  if (!projectList) return;
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) return;
    const payload = await response.json();
    const visibleProjects = (payload.projects || []).filter((project) => project.published !== false);
    if (visibleProjects.length) projectList.innerHTML = visibleProjects.map(projectMarkup).join('');
  } catch (_) {
    // Keep the hand-authored project cards if cloud content is unavailable.
  }
}

loadProjects();

const liveAge = document.querySelector('#live-age');
const birthNpt = { year: 2008, month: 7, day: 22, hour: 11, minute: 0, second: 0 };
const nptOffsetMs = (5 * 60 + 45) * 60 * 1000;

function nptDate(year, month) {
  return new Date(Date.UTC(year, month, birthNpt.day, birthNpt.hour, birthNpt.minute, birthNpt.second) - nptOffsetMs);
}

function updateLiveAge() {
  if (!liveAge) return;
  const now = new Date();
  const nowNpt = new Date(now.getTime() + nptOffsetMs);
  let years = nowNpt.getUTCFullYear() - birthNpt.year;
  let cursor = nptDate(birthNpt.year + years, birthNpt.month);
  if (cursor > now) cursor = nptDate(birthNpt.year + --years, birthNpt.month);

  let months = 0;
  while (months < 11 && nptDate(birthNpt.year + years, birthNpt.month + months + 1) <= now) months += 1;
  cursor = nptDate(birthNpt.year + years, birthNpt.month + months);

  let remainingSeconds = Math.floor((now - cursor) / 1000);
  const days = Math.floor(remainingSeconds / 86400);
  remainingSeconds %= 86400;
  const hours = Math.floor(remainingSeconds / 3600);
  remainingSeconds %= 3600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  liveAge.textContent = `${years} years · ${months} months · ${days} days · ${hours}h ${minutes}m ${seconds}s old`;
}

updateLiveAge();
setInterval(updateLiveAge, 1000);

const nepalTime = document.querySelector('#nepal-time');
const adDate = document.querySelector('#ad-date');
const bsDate = document.querySelector('#bs-date');
const bsMonths = ['Baisakh','Jestha','Asar','Shrawan','Bhadra','Asoj','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
const bsMonthDays2083 = [31,31,32,31,31,31,30,29,30,29,30,30];

function bsDateFor2083(kathmanduDate) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(kathmanduDate);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const currentUtc = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day));
  const startUtc = Date.UTC(2026, 3, 14);
  let offset = Math.floor((currentUtc - startUtc) / 86400000);
  if (offset < 0 || offset >= bsMonthDays2083.reduce((sum, days) => sum + days, 0)) return 'BS date unavailable';
  let month = 0;
  while (offset >= bsMonthDays2083[month]) offset -= bsMonthDays2083[month++];
  return `${offset + 1} ${bsMonths[month]} 2083 BS`;
}

function updateNepalClock() {
  if (!nepalTime || !adDate || !bsDate) return;
  const now = new Date();
  nepalTime.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  adDate.textContent = `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', day: '2-digit', month: 'short', year: 'numeric' }).format(now)} AD`;
  bsDate.textContent = bsDateFor2083(now);
}
updateNepalClock();
setInterval(updateNepalClock, 1000);
