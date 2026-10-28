'use strict';
/* Sync between devices through Firebase (Google's online database).
   Each task, event and note is one record under users/{your account}/items.
   Locked notes travel as the same encrypted bundle that is stored on the phone (users/{you}/meta/vault),
   so they can only be read with your PIN.
   How changes are found: after every save we compare each item with a fingerprint of what was last
   synced. Changed items are uploaded; items that disappeared are uploaded as "deleted".
   Changes from other devices arrive through a live listener and replace the local copy. */
(function(){
  const CFG=window.DAYLINE_FIREBASE;
  const SDK='https://www.gstatic.com/firebasejs/10.12.2/';
  let auth=null, db=null, user=null, ready=false, vaultSeen=false, started=false, unsub=[], timer=null, lastOk=null, error='', mountEl=null;

  // Same content always gives the same text, whatever order the fields come back in.
  const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
  function hash(str){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36)}
  const fp=v=>hash(stable(v));
  const clean=v=>JSON.parse(JSON.stringify(v));
  const LISTS={task:'tasks',event:'events',note:'notes'};

  function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('load '+src));document.head.append(s)})}
  async function boot(){
    if(window.__daylineFirebase){({auth,db}=window.__daylineFirebase);return}  // test hook
    for(const f of ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js'])await loadScript(SDK+f);
    firebase.initializeApp(CFG);
    db=firebase.firestore();
    try{await db.enablePersistence({synchronizeTabs:true})}catch(e){}
    auth=firebase.auth();
  }
  const items=()=>db.collection('users').doc(user.uid).collection('items');
  const vaultDoc=()=>db.collection('users').doc(user.uid).collection('meta').doc('vault');
  const st=()=>S.sync;

  function collect(){const m=new Map();S.tasks.forEach(x=>m.set(x.id,['task',x]));S.events.forEach(x=>m.set(x.id,['event',x]));S.notes.forEach(x=>m.set(x.id,['note',x]));return m}

  async function push(){
    timer=null;
    if(!user||!ready||!st())return;
    const last=st().last,ops=[];
    for(const[id,[kind,x]]of collect()){
      if(last[id]===fp(x))continue;
      x.updated=Date.now();last[id]=fp(x);
      ops.push([items().doc(id),{kind,data:clean(x),updated:x.updated,deleted:false}]);
    }
    const now=collect();
    for(const id of Object.keys(last)){if(id==='__vault'||now.has(id))continue;delete last[id];ops.push([items().doc(id),{deleted:true,updated:Date.now()}])}
    const vf=fp(S.vault||null);
    // Only after the online copy of the locked notes has been read, so a device without them never wipes them.
    if(vaultSeen&&last.__vault!==vf&&!(S.vault==null&&last.__vault===undefined)){last.__vault=vf;ops.push([vaultDoc(),{vault:S.vault?clean(S.vault):null,updated:Date.now()}])}
    if(!ops.length)return;
    await idbSet('state',S);
    for(let i=0;i<ops.length;i+=400){
      const b=db.batch();ops.slice(i,i+400).forEach(([ref,data])=>b.set(ref,data));
      b.commit().then(()=>{lastOk=Date.now();error='';paint()}).catch(e=>{error=e.code==='permission-denied'?'The online database refused the change. Check the security rules from the setup guide.':'Could not upload: '+(e.message||e);paint()});
    }
  }
  function schedule(){if(user&&ready&&!timer)timer=setTimeout(push,800)}

  function removeLocal(id){let hit=false;for(const k of ['tasks','events','notes']){const n=S[k].length;S[k]=S[k].filter(x=>x.id!==id);if(S[k].length!==n)hit=true}return hit}
  function upsertLocal(kind,data){removeLocal(data.id);S[LISTS[kind]].push(data)}

  function onItems(snap){
    let changed=false;
    snap.docChanges().forEach(ch=>{
      if(ch.type==='removed'||ch.doc.metadata.hasPendingWrites)return;
      const d=ch.doc.data(),id=ch.doc.id,last=st().last;
      if(d.deleted){if(removeLocal(id))changed=true;delete last[id];return}
      if(!d.data||!LISTS[d.kind])return;
      const f=fp(d.data);if(last[id]===f)return;
      upsertLocal(d.kind,d.data);last[id]=f;changed=true;
    });
    if(!snap.metadata.fromCache){lastOk=Date.now();error=''}
    if(!ready&&(st().primed||!snap.metadata.fromCache)){ready=true;st().primed=true;changed=true;setTimeout(push,0)}
    if(changed){idbSet('state',S);renderTasks();renderCal();renderNotes()}
    paint();
  }
  async function onVault(doc){
    if(doc.metadata.hasPendingWrites)return;
    if(!doc.exists){vaultSeen=true;schedule();return}
    const v=doc.data().vault||null,f=fp(v);
    if(st().last.__vault===f){vaultSeen=true;return}
    vaultSeen=true;
    const old=S.vault;
    if(v==null&&old&&st().last.__vault===undefined){schedule();return}  // never seen online before: keep ours and upload it
    S.vault=v;st().last.__vault=f;
    if(vaultKey){
      if(v&&old&&v.salt===old.salt){
        try{const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(v.iv)},vaultKey,unb64(v.data));vaultNotes=JSON.parse(new TextDecoder().decode(pt))}catch(e){lockVault()}
      }else lockVault();
    }
    await idbSet('state',S);renderNotes();
  }
  function listen(){
    unsub.forEach(u=>u());
    const fail=e=>{error=e.code==='permission-denied'?'The online database refused access. Check the security rules from the setup guide.':'Sync stopped: '+(e.message||e);paint()};
    unsub=[items().onSnapshot({includeMetadataChanges:true},onItems,fail),vaultDoc().onSnapshot(onVault,fail)];
  }
  function onUser(u){
    user=u;ready=false;vaultSeen=false;unsub.forEach(f=>f());unsub=[];
    if(u){
      if(!S.sync||S.sync.uid!==u.uid){S.sync={uid:u.uid,email:u.email,last:{},primed:false};idbSet('state',S)}
      listen();
    }
    paint();
  }

  const MSG={'auth/invalid-credential':'That email and password do not match.','auth/wrong-password':'That email and password do not match.','auth/user-not-found':'There is no account with that email yet. Tap "Create account".','auth/email-already-in-use':'An account with that email already exists. Tap "Sign in" instead.','auth/weak-password':'Choose a password with at least 6 characters.','auth/invalid-email':'That email address does not look right.','auth/network-request-failed':'No internet connection. Try again when you are online.','auth/too-many-requests':'Too many tries. Wait a few minutes and try again.','auth/operation-not-allowed':'Email sign-in is not switched on yet (step 3 of the setup guide).'};
  const say=e=>MSG[e.code]||e.message||String(e);
  const ago=t=>{if(!t)return'';const s=Math.round((Date.now()-t)/1000);return s<60?'just now':s<3600?Math.round(s/60)+' min ago':new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})};

  function paint(){
    const el=mountEl;if(!el||!el.isConnected)return;
    const P=t=>`<p class="firstrun" style="margin:0">${t}</p>`;
    if(!CFG||!CFG.apiKey){el.innerHTML=P('Sync is not set up for this copy of Dayline yet.');return}
    if(!auth){el.innerHTML=P(navigator.onLine?'Connecting…':'Sync needs the internet the first time. Try again when you are online.');return}
    if(user){
      el.innerHTML=`<div class="settings">${P(`<b>Syncing as ${esc(user.email)}.</b> ${error?esc(error):ready?(lastOk?'Last synced '+ago(lastOk)+'.':'Up to date.'):'Getting your data…'} Sign in with the same email on your other devices to share everything.`)}
        <button class="ghost" id="sy-out" style="justify-self:start;padding-left:0;color:var(--accent)">Sign out on this device</button></div>`;
      el.querySelector('#sy-out').onclick=async()=>{await auth.signOut();toast('Signed out. Your data stays on this device.')};
      return;
    }
    el.innerHTML=`<form id="sy-form" style="display:grid;gap:6px">${P('Use the same email and password on your phone and computer, and everything stays the same on both.')}
      <label for="sy-email">Email</label><input id="sy-email" type="email" autocomplete="username" inputmode="email" value="${esc(S.sync?.email||'')}">
      <label for="sy-pass">Password</label><input id="sy-pass" type="password" autocomplete="current-password" minlength="6">
      <p class="err" id="sy-err" ${error?'':'hidden'} style="margin:0">${esc(error)}</p>
      <div class="actions" style="margin-top:6px;justify-content:flex-start"><button class="primary" id="sy-in">Sign in</button><button type="button" class="ghost" id="sy-new" style="color:var(--accent)">Create account</button><button type="button" class="ghost" id="sy-reset">Forgot password</button></div></form>`;
    const f=el.querySelector('#sy-form'),E=()=>el.querySelector('#sy-email').value.trim(),Pw=()=>el.querySelector('#sy-pass').value;
    const run=async fn=>{error='';try{await fn()}catch(e){error=say(e);paint()}};
    f.onsubmit=e=>{e.preventDefault();run(()=>auth.signInWithEmailAndPassword(E(),Pw()))};
    el.querySelector('#sy-new').onclick=()=>run(()=>auth.createUserWithEmailAndPassword(E(),Pw()).then(()=>toast('Account created. Syncing…')));
    el.querySelector('#sy-reset').onclick=()=>run(async()=>{if(!E())throw{message:'Type your email first.'};await auth.sendPasswordResetEmail(E());toast('Password reset email sent')});
  }

  async function start(){
    if(started||!CFG||!CFG.apiKey)return;started=true;
    try{await boot();auth.onAuthStateChanged(onUser)}
    catch(e){started=false;paint();window.addEventListener('online',start,{once:true})}
  }
  window.Sync={start,schedule,mount(el){mountEl=el;paint()},_push:push,_state:()=>({user,ready,error})};
  if(window.daylineBooted)start();
})();
