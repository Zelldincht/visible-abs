const STORAGE_KEY = 'ova-data-v1';
const SCHEMA_VERSION = 2;
const PERFECT_DAY_XP = 250;
const METRICS = {
  weight: { title: 'Log weight', label: 'Weight (kg)', min: 20, max: 500, step: .1 },
  steps: { title: 'Log steps', label: 'Steps', min: 0, max: 200000, step: 1 },
  water: { title: 'Log water', label: 'Water (litres)', min: 0, max: 20, step: .1 },
  sleep: { title: 'Log sleep', label: 'Sleep (hours)', min: 0, max: 24, step: .1 }
};
const PROTOCOL = [
  ['Morning Weight', 10], ['Gym', 100], ['Meal A', 40], ['Meal B', 50],
  ['Meal C', 50], ['Meal D', 60], ['Water Goal', 40], ['Foam Roll', 20],
  ['Creatine', 10], ['Fish Oil', 10], ['Vitamin D', 10], ['Magnesium', 10]
];
const TITLES = ['Initiate','Apprentice','Adept','Disciplined','Vanguard','Guardian','Champion','Warden','Hero','Legend'];
const emptyData = () => ({ schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), campaign: { name: 'Visible Abs', startingWeight: null, targetWeight: null }, days: {}, protocolVersion: 0 });
let data = loadData();
let selectedMetric = null;
let installPrompt = null;
const todayKey = localDateKey();
ensureDataShape();
if(data.campaign.name==='Operation Visible Abs'){data.campaign.name='Visible Abs';persist();}
seedProtocol();

function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
function getDay(key = todayKey) { if (!data.days[key]) data.days[key] = { quests: [], metrics: {}, dayType: null, note: '' }; return data.days[key]; }
function loadData() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)); return parsed?.days ? parsed : emptyData(); } catch { return emptyData(); } }
function ensureDataShape() {
  data.schemaVersion = SCHEMA_VERSION;
  data.campaign ||= { name: 'Visible Abs', startingWeight: null, targetWeight: null };
  data.campaign.name ||= 'Visible Abs';
  Object.values(data.days).forEach(day => { day.quests ||= []; day.metrics ||= {}; });
}
function seedProtocol() {
  if (data.protocolVersion >= 2) return;
  const day = getDay();
  const temporaryIds = new Set(['starter-weight','starter-steps','starter-water','starter-sleep','starter-training']);
  const containsOnlyTemporary = day.quests.length && day.quests.every(q => temporaryIds.has(q.id));
  if (!day.quests.length || containsOnlyTemporary) day.quests = PROTOCOL.map(([name,xp], index) => ({ id:`protocol-${index}`, name, xp, completed:false }));
  data.protocolVersion = 2; persist();
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveData() { persist(); renderAll(); }
function isPerfect(day) { return Boolean(day?.quests?.length) && day.quests.every(q => q.completed); }
function lifetimeXp() { return Object.values(data.days).reduce((total,day) => total + day.quests.filter(q=>q.completed).reduce((sum,q)=>sum+Number(q.xp||0),0) + (isPerfect(day)?PERFECT_DAY_XP:0),0); }
function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const start = 100 * (level - 1) ** 2;
  const end = 100 * level ** 2;
  return { level, start, end, progress:(xp-start)/(end-start)*100, name:TITLES[Math.min(level-1,TITLES.length-1)] };
}
function perfectDayCount() { return Object.values(data.days).filter(isPerfect).length; }
function streakStats() {
  const perfectKeys = Object.entries(data.days).filter(([,d])=>isPerfect(d)).map(([k])=>k).sort();
  let longest=0, run=0, previous=null;
  perfectKeys.forEach(key => { const date=dateFromKey(key); run = previous && Math.round((date-previous)/86400000)===1 ? run+1 : 1; longest=Math.max(longest,run); previous=date; });
  let cursor=new Date(); if(!isPerfect(data.days[localDateKey(cursor)])) cursor.setDate(cursor.getDate()-1);
  let current=0; while(isPerfect(data.days[localDateKey(cursor)])){ current++; cursor.setDate(cursor.getDate()-1); }
  return {current,longest};
}
function latestWeight() { const found=Object.entries(data.days).filter(([,d])=>d.metrics?.weight!==undefined).sort(([a],[b])=>b.localeCompare(a)); return found.length?Number(found[0][1].metrics.weight):null; }
function campaignProgress() { const start=Number(data.campaign.startingWeight),target=Number(data.campaign.targetWeight),current=latestWeight(); if(!start||!target||current===null||start===target)return 0; return Math.max(0,Math.min(100,(start-current)/(start-target)*100)); }
function nextMilestone(value, milestones) { return milestones.find(x=>x>value) || Math.ceil((value+1)/100)*100; }
function safeText(value) { const el=document.createElement('span'); el.textContent=value; return el.innerHTML; }
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),1800); }
function haptic(pattern=18) { navigator.vibrate?.(pattern); }
function playTone(frequency=740,duration=.06) { try { const ctx=new (window.AudioContext||window.webkitAudioContext)(); const osc=ctx.createOscillator(),gain=ctx.createGain(); osc.type='square'; osc.frequency.value=frequency; gain.gain.setValueAtTime(.035,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+duration); } catch {} }
function showXp(amount) { const el=document.querySelector('#xpBurst'); el.textContent=`+${amount} XP`; el.classList.remove('play'); void el.offsetWidth; el.classList.add('play'); playTone(); haptic(); }
function showLevelUp(level) { document.querySelector('#levelUpNumber').textContent=level; document.querySelector('#levelUpOverlay').hidden=false; haptic([80,40,120]); playTone(980,.18); }

function renderAll(){ renderToday(); renderStatistics(); renderAchievements(); renderCampaign(); }
function renderToday(){
  const day=getDay(),xp=lifetimeXp(),info=levelInfo(xp),complete=day.quests.filter(q=>q.completed).length,total=day.quests.length,perfect=isPerfect(day),weight=latestWeight(),progress=campaignProgress(),streak=streakStats();
  document.querySelector('#campaignName').textContent=data.campaign.name;
  document.querySelector('#todayDate').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  document.querySelector('#levelNumber').textContent=info.level; document.querySelector('#headerLevel').textContent=info.level; document.querySelector('#levelName').textContent=info.name;
  document.querySelector('#xpLabel').textContent=`${xp-info.start} / ${info.end-info.start} XP`; document.querySelector('#xpProgress').style.width=`${info.progress}%`; document.querySelector('#headerXpBar').style.width=`${info.progress}%`;
  document.querySelector('#currentWeight').textContent=weight===null?'—':weight.toFixed(1); document.querySelector('#targetWeight').textContent=data.campaign.targetWeight??'—'; document.querySelector('#currentStreak').textContent=streak.current; document.querySelector('#campaignPercent').textContent=`${Math.round(progress)}%`; document.querySelector('#campaignProgress').style.width=`${progress}%`;
  document.querySelector('#questCounter').textContent=`${complete} / ${total} complete`; document.querySelector('#questBoardProgress').style.width=total?`${complete/total*100}%`:'0%'; document.querySelector('#perfectDayBonus').classList.toggle('earned',perfect);
  const list=document.querySelector('#questList'); list.innerHTML=day.quests.map(q=>`<div class="quest ${q.completed?'completed':''}"><input class="quest-check" type="checkbox" data-quest-id="${q.id}" ${q.completed?'checked':''} aria-label="Complete ${safeText(q.name)}"><span class="quest-title">${safeText(q.name)}</span><span class="quest-xp">+${q.xp} XP</span><button class="delete-quest" data-delete-quest="${q.id}" aria-label="Delete ${safeText(q.name)}">×</button></div>`).join(''); document.querySelector('#emptyQuests').hidden=Boolean(total);
  for(const metric of Object.keys(METRICS)){ const value=day.metrics?.[metric]; document.querySelector(`#${metric}Value`).textContent=value===undefined?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:1}); }
}
function renderStatistics(){
  const xp=lifetimeXp(),info=levelInfo(xp),perfect=perfectDayCount(),streak=streakStats(),gym=Object.values(data.days).reduce((n,d)=>n+d.quests.filter(q=>q.completed&&q.name.toLowerCase()==='gym').length,0),meals=Object.values(data.days).reduce((n,d)=>n+d.quests.filter(q=>q.completed&&/^meal\s/i.test(q.name)).length,0),start=Number(data.campaign.startingWeight),current=latestWeight(),lost=start&&current!==null?Math.max(0,start-current):0;
  document.querySelector('#lifetimeXp').textContent=xp.toLocaleString(); document.querySelector('#statXpProgress').style.width=`${info.progress}%`; document.querySelector('#nextLevelStat').textContent=`Level ${info.level+1} at ${info.end} XP`;
  const perfectNext=nextMilestone(perfect,[1,3,7,14,25,50,100]); document.querySelector('#perfectDays').textContent=perfect; document.querySelector('#perfectDaysProgress').style.width=`${perfect/perfectNext*100}%`; document.querySelector('#perfectDaysNext').textContent=`Next: ${perfectNext}`;
  const streakNext=nextMilestone(streak.longest,[3,7,14,21,30,50,100,365]); document.querySelector('#longestStreak').textContent=streak.longest; document.querySelector('#streakProgress').style.width=`${streak.longest/streakNext*100}%`; document.querySelector('#streakNext').textContent=`Next: ${streakNext}`;
  const gymNext=nextMilestone(gym,[1,5,10,25,50,100]); document.querySelector('#gymSessions').textContent=gym; document.querySelector('#gymProgress').style.width=`${gym/gymNext*100}%`; document.querySelector('#gymNext').textContent=`Next: ${gymNext}`;
  const mealNext=nextMilestone(meals,[1,10,50,100,250,500,1000]); document.querySelector('#mealsCompleted').textContent=meals; document.querySelector('#mealProgress').style.width=`${meals/mealNext*100}%`; document.querySelector('#mealNext').textContent=`Next: ${mealNext}`;
  document.querySelector('#weightLost').textContent=`${lost.toFixed(1)} kg`; document.querySelector('#weightProgress').style.width=`${campaignProgress()}%`;
}
function achievements(){ const xp=lifetimeXp(),perfect=perfectDayCount(),quests=Object.values(data.days).reduce((n,d)=>n+d.quests.filter(q=>q.completed).length,0),meals=Object.values(data.days).reduce((n,d)=>n+d.quests.filter(q=>q.completed&&/^meal\s/i.test(q.name)).length,0); return [
  ['First Step','Complete your first quest',quests>=1,10],['Protocol Perfect','Complete one perfect day',perfect>=1,50],['Three Day Flame','Reach a 3-day streak',streakStats().longest>=3,100],['Meal Initiate','Complete your first meal',meals>=1,10],['Meal Veteran','Complete 50 meals',meals>=50,250],['XP Collector','Earn 1,000 lifetime XP',xp>=1000,100]
]; }
function renderAchievements(){ document.querySelector('#achievementList').innerHTML=achievements().map(([name,desc,done,reward])=>`<article class="pixel-panel achievement ${done?'':'locked'}"><span class="achievement-icon">${done?'★':'?'}</span><div><strong>${name}</strong><small>${desc}</small></div><em>+${reward} XP</em></article>`).join(''); }
function renderCampaign(){ document.querySelector('#campaignNameInput').value=data.campaign.name; document.querySelector('#startingWeightInput').value=data.campaign.startingWeight??''; document.querySelector('#targetWeightInput').value=data.campaign.targetWeight??''; }

function showRoute(){ const route=location.hash.slice(1)||'today'; document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===route)); document.querySelectorAll('.bottom-nav a').forEach(a=>a.classList.toggle('active',a.hash===`#${route}`)); window.scrollTo({top:0}); }
addEventListener('hashchange',showRoute); showRoute();
document.querySelector('#questList').addEventListener('change',e=>{ const id=e.target.dataset.questId;if(!id)return; const q=getDay().quests.find(x=>x.id===id);if(!q)return; const before=levelInfo(lifetimeXp()).level,wasPerfect=isPerfect(getDay()); q.completed=e.target.checked; persist(); const afterXp=lifetimeXp(),after=levelInfo(afterXp).level; renderAll(); if(q.completed){showXp(q.xp); if(!wasPerfect&&isPerfect(getDay())){setTimeout(()=>showXp(PERFECT_DAY_XP),350);toast('Perfect Day!');} if(after>before)setTimeout(()=>showLevelUp(after),700);}else{toast('Quest reopened');} });
document.querySelector('#questList').addEventListener('click',e=>{const id=e.target.dataset.deleteQuest;if(!id)return;getDay().quests=getDay().quests.filter(q=>q.id!==id);saveData();toast('Quest removed');});
document.querySelector('#addQuestButton').addEventListener('click',()=>{document.querySelector('#questForm').reset();document.querySelector('#questDialog').showModal();});
document.querySelector('#questForm').addEventListener('submit',e=>{e.preventDefault();const name=document.querySelector('#questName').value.trim();if(!name)return;getDay().quests.push({id:crypto.randomUUID?.()||`${Date.now()}`,name,xp:Number(document.querySelector('#questXp').value),completed:false});saveData();document.querySelector('#questDialog').close();toast('Quest added');});
document.querySelectorAll('[data-open-metric]').forEach(button=>button.addEventListener('click',()=>{selectedMetric=button.dataset.openMetric;const cfg=METRICS[selectedMetric],input=document.querySelector('#metricInput');document.querySelector('#metricTitle').textContent=cfg.title;document.querySelector('#metricLabel').textContent=cfg.label;input.min=cfg.min;input.max=cfg.max;input.step=cfg.step;input.value=getDay().metrics?.[selectedMetric]??'';document.querySelector('#metricDialog').showModal();}));
document.querySelector('#metricForm').addEventListener('submit',e=>{e.preventDefault();const input=document.querySelector('#metricInput'),value=Number(input.value),cfg=METRICS[selectedMetric];if(!Number.isFinite(value)||value<cfg.min||value>cfg.max)return;getDay().metrics[selectedMetric]=value;if(selectedMetric==='weight'&&!data.campaign.startingWeight)data.campaign.startingWeight=value;saveData();document.querySelector('#metricDialog').close();showXp(5);toast('Log saved');});
document.querySelector('#campaignForm').addEventListener('submit',e=>{e.preventDefault();data.campaign.name=document.querySelector('#campaignNameInput').value.trim()||'Visible Abs';data.campaign.startingWeight=Number(document.querySelector('#startingWeightInput').value)||null;data.campaign.targetWeight=Number(document.querySelector('#targetWeightInput').value)||null;saveData();toast('Campaign saved');});
document.querySelector('#dismissLevelUp').addEventListener('click',()=>document.querySelector('#levelUpOverlay').hidden=true);
document.querySelector('#exportButton').addEventListener('click',()=>{const payload={...data,exportedAt:new Date().toISOString(),app:'GoalRPG'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`goalrpg-backup-${todayKey}.json`;a.click();URL.revokeObjectURL(url);toast('Backup exported');});
document.querySelector('#importInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const restored=JSON.parse(await file.text());if(!restored.days)throw new Error();data=restored;ensureDataShape();
if(data.campaign.name==='Operation Visible Abs'){data.campaign.name='Visible Abs';persist();}persist();renderAll();document.querySelector('#storageStatus').textContent=`Restored ${Object.keys(data.days).length} days.`;toast('Backup restored');}catch{document.querySelector('#storageStatus').textContent='Invalid GoalRPG backup.';}e.target.value='';});
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.querySelector('#installButton').classList.remove('hidden');});
document.querySelector('#installButton').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;document.querySelector('#installButton').classList.add('hidden');});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
renderAll();
function previewReminder(){const el=document.querySelector('#notificationPreview');el.classList.add('show');clearTimeout(previewReminder.timer);previewReminder.timer=setTimeout(()=>el.classList.remove('show'),4200);}
document.querySelector('#previewNotificationButton').addEventListener('click',previewReminder);
setTimeout(previewReminder,900);
