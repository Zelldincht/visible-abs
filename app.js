const STORAGE_KEY = 'ova-data-v1';
const SCHEMA_VERSION = 1;
const METRICS = {
  weight: { title: 'Log weight', label: 'Weight (kg)', min: 20, max: 500, step: .1 },
  steps: { title: 'Log steps', label: 'Steps', min: 0, max: 200000, step: 1 },
  water: { title: 'Log water', label: 'Water (litres)', min: 0, max: 20, step: .1 },
  sleep: { title: 'Log sleep', label: 'Sleep (hours)', min: 0, max: 24, step: .1 }
};

const emptyData = () => ({ schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), days: {} });
let data = loadData();
let selectedMetric = null;
let installPrompt = null;
const todayKey = localDateKey();

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function getDay(key = todayKey) {
  if (!data.days[key]) data.days[key] = { quests: [], metrics: {}, dayType: null, note: '' };
  return data.days[key];
}
function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && parsed.schemaVersion === SCHEMA_VERSION && parsed.days ? parsed : emptyData();
  } catch { return emptyData(); }
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll();
}
function lifetimeXp() {
  return Object.values(data.days).reduce((total, day) => total + (day.quests || []).filter(q => q.completed).reduce((sum, q) => sum + Number(q.xp || 0), 0), 0);
}
function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const start = 50 * (level - 1) ** 2;
  const end = 50 * level ** 2;
  const names = ['Foundation', 'Momentum', 'Discipline', 'Consistency', 'Resolve', 'Unshakeable'];
  return { level, start, end, progress: ((xp - start) / (end - start)) * 100, name: names[Math.min(level - 1, names.length - 1)] };
}
function safeText(value) { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }
function toast(message) {
  const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function renderAll() { renderToday(); renderProgress(); }
function renderToday() {
  const day = getDay();
  document.querySelector('#todayDate').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const xp = lifetimeXp(); const info = levelInfo(xp);
  document.querySelector('#levelNumber').textContent = info.level;
  document.querySelector('#levelName').textContent = info.name;
  document.querySelector('#xpLabel').textContent = `${xp - info.start} / ${info.end - info.start} XP`;
  document.querySelector('#xpProgress').style.width = `${info.progress}%`;
  const list = document.querySelector('#questList');
  list.innerHTML = (day.quests || []).map(q => `<div class="quest ${q.completed ? 'completed' : ''}"><input class="quest-check" type="checkbox" data-quest-id="${q.id}" ${q.completed ? 'checked' : ''} aria-label="Complete ${safeText(q.name)}"><span class="quest-title">${safeText(q.name)}</span><span class="quest-xp">+${q.xp} XP</span><button class="delete-quest" data-delete-quest="${q.id}" aria-label="Delete ${safeText(q.name)}">×</button></div>`).join('');
  document.querySelector('#emptyQuests').hidden = Boolean(day.quests?.length);
  for (const metric of Object.keys(METRICS)) {
    const value = day.metrics?.[metric];
    document.querySelector(`#${metric}Value`).textContent = value === undefined ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
    document.querySelector(`[data-open-metric="${metric}"]`).textContent = value === undefined ? `Log ${metric}` : 'Edit entry';
  }
  document.querySelectorAll('[data-day-type]').forEach(b => b.classList.toggle('active', b.dataset.dayType === day.dayType));
  document.querySelector('#dayNote').value = day.note || '';
}
function renderProgress() {
  const days = Object.entries(data.days).filter(([,d]) => d.quests?.length || Object.keys(d.metrics || {}).length || d.dayType || d.note).sort(([a],[b]) => b.localeCompare(a));
  document.querySelector('#lifetimeXp').textContent = lifetimeXp().toLocaleString();
  document.querySelector('#questsComplete').textContent = Object.values(data.days).reduce((n,d) => n + (d.quests || []).filter(q=>q.completed).length, 0);
  document.querySelector('#daysLogged').textContent = days.length;
  document.querySelector('#historyList').innerHTML = days.length ? days.slice(0,30).map(([key,d]) => {
    const complete = (d.quests || []).filter(q=>q.completed).length;
    const total = (d.quests || []).length;
    const type = d.dayType ? d.dayType[0].toUpperCase() + d.dayType.slice(1) : 'Not set';
    const metrics = Object.keys(d.metrics || {}).length;
    return `<div class="history-row"><div><b>${new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(new Date(key+'T12:00:00'))}</b><small> · ${type}</small></div><small>${complete}/${total} quests</small><small>${metrics} metrics</small><small>${(d.quests || []).filter(q=>q.completed).reduce((s,q)=>s+q.xp,0)} XP</small></div>`;
  }).join('') : '<p class="empty">Your logged days will appear here.</p>';
}

document.querySelector('#addQuestButton').addEventListener('click', () => { document.querySelector('#questForm').reset(); document.querySelector('#questDialog').showModal(); });
document.querySelector('#questForm').addEventListener('submit', e => {
  e.preventDefault(); const name = document.querySelector('#questName').value.trim(); if (!name) return;
  getDay().quests.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name, xp: Number(document.querySelector('#questXp').value), completed: false });
  saveData(); document.querySelector('#questDialog').close(); toast('Quest added');
});
document.querySelector('#questList').addEventListener('change', e => {
  const id = e.target.dataset.questId; if (!id) return; const quest = getDay().quests.find(q => q.id === id); if (!quest) return;
  quest.completed = e.target.checked; saveData(); toast(quest.completed ? `Quest complete · +${quest.xp} XP` : 'Quest reopened');
});
document.querySelector('#questList').addEventListener('click', e => {
  const id = e.target.dataset.deleteQuest; if (!id) return; getDay().quests = getDay().quests.filter(q => q.id !== id); saveData(); toast('Quest removed');
});
document.querySelectorAll('[data-open-metric]').forEach(button => button.addEventListener('click', () => {
  selectedMetric = button.dataset.openMetric; const config = METRICS[selectedMetric]; const input = document.querySelector('#metricInput');
  document.querySelector('#metricTitle').textContent = config.title; document.querySelector('#metricLabel').textContent = config.label;
  Object.assign(input, { min: config.min, max: config.max, step: config.step }); input.value = getDay().metrics?.[selectedMetric] ?? '';
  document.querySelector('#metricDialog').showModal(); input.focus();
}));
document.querySelector('#metricForm').addEventListener('submit', e => {
  e.preventDefault(); const input = document.querySelector('#metricInput'); if (!input.reportValidity()) return;
  const value = Number(input.value); const config = METRICS[selectedMetric]; if (!Number.isFinite(value) || value < config.min || value > config.max) return;
  getDay().metrics[selectedMetric] = value; saveData(); document.querySelector('#metricDialog').close(); toast('Entry saved');
});
document.querySelectorAll('[data-day-type]').forEach(button => button.addEventListener('click', () => {
  getDay().dayType = button.dataset.dayType === 'clear' ? null : button.dataset.dayType; saveData(); toast(getDay().dayType ? `${getDay().dayType[0].toUpperCase()+getDay().dayType.slice(1)} day logged` : 'Training status cleared');
}));
document.querySelector('#saveNote').addEventListener('click', () => { getDay().note = document.querySelector('#dayNote').value.trim(); saveData(); toast('Note saved'); });

function showRoute() {
  const route = location.hash.slice(1) || 'today';
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === route));
  document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.toggle('active', a.hash === `#${route}`));
  window.scrollTo({ top: 0 });
}
addEventListener('hashchange', showRoute); showRoute();

document.querySelector('#exportButton').addEventListener('click', () => {
  const payload = { ...data, exportedAt: new Date().toISOString(), app: 'Operation Visible Abs' };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `operation-visible-abs-backup-${localDateKey()}.json`; a.click(); URL.revokeObjectURL(url); toast('Backup exported');
});
document.querySelector('#importInput').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const restored = JSON.parse(await file.text());
    if (restored.schemaVersion !== SCHEMA_VERSION || !restored.days || typeof restored.days !== 'object') throw new Error('Invalid backup');
    data = { schemaVersion: SCHEMA_VERSION, createdAt: restored.createdAt || new Date().toISOString(), days: restored.days };
    saveData(); document.querySelector('#storageStatus').textContent = `Restored ${Object.keys(data.days).length} day entries from ${file.name}.`; toast('Backup restored');
  } catch { document.querySelector('#storageStatus').textContent = 'That file is not a valid Operation Visible Abs backup.'; }
  e.target.value = '';
});

addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; document.querySelector('#installButton').classList.remove('hidden'); });
document.querySelector('#installButton').addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; document.querySelector('#installButton').classList.add('hidden'); });
addEventListener('appinstalled', () => toast('App installed'));
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
renderAll();
