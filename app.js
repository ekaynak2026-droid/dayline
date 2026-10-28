'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromIso=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const TODAY=new Date();TODAY.setHours(0,0,0,0);const T=iso(TODAY);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const byTime=(a,b)=>(a.time||'99')<(b.time||'99')?-1:(a.time||'99')>(b.time||'99')?1:0;
const fmt=(d,o)=>d.toLocaleDateString('en-GB',o);
const VERSION='1.0';

const ICON={
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>',
  left:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  camera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  text:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 6h14M5 11h14M5 16h9"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="4" height="4" rx="1"/><rect x="4" y="14" width="4" height="4" rx="1"/><path d="M11 7h9M11 16h9"/></svg>',
  bell:'<svg class="bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-label="Has a reminder"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg>',
  save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/></svg>',
  open:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/></svg>'
};
const REMIND=[['','No reminder'],['0','At the time'],['10','10 minutes before'],['60','1 hour before'],['1440','1 day before']];
const remindSelect=(id,val)=>`<select id="${id}">${REMIND.map(([v,l])=>`<option value="${v}" ${String(val??'')===v?'selected':''}>${l}</option>`).join('')}</select>`;
const hasRemind=x=>x.remind!==''&&x.remind!=null;

/* ---------- storage (IndexedDB, falls back to localStorage) ---------- */
const empty=()=>({v:1,tasks:[],events:[],notes:[],vault:null,fired:{},installDismissed:false,lastBackup:null});
const dbp=new Promise(res=>{try{const r=indexedDB.open('dayline',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>res(null)}catch(e){res(null)}});
async function idbGet(k){const d=await dbp;if(!d){try{return JSON.parse(localStorage.getItem('dayline-'+k))}catch(e){return null}}
  return new Promise(res=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})}
async function idbSet(k,v){const d=await dbp;if(!d){localStorage.setItem('dayline-'+k,JSON.stringify(v));return}
  return new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
let S=empty(), askedPersist=false;
async function save(){
  try{await idbSet('state',S)}catch(e){toast('Could not save. Your phone may be out of space.')}
  if(!askedPersist&&navigator.storage&&navigator.storage.persist){askedPersist=true;navigator.storage.persist().catch(()=>{})}
}

/* ---------- locked notes: AES-GCM, key derived from the PIN ---------- */
let vaultKey=null, vaultNotes=[];
function b64(buf){const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pin,salt){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function sealVault(){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},vaultKey,new TextEncoder().encode(JSON.stringify(vaultNotes)));
  S.vault={salt:S.vault.salt,iv:b64(iv),data:b64(ct),count:vaultNotes.length};await save();
}
async function createVault(pin){const salt=crypto.getRandomValues(new Uint8Array(16));vaultKey=await deriveKey(pin,salt);S.vault={salt:b64(salt)};await sealVault()}
async function openVault(pin){
  const key=await deriveKey(pin,unb64(S.vault.salt));
  try{const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(S.vault.iv)},key,unb64(S.vault.data));vaultKey=key;vaultNotes=JSON.parse(new TextDecoder().decode(pt));return true}catch(e){return false}
}
function lockVault(){vaultKey=null;vaultNotes=[]}
function ensureVault(cb){if(!S.vault)pinSheet('set',cb);else if(!vaultKey)pinSheet('unlock',cb);else cb()}

/* ---------- ui helpers ---------- */
let noteFilter='all', calMonth=new Date(TODAY.getFullYear(),TODAY.getMonth(),1), selDay=T, tab='tasks', firstTasks=true;
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2200)}
function openSheet(html,mount){const s=$('#sheet'),p=s.querySelector('.panel');p.innerHTML=html;s.hidden=false;p.scrollTop=0;p.onkeydown=null;mount&&mount(p)}
function closeSheet(){$('#sheet').hidden=true}
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet'||e.target.closest('[data-close]'))closeSheet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#sheet').hidden)closeSheet()});
function download(name,text,type){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;renderTasks()});
window.addEventListener('appinstalled',()=>{installPrompt=null;renderTasks()});
async function runInstall(){if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice.catch(()=>{});installPrompt=null;renderTasks()}
const installSteps=()=>isIOS
  ?`<ol class="steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (the square with an arrow pointing up).</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>`
  :installPrompt?`<p style="margin:0">Tap the button to add Dayline to your home screen.</p>`
  :`<ol class="steps"><li>Open this page in <b>Chrome</b>.</li><li>Tap the <b>⋮</b> menu at the top right.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol>`;

/* ---------- reminders ---------- */
function dueAt(x){const[h,m]=(x.time||'09:00').split(':').map(Number);const d=fromIso(x.date);d.setHours(h,m,0,0);return d.getTime()-(+x.remind)*60000}
function whenText(x){const d=fromIso(x.date);const day=x.date===T?'Today':x.date===iso(addDays(TODAY,1))?'Tomorrow':fmt(d,{weekday:'long',day:'numeric',month:'long'});return x.time?`${day} at ${x.time}`:day}
async function notify(title,body){
  toast('Reminder: '+title);
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  try{const reg=await navigator.serviceWorker?.getRegistration();const opts={body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:title+body};
    if(reg)await reg.showNotification(title,opts);else new Notification(title,opts)}catch(e){}
}
function checkReminders(){
  const now=Date.now();let changed=false;
  for(const x of [...S.tasks.filter(t=>!t.done),...S.events]){
    if(!hasRemind(x))continue;const at=dueAt(x),key=x.id+'@'+at;
    if(now>=at&&now-at<12*3600e3&&at>=(x.rset||0)-60000&&!S.fired[key]){S.fired[key]=now;changed=true;notify(x.text||x.title,whenText(x))}
  }
  for(const k in S.fired)if(now-S.fired[k]>7*864e5){delete S.fired[k];changed=true}
  if(changed)save();
}
async function enableReminders(){
  if(!('Notification' in window)){toast(isIOS&&!standalone()?'Add Dayline to your Home Screen first':'This browser cannot show reminders');return}
  const r=await Notification.requestPermission();
  toast(r==='granted'?'Reminders are on':'Reminders are blocked. You can allow them in your phone settings.');settingsSheet();
}

/* ---------- tasks ---------- */
const taskRow=t=>`<li class="task ${t.done?'done':''}" data-id="${t.id}"><button class="check" data-act="toggle" aria-label="${t.done?'Mark as not done':'Mark as done'}">${t.done?ICON.check:''}</button><button class="t" data-act="edit-task">${esc(t.text)}</button>${hasRemind(t)&&!t.done?ICON.bell:''}${t.time?`<span class="time">${t.time}</span>`:''}</li>`;
const evRow=e=>`<li class="evrow c${e.color}" data-id="${e.id}"><span class="bar"></span><button class="t" data-act="edit-event">${esc(e.title)}</button>${hasRemind(e)?ICON.bell:''}<span class="time">${e.time||'All day'}</span></li>`;
function dayKeys(){
  const set=new Set();for(let i=-14;i<=60;i++)set.add(iso(addDays(TODAY,i)));
  S.tasks.forEach(t=>set.add(t.date));S.events.forEach(e=>{if(e.date>=iso(addDays(TODAY,-14)))set.add(e.date)});
  return [...set].sort();
}
function renderTasks(){
  const v=$('#v-tasks'),keep=v.scrollTop;
  const overdue=S.tasks.filter(t=>!t.done&&t.date<T).length;
  let h=`<header class="top"><h1>Tasks</h1><div class="topbtns"><button class="pill" data-act="today">Today</button><button class="iconbtn" data-act="settings" aria-label="Settings">${ICON.gear}</button></div></header>`;
  if(!standalone()&&!S.installDismissed)h+=`<div class="banner"><div><b>Put Dayline on your home screen</b> so it opens like a normal app and works without internet.</div>${installSteps()}<div class="btns">${installPrompt?'<button class="pill on" data-act="install">Install</button>':''}<button class="pill" data-act="dismiss-install">Not now</button></div></div>`;
  for(const k of dayKeys()){
    const d=fromIso(k),i=Math.round((d-TODAY)/864e5);
    const ts=S.tasks.filter(t=>t.date===k).sort(byTime),es=S.events.filter(e=>e.date===k).sort(byTime);
    const name=i===0?'Today':i===1?'Tomorrow':i===-1?'Yesterday':fmt(d,{weekday:'long'});
    const sub=Math.abs(i)<=1?fmt(d,{weekday:'short',day:'numeric',month:'long'}):fmt(d,{day:'numeric',month:'long',...(d.getFullYear()!==TODAY.getFullYear()?{year:'numeric'}:{})});
    h+=`<section class="day${i===0?' is-today':''}${i<0?' is-past':''}" data-day="${k}"><h2><span>${name}</span><small>${sub}</small></h2>`;
    if(i===0&&overdue)h+=`<div class="carry"><span>${overdue} unfinished from earlier days</span><button data-act="carry">Move to today</button></div>`;
    if(i===0&&!S.tasks.length)h+=`<p class="firstrun">Type below to add your first task. Tap + to give it a time or a reminder.</p>`;
    h+=`<ul class="items">${es.map(evRow).join('')}${ts.map(taskRow).join('')}</ul>`;
    h+=`<form class="add" data-date="${k}"><span class="plus" aria-hidden="true">+</span><input id="add-${k}" aria-label="Add a task for ${esc(name)}" placeholder="${i===0?'Add a task for today':'Add a task'}" autocomplete="off" enterkeyhint="done"></form></section>`;
  }
  v.innerHTML=h;v.scrollTop=keep;
}
function scrollToDay(k,smooth){const v=$('#v-tasks'),sec=v.querySelector(`section[data-day="${k}"]`);if(!sec)return;v.scrollTo({top:sec.offsetTop-v.querySelector('.top').offsetHeight-2,behavior:smooth?'smooth':'auto'})}
$('#v-tasks').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const id=b.closest('[data-id]')?.dataset.id;
  switch(b.dataset.act){
    case 'toggle':{const t=S.tasks.find(x=>x.id===id);t.done=!t.done;save();renderTasks();break}
    case 'edit-task':taskSheet(S.tasks.find(x=>x.id===id));break;
    case 'edit-event':eventSheet(S.events.find(x=>x.id===id));break;
    case 'carry':S.tasks.forEach(t=>{if(!t.done&&t.date<T)t.date=T});save();renderTasks();toast('Moved to today');break;
    case 'today':scrollToDay(T,true);break;
    case 'settings':settingsSheet();break;
    case 'install':runInstall();break;
    case 'dismiss-install':S.installDismissed=true;save();renderTasks();toast('You can find this again in Settings');break;
  }
});
$('#v-tasks').addEventListener('submit',e=>{
  e.preventDefault();const f=e.target,inp=f.querySelector('input'),val=inp.value.trim();if(!val)return;
  S.tasks.push({id:uid(),text:val,date:f.dataset.date,time:'',remind:'',done:false});save();renderTasks();
  document.getElementById(inp.id)?.focus({preventScroll:true});
});
function taskSheet(t,date){
  const isNew=!t;t=t||{id:uid(),text:'',date:date||T,time:'',remind:'',done:false};
  openSheet(`<h3>${isNew?'New task':'Edit task'}</h3><form id="f-task">
    <label for="ft-text">Task</label><input id="ft-text" value="${esc(t.text)}" placeholder="What do you need to do?" autocomplete="off">
    <div class="row2"><div><label for="ft-date">Day</label><input type="date" id="ft-date" value="${t.date}"></div><div><label for="ft-time">Time (optional)</label><input type="time" id="ft-time" value="${t.time}"></div></div>
    <label for="ft-remind">Reminder</label>${remindSelect('ft-remind',t.remind)}
    <div class="actions">${isNew?'':'<button type="button" class="ghost danger" id="ft-del">Delete</button>'}<button type="button" class="ghost" data-close>Cancel</button><button class="primary">Save</button></div></form>`,p=>{
    p.querySelector('#f-task').onsubmit=e=>{e.preventDefault();const txt=p.querySelector('#ft-text').value.trim();if(!txt){p.querySelector('#ft-text').focus();return}
      t.text=txt;t.date=p.querySelector('#ft-date').value||T;t.time=p.querySelector('#ft-time').value;t.remind=p.querySelector('#ft-remind').value;t.rset=Date.now();
      if(isNew)S.tasks.push(t);save();closeSheet();renderAll();toast(isNew?'Task added':'Task saved');remindHint(t)};
    p.querySelector('#ft-del')?.addEventListener('click',()=>{S.tasks=S.tasks.filter(x=>x.id!==t.id);save();closeSheet();renderAll();toast('Task deleted')});
    if(isNew)p.querySelector('#ft-text').focus();
  });
}
function remindHint(x){if(hasRemind(x)&&'Notification' in window&&Notification.permission==='default')setTimeout(()=>toast('Turn on reminders in Settings to get alerts'),2300)}

/* ---------- calendar ---------- */
function renderCal(){
  const v=$('#v-calendar'),y=calMonth.getFullYear(),m=calMonth.getMonth();
  const first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=addDays(first,-offset);
  const weeks=Math.ceil((offset+new Date(y,m+1,0).getDate())/7);
  let h=`<header class="top"><h1>${fmt(first,{month:'long'})} <span style="color:var(--muted);font-weight:600">${y}</span></h1><div class="monthnav"><button data-act="prev" aria-label="Previous month">${ICON.left}</button><button data-act="next" aria-label="Next month">${ICON.right}</button></div></header>`;
  h+=`<div class="wk">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<span>${w}</span>`).join('')}</div><div class="grid">`;
  for(let i=0;i<weeks*7;i++){
    const d=addDays(start,i),k=iso(d),evs=S.events.filter(e=>e.date===k).sort(byTime);
    h+=`<button class="cell${d.getMonth()!==m?' out':''}${k===T?' today':''}${k===selDay?' sel':''}" data-act="day" data-date="${k}" aria-label="${fmt(d,{weekday:'long',day:'numeric',month:'long'})}, ${evs.length} events"><span class="n">${d.getDate()}</span>${evs.slice(0,2).map(e=>`<span class="ev c${e.color}">${esc(e.title)}</span>`).join('')}${evs.length>2?`<span class="more">+${evs.length-2} more</span>`:''}</button>`;
  }
  h+='</div>';
  const sd=fromIso(selDay),evs=S.events.filter(e=>e.date===selDay).sort(byTime),tc=S.tasks.filter(t=>t.date===selDay&&!t.done).length;
  h+=`<section class="agenda"><h3>${selDay===T?'Today, ':''}${fmt(sd,{weekday:'long',day:'numeric',month:'long'})}</h3>`;
  h+=evs.length?`<ul class="items">${evs.map(evRow).join('')}</ul>`:`<p class="empty">Nothing pinned on this day yet.</p>`;
  h+=`<div class="linkrow"><button class="linkbtn" data-act="add-event">+ Add event</button>${tc?`<button class="linkbtn" data-act="see-tasks">See ${tc} open task${tc>1?'s':''}</button>`:''}${selDay!==T?'<button class="linkbtn" data-act="go-today">Back to today</button>':''}</div></section>`;
  v.innerHTML=h;
}
$('#v-calendar').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  switch(b.dataset.act){
    case 'prev':calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()-1,1);renderCal();break;
    case 'next':calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+1,1);renderCal();break;
    case 'day':{selDay=b.dataset.date;const d=fromIso(selDay);if(d.getMonth()!==calMonth.getMonth())calMonth=new Date(d.getFullYear(),d.getMonth(),1);renderCal();break}
    case 'go-today':selDay=T;calMonth=new Date(TODAY.getFullYear(),TODAY.getMonth(),1);renderCal();break;
    case 'add-event':eventSheet(null,selDay);break;
    case 'edit-event':eventSheet(S.events.find(x=>x.id===b.closest('[data-id]').dataset.id));break;
    case 'see-tasks':{const k=selDay;location.hash='#tasks';setTimeout(()=>scrollToDay(k,true),30);break}
  }
});
const icsEsc=s=>String(s).replace(/[\\;,]/g,c=>'\\'+c).replace(/\n/g,'\\n');
const utcStamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
function icsFor(ev){
  const dt=ev.date.replace(/-/g,'');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Dayline//Planner//EN','BEGIN:VEVENT','UID:'+ev.id+'@dayline','DTSTAMP:'+utcStamp(new Date())];
  if(ev.time)L.push('DTSTART:'+dt+'T'+ev.time.replace(':','')+'00','DURATION:PT1H');
  else L.push('DTSTART;VALUE=DATE:'+dt,'DTEND;VALUE=DATE:'+iso(addDays(fromIso(ev.date),1)).replace(/-/g,''));
  L.push('SUMMARY:'+icsEsc(ev.title));
  if(hasRemind(ev))L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(ev.title),'TRIGGER:-PT'+(+ev.remind)+'M','END:VALARM');
  L.push('END:VEVENT','END:VCALENDAR');return L.join('\r\n');
}
function eventSheet(ev,date){
  const isNew=!ev;ev=ev||{id:uid(),title:'',date:date||T,time:'',remind:'',color:1};
  const sw=[1,2,3,4].map(c=>`<label class="c${c}"><input type="radio" name="fe-color" value="${c}" ${ev.color==c?'checked':''} aria-label="Colour ${c}"><span></span></label>`).join('');
  openSheet(`<h3>${isNew?'New event':'Edit event'}</h3><form id="f-ev">
    <label for="fe-title">Event</label><input id="fe-title" value="${esc(ev.title)}" placeholder="e.g. Dentist, Birthday, Flight" autocomplete="off">
    <div class="row2"><div><label for="fe-date">Date</label><input type="date" id="fe-date" value="${ev.date}"></div><div><label for="fe-time">Time (empty = all day)</label><input type="time" id="fe-time" value="${ev.time}"></div></div>
    <label for="fe-remind">Reminder</label>${remindSelect('fe-remind',ev.remind)}
    <label>Colour</label><div class="swatches">${sw}</div>
    <div><button type="button" class="ghost" id="fe-ics" style="padding-left:0;color:var(--accent)">Also add to my phone's calendar</button></div>
    <div class="actions">${isNew?'':'<button type="button" class="ghost danger" id="fe-del">Delete</button>'}<button type="button" class="ghost" data-close>Cancel</button><button class="primary">Save</button></div></form>`,p=>{
    const read=()=>({...ev,title:p.querySelector('#fe-title').value.trim(),date:p.querySelector('#fe-date').value||T,time:p.querySelector('#fe-time').value,remind:p.querySelector('#fe-remind').value,color:+(p.querySelector('[name=fe-color]:checked')?.value||1)});
    p.querySelector('#f-ev').onsubmit=e=>{e.preventDefault();const n=read();if(!n.title){p.querySelector('#fe-title').focus();return}
      Object.assign(ev,n);ev.rset=Date.now();if(isNew)S.events.push(ev);save();closeSheet();selDay=ev.date;const d=fromIso(ev.date);calMonth=new Date(d.getFullYear(),d.getMonth(),1);renderAll();toast(isNew?'Event pinned':'Event saved');remindHint(ev)};
    p.querySelector('#fe-ics').onclick=()=>{const n=read();if(!n.title){toast('Give the event a name first');return}download((n.title.replace(/[^\w ]+/g,'').trim()||'event')+'.ics',icsFor(n),'text/calendar')};
    p.querySelector('#fe-del')?.addEventListener('click',()=>{S.events=S.events.filter(x=>x.id!==ev.id);save();closeSheet();renderAll();toast('Event deleted')});
    if(isNew)p.querySelector('#fe-title').focus();
  });
}

/* ---------- notes ---------- */
function ago(ts){const d=new Date(ts);d.setHours(0,0,0,0);const n=Math.round((TODAY-d)/864e5);return n<=0?'Today':n===1?'Yesterday':fmt(d,{day:'numeric',month:'short'})}
function noteCard(n){
  let prev;
  if(n.type==='list'){const left=n.items.filter(i=>!i.done).length;prev=`<ul class="mini">${n.items.slice(0,5).map(i=>`<li class="${i.done?'done':''}">${esc(i.t)}</li>`).join('')}</ul><span class="meta">${left} of ${n.items.length} left</span>`}
  else prev=n.body?`<p class="body">${esc(n.body)}</p>`:'';
  return `<button class="note" data-act="open-note" data-id="${n.id}">${n.photo?`<img src="${n.photo}" alt="">`:''}<strong>${esc(n.title||'Untitled')}</strong>${prev}<span class="meta">${n.locked?ICON.lock:''}${ago(n.updated)}</span></button>`;
}
function renderNotes(){
  const v=$('#v-notes'),open=[...S.notes].sort((a,b)=>b.updated-a.updated),locked=[...vaultNotes].sort((a,b)=>b.updated-a.updated);
  const shown=open.filter(n=>noteFilter==='all'||(noteFilter==='lists'&&n.type==='list')||(noteFilter==='photos'&&n.photo));
  const chip=(k,l)=>`<button class="pill${noteFilter===k?' on':''}" data-act="filter" data-f="${k}">${l}</button>`;
  let h=`<header class="top"><h1>Notes</h1></header><div class="chips">${chip('all','All')}${chip('lists','Checklists')}${chip('photos','With photos')}</div>`;
  h+=`<div class="notes">${shown.length?shown.map(noteCard).join(''):`<p class="emptystate">${noteFilter==='photos'?'No photo notes yet. Tap + and choose "Photo note".':noteFilter==='lists'?'No checklists yet. Tap + and choose "Checklist".':'No notes yet. Tap + to write one, like a shopping list.'}</p>`}</div>`;
  h+=`<div class="section-h"><h2>${ICON.lock} Locked notes</h2>${vaultKey?`<button class="pill" data-act="relock">Lock now</button>`:''}</div>`;
  if(vaultKey)h+=locked.length?`<div class="notes">${locked.map(noteCard).join('')}</div>`:`<p class="emptystate">No locked notes yet. Tap + and choose "Locked note".</p>`;
  else{const c=S.vault?.count||0;h+=`<button class="vault" data-act="unlock"><span class="ico">${ICON.lock}</span><span><b>${S.vault?`${c} locked note${c===1?'':'s'}`:'Set up locked notes'}</b><span>${S.vault?'Tap and enter your PIN to open':'For passwords, codes and other private things. Choose a 6-digit PIN.'}</span></span></button>`}
  h+=`<p class="fine">Locked notes are encrypted on this phone with your PIN. Nobody, including me, can open them without it, so keep your PIN somewhere safe. They lock again a minute after you leave the app.</p>`;
  v.innerHTML=h;
}
$('#v-notes').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  switch(b.dataset.act){
    case 'filter':noteFilter=b.dataset.f;renderNotes();break;
    case 'open-note':{const n=S.notes.find(n=>n.id===b.dataset.id)||vaultNotes.find(n=>n.id===b.dataset.id);if(n)noteSheet(n,false);break}
    case 'unlock':ensureVault(renderNotes);break;
    case 'relock':lockVault();renderNotes();toast('Locked');break;
  }
});
function newNoteChooser(){
  openSheet(`<h3>New note</h3><div class="choices">
    <button class="choice" data-k="text"><span class="ico">${ICON.text}</span><span><b>Text note</b><span>Anything to remember for later</span></span></button>
    <button class="choice" data-k="list"><span class="ico">${ICON.list}</span><span><b>Checklist</b><span>Shopping lists, packing lists, things to buy</span></span></button>
    <button class="choice" data-k="photo"><span class="ico">${ICON.camera}</span><span><b>Photo note</b><span>A picture with a few words, like a parking spot or a receipt</span></span></button>
    <button class="choice" data-k="locked"><span class="ico">${ICON.lock}</span><span><b>Locked note</b><span>Passwords and codes, encrypted with your PIN</span></span></button>
    </div>`,p=>p.querySelectorAll('.choice').forEach(c=>c.onclick=()=>{
      const k=c.dataset.k,n={id:uid(),type:k==='list'?'list':'text',title:'',body:'',items:[],photo:null,locked:k==='locked',updated:Date.now()};
      if(k==='locked')ensureVault(()=>{renderNotes();noteSheet(n,true)});else noteSheet(n,true,k==='photo');
    }));
}
function shrink(file,cb){const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const m=1200,sc=Math.min(1,m/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.75))};img.onerror=()=>toast('That file is not a photo Dayline can read');img.src=r.result};r.readAsDataURL(file)}
async function storeNote(w){
  const wasLocked=vaultNotes.some(x=>x.id===w.id);
  S.notes=S.notes.filter(x=>x.id!==w.id);vaultNotes=vaultNotes.filter(x=>x.id!==w.id);
  if(w.locked)vaultNotes.push(w);else S.notes.push(w);
  if(w.locked||wasLocked)await sealVault();else await save();
}
async function removeNote(w){const wasLocked=vaultNotes.some(x=>x.id===w.id);S.notes=S.notes.filter(x=>x.id!==w.id);vaultNotes=vaultNotes.filter(x=>x.id!==w.id);if(wasLocked)await sealVault();else await save()}
function noteSheet(n,isNew,pickPhoto){
  const w=JSON.parse(JSON.stringify(n));w.items=w.items||[];
  const itemRow=i=>`<li><input type="checkbox" class="li-done" ${i.done?'checked':''} aria-label="Done"><input class="li-text" value="${esc(i.t)}" placeholder="Item" aria-label="Item" enterkeyhint="next"><button type="button" class="x" data-rm aria-label="Remove item">×</button></li>`;
  const title=isNew?(w.type==='list'?'New checklist':pickPhoto?'New photo note':w.locked?'New locked note':'New note'):'Edit note';
  openSheet(`<h3>${title}</h3><form id="f-note">
    <label for="fn-title">Title</label><input id="fn-title" value="${esc(w.title)}" placeholder="${w.type==='list'?'e.g. Shopping list':w.locked?'e.g. Bank app login':'e.g. Where I parked'}" autocomplete="off">
    ${w.type==='list'?`<label>Items</label><ul class="items-ed" id="fn-items">${(w.items.length?w.items:[{t:'',done:false}]).map(itemRow).join('')}</ul><div><button type="button" class="ghost" id="fn-add" style="padding-left:0;color:var(--accent)">+ Add item</button></div>`
      :`<label for="fn-body">Note</label><textarea id="fn-body" rows="5" placeholder="Write anything…">${esc(w.body)}</textarea>`}
    <div class="photo-ed"><img id="fn-img" ${w.photo?`src="${w.photo}"`:'hidden'} alt="Attached photo"><label class="filebtn" for="fn-file">${ICON.camera}<span id="fn-filelbl">${w.photo?'Change photo':'Attach a photo'}</span></label><input type="file" id="fn-file" accept="image/*" hidden><button type="button" class="ghost" id="fn-rmphoto" ${w.photo?'':'hidden'}>Remove photo</button></div>
    <label class="toggle"><input type="checkbox" id="fn-lock" ${w.locked?'checked':''}> Keep in locked notes (encrypted, needs your PIN)</label>
    <div class="actions">${isNew?'':'<button type="button" class="ghost danger" id="fn-del">Delete</button>'}<button type="button" class="ghost" data-close>Cancel</button><button class="primary">Save</button></div></form>`,p=>{
    const list=p.querySelector('#fn-items');
    const addItem=after=>{const tmp=document.createElement('ul');tmp.innerHTML=itemRow({t:'',done:false});const li=tmp.firstElementChild;after?after.after(li):list.append(li);li.querySelector('.li-text').focus()};
    if(list){
      p.querySelector('#fn-add').onclick=()=>addItem();
      list.addEventListener('click',e=>{if(e.target.closest('[data-rm]'))e.target.closest('li').remove()});
      list.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList.contains('li-text')){e.preventDefault();addItem(e.target.closest('li'))}});
    }
    const file=p.querySelector('#fn-file'),img=p.querySelector('#fn-img'),rm=p.querySelector('#fn-rmphoto');
    file.onchange=()=>{const f=file.files[0];if(!f)return;shrink(f,url=>{w.photo=url;img.src=url;img.hidden=false;rm.hidden=false;p.querySelector('#fn-filelbl').textContent='Change photo'})};
    rm.onclick=()=>{w.photo=null;img.hidden=true;img.removeAttribute('src');rm.hidden=true;p.querySelector('#fn-filelbl').textContent='Attach a photo'};
    p.querySelector('#f-note').onsubmit=e=>{
      e.preventDefault();
      w.title=p.querySelector('#fn-title').value.trim();
      if(w.type==='list')w.items=[...list.querySelectorAll('li')].map(li=>({t:li.querySelector('.li-text').value.trim(),done:li.querySelector('.li-done').checked})).filter(i=>i.t);
      else w.body=p.querySelector('#fn-body').value;
      if(!w.title&&!w.body&&!w.items.length&&!w.photo){toast('Write something first');return}
      w.locked=p.querySelector('#fn-lock').checked;w.updated=Date.now();
      const done=async()=>{try{await storeNote(w);closeSheet();renderNotes();toast(w.locked?'Saved and locked':'Note saved')}catch(err){toast('Could not save the note')}};
      if(w.locked&&!vaultKey){closeSheet();ensureVault(done)}else done();
    };
    p.querySelector('#fn-del')?.addEventListener('click',async()=>{await removeNote(w);closeSheet();renderNotes();toast('Note deleted')});
    if(pickPhoto)setTimeout(()=>file.click(),50);else if(isNew)p.querySelector('#fn-title').focus();
  });
}

/* ---------- PIN pad ---------- */
const PINLEN=6;
function pinSheet(mode,then){
  let entry='',first=null,busy=false;
  const setup=mode==='set'||mode==='change';
  const head=mode==='change'?'Choose a new 6-digit PIN':setup?'Choose a 6-digit PIN':'Enter your PIN';
  const sub=setup?'You will type it to open locked notes. If you forget it, those notes cannot be recovered.':'Locked notes stay encrypted until you enter it.';
  openSheet(`<div class="pinwrap"><h3 id="pin-h">${head}</h3><p id="pin-p">${sub}</p>
    <div class="dots" id="pin-dots">${'<i></i>'.repeat(PINLEN)}</div><p class="err" id="pin-err" hidden></p>
    <div class="pad">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>`<button type="button" data-k="${k}" ${k==='⌫'?'aria-label="Delete digit"':''}>${k}</button>`).join('')}</div>
    <button type="button" class="ghost" data-close>Cancel</button></div>`,p=>{
    const dots=p.querySelector('#pin-dots'),err=p.querySelector('#pin-err'),H=p.querySelector('#pin-h'),P=p.querySelector('#pin-p');
    const draw=()=>dots.querySelectorAll('i').forEach((d,i)=>d.classList.toggle('on',i<entry.length));
    const fail=m=>{err.textContent=m;err.hidden=false;dots.classList.remove('shake');void dots.offsetWidth;dots.classList.add('shake');entry='';draw()};
    const press=async k=>{
      if(busy)return;
      if(k==='⌫'){entry=entry.slice(0,-1);draw();return}
      if(entry.length>=PINLEN)return;entry+=k;draw();err.hidden=true;
      if(entry.length<PINLEN)return;
      if(setup&&first===null){first=entry;entry='';setTimeout(draw,150);H.textContent='Type it once more';P.textContent='Just to be sure it is right.';return}
      if(setup&&entry!==first){first=null;H.textContent=head;P.textContent=sub;fail('Those did not match. Start again.');return}
      busy=true;P.textContent=setup?'Securing your notes…':'Checking…';
      try{
        if(setup){
          if(mode==='change'){const salt=crypto.getRandomValues(new Uint8Array(16));vaultKey=await deriveKey(entry,salt);S.vault.salt=b64(salt);await sealVault()}
          else await createVault(entry);
          closeSheet();toast(mode==='change'?'PIN changed':'PIN set. Locked notes are ready');then&&then();
        }else if(await openVault(entry)){closeSheet();then&&then()}
        else{busy=false;P.textContent=sub;fail('Wrong PIN. Try again.')}
      }catch(e){busy=false;P.textContent=sub;fail('Locked notes need a secure (https) connection.')}
    };
    p.querySelector('.pad').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b&&b.dataset.k!=='')press(b.dataset.k)});
    p.onkeydown=e=>{if(/^\d$/.test(e.key))press(e.key);else if(e.key==='Backspace')press('⌫')};
    p.querySelector('[data-k="1"]').focus();
  });
}

/* ---------- settings, backup ---------- */
function settingsSheet(){
  const perm='Notification' in window?Notification.permission:'unsupported';
  const remindState=perm==='granted'?'<b>Reminders are on.</b>':perm==='denied'?'<b>Reminders are blocked.</b> Allow notifications for Dayline in your phone settings.':isIOS&&!standalone()?'On iPhone, add Dayline to your Home Screen first, then turn reminders on here.':perm==='unsupported'?'This browser cannot show reminders.':'Reminders are off.';
  openSheet(`<h3>Settings</h3><div class="settings">
    <h4>Reminders</h4>
    <p class="firstrun" style="margin:0">${remindState} Reminders pop up when Dayline is open or running in the background. For events you must not miss, use "Also add to my phone's calendar" on the event.</p>
    ${perm==='default'?'<button class="primary" id="st-remind">Turn on reminders</button>':''}
    <h4>Backup</h4>
    <p class="firstrun" style="margin:0">Everything is stored only on this phone. Save a backup file now and then, for example to iCloud Drive or Google Drive. ${S.lastBackup?`Last backup: ${ago(S.lastBackup)}.`:'You have not made a backup yet.'}</p>
    <button class="choice" id="st-backup"><span class="ico">${ICON.save}</span><span><b>Save a backup file</b><span>Locked notes stay encrypted inside it</span></span></button>
    <label class="choice" for="st-file" style="margin:0;text-transform:none;letter-spacing:0;font-size:inherit;color:inherit;font-weight:inherit;cursor:pointer"><span class="ico">${ICON.open}</span><span><b>Restore from a backup file</b><span>Replaces what is on this phone</span></span></label><input type="file" id="st-file" accept="application/json,.json" hidden>
    <h4>Locked notes</h4>
    ${S.vault?`<button class="choice" id="st-pin"><span class="ico">${ICON.lock}</span><span><b>Change my PIN</b><span>You will need your current PIN first</span></span></button>
      <button class="ghost danger" id="st-forgot" style="margin:0;text-align:left;padding-left:0">I forgot my PIN</button>`:'<p class="firstrun" style="margin:0">Not set up yet. Open the Notes tab to start.</p>'}
    ${standalone()?'':`<h4>Install</h4>${installSteps()}${installPrompt?'<button class="primary" id="st-install">Install Dayline</button>':''}`}
    <p class="fine">Dayline ${VERSION}</p>
    <div class="actions"><button class="primary" data-close>Done</button></div></div>`,p=>{
    p.querySelector('#st-remind')?.addEventListener('click',enableReminders);
    p.querySelector('#st-install')?.addEventListener('click',runInstall);
    p.querySelector('#st-backup').onclick=async()=>{S.lastBackup=Date.now();await save();download(`dayline-backup-${iso(new Date())}.json`,JSON.stringify({app:'dayline',saved:new Date().toISOString(),state:S}),'application/json');toast('Backup file saved')};
    p.querySelector('#st-file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{
      try{const d=JSON.parse(r.result),st=d.state||d;if(!Array.isArray(st.tasks)||!Array.isArray(st.events)||!Array.isArray(st.notes))throw 0;confirmRestore(st,d.saved)}catch(err){toast('That is not a Dayline backup file')}};r.readAsText(f)};
    p.querySelector('#st-pin')?.addEventListener('click',()=>ensureVault(()=>pinSheet('change')));
    p.querySelector('#st-forgot')?.addEventListener('click',forgotPin);
  });
}
function confirmRestore(st,saved){
  openSheet(`<h3>Restore this backup?</h3><div class="warnbox">This replaces all tasks, events and notes on this phone with the backup${saved?` from ${fmt(new Date(saved),{day:'numeric',month:'long',year:'numeric'})}`:''}: ${st.tasks.length} tasks, ${st.events.length} events, ${st.notes.length+(st.vault?.count||0)} notes.</div>
    <div class="actions"><button class="ghost" data-close>Cancel</button><button class="primary" id="rs-go">Restore</button></div>`,p=>{
    p.querySelector('#rs-go').onclick=async()=>{S={...empty(),...st};lockVault();await save();closeSheet();renderAll();toast('Backup restored')};
  });
}
function forgotPin(){
  openSheet(`<h3>Forgot your PIN?</h3><div class="warnbox">Locked notes are encrypted with your PIN, so without it they cannot be opened by anyone. If you restore an older backup, use the PIN you had then. The only other option is to delete the ${S.vault?.count||0} locked notes and choose a new PIN.</div>
    <div class="actions"><button class="ghost" data-close>Keep them</button><button class="primary" id="fg-go" style="background:var(--danger)">Delete locked notes</button></div>`,p=>{
    p.querySelector('#fg-go').onclick=async()=>{S.vault=null;lockVault();await save();closeSheet();renderNotes();toast('Locked notes deleted')};
  });
}

/* ---------- tabs and start-up ---------- */
function renderAll(){renderTasks();renderCal();renderNotes()}
function show(){
  const h=location.hash.slice(1);tab=['tasks','calendar','notes'].includes(h)?h:'tasks';
  ['tasks','calendar','notes'].forEach(n=>$('#v-'+n).hidden=n!==tab);
  document.querySelectorAll('.tabs a').forEach(a=>{if(a.dataset.tab===tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  $('#fab').setAttribute('aria-label',tab==='tasks'?'Add task':tab==='calendar'?'Add event':'New note');
  if(tab==='tasks'&&firstTasks){firstTasks=false;requestAnimationFrame(()=>scrollToDay(T))}
}
$('#fab').onclick=()=>tab==='tasks'?taskSheet(null,T):tab==='calendar'?eventSheet(null,selDay):newNoteChooser();
window.addEventListener('hashchange',show);
let lockTimer;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){lockTimer=setTimeout(()=>{if(vaultKey){lockVault();renderNotes()}},60000)}
  else{clearTimeout(lockTimer);if(iso(new Date())!==T)location.reload();else checkReminders()}
});
(async()=>{
  const saved=await idbGet('state');if(saved)S={...empty(),...saved};
  renderAll();show();checkReminders();setInterval(checkReminders,30000);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
