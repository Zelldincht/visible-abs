const STORAGE_KEY = 'ova-data-v1';
const SCHEMA_VERSION = 3;
const PERFECT_DAY_XP = 250;
const METRICS = {
  weight: { title: 'Log weight', label: 'Weight (kg)', min: 20, max: 500, step: .1 },
  steps: { title: 'Log steps', label: 'Steps', min: 0, max: 200000, step: 1 },
  water: { title: 'Log water', label: 'Water (litres)', min: 0, max: 20, step: .1 },
  sleep: { title: 'Log sleep', label: 'Sleep (hours)', min: 0, max: 24, step: .1 }
};
const TITLES = ['Initiate','Apprentice','Adept','Disciplined','Vanguard','Guardian','Champion','Warden','Hero','Legend'];
const ACHIEVEMENT_REWARDS = {'first-step':10,'protocol-perfect':50,'three-day-flame':100,'meal-initiate':10,'meal-veteran':250,'xp-collector':100};
const emptyData = () => ({ schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), campaign: { name: 'Visible Abs', startingWeight: null, targetWeight: null }, targets: { steps: null, water: null, sleep: null }, questTemplates: [], days: {} });
let data = loadData();
let selectedMetric = null;
let installPrompt = null;
let todayKey = localDateKey();
ensureDataShape();
if(data.campaign.name==='Operation Visible Abs'){data.campaign.name='Visible Abs';persist();}
ensureToday();

function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
function getDay(key = todayKey) { if (!data.days[key]) { const weekday=dateFromKey(key).getDay(); data.days[key]={ quests:(data.questTemplates||[]).filter(q=>q.recurrence==='daily'||q.days?.includes(weekday)).map(q=>({id:q.id,name:q.name,xp:q.xp,completed:false,metric:q.metric||'',recurring:true})), metrics:{}, dayType:null, note:'' }; persist(); } return data.days[key]; }
function loadData() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)); return parsed?.days ? parsed : emptyData(); } catch { return emptyData(); } }
function ensureDataShape() {
  data.schemaVersion = SCHEMA_VERSION;
  data.campaign ||= { name: 'Visible Abs', startingWeight: null, targetWeight: null };
  data.campaign.name ||= 'Visible Abs';
  data.targets ||= { steps: null, water: null, sleep: null };
  data.questTemplates ||= [];
  data.unlockedAchievements ||= [];
  Object.values(data.days).forEach(day => { day.quests ||= []; day.metrics ||= {}; });
  if(!data.questTemplates.length){const latest=Object.entries(data.days).sort(([a],[b])=>b.localeCompare(a))[0]?.[1];if(latest?.quests?.length)data.questTemplates=latest.quests.map(q=>({id:q.id,name:q.name,xp:Number(q.xp)||10,metric:inferMetric(q.name),recurrence:'daily'}));}
  persist();
}
function inferMetric(name=''){const value=name.toLowerCase();if(value.includes('weight'))return 'weight';if(value.includes('step'))return 'steps';if(value.includes('water'))return 'water';if(value.includes('sleep'))return 'sleep';if(value.includes('workout')||value.includes('gym')||value.includes('rest'))return 'training';return '';}
function ensureToday(){getDay();}
function refreshToday(){const current=localDateKey();if(current===todayKey)return;todayKey=current;ensureToday();renderAll();toast('A new quest day has begun');}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveData() { persist(); renderAll(); }
function isPerfect(day) { return Boolean(day?.quests?.length) && day.quests.every(q => q.completed); }
function rawXp() { return Object.values(data.days).reduce((total,day) => total + day.quests.filter(q=>q.completed).reduce((sum,q)=>sum+Number(q.xp||0),0) + (isPerfect(day)?PERFECT_DAY_XP:0),0); }
function lifetimeXp() { return rawXp() + data.unlockedAchievements.reduce((sum,id)=>sum+(ACHIEVEMENT_REWARDS[id]||0),0); }
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
let audioContext;
let audioUnlocked=false;
function unlockAudio(){try{const AudioEngine=window.AudioContext||window.webkitAudioContext;if(!AudioEngine)return false;if(!audioContext){try{audioContext=new AudioEngine();}catch{audioContext=new AudioEngine;}}if(audioContext.state==='suspended')audioContext.resume();if(!audioUnlocked){const buffer=audioContext.createBuffer(1,1,22050),source=audioContext.createBufferSource(),gain=audioContext.createGain();gain.gain.value=.0001;source.buffer=buffer;source.connect(gain).connect(audioContext.destination);source.start(0);audioUnlocked=true;}return true;}catch{return false;}}
function playNotes(notes,type='square',volume=.1){if(!unlockAudio())return false;const ctx=audioContext,start=ctx.currentTime+.035;notes.forEach(([frequency,offset,duration])=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,start+offset);gain.gain.setValueAtTime(volume,start+offset);gain.gain.exponentialRampToValueAtTime(.001,start+offset+duration);osc.connect(gain).connect(ctx.destination);osc.start(start+offset);osc.stop(start+offset+duration);});return true;}
function playQuestSound(){playNotes([[659,0,.11],[880,.11,.16]],'square',.09);}
function playLevelSound(){playNotes([[523,0,.16],[659,.14,.16],[784,.28,.2],[1047,.46,.42]],'square',.12);}
function playAchievementSound(){playNotes([[784,0,.13],[988,.12,.13],[1175,.24,.17],[1568,.41,.36]],'triangle',.14);}
function showXp(amount) { const el=document.querySelector('#xpBurst'); el.textContent=`+${amount} XP`; el.classList.remove('play'); void el.offsetWidth; el.classList.add('play'); playQuestSound(); haptic(); }
function showLevelUp(level) { document.querySelector('#levelUpNumber').textContent=level; document.querySelector('#levelUpOverlay').hidden=false; haptic([80,40,120,40,180]); playLevelSound(); }
function showAchievement(name,reward){document.querySelector('#achievementUnlockName').textContent=name;document.querySelector('#achievementUnlockReward').textContent=`+${reward} XP`;document.querySelector('#achievementOverlay').hidden=false;haptic([40,35,80,35,140]);playAchievementSound();}
function renderAll(){ renderToday(); renderStatistics(); renderAchievements(); renderCampaign(); }
function renderToday(){
  const day=getDay(),xp=lifetimeXp(),info=levelInfo(xp),complete=day.quests.filter(q=>q.completed).length,total=day.quests.length,perfect=isPerfect(day),weight=latestWeight(),progress=campaignProgress(),streak=streakStats();
  document.querySelector('#campaignName').textContent=data.campaign.name;
  document.querySelector('#todayDate').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  document.querySelector('#levelNumber').textContent=info.level; document.querySelector('#headerLevel').textContent=info.level; document.querySelector('#levelName').textContent=info.name;
  document.querySelector('#xpLabel').textContent=`${xp-info.start} / ${info.end-info.start} XP`; document.querySelector('#xpProgress').style.width=`${info.progress}%`; document.querySelector('#headerXpBar').style.width=`${info.progress}%`;
  document.querySelector('#currentWeight').textContent=weight===null?'—':weight.toFixed(1); document.querySelector('#targetWeight').textContent=data.campaign.targetWeight??'—'; document.querySelector('#currentStreak').textContent=streak.current; document.querySelector('#campaignPercent').textContent=`${Math.round(progress)}%`; document.querySelector('#campaignProgress').style.width=`${progress}%`;
  document.querySelector('#questCounter').textContent=`${complete} / ${total} complete`; document.querySelector('#questBoardProgress').style.width=total?`${complete/total*100}%`:'0%'; document.querySelector('#perfectDayBonus').classList.toggle('earned',perfect);
  const list=document.querySelector('#questList'); list.innerHTML=day.quests.map(q=>`<div class="quest ${q.completed?'completed':''}"><input class="quest-check" type="checkbox" data-quest-id="${q.id}" ${q.completed?'checked':''} aria-label="Complete ${safeText(q.name)}"><button type="button" class="quest-title edit-quest">${safeText(q.name)}</button><span class="quest-xp">+${q.xp} XP</span><button class="delete-quest" data-delete-quest="${q.id}" aria-label="Delete ${safeText(q.name)}">×</button></div>`).join(''); document.querySelector('#emptyQuests').hidden=Boolean(total);
  for(const metric of Object.keys(METRICS)){const value=day.metrics?.[metric],target=data.targets?.[metric],label=value===undefined?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:1})+(target?' / '+target:'');document.getElementById(metric+'Value').textContent=label;}document.querySelector('#trainingValue').textContent=day.dayType?day.dayType[0].toUpperCase()+day.dayType.slice(1):'Choose'
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
  ['first-step','First Step','Complete your first quest',quests>=1,10],['protocol-perfect','Protocol Perfect','Complete one perfect day',perfect>=1,50],['three-day-flame','Three Day Flame','Reach a 3-day streak',streakStats().longest>=3,100],['meal-initiate','Meal Initiate','Complete your first meal',meals>=1,10],['meal-veteran','Meal Veteran','Complete 50 meals',meals>=50,250],['xp-collector','XP Collector','Earn 1,000 lifetime XP',xp>=1000,100]
]; }
function renderAchievements(){ document.querySelector('#achievementList').innerHTML=achievements().map(([id,name,desc,done,reward])=>`<article class="pixel-panel achievement ${done?'':'locked'}"><span class="achievement-icon">${done?'★':'?'}</span><div><strong>${name}</strong><small>${desc}</small></div><em>+${reward} XP</em></article>`).join(''); }
function checkNewAchievements(){ const award=achievements().find(([id,,,done])=>done&&!data.unlockedAchievements.includes(id)); if(!award)return; const [id,name,,done,reward]=award,before=levelInfo(lifetimeXp()).level; data.unlockedAchievements.push(id); persist(); renderAll(); showAchievement(name,reward); const after=levelInfo(lifetimeXp()).level; if(after>before)setTimeout(()=>showLevelUp(after),1700); }function renderCampaign(){document.querySelector('#campaignNameInput').value=data.campaign.name;document.querySelector('#startingWeightInput').value=data.campaign.startingWeight??'';document.querySelector('#targetWeightInput').value=data.campaign.targetWeight??'';for(const metric of ['steps','water','sleep'])document.getElementById(metric+'TargetInput').value=data.targets?.[metric]??'';}

function showRoute(){ const route=location.hash.slice(1)||'today'; document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===route)); document.querySelectorAll('.bottom-nav a').forEach(a=>a.classList.toggle('active',a.hash===`#${route}`)); window.scrollTo({top:0}); }
addEventListener('hashchange',showRoute); showRoute();
document.querySelector('#questList').addEventListener('change',e=>{ const id=e.target.dataset.questId;if(!id)return; const q=getDay().quests.find(x=>x.id===id);if(!q)return; const before=levelInfo(lifetimeXp()).level,wasPerfect=isPerfect(getDay()); q.completed=e.target.checked; persist(); const afterXp=lifetimeXp(),after=levelInfo(afterXp).level; renderAll(); if(q.completed){showXp(q.xp); setTimeout(checkNewAchievements,550); if(!wasPerfect&&isPerfect(getDay())){setTimeout(()=>showXp(PERFECT_DAY_XP),350);toast('Perfect Day!');} if(after>before)setTimeout(()=>showLevelUp(after),900);}else{toast('Quest reopened');} });
function openQuestDialog(quest=null){document.querySelector('#questForm').reset();document.querySelector('#questId').value=quest?.id||'';document.querySelector('#questDialogTitle').textContent=quest?'Edit quest':'New quest';document.querySelector('#questName').value=quest?.name||'';document.querySelector('#questXp').value=quest?.xp||40;document.querySelector('#questMetric').value=quest?.metric||inferMetric(quest?.name);document.querySelector('#questRecurrence').value=quest?.recurring===false?'once':'daily';document.querySelector('#questDialog').showModal();}
document.querySelector('#questList').addEventListener('click',e=>{const row=e.target.closest('.quest'),id=row?.querySelector('[data-quest-id]')?.dataset.questId;if(!id)return;if(e.target.closest('.delete-quest')){const q=getDay().quests.find(item=>item.id===id);getDay().quests=getDay().quests.filter(item=>item.id!==id);if(q?.recurring!==false)data.questTemplates=data.questTemplates.filter(item=>item.id!==id);saveData();toast('Quest removed');return;}if(e.target.closest('.edit-quest'))openQuestDialog(getDay().quests.find(item=>item.id===id));});
document.querySelector('#addQuestButton').addEventListener('click',()=>openQuestDialog());
document.querySelector('#questForm').addEventListener('submit',e=>{e.preventDefault();const id=document.querySelector('#questId').value,name=document.querySelector('#questName').value.trim(),xp=Number(document.querySelector('#questXp').value),metric=document.querySelector('#questMetric').value,recurrence=document.querySelector('#questRecurrence').value;if(!name||!Number.isFinite(xp))return;if(id){const quest=getDay().quests.find(q=>q.id===id);Object.assign(quest,{name,xp,metric,recurring:recurrence!=='once'});data.questTemplates=data.questTemplates.filter(q=>q.id!==id);if(recurrence==='daily')data.questTemplates.push({id,name,xp,metric,recurrence:'daily'});}else{const newId=crypto.randomUUID?.()||Date.now().toString();getDay().quests.push({id:newId,name,xp,metric,completed:false,recurring:recurrence!=='once'});if(recurrence==='daily')data.questTemplates.push({id:newId,name,xp,metric,recurrence:'daily'});}saveData();document.querySelector('#questDialog').close();toast('Quest saved');});
document.querySelectorAll('[data-open-metric]').forEach(button=>button.addEventListener('click',()=>{selectedMetric=button.dataset.openMetric;const cfg=METRICS[selectedMetric],input=document.querySelector('#metricInput');document.querySelector('#metricTitle').textContent=cfg.title;document.querySelector('#metricLabel').textContent=cfg.label;input.min=cfg.min;input.max=cfg.max;input.step=cfg.step;input.value=getDay().metrics?.[selectedMetric]??'';document.querySelector('#metricDialog').showModal();}));
function completeLinkedQuests(metric){const day=getDay(),target=data.targets?.[metric],qualifies=metric==='weight'||metric==='training'||(target!==null&&target!==undefined&&Number(day.metrics[metric])>=Number(target)),completed=[];if(!qualifies)return completed;day.quests.filter(q=>!q.completed&&(q.metric===metric||(!q.metric&&inferMetric(q.name)===metric))).forEach(q=>{q.completed=true;completed.push(q);});return completed;}
function celebrateLinked(completed,beforeLevel){if(!completed.length)return;showXp(completed.reduce((sum,q)=>sum+Number(q.xp||0),0));setTimeout(checkNewAchievements,550);const after=levelInfo(lifetimeXp()).level;if(after>beforeLevel)setTimeout(()=>showLevelUp(after),900);}
document.querySelector('#metricForm').addEventListener('submit',e=>{e.preventDefault();const input=document.querySelector('#metricInput'),value=Number(input.value),cfg=METRICS[selectedMetric];if(!Number.isFinite(value)||value<cfg.min||value>cfg.max)return;const before=levelInfo(lifetimeXp()).level;getDay().metrics[selectedMetric]=value;if(selectedMetric==='weight'&&!data.campaign.startingWeight)data.campaign.startingWeight=value;const completed=completeLinkedQuests(selectedMetric);saveData();document.querySelector('#metricDialog').close();celebrateLinked(completed,before);toast(completed.length?'Log saved · quest complete':'Log saved');});
document.querySelector('#campaignForm').addEventListener('submit',e=>{e.preventDefault();data.campaign.name=document.querySelector('#campaignNameInput').value.trim()||'Visible Abs';data.campaign.startingWeight=Number(document.querySelector('#startingWeightInput').value)||null;data.campaign.targetWeight=Number(document.querySelector('#targetWeightInput').value)||null;for(const metric of ['steps','water','sleep'])data.targets[metric]=Number(document.getElementById(metric+'TargetInput').value)||null;saveData();toast('Campaign and targets saved');});
document.querySelector('#trainingLogButton').addEventListener('click',()=>document.querySelector('#trainingDialog').showModal());
document.querySelector('#trainingForm').addEventListener('submit',e=>{e.preventDefault();const choice=e.submitter?.value;if(!['workout','rest'].includes(choice))return;const before=levelInfo(lifetimeXp()).level;getDay().dayType=choice;const completed=completeLinkedQuests('training');saveData();document.querySelector('#trainingDialog').close();celebrateLinked(completed,before);toast((choice==='workout'?'Workout':'Rest day')+' logged');});
document.querySelector('#dismissLevelUp').addEventListener('click',()=>document.querySelector('#levelUpOverlay').hidden=true);
document.querySelector('#dismissAchievement').addEventListener('click',()=>{document.querySelector('#achievementOverlay').hidden=true;setTimeout(checkNewAchievements,250);});
document.querySelector('#exportButton').addEventListener('click',()=>{const payload={...data,exportedAt:new Date().toISOString(),app:'GoalRPG'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`goalrpg-backup-${todayKey}.json`;a.click();URL.revokeObjectURL(url);toast('Backup exported');});
document.querySelector('#importInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const restored=JSON.parse(await file.text());if(!restored.days)throw new Error();data=restored;ensureDataShape();
if(data.campaign.name==='Operation Visible Abs'){data.campaign.name='Visible Abs';persist();}persist();renderAll();document.querySelector('#storageStatus').textContent=`Restored ${Object.keys(data.days).length} days.`;toast('Backup restored');}catch{document.querySelector('#storageStatus').textContent='Invalid GoalRPG backup.';}e.target.value='';});
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.querySelector('#installButton').classList.remove('hidden');});
document.querySelector('#installButton').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;document.querySelector('#installButton').classList.add('hidden');});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
renderAll();
function previewReminder(){const el=document.querySelector('#notificationPreview');el.classList.add('show');clearTimeout(previewReminder.timer);previewReminder.timer=setTimeout(()=>el.classList.remove('show'),4200);}
document.querySelector('#previewNotificationButton').addEventListener('click',previewReminder);
document.addEventListener('pointerdown',unlockAudio,{capture:true,once:true});
document.addEventListener('touchstart',unlockAudio,{capture:true,once:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(audioContext?.state==='suspended')audioContext.resume();refreshToday();}});
setInterval(refreshToday,60000);
document.querySelector('#soundTestButton').addEventListener('click',()=>{if(playNotes([[523,0,.16],[659,.14,.16],[784,.28,.2],[1047,.46,.42]],'square',.12)){toast('Sound test playing');}else toast('Sound is unavailable');});
setTimeout(previewReminder,900);
setTimeout(checkNewAchievements,1900);
