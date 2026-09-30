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
const themeLabel = themeSwitch.querySelector('.switch-label');
const savedTheme = localStorage.getItem('yojan-theme');
if (savedTheme === 'day') document.body.classList.add('day');

function syncThemeControl() {
  const isDay = document.body.classList.contains('day');
  themeSwitch.setAttribute('aria-pressed', String(isDay));
  themeSwitch.setAttribute('aria-label', `Switch to ${isDay ? 'night' : 'day'} theme`);
  themeLabel.textContent = isDay ? 'Day' : 'Night';
  document.querySelector('meta[name="theme-color"]').content = isDay ? '#d8d5cc' : '#070809';
}

themeSwitch.addEventListener('click', () => {
  document.body.classList.toggle('day');
  localStorage.setItem('yojan-theme', document.body.classList.contains('day') ? 'day' : 'night');
  syncThemeControl();
});
syncThemeControl();

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
  const now = new Date();
  nepalTime.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  adDate.textContent = `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', day: '2-digit', month: 'short', year: 'numeric' }).format(now)} AD`;
  bsDate.textContent = bsDateFor2083(now);
}
updateNepalClock();
setInterval(updateNepalClock, 1000);
