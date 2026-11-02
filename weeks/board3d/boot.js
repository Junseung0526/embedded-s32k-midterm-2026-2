(function(){
const EV=window.B3D, q=new URLSearchParams(location.search);
EV.renderTabs();
EV.start();
const hm=location.hash.slice(1).split('/'); const hid=hm[0], hstep=parseInt(hm[1]);
let idx=EV.modes.findIndex(m=>m.id===(q.get('m')||hid)); if(idx<0) idx=0;
EV.setMode(idx);
let s=parseInt(q.get('s')); if(isNaN(s)&&!isNaN(hstep)) s=hstep-1;
if(!isNaN(s)&&EV.modes[idx].steps) EV.setStep(s);
addEventListener('hashchange',()=>{ const p=location.hash.slice(1).split('/'); const i=EV.modes.findIndex(m=>m.id===p[0]); if(i<0) return; if(i!==EV.mode) EV.setMode(i); const st=parseInt(p[1]); if(!isNaN(st)&&EV.modes[i].steps&&st-1!==EV.step) EV.setStep(st-1); });
if(q.get('pick')) EV.onPick(q.get('pick'));
if(q.get('adv')) EV.advance(parseFloat(q.get('adv')));
if(q.get('still')){ Object.assign(EV.camState.cur,EV.camState.goal); }
// 이어서 보기: 주소에 모드/단계가 없을 때만, 마지막으로 본 곳을 허브와 같은 카드로 제안
{ const last=EV.store.get('b3d-last'); const explicit=location.hash||q.get('m');
  const mi=last?EV.modes.findIndex(m=>m.id===last.id):-1;
  if(last&&!explicit&&mi>0){ const m=EV.modes[mi], r=document.getElementById('resume'); const st=m.steps?` · ${last.step+1}/${m.steps.length} 단계`:'';
    r.querySelector('b').textContent=`${m.tab}${st} →`; r.hidden=false;
    r.addEventListener('click',(e)=>{ e.preventDefault(); EV.setMode(mi); if(m.steps) EV.setStep(Math.min(last.step,m.steps.length-1)); r.hidden=true; document.getElementById('b3d').scrollIntoView({behavior:'smooth',block:'start'}); }); } }
window.__ready=true;
})();
