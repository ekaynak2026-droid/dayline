'use strict';
/* In-app viewer: shows attached files on screen, without downloading them.
   PDF uses pdf.js (Mozilla), Word uses mammoth.js, Excel uses SheetJS. The three libraries live in
   the vendor/ folder and are only loaded the first time a file of that kind is opened. */
(function(){
  const loaded={};
  const load=src=>loaded[src]||(loaded[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>{delete loaded[src];rej(new Error('load'))};document.head.append(s)}));
  const ext=n=>(String(n).split('.').pop()||'').toLowerCase();
  let el=null, gen=0;

  // Word and Excel files are turned into web page code; keep only harmless parts of it.
  function clean(html){
    const d=new DOMParser().parseFromString(html,'text/html');
    d.querySelectorAll('script,style,iframe,object,embed,link,meta,form,base').forEach(x=>x.remove());
    d.querySelectorAll('*').forEach(x=>{for(const a of [...x.attributes]){
      const n=a.name.toLowerCase(),v=a.value.trim().toLowerCase();
      if(n.startsWith('on')||n==='style'&&/url\(/.test(v))x.removeAttribute(a.name);
      else if((n==='href'||n==='src')&&!(/^https?:/.test(v)||v.startsWith('#')||(n==='src'&&v.startsWith('data:image/'))))x.removeAttribute(a.name);
    }if(x.tagName==='A'){x.target='_blank';x.rel='noopener'}});
    return d.body.innerHTML;
  }

  async function renderPdf(body,blob,my){
    await load('vendor/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';
    const doc=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
    body.innerHTML=`<p class="vmsg">${doc.numPages} page${doc.numPages===1?'':'s'}</p>`;
    const dpr=Math.min(window.devicePixelRatio||1,3);
    for(let i=1;i<=doc.numPages;i++){
      if(my!==gen)return;
      const page=await doc.getPage(i),base=page.getViewport({scale:1});
      const w=Math.min(body.clientWidth-24,900),vp=page.getViewport({scale:w/base.width*dpr});
      const c=document.createElement('canvas');c.className='vpage';c.width=vp.width;c.height=vp.height;c.style.width=w+'px';c.setAttribute('aria-label','Page '+i);
      body.append(c);
      await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
    }
  }
  async function renderWord(body,blob){
    await load('vendor/mammoth.browser.min.js');
    const r=await mammoth.convertToHtml({arrayBuffer:await blob.arrayBuffer()});
    body.innerHTML=`<article class="vdoc">${clean(r.value)||'<p>This document is empty.</p>'}</article>`;
  }
  async function renderSheet(body,blob){
    await load('vendor/xlsx.full.min.js');
    const wb=XLSX.read(new Uint8Array(await blob.arrayBuffer()),{type:'array'});
    const tabs=wb.SheetNames.length>1?`<div class="chips vtabs">${wb.SheetNames.map((n,i)=>`<button class="pill${i?'':' on'}" data-sheet="${i}">${esc(n)}</button>`).join('')}</div>`:'';
    body.innerHTML=`${tabs}<div class="vsheet"></div>`;
    const show=i=>{body.querySelector('.vsheet').innerHTML=clean(XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[i]],{header:'',footer:''}));
      body.querySelectorAll('[data-sheet]').forEach(b=>b.classList.toggle('on',+b.dataset.sheet===i))};
    body.addEventListener('click',e=>{const b=e.target.closest('[data-sheet]');if(b)show(+b.dataset.sheet)});
    show(0);
  }

  async function open(blob,name,type){
    close();const my=++gen;
    el=document.createElement('div');el.className='viewer';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',name);
    el.innerHTML=`<header class="vbar"><button class="iconbtn" data-vclose aria-label="Close">×</button><b class="vname">${esc(name)}</b><button class="ghost" data-vsave>Save a copy</button></header><div class="vbody"><p class="vmsg">Opening…</p></div>`;
    document.body.append(el);
    el.querySelector('[data-vclose]').onclick=close;
    el.querySelector('[data-vsave]').onclick=()=>showBlob(blob,name,type);
    el.querySelector('[data-vclose]').focus();
    const body=el.querySelector('.vbody'),e=ext(name);
    try{
      if(type==='application/pdf'||e==='pdf')await renderPdf(body,blob,my);
      else if(e==='docx')await renderWord(body,blob);
      else if(['xlsx','xls','xlsm','csv','ods'].includes(e))await renderSheet(body,blob);
      else if(e==='txt'||String(type).startsWith('text/'))body.innerHTML=`<pre class="vdoc vtext">${esc(await blob.text())}</pre>`;
      else if(String(type).startsWith('image/')){const u=URL.createObjectURL(blob);body.innerHTML=`<img class="vpage" src="${u}" alt="${esc(name)}">`}
      else body.innerHTML=`<p class="vmsg">This kind of file (${esc(e.toUpperCase()||'unknown')}) can't be shown inside Dayline.${e==='doc'?' Older Word files (.doc) need Word; files saved as .docx open here.':''} Tap <b>Save a copy</b> to open it in another app.</p>`;
    }catch(err){
      if(my!==gen)return;
      body.innerHTML=`<p class="vmsg">${err.message==='load'?'The viewer could not load. Connect to the internet once and try again.':'Dayline could not read this file. It may be damaged or password-protected.'} You can still tap <b>Save a copy</b>.</p>`;
    }
  }
  function close(){gen++;if(el){el.remove();el=null}}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el){e.stopPropagation();close()}},true);
  window.Viewer={open,close};
})();
