// static/js/popup.js  —  CLDD custom popup system
// API: CLDD.toast(msg,type,dur) | CLDD.alert(opts) | CLDD.confirm(opts)
'use strict';
(function(){

// ── inject styles once ──────────────────────────────────────
const SID='cldd-ps';
if(!document.getElementById(SID)){
  const s=document.createElement('style');s.id=SID;
  s.textContent=`
@keyframes cldd-up{from{opacity:0;transform:translateY(12px) translateX(-50%)}to{opacity:1;transform:translateY(0) translateX(-50%)}}
@keyframes cldd-dn{from{opacity:1;transform:translateY(0) translateX(-50%)}to{opacity:0;transform:translateY(12px) translateX(-50%)}}
@keyframes cldd-mi{from{opacity:0;transform:scale(.93) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes cldd-mo{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(.93) translateY(10px)}}
@keyframes cldd-bi{from{opacity:0}to{opacity:1}}
@keyframes cldd-bo{from{opacity:1}to{opacity:0}}
.cldd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9000;
  display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;
  font-size:13px;font-weight:500;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.18);
  white-space:normal;max-width:calc(100vw - 32px);text-align:center;pointer-events:auto;cursor:pointer;
  animation:cldd-up .26s cubic-bezier(.34,1.56,.64,1) both}
.cldd-toast.out{animation:cldd-dn .2s ease forwards}
.cldd-toast.info{background:#334155}.cldd-toast.success{background:#16a34a}
.cldd-toast.error{background:#dc2626}.cldd-toast.warning{background:#d97706}
.cldd-bd{position:fixed;inset:0;z-index:9100;background:rgba(15,23,42,.5);
  backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;
  padding:20px;animation:cldd-bi .18s ease both}
.cldd-bd.out{animation:cldd-bo .16s ease forwards}
.cldd-modal{background:#fff;border-radius:20px;padding:32px 28px 24px;width:100%;max-width:400px;
  box-shadow:0 20px 60px rgba(0,0,0,.16);text-align:center;
  animation:cldd-mi .26s cubic-bezier(.34,1.56,.64,1) both}
.cldd-modal.out{animation:cldd-mo .16s ease forwards}
.cldd-mi-icon{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 16px}
.cldd-mi-icon.info{background:#eff6ff}.cldd-mi-icon.success{background:#dcfce7}
.cldd-mi-icon.error{background:#fee2e2}.cldd-mi-icon.warning{background:#fef3c7}
.cldd-mt{font-size:17px;font-weight:700;color:#0f172a;margin-bottom:8px;line-height:1.3}
.cldd-mb{font-size:13px;color:#475569;line-height:1.6;margin-bottom:24px}
.cldd-actions{display:flex;gap:8px;justify-content:center}
.cldd-btn{flex:1;max-width:140px;padding:10px 16px;border-radius:999px;font-size:13px;
  font-weight:600;border:none;cursor:pointer;transition:opacity .15s,transform .1s}
.cldd-btn:hover{opacity:.88}.cldd-btn:active{transform:scale(.97)}
.cldd-ok.info{background:#3b82f6;color:#fff}.cldd-ok.success{background:#16a34a;color:#fff}
.cldd-ok.error{background:#dc2626;color:#fff}.cldd-ok.warning{background:#d97706;color:#fff}
.cldd-cancel{background:#f1f5f9;color:#475569;border:1.5px solid #e2e8f0}`;
  document.head.appendChild(s);}

const ICONS={info:'💬',success:'✅',error:'❌',warning:'⚠️'};
const toasts=[];

function dismiss(el){
  const i=toasts.indexOf(el);if(i>-1)toasts.splice(i,1);
  el.classList.add('out');
  setTimeout(()=>el.remove(),220);
  toasts.forEach((t,k)=>{t.style.bottom=`${24+k*52}px`;});}

function toast(msg,type='info',dur=3400){
  toasts.filter(t=>t._type===type).forEach(dismiss);
  const el=document.createElement('div');
  el._type=type;el.className=`cldd-toast ${type}`;
  el.innerHTML=`<span>${ICONS[type]||'ℹ️'}</span><span>${msg}</span>`;
  el.style.bottom=`${24+toasts.length*52}px`;
  document.body.appendChild(el);toasts.push(el);
  const t=setTimeout(()=>dismiss(el),dur);
  el.addEventListener('click',()=>{clearTimeout(t);dismiss(el);});}

function modal({title='',message='',type='info',okText='OK',cancelText=null}){
  return new Promise(res=>{
    const bd=document.createElement('div');bd.className='cldd-bd';
    const m=document.createElement('div');m.className='cldd-modal';
    m.innerHTML=`
      <div class="cldd-mi-icon ${type}">${ICONS[type]||'ℹ️'}</div>
      <div class="cldd-mt">${title}</div>
      <div class="cldd-mb">${message}</div>
      <div class="cldd-actions">
        ${cancelText?`<button class="cldd-btn cldd-cancel" id="cldd-x">${cancelText}</button>`:''}
        <button class="cldd-btn cldd-ok ${type}" id="cldd-ok">${okText}</button>
      </div>`;
    bd.appendChild(m);document.body.appendChild(bd);
    m.querySelector('#cldd-ok').focus();
    function close(v){
      m.classList.add('out');bd.classList.add('out');
      setTimeout(()=>bd.remove(),200);res(v);}
    m.querySelector('#cldd-ok').onclick=()=>close(true);
    const cx=m.querySelector('#cldd-x');if(cx)cx.onclick=()=>close(false);
    bd.onclick=e=>{if(e.target===bd)close(false);};
    function onKey(e){
      if(e.key==='Escape'){close(false);document.removeEventListener('keydown',onKey);}
      if(e.key==='Enter'){close(true);document.removeEventListener('keydown',onKey);}}
    document.addEventListener('keydown',onKey);});}

window.CLDD={
  toast,
  alert:(o)=>typeof o==='string'?modal({title:'Info',message:o,cancelText:null}):modal({...o,cancelText:null}),
  confirm:(o)=>typeof o==='string'?modal({title:'Konfirmasi',message:o,cancelText:'Batal'}):modal({cancelText:'Batal',...o}),
  success:(m,d)=>toast(m,'success',d),
  error:(m,d)=>toast(m,'error',d),
  warning:(m,d)=>toast(m,'warning',d),
  info:(m,d)=>toast(m,'info',d),};
})();
