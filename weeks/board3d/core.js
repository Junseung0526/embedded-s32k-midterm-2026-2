/* core.js — 렌더러(HDR + 블룸 + MSAA), 카메라, 헬퍼, 라벨, 트윈, 신호 경로, 단계 UI */
(function(){
const T = window.THREE, FX = window.B3D_FX;
const EV = window.B3D = { T, parts:{}, groups:{}, paths:{}, labelDefs:{}, glows:{}, frameFns:[], tweens:[], modes:[], mode:-1, step:-1, time:0, cleanup:[] };
const $ = id => document.getElementById(id);
const stage = $('stage'), canvas = $('c');
window.addEventListener('error',e=>{ const el=$('err'); if(el) el.textContent+=e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno+'\n'; });

/* ---------- 테마: 레포 base.css 색을 그대로 읽어 씬 배경에 반영 ---------- */
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const lin = hex => new T.Color(hex).convertSRGBToLinear();
EV.theme = {};
const store = EV.store = { get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(_){ return null; } }, set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} } };
function readTheme(){
  const bg = css('--bg')||'#1A1B19', panel = css('--panel')||'#232421';
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  Object.assign(EV.theme,{ bg, panel, dark, on:css('--on')||'#E8412C', data:css('--data')||'#1F8A8A', clk:css('--clk')||'#E9A23B', ink:css('--ink')||'#E8E6E1' });
  if(EV.scene){ const c=lin(bg); EV.scene.background=c; EV.scene.fog.color.copy(c);  if(EV.floorMat) EV.floorMat.opacity=dark?.6:.34; }
  if(EV.onTheme) EV.onTheme(EV.theme);
}

/* ---------- 렌더러 / 씬 ---------- */
const STILL = /[?&]still=/.test(location.search);   // 스크린샷 테스트일 때만 버퍼 보존
const R = EV.renderer = new T.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance', preserveDrawingBuffer:STILL });
EV.prMax = Math.min(devicePixelRatio||1, 1.5); EV.pr = EV.prMax;
R.setPixelRatio(EV.pr);
R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = true;
const scene = EV.scene = new T.Scene(); scene.fog = new T.Fog(0x000000, 70, 150);
const cam = EV.cam = new T.PerspectiveCamera(36, 1, .1, 400);
const maxAniso = R.capabilities.getMaxAnisotropy();

/* ---------- 포스트프로세싱: MSAA HDR → 블룸 → 필름 롤오프 + 감마 + 비네트 ---------- */
let composer = null, bloom = null;
const FinalShader = {
  uniforms:{ tDiffuse:{value:null}, vig:{value:.28}, exposure:{value:1.0} },
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader:`uniform sampler2D tDiffuse; uniform float vig; uniform float exposure; varying vec2 vUv;
  void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb*exposure;
    vec3 hi=max(c-.9,vec3(0.)); c=min(c,vec3(.9))+.1*hi/(.1+hi);
    vec2 d=vUv-.5; float v=smoothstep(.95,.35,length(d*vec2(1.15,1.0))); c*=mix(1.-vig,1.,v);
    c=pow(c,vec3(1./2.2)); gl_FragColor=vec4(c,1.); }`
};
function buildComposer(w,h){
  try{
    const rt = new T.WebGLMultisampleRenderTarget(w*R.getPixelRatio(),h*R.getPixelRatio(),{format:T.RGBAFormat,type:T.HalfFloatType}); rt.samples = EV.msaa==null?4:EV.msaa;
    composer = new FX.EffectComposer(R,rt); composer.setPixelRatio(R.getPixelRatio()); composer.setSize(w,h);
    composer.addPass(new FX.RenderPass(scene,cam));
    bloom = new FX.UnrealBloomPass(new T.Vector2(Math.round(w/2),Math.round(h/2)),.2,.45,1.3); composer.addPass(bloom);
    composer.addPass(new FX.ShaderPass(FinalShader));
  }catch(err){ console.warn('composer 사용 불가, 기본 렌더로 대체',err); composer=null; R.outputEncoding=T.sRGBEncoding; R.toneMapping=T.ACESFilmicToneMapping; R.toneMappingExposure=1; }
}
function resize(){
  const w=Math.max(200,stage.clientWidth), h=Math.max(200,stage.clientHeight);
  R.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix();
  if(!composer) buildComposer(w,h); else { composer.setSize(w,h); if(bloom) bloom.setSize(Math.round(w/2),Math.round(h/2)); }
  EV.size={w,h}; EV.hold=1; EV.fit=Math.max(1,1.35/(w/h)); EV.layoutHUD&&EV.layoutHUD();
}
EV.maxAniso = maxAniso;
EV.setPR=(pr)=>{ EV.pr=pr; R.setPixelRatio(pr); if(composer){ composer.setPixelRatio(pr); composer.setSize(EV.size.w,EV.size.h); if(bloom) bloom.setSize(Math.round(EV.size.w/2),Math.round(EV.size.h/2)); } else R.setSize(EV.size.w,EV.size.h,false); EV.hold=1; };
let aAcc=0,aN=0,aSkip=6;
function adapt(dt){ // 연속 렌더 중 평균 프레임 시간으로 해상도/후처리 자동 조절
  if(aSkip>0){ aSkip--; return; } aAcc+=dt*1000; aN++;
  if(aN<40) return; const avg=aAcc/aN; aAcc=0; aN=0;
  if(avg>21){ if(EV.pr>1.0) EV.setPR(Math.max(1,EV.pr-.25)); else if(EV.msaa!==0){ EV.msaa=0; composer=null; resize(); } else if(bloom&&bloom.enabled){ bloom.enabled=false; } }
  else if(avg<10&&EV.pr<EV.prMax&&EV.msaa!==0) EV.setPR(Math.min(EV.prMax,EV.pr+.25));
}
EV.invalidate=(sec=.8,shadow=true)=>{ EV.hold=Math.max(EV.hold||0,sec); if(shadow) EV.shadowDirty=true; };

/* ---------- 조명 (스튜디오 3점 + 환경 반사) ---------- */
scene.add(new T.HemisphereLight(0xcfd8ff, 0x1a1a18, .35));
const sun = new T.DirectionalLight(0xfff0dc, 1.7);
sun.position.set(18, 36, 20); sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:1,far:120});
sun.shadow.bias = -0.0003; sun.shadow.normalBias = .04; sun.shadow.radius = 4;
scene.add(sun);
const rim = new T.DirectionalLight(0x9ab8ff, 1.0); rim.position.set(-26,16,-24); scene.add(rim);
const fill = new T.DirectionalLight(0xffd6b0, .45); fill.position.set(-22,9,26); scene.add(fill);
{ const pm=new T.PMREMGenerator(R); const es=new T.Scene();
  const sg=new T.SphereGeometry(60,32,18); const col=[]; const p=sg.attributes.position;
  for(let i=0;i<p.count;i++){ const y=p.getY(i)/60; const k=Math.max(0,y); col.push(.05+.3*k,.055+.34*k,.07+.46*k); }
  sg.setAttribute('color',new T.Float32BufferAttribute(col,3)); es.add(new T.Mesh(sg,new T.MeshBasicMaterial({side:T.BackSide,vertexColors:true})));
  const panel=(w,d,x,y,z,k,tint)=>{ const o=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({color:new T.Color(tint).multiplyScalar(k),side:T.DoubleSide})); o.position.set(x,y,z); o.lookAt(0,0,0); es.add(o); };
  panel(46,24,0,50,8,7,0xffffff); panel(20,34,-42,22,8,3.2,0xdfe8ff); panel(20,34,42,18,-8,2.6,0xfff0dc); panel(70,9,0,12,-48,2,0xffffff); panel(40,6,0,8,46,1.4,0xfff6ea);
  scene.environment=pm.fromScene(es,.03).texture; pm.dispose(); }

/* ---------- 헬퍼 ---------- */
EV.mat = (color,o={}) => new T.MeshStandardMaterial(Object.assign({color, roughness:.55, metalness:.1, envMapIntensity:.55}, o));
EV.pmat = (color,o={}) => new T.MeshPhysicalMaterial(Object.assign({color, roughness:.4, metalness:.05, clearcoat:.5, clearcoatRoughness:.35, envMapIntensity:.6}, o));
function rrShape(w,h,r){ const s=new T.Shape(),x=-w/2,y=-h/2; s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s; }
EV.rrShape = rrShape;
EV.rrGeo = (w,d,h,r=.08,b=.03) => { const bb=Math.min(b,Math.min(w,d,h)*.3), rr=Math.max(.01,Math.min(r,Math.min(w,d)/2-.01)); const g=new T.ExtrudeGeometry(rrShape(w-2*bb,d-2*bb,Math.max(.01,rr-bb)),{depth:Math.max(.01,h-2*bb),bevelEnabled:true,bevelThickness:bb,bevelSize:bb,bevelSegments:2,curveSegments:6}); g.rotateX(-Math.PI/2); g.translate(0,bb-h/2,0); return g; };
EV.rbox = (w,h,d,m,x=0,y=0,z=0,parent) => { const me=new T.Mesh(EV.rrGeo(w,d,h,Math.min(w,d,h)*.28,Math.min(w,d,h)*.12),m); me.position.set(x,y,z); me.castShadow=me.receiveShadow=true; if(parent) parent.add(me); return me; };
EV.box = (w,h,d,m,x=0,y=0,z=0,parent) => { const me=new T.Mesh(new T.BoxGeometry(w,h,d),m); me.position.set(x,y,z); me.castShadow=me.receiveShadow=true; if(parent) parent.add(me); return me; };
EV.cyl = (r,h,m,x=0,y=0,z=0,parent,seg=32) => { const me=new T.Mesh(new T.CylinderGeometry(r,r,h,seg),m); me.position.set(x,y,z); me.castShadow=me.receiveShadow=true; if(parent) parent.add(me); return me; };
EV.tex = (w,h,draw,opt={}) => {
  const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d'); if(draw) draw(ctx,w,h);
  const t=new T.CanvasTexture(c); if(!opt.linear) t.encoding=T.sRGBEncoding; t.anisotropy=maxAniso; t.generateMipmaps=true; t.minFilter=T.LinearMipmapLinearFilter;
  return {c, ctx, t, redraw(fn){ ctx.clearRect(0,0,w,h); fn(ctx,w,h); t.needsUpdate=true; }};
};
EV.hex = n => '#'+n.toString(16).padStart(6,'0');
EV.reg = (name,g,visible=false) => { EV.groups[name]=g; g.visible=visible; scene.add(g); return g; };
EV.show = (...names) => { Object.values(EV.groups).forEach(g=>{ if(g.userData.mode) g.visible=false; }); names.forEach(n=>{ if(EV.groups[n]) EV.groups[n].visible=true; }); };
EV.vec = (x,y,z) => new T.Vector3(x,y,z);

/* 슬랩: 어두운 유리판 + 색 모서리선 + 앞/윗면 글자 (HUD 느낌) */
EV.slab = (o) => {
  const g=new T.Group();
  const {w=3,h=.5,d=1.6,color=0x6c8cff,title='',sub='',opacity=.95,fs=0,tc='#fff',top=true}=o;
  const base=new T.Color(color), dark=base.clone().multiplyScalar(.34).lerp(new T.Color(0x0b0c0e),.35);
  const m=new T.MeshPhysicalMaterial({color:dark,metalness:.2,roughness:.3,clearcoat:.9,clearcoatRoughness:.18,transparent:true,opacity,emissive:base,emissiveIntensity:.07,envMapIntensity:.6});
  const geo=EV.rrGeo(w,d,h,Math.min(.3,Math.min(w,d)*.16),Math.min(.05,h*.12));
  const b=new T.Mesh(geo,m); b.castShadow=b.receiveShadow=true; g.add(b);
  const e=new T.LineSegments(new T.EdgesGeometry(geo,38),new T.LineBasicMaterial({color:base.clone().lerp(new T.Color(0xffffff),.4),transparent:true,opacity:.75}));
  g.add(e);
  const bar=new T.Mesh(new T.PlaneGeometry(w*.86,Math.max(.035,h*.07)),new T.MeshBasicMaterial({color:base.clone().multiplyScalar(1.7),transparent:true,opacity:.95})); bar.position.set(0,-h/2+h*.12,d/2+.006); g.add(bar);
  const FONT='"Pretendard Variable","Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';
  const txt=(c,t,x,y,f,weight,col)=>{ c.font=`${weight} ${f}px ${FONT}`; c.lineWidth=Math.max(3,f*.12); c.strokeStyle='rgba(4,6,10,.8)'; c.lineJoin='round'; c.strokeText(t,x,y); c.fillStyle=col; c.fillText(t,x,y); };
  const fit=(c,t,f,wt,maxW)=>{ c.font=`${wt} ${f}px ${FONT}`; const mw=c.measureText(t).width; return mw>maxW?f*maxW/mw:f; };
  const paintTop=(c,W,H,t,s)=>{ c.clearRect(0,0,W,H); c.textAlign='center'; c.textBaseline='middle'; let f=fit(c,t,fs||Math.min(H*.34,54),'bold',W*.92);
    txt(c,t,W/2,s?H*.40:H*.5,f,'bold',tc); if(s){ const f2=fit(c,s,f*.62,'normal',W*.92); txt(c,s,W/2,H*.72,f2,'normal','rgba(255,255,255,.9)'); } };
  const paintFront=(c,W,H,t,s)=>{ c.clearRect(0,0,W,H); c.textAlign='center'; c.textBaseline='middle';
    if(!s){ txt(c,t,W/2,H*.52,fit(c,t,H*.62,'bold',W*.94),'bold',tc); return; }
    txt(c,t,W/2,H*.32,fit(c,t,H*.44,'bold',W*.94),'bold',tc); txt(c,s,W/2,H*.73,fit(c,s,H*.34,'normal',W*.94),'normal','rgba(255,255,255,.95)'); };
  const pw=768, ph=Math.max(96,Math.round(pw*d/w));
  const tx=EV.tex(pw,ph,(c,W,H)=>paintTop(c,W,H,title,sub));
  const pl=new T.Mesh(new T.PlaneGeometry(w*.98,d*.98),new T.MeshBasicMaterial({map:tx.t,transparent:true,depthWrite:false})); pl.rotation.x=-Math.PI/2; pl.position.y=h/2+.004; pl.visible=top; g.add(pl);
  const fh=Math.max(96,Math.round(1536*h/w));
  const tf=EV.tex(1536,fh,(c,W,H)=>paintFront(c,W,H,title,sub));
  const pf=new T.Mesh(new T.PlaneGeometry(w*.98,h*.94),new T.MeshBasicMaterial({map:tf.t,transparent:true,depthWrite:false})); pf.position.set(0,0,d/2+.004); g.add(pf);
  g.userData.slab={box:b,edge:e,mat:m,bar};
  g.setGlow=(v,c)=>{ m.emissiveIntensity=.07+Math.min(v,1.2)*.3; m.emissive.setHex(c!=null&&c!==0xffffff?c:color); e.material.opacity=v>0?1:.75; bar.material.color.copy(new T.Color(c!=null&&c!==0xffffff?c:color).multiplyScalar(v>0?2.2:1.7)); };
  g.retitle=(t,s)=>{ tx.redraw((c,W,H)=>paintTop(c,W,H,t,s)); tf.redraw((c,W,H)=>paintFront(c,W,H,t,s)); };
  return g;
};
EV.sprite = (text,o={}) => {
  const {size=1,color='#fff',bg=null,w=512,h=128,fs=56}=o;
  const tx=EV.tex(w,h,(c)=>{ if(bg){c.fillStyle=bg;c.fillRect(0,0,w,h);} c.font=`bold ${fs}px "Pretendard","Noto Sans KR",sans-serif`; c.textAlign='center'; c.textBaseline='middle'; c.lineWidth=fs*.14; c.strokeStyle='rgba(4,6,10,.8)'; c.strokeText(text,w/2,h/2); c.fillStyle=color; c.fillText(text,w/2,h/2); });
  const s=new T.Sprite(new T.SpriteMaterial({map:tx.t,transparent:true,depthTest:false})); s.scale.set(size*w/h,size,1); s.renderOrder=20; s.userData.tx=tx; return s;
};

/* ---------- 카메라 컨트롤러 ---------- */
const C = EV.camState = { cur:{tx:0,ty:0,tz:0,rad:30,th:.55,ph:1.0}, goal:{tx:0,ty:0,tz:0,rad:30,th:.55,ph:1.0} };
const HOME = {tx:-9,ty:0,tz:-3,rad:44,th:.3,ph:.95};
EV.home = HOME;
EV.flyTo = g => { Object.assign(C.goal,g); };
EV.jumpTo = g => { Object.assign(C.goal,g); Object.assign(C.cur,C.goal); };
let drag=null;
const rectOf = () => canvas.getBoundingClientRect();
const pts=new Map(); let pinch=null;
canvas.addEventListener('pointerdown',e=>{ EV.idle=0; EV.hold=1; EV.hideTip&&EV.hideTip(); stage.classList.add('active'); stage.focus({preventScroll:true}); EV.hideCoach&&EV.hideCoach();
  pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); canvas.setPointerCapture(e.pointerId);
  if(pts.size===2){ const [p,q]=[...pts.values()]; pinch={d:Math.hypot(p.x-q.x,p.y-q.y)||1,rad:C.goal.rad}; drag=null; canvas.classList.remove('grabbing'); return; }
  drag={x:e.clientX,y:e.clientY,moved:0,pan:e.shiftKey||e.button===2||e.button===1}; canvas.classList.add('grabbing'); });
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{
  EV.idle=0; EV.pointer={x:e.clientX,y:e.clientY};
  if(pts.has(e.pointerId)) pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&pts.size===2){ const [p,q]=[...pts.values()]; const d=Math.hypot(p.x-q.x,p.y-q.y)||1; C.goal.rad=Math.min(80,Math.max(4,pinch.rad*pinch.d/d)); EV.hold=1; return; }
  if(!drag){ hover(e); return; }
  const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.moved+=Math.abs(dx)+Math.abs(dy); drag.x=e.clientX; drag.y=e.clientY;
  const g=C.goal;
  if(drag.pan){ const s=g.rad*.0016; const rx=Math.cos(g.th), rz=-Math.sin(g.th); g.tx-=dx*rx*s; g.tz-=dx*rz*s; g.tx+=Math.sin(g.th)*dy*s; g.tz+=Math.cos(g.th)*dy*s; }
  else { g.th-=dx*.0055; g.ph=Math.min(1.52,Math.max(.12,g.ph-dy*.0055)); }
});
const endPtr=e=>{ pts.delete(e.pointerId); if(pts.size<2) pinch=null; canvas.classList.remove('grabbing'); if(drag&&drag.moved<5&&e.type==='pointerup') pick(e); drag=null; };
canvas.addEventListener('pointerup',endPtr); canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{ if(!(stage.classList.contains('active')||e.ctrlKey||e.metaKey)) return; EV.idle=0; EV.hold=1; e.preventDefault(); C.goal.rad=Math.min(80,Math.max(4,C.goal.rad*(1+e.deltaY*.0011))); },{passive:false});
stage.addEventListener('focusout',e=>{ if(!stage.contains(e.relatedTarget)) stage.classList.remove('active'); });

/* ---------- 피킹 / 호버 ---------- */
const ray=new T.Raycaster(), mp=new T.Vector2();
function partAt(e){ const r=rectOf(); mp.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(mp,cam);
  const dieB=EV.die&&EV.die.visible?Object.values(EV.die.blocks):[]; const hits=ray.intersectObjects([...Object.values(EV.parts),...dieB],true);
  for(const h of hits){ let o=h.object; while(o&&!o.userData.part) o=o.parent; if(o) return o.userData.part; } return null; }
function hover(e){ EV.pendingHover=e; EV.hold=Math.max(EV.hold||0,.3); }
let lastHover=0;
function doHover(){ const e=EV.pendingHover; if(!e) return; const now=performance.now(); if(now-lastHover<40) return; lastHover=now; EV.pendingHover=null; const p=partAt(e); canvas.style.cursor=p?'pointer':'grab'; if(p!==EV.hoverPart){ EV.hoverPart=p; EV.hold=Math.max(EV.hold||0,.6); } const r=rectOf(); EV.showTip&&EV.showTip(p,e.clientX-r.left,e.clientY-r.top); }
canvas.addEventListener('pointerleave',()=>{ EV.hoverPart=null; EV.hideTip&&EV.hideTip(); });
function pick(e){ const p=partAt(e); if(p&&EV.onPick) EV.onPick(p); }

/* ---------- 툴팁 / 호버 애니메이션 / 포커스 ---------- */
const tipEl=$('tip'), statusEl=$('status');
EV.baseStatus='부품에 마우스를 올려 보세요.';
EV.setStatus=(html)=>{ EV.baseStatus=html; statusEl.setAttribute('aria-live','polite'); if(!statusEl.dataset.h) statusEl.innerHTML=html; setTimeout(()=>statusEl.setAttribute('aria-live','off'),600); };
EV.showTip=(id,x,y)=>{ const i=id&&EV.partInfo&&EV.partInfo[id];
  if(!i){ tipEl.style.opacity=0; if(statusEl.dataset.h){ delete statusEl.dataset.h; statusEl.innerHTML=EV.baseStatus; } return; }
  tipEl.innerHTML=`<b>${i.t}</b><small>${i.s||'클릭: 확대 + 설명'}</small>`; tipEl.style.opacity=1; tipEl.style.transform=`translate(${Math.min(EV.size.w-260,x+16)}px,${Math.min(EV.size.h-60,y+18)}px)`;
  statusEl.dataset.h='1'; statusEl.innerHTML=`<b>${i.t}</b>${i.s?' · '+i.s:''} — 클릭하면 확대 + 설명`; };
EV.hideTip=()=>{ tipEl.style.opacity=0; if(statusEl.dataset.h){ delete statusEl.dataset.h; statusEl.innerHTML=EV.baseStatus; } };
function hoverAnim(dt){
  const k=1-Math.exp(-dt*11);
  for(const [id,g] of Object.entries(EV.parts)){
    if(g.userData.by==null) g.userData.by=g.position.y;
    const tgt=(EV.hoverPart===id&&!drag)?1:0, hv=g.userData.hv||0, nv=hv+(tgt-hv)*k; g.userData.hv=nv;
    if(Math.abs(nv-hv)<1e-4&&(nv<.002||nv>.998)) continue;
    EV._moving=true; const e=nv*nv*(3-2*nv); g.position.y=g.userData.by+e*(g.userData.lift!=null?g.userData.lift:.22);
    if(!EV.glows[id]){ if(nv>.01) setEm(id,.55*e,0xe8412c); else if(g.userData.hot) setEm(id,0,0); g.userData.hot=nv>.01; }
  }
}
EV.focusPart=(id,rad)=>{ const a=EV.anchors&&EV.anchors[id]; if(!a) return; const sz={chip:11,lcd:13,pcf:9,pc:12,pot:7,sw5:6,sw6:6,reset:6,led:5.5,usb:6,opensda:7,barrel:7,sw1:6,fs26:7,xtal:5,jtag:5,touchA:8,touchB:8,can:6,lin:6}; EV.flyTo({tx:a.x,ty:a.y*.5,tz:a.z,rad:rad||sz[id]||9,ph:.95}); };
EV.autoRotate=false; EV.idle=0;
EV.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 라벨 (HTML, 3D 좌표 투영) ---------- */
const labelsEl=$('labels');
EV.defLabel=(id,html,posFn)=>{ EV.labelDefs[id]={html,posFn,el:null,on:false}; };
EV.showLabels=(ids,hot=[])=>{
  const allow=$('optLabels').checked;
  for(const [id,d] of Object.entries(EV.labelDefs)){
    const on=ids&&ids.includes(id);
    if(on&&!d.el){ d.el=document.createElement('div'); d.el.className='lbl'; d.el.innerHTML=d.html; labelsEl.appendChild(d.el); }
    if(d.el){ d.el.style.display=(on&&allow)?'':'none'; d.el.classList.toggle('hot',hot.includes(id)); }
    d.on=on;
  }
};
EV.setLabel=(id,html)=>{ const d=EV.labelDefs[id]; if(d){ d.html=html; d.dirty=true; if(d.el) d.el.innerHTML=html; } };
const _v=new T.Vector3();
const SVGNS='http://www.w3.org/2000/svg';
const leaders=document.createElementNS(SVGNS,'svg'); leaders.setAttribute('class','leaders'); labelsEl.prepend(leaders);
function leaderOf(d){ if(!d.ld){ const g=document.createElementNS(SVGNS,'g'), l=document.createElementNS(SVGNS,'line'), c=document.createElementNS(SVGNS,'circle'); c.setAttribute('r','3.6'); g.append(l,c); leaders.append(g); d.ld={g,l,c}; } return d.ld; }
const CAND=(w)=>{ const o=w/2+18; return [[0,0],[0,30],[o,0],[-o,0],[0,60],[o,30],[-o,30],[0,90],[o,60],[-o,60]]; };
function updateLabels(){
  const list=[], W=EV.size.w, H=EV.size.h, still=EV._still;
  for(const d of Object.values(EV.labelDefs)){
    if(!d.el) continue;
    if(!d.on){ if(d.ld) d.ld.g.style.display='none'; continue; }
    d.posFn(_v); _v.project(cam);
    if(_v.z>1||_v.z<-1||Math.abs(_v.x)>1.2||Math.abs(_v.y)>1.2){ d.el.style.opacity=0; if(d.ld) d.ld.g.style.display='none'; continue; }
    d.sx=(_v.x+1)/2*W; d.sy=(1-_v.y)/2*H; list.push(d);
    if(d.w==null||d.dirty){ d.w=d.el.offsetWidth||80; d.h=d.el.offsetHeight||24; d.dirty=false; }
  }
  // 우선순위: hot → 정의 순서
  list.sort((a,b)=>(b.el.classList.contains('hot')?1:0)-(a.el.classList.contains('hot')?1:0));
  const kept=[]; let moving=false;
  for(const d of list){
    const cands=CAND(d.w); const order=d.ci!=null?[d.ci,...cands.keys()].filter((v,i,a)=>a.indexOf(v)===i):[...cands.keys()];
    let pick=-1, rect=null;
    for(const i of order){ let [dx,dy]=cands[i]; let cx=d.sx+dx; const by=d.sy-16-dy; cx=Math.max(d.w/2+6,Math.min(W-d.w/2-6,cx));
      const r=[cx-d.w/2-4,by-d.h-4,cx+d.w/2+4,by+4];
      if(r[1]<4) continue;
      if(!kept.some(k=>r[0]<k[2]&&r[2]>k[0]&&r[1]<k[3]&&r[3]>k[1])){ pick=i; rect=r; d.tx=cx-d.sx; d.ty=dy; break; } }
    const hot=d.el.classList.contains('hot');
    if(pick<0&&hot){ pick=0; d.tx=0; d.ty=0; rect=[d.sx-d.w/2,d.sy-16-d.h,d.sx+d.w/2,d.sy-16]; }
    const hide=pick<0; if(d.hid==null) d.hid=hide;
    if(hide!==d.hid){ d.cnt=(d.cnt||0)+1; if(d.cnt>=8){ d.hid=hide; d.cnt=0; } } else d.cnt=0;
    if(!hide) d.ci=pick;
    if(d.hid||hide&&d.hid){ d.el.style.opacity=0; leaderOf(d).g.style.display='none'; continue; }
    if(rect) kept.push(rect);
    if(d.ox==null){ d.ox=d.tx; d.oy=d.ty; }
    const k=.3; const ex=d.tx-d.ox, ey=d.ty-d.oy; if(Math.abs(ex)>.4||Math.abs(ey)>.4){ d.ox+=ex*k; d.oy+=ey*k; moving=true; } else { d.ox=d.tx; d.oy=d.ty; }
    const px=d.sx+d.ox, py=d.sy-16-d.oy;
    const X=still?Math.round(px):px, Y=still?Math.round(py):py;
    d.el.style.transform=`translate3d(${X}px,${Y}px,0) translate(-50%,-100%)`; d.el.style.opacity=1;
    const L=leaderOf(d); L.g.style.display=''; L.g.setAttribute('class',hot?'hot':'');
    L.l.setAttribute('x1',d.sx.toFixed(1)); L.l.setAttribute('y1',d.sy.toFixed(1)); L.l.setAttribute('x2',X.toFixed(1)); L.l.setAttribute('y2',(Y).toFixed(1));
    L.c.setAttribute('cx',d.sx.toFixed(1)); L.c.setAttribute('cy',d.sy.toFixed(1));
  }
  if(moving) EV.hold=Math.max(EV.hold||0,.15);
}
$('optLabels').addEventListener('change',()=>{ EV.hold=1; EV.showLabels(EV.curLabels||[],EV.curHot||[]); EV.saveUI&&EV.saveUI(); });

/* ---------- 트윈 ---------- */
EV.tween=(dur,fn,done,ease=(t)=>t)=>{ const t={t:0,dur:Math.max(.0001,dur),fn,done,ease}; EV.tweens.push(t); return t; };
EV.wait=(sec,fn)=>EV.tween(sec,null,fn);
EV.cancelTweens=()=>{ EV.tweens.length=0; };
EV.seq=(list)=>{ let i=0; const run=()=>{ if(i>=list.length) return; const [d,f,dn]=list[i++]; EV.tween(d,f,()=>{ dn&&dn(); run(); }); }; run(); };
EV.easeIO=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

/* ---------- 글로우 ---------- */
EV.glow=(id,color=0xe9a23b,amp=.9)=>{ EV.glows[id]={color,amp}; };
EV.clearGlow=()=>{ for(const id of Object.keys(EV.glows)) setEm(id,0,0); EV.glows={}; };
function setEm(id,v,c){
  const p=EV.parts[id]||EV.groups[id]; if(!p) return; v*=(EV.parts[id]?.2:1);
  p.traverse(o=>{ if(o.isInstancedMesh) return; if(o.material&&o.userData.glowOK!==false&&o.material.emissive){
    const ms=Array.isArray(o.material)?o.material:[o.material]; ms.forEach(m=>{ if(m.userData&&m.userData.fixedEm) return; m.emissive.setHex(c||0); m.emissiveIntensity=v; }); } });
}

/* ---------- 신호 경로 ---------- */
EV.makePath=(name,pts,color=0xe9a23b,o={})=>{
  const {r=.06,y=.3}=o;
  const v3=pts.map(p=>p.isVector3?p:new T.Vector3(p[0],p[2]!=null?p[2]:y,p[1]));
  const cp=new T.CurvePath(); for(let i=0;i<v3.length-1;i++) if(v3[i].distanceTo(v3[i+1])>1e-4) cp.add(new T.LineCurve3(v3[i],v3[i+1]));
  const len=cp.getLength();
  const tube=new T.Mesh(new T.TubeGeometry(cp,Math.max(8,Math.round(len*6)),r,8,false),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(1.6),transparent:true,opacity:.55,depthWrite:false}));
  tube.visible=false; scene.add(tube);
  const head=new T.Mesh(new T.SphereGeometry(r*2.8,20,20),new T.MeshBasicMaterial({color:new T.Color(0xffffff).multiplyScalar(2.2)}));
  const halo=new T.Mesh(new T.SphereGeometry(r*5.5,20,20),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(2.0),transparent:true,opacity:.35,depthWrite:false})); head.add(halo); head.visible=false; scene.add(head);
  const P={name,cp,len,tube,head,color,flowing:false,trail:[],off:0};
  for(let i=0;i<8;i++){ const s=new T.Mesh(new T.SphereGeometry(r*1.7,12,12),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(2),transparent:true,opacity:.9})); s.visible=false; scene.add(s); P.trail.push(s); }
  EV.paths[name]=P; return P;
};
EV.pathShow=(name,on=true)=>{ const p=EV.paths[name]; if(!p) return; p.tube.visible=on; if(!on){ p.head.visible=false; p.flowing=false; p.trail.forEach(s=>s.visible=false); } };
EV.pathFlow=(name,on=true,speed=.18)=>{ const p=EV.paths[name]; if(!p) return; p.tube.visible=true; p.flowing=on; p.speed=speed; p.trail.forEach(s=>s.visible=on); };
EV.pathSend=(name,dur=1.2,done,from=0,to=1)=>{ const p=EV.paths[name]; p.tube.visible=true; p.head.visible=true; return EV.tween(dur,k=>{ p.cp.getPointAt(from+(to-from)*k,p.head.position); },()=>{ p.head.visible=false; done&&done(); },EV.easeIO); };
EV.pathPoint=(name,k,out)=>EV.paths[name].cp.getPointAt(Math.min(1,Math.max(0,k)),out||new T.Vector3());
EV.hideAllPaths=()=>Object.keys(EV.paths).forEach(n=>EV.pathShow(n,false));

/* ---------- 프레임 루프 ---------- */
EV.onFrame=fn=>EV.frameFns.push(fn);
function update(dt){
  const rdt=dt; dt=dt*(EV.speed||1);
  EV.time+=dt; EV.dt=dt;
  for(let i=EV.tweens.length-1;i>=0;i--){ const t=EV.tweens[i]; if(!t) continue; t.t+=dt; const p=Math.min(1,t.t/t.dur); try{ if(t.fn) t.fn(t.ease(p)); }catch(e){ (window.B3D_ERR||console.error)(e,'애니메이션'); t.t=t.dur; } if(p>=1||t.t>=t.dur){ const k=EV.tweens.indexOf(t); if(k>=0) EV.tweens.splice(k,1); try{ t.done&&t.done(); }catch(e){ (window.B3D_ERR||console.error)(e,'애니메이션'); } } }
  for(const [id,g] of Object.entries(EV.glows)) setEm(id,g.amp*(.7+.3*Math.sin(EV.time*3)),g.color);
  for(const p of Object.values(EV.paths)) if(p.flowing){ p.off=(p.off+dt*p.speed)%1; p.trail.forEach((s,i)=>{ const k=((p.off+i/p.trail.length)%1); p.cp.getPointAt(k,s.position); s.scale.setScalar(.6+.6*Math.sin(k*Math.PI)); }); }
  EV.frameFns.forEach(f=>f(dt,EV.time));
  hoverAnim(rdt);
}
EV.advance=(sec)=>{ for(let t=0;t<sec;t+=.05) update(.05); };
let last=performance.now(), running=true; EV.hold=1;
const camDelta=()=>{ const c=C.cur,g=C.goal; return Math.abs(g.tx-c.tx)+Math.abs(g.ty-c.ty)+Math.abs(g.tz-c.tz)+Math.abs(g.rad-c.rad)*.5+(Math.abs(g.th-c.th)+Math.abs(g.ph-c.ph))*10; };
let frameErr=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000||0); last=now;
  if(running&&frameErr<30){ try{ frameBody(dt); frameErr=Math.max(0,frameErr-.02); }catch(e){ frameErr++; (window.B3D_ERR||console.error)(e,'렌더'); if(frameErr>=30){ const f=document.getElementById('fail'); if(f){ f.hidden=false; f.querySelector('p').textContent='3D 렌더링에서 계속 오류가 나서 멈췄어요. 새로고침하거나 주차별 페이지에서 같은 내용을 볼 수 있어요.'; } } } }
  requestAnimationFrame(frame);
}
function frameBody(dt){
  if(running){
    EV._moving=false; doHover(); update(dt);
    EV.idle+=dt;
    if(EV.autoRotate&&!EV.reduceMotion&&EV.idle>6&&!drag) C.goal.th+=dt*.035;
    const moving=camDelta()>.002; EV._still=!moving&&!drag;
    if(moving){ const k=1-Math.exp(-dt*4.2), c=C.cur, g=C.goal; for(const key of ['tx','ty','tz','rad','th','ph']) c[key]+=(g[key]-c[key])*k; }
    const anyFlow=Object.values(EV.paths).some(p=>p.flowing);
    const active=moving||EV.tweens.length>0||anyFlow||!!drag||EV._moving||EV.alive||(EV.hold>0)||Object.keys(EV.glows).length>0||(EV.autoRotate&&EV.idle>6);
    if(EV.hold>0) EV.hold-=dt;
    if(active){
      const rr=C.cur.rad*(EV.fit||1), c=C.cur;
      cam.position.set(c.tx+Math.sin(c.th)*Math.sin(c.ph)*rr,c.ty+Math.cos(c.ph)*rr,c.tz+Math.cos(c.th)*Math.sin(c.ph)*rr); cam.lookAt(c.tx,c.ty,c.tz); cam.updateMatrixWorld(true);
      EV.billboards&&EV.billboards.forEach(b=>b.quaternion.copy(cam.quaternion));
      if(EV.tweens.length>0||EV._moving||EV.shadowDirty){ R.shadowMap.needsUpdate=true; EV.shadowDirty=false; }
      updateLabels();
      if(composer) composer.render(); else R.render(scene,cam);
      adapt(dt);
    } else aSkip=6;
  }
}
// 화면 밖(스크롤 아웃)이면 렌더 중단 → 배터리/GPU 절약
new IntersectionObserver(es=>{ running=es[0].isIntersecting; },{threshold:0}).observe(stage);
new ResizeObserver(()=>{ try{ resize(); }catch(e){ (window.B3D_ERR||console.error)(e,'크기 조정'); } }).observe(stage);
canvas.addEventListener('webglcontextlost',(e)=>{ e.preventDefault(); running=false; const el=document.getElementById('err'); if(el) el.textContent='3D 연결이 잠시 끊겼어요. 복구하는 중…'; });
canvas.addEventListener('webglcontextrestored',()=>{ running=true; last=performance.now(); EV.hold=1; EV.shadowDirty=true; try{ resize(); }catch(_){} const el=document.getElementById('err'); if(el) el.textContent=''; });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',readTheme);
['pointerdown','input','change','click','keydown'].forEach(t=>$('panel').addEventListener(t,()=>{ EV.hold=Math.max(EV.hold||0,1); EV.shadowDirty=true; }));
EV.start=()=>{ readTheme(); resize(); EV.ready=true; Object.assign(C.cur,HOME); Object.assign(C.goal,HOME); requestAnimationFrame(frame); };
EV.readTheme=readTheme;

/* ---------- 모드 / 스텝 UI (레포 위젯 스타일: .key / .chip) ---------- */
EV.ui={play:false};
function renderTabs(){
  const t=$('tabs'); t.innerHTML=''; const seen=store.get('b3d-seen')||{};
  EV.modes.forEach((m,i)=>{ const b=document.createElement('button'); b.type='button'; b.className='key'; b.textContent=m.tab; b.setAttribute('aria-pressed',i===EV.mode?'true':'false');
    if(m.steps&&m.steps.length){ const n=(seen[m.id]||[]).length, done=n>=m.steps.length; const pg=document.createElement('span'); pg.className='pg'+(done?' done':''); pg.textContent=done?'✓':(n?`${n}/${m.steps.length}`:''); pg.setAttribute('aria-label',done?'모두 봄':`${n}/${m.steps.length} 단계 봄`); if(pg.textContent) b.appendChild(pg); }
    b.onclick=()=>EV.setMode(i); t.appendChild(b); });
}
EV.markSeen=(id,j)=>{ const s=store.get('b3d-seen')||{}; const a=s[id]||[]; if(!a.includes(j)){ a.push(j); s[id]=a; store.set('b3d-seen',s); renderTabs(); } };
EV.resetScene=()=>{
  EV.cancelTweens(); EV.clearGlow(); EV.hideAllPaths();
  Object.values(EV.groups).forEach(g=>{ if(g.userData.mode) g.visible=false; });
  EV.showLabels([]); EV.curLabels=[]; EV.curHot=[];
  EV.cleanup&&EV.cleanup.forEach(f=>f()); EV.cleanup=[]; $('wg').innerHTML=''; EV.billboards=[];
};
EV.labels=(ids,hot=[])=>{ EV.curLabels=ids; EV.curHot=hot; EV.showLabels(ids,hot); };
EV.setMode=(i)=>{ if(!EV.modes[i]) i=0; EV.hold=1; EV.shadowDirty=true;
  EV.autoRotate=false; EV.mode=i; EV.step=-1; const m=EV.modes[i]; renderTabs();
  $('kicker').textContent=m.kicker||''; $('mtitle').textContent=m.title;
  const pills=$('pills'); pills.innerHTML='';
  (m.steps||[]).forEach((s,j)=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=j+1; b.title=(j+1)+'. '+s.t; b.onclick=()=>EV.setStep(j); pills.appendChild(b); });
  const has=m.steps&&m.steps.length; $('ctl').style.display=has?'flex':'none'; $('speed').hidden=!has; $('progress').style.display=has?'block':'none';
  if(has) EV.setStep(0); else { EV.resetScene(); try{ m.enter&&m.enter(); }catch(e){ (window.B3D_ERR||console.error)(e,m.tab); } }
  updateModeLink(m); try{ history.replaceState(null,'','#'+m.id); }catch(_){}
  if(!has){ EV.setStatus('부품을 <b>클릭</b>하면 확대되고 설명이 나와요. 마우스를 올리면 이름이 떠요.'); store.set('b3d-last',{id:m.id,step:0}); }
};
EV.setStep=(j)=>{ EV.hold=1; EV.shadowDirty=true;
  const m=EV.modes[EV.mode]; if(!m||!m.steps||!m.steps.length) return; j=Number.isFinite(+j)?Math.max(0,Math.min(m.steps.length-1,Math.trunc(+j))):0; EV.step=j; const s=m.steps[j]; EV.resetScene();
  [...$('pills').children].forEach((b,k)=>{ b.className='chip'+(k===j?' on':(k<j?' done':'')); });
  $('stepmeta').innerHTML=`step <b>${j+1}/${m.steps.length}</b> · ${s.t}`;
  $('sbody').innerHTML=`<h3>${j+1}. ${s.t}</h3>`+s.html; $('sbody').scrollTop=0;
  try{ if(s.cam) EV.flyTo(s.cam); }catch(e){ (window.B3D_ERR||console.error)(e,'카메라'); }
  try{ m.enter&&m.enter(); }catch(e){ (window.B3D_ERR||console.error)(e,m.tab); }
  try{ s.enter&&s.enter(); }catch(e){ (window.B3D_ERR||console.error)(e,(j+1)+'단계'); $('sbody').insertAdjacentHTML('beforeend','<div class="warn">이 단계의 3D 장면을 만들다 문제가 생겼어요. 설명은 그대로 볼 수 있고, 다른 단계로 이동해도 돼요.</div>'); }
  if(s.play) EV.wait(.8,()=>{ try{ s.play(); }catch(e){ (window.B3D_ERR||console.error)(e,'재생'); } });
  { const hasWg=$('wg').children.length>0; EV.setStatus(hasWg?'오른쪽 <b>직접 해보기</b>를 만지면 3D에서 바로 바뀌어요.':(s.play?'재생이 끝나면 <b>↻ 다시 재생</b>(Space)으로 반복해서 볼 수 있어요.':'3D를 돌려 보며 오른쪽 설명을 따라가 보세요.')); store.set('b3d-last',{id:m.id,step:j}); EV.markSeen(m.id,j); setTimeout(updateMore,30); linkify(sbEl); try{ history.replaceState(null,'','#'+m.id+'/'+(j+1)); }catch(_){} }
  $('prev').disabled=j===0; { const t=nextTarget(); $('next').disabled=false; $('next').textContent=!t?'다음 →':(t.page?'예상문제 풀기 →':EV.modes[t.mode].tab+' →'); } if(!s.play) $('play').textContent='▶ 재생'; else $('play').textContent='▶ 재생 중…'; if(s.play) EV.wait(7,()=>{ $('play').textContent='↻ 다시 재생'; });
};
$('prev').onclick=()=>EV.setStep(EV.step-1);
const nextTarget=()=>{ const m=EV.modes[EV.mode]; if(!m||!m.steps||EV.step<m.steps.length-1) return null; const ni=EV.mode+1; return ni<EV.modes.length?{mode:ni}:{page:'exam.html'}; };
$('next').onclick=()=>{ const t=nextTarget(); if(!t){ EV.setStep(EV.step+1); return; } if(t.page){ const a=document.createElement('a'); a.href=t.page; document.body.append(a); a.click(); a.remove(); } else { EV.setMode(t.mode); document.getElementById('b3d').scrollIntoView({behavior:'smooth',block:'nearest'}); } };
$('play').onclick=()=>{ if(EV.step<0) return; EV.setStep(EV.step); $('play').textContent='↻ 다시 재생'; };
EV.renderTabs=renderTabs;
const MP={w1:['w1-uart.html','W1'],w2:['w2-gpio-bare.html','W2'],w3:['w3-ipl-mcal.html','W3'],w4:['w4-i2c-lcd.html','W4'],w5:['w5-interrupt.html','W5'],w6:['w6-adc.html','W6']};
const modeLinkEl=$('modeLink');
function updateModeLink(m){ const p=MP[m.id]; if(!p){ modeLinkEl.hidden=true; return; } modeLinkEl.hidden=false; modeLinkEl.href=p[0]; modeLinkEl.innerHTML=`<b>${p[1]} 상세 페이지</b>에서 그림으로 더 보기 →`; }
const sbEl=$('sbody'), panelEl=$('panel');
const updateMore=()=>{ panelEl.classList.toggle('more',sbEl.scrollHeight>sbEl.clientHeight+4&&sbEl.scrollTop+sbEl.clientHeight<sbEl.scrollHeight-6); };
sbEl.addEventListener('scroll',updateMore,{passive:true}); new ResizeObserver(updateMore).observe(sbEl);
EV.updateMore=updateMore;
const XMAP={OpenSDA:'opensda',PCF8574:'pcf',ADC_POT0:'pot',LCD:'lcd',SW5:'sw5',D13:'led',PTA29:'led',PTA11:'pot',USB:'usb',FXOSC:'xtal',FS26:'fs26'};
function linkify(root){
  const used=new Set(); const re=new RegExp('\\b('+Object.keys(XMAP).join('|')+')\\b','g');
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest('pre,button,a,h3')?NodeFilter.FILTER_REJECT:(re.test(n.nodeValue)?(re.lastIndex=0,NodeFilter.FILTER_ACCEPT):NodeFilter.FILTER_REJECT)});
  const nodes=[]; while(w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(n=>{ const frag=document.createDocumentFragment(); let last=0; const txt=n.nodeValue; re.lastIndex=0; let m;
    while((m=re.exec(txt))){ if(used.has(m[1])) continue; used.add(m[1]); frag.append(txt.slice(last,m.index)); const b=document.createElement('button'); b.type='button'; b.className='xref'; b.textContent=m[1]; b.dataset.part=XMAP[m[1]]; b.title='3D에서 '+m[1]+' 위치 보기'; frag.append(b); last=m.index+m[1].length; }
    if(last){ frag.append(txt.slice(last)); n.replaceWith(frag); } });
  root.querySelectorAll('.xref[data-part]').forEach(b=>{ const id=b.dataset.part;
    const on=()=>{ EV.hoverPart=id; EV.hold=1; }, off=()=>{ if(EV.hoverPart===id) EV.hoverPart=null; EV.hold=1; };
    b.addEventListener('mouseenter',on); b.addEventListener('focus',on); b.addEventListener('mouseleave',off); b.addEventListener('blur',off);
    b.addEventListener('click',()=>{ EV.focusPart(id); stage.scrollIntoView({behavior:'smooth',block:'nearest'}); }); });
}
EV.linkify=linkify;
const PRE=()=>({all:EV.home,top:{tx:EV.CHIP.x-2,ty:0,tz:-1,rad:36,th:0,ph:.14},chip:{tx:EV.CHIP.x,ty:0,tz:EV.CHIP.z,rad:9.5,th:.3,ph:.85},lcd:{tx:3,ty:0,tz:-11.5,rad:15,th:.15,ph:.8},pc:{tx:-22,ty:1,tz:2,rad:20,th:.55,ph:.95}});
document.querySelectorAll('[data-cam]').forEach(b=>b.onclick=()=>EV.flyTo(PRE()[b.dataset.cam]));
const box=$('b3d'), page=document.querySelector('.page');
const fsOn=()=>document.fullscreenElement===box;
function toggleFS(){ try{ const r=fsOn()?document.exitFullscreen():(box.requestFullscreen||box.webkitRequestFullscreen||(()=>Promise.reject(new Error('이 브라우저는 전체화면을 지원하지 않아요')))).call(box); if(r&&r.catch) r.catch(e=>(window.B3D_ERR||console.error)(e,'전체화면')); }catch(e){ (window.B3D_ERR||console.error)(e,'전체화면'); } }
document.addEventListener('fullscreenchange',()=>{ $('fsBtn').textContent=fsOn()?'전체화면 닫기':'전체화면'; stage.focus({preventScroll:true}); });
$('fsBtn').onclick=toggleFS;
const setWide=(on)=>{ page.classList.toggle('full',on); document.querySelector('.topbar').classList.toggle('full',on); $('wideBtn').textContent=on?'좁게':'넓게'; saveUI(); };
$('wideBtn').onclick=()=>setWide(!page.classList.contains('full'));
const ui=store.get('b3d-ui')||{};
const saveUI=()=>store.set('b3d-ui',{panel:!document.getElementById('b3d').classList.contains('nopanel'),labels:$('optLabels').checked,wide:page.classList.contains('full')});
const togglePanel=()=>{ const on=document.getElementById('b3d').classList.toggle('nopanel'); $('togglePanel').textContent=on?'패널 열기':'패널 접기'; saveUI(); };
$('togglePanel').onclick=togglePanel; EV.saveUI=saveUI;
const coach=$('coach'), helpBtn=$('helpBtn');
document.querySelectorAll('#speed [data-s]').forEach(b=>b.onclick=()=>{ EV.speed=+b.dataset.s; document.querySelectorAll('#speed [data-s]').forEach(x=>x.classList.toggle('on',x===b)); EV.hold=1; });
$('copyLink').onclick=async()=>{ const b=$('copyLink'); try{ await navigator.clipboard.writeText(location.href); b.textContent='복사됨 ✓'; b.classList.add('ok'); }catch(_){ b.textContent='주소창을 복사하세요'; } setTimeout(()=>{ b.textContent='링크 복사'; b.classList.remove('ok'); },1600); };
EV.hideCoach=()=>{ if(coach.hidden) return; coach.hidden=true; helpBtn.setAttribute('aria-expanded','false'); store.set('b3d-coach',1); };
const showCoach=()=>{ coach.hidden=false; helpBtn.setAttribute('aria-expanded','true'); };
helpBtn.onclick=()=>coach.hidden?showCoach():EV.hideCoach(); $('coachOk').onclick=EV.hideCoach;
if(ui.panel===false) togglePanel(); if(ui.labels===false){ $('optLabels').checked=false; } if(ui.wide) setWide(true);
if(!store.get('b3d-coach')){ showCoach(); canvas.addEventListener('pointerdown',()=>EV.hideCoach(),{once:true}); setTimeout(()=>EV.hideCoach(),9000); }
stage.addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT') return;
  if(e.key==='ArrowRight'){ e.preventDefault(); EV.setStep(EV.step+1); } else if(e.key==='ArrowLeft'){ e.preventDefault(); EV.setStep(EV.step-1); }
  else if(e.key==='h'||e.key==='H') togglePanel(); else if(e.key==='?') (coach.hidden?showCoach():EV.hideCoach()); else if(e.key==='f'||e.key==='F') toggleFS(); else if(e.key==='Escape'){ if(!coach.hidden) EV.hideCoach(); else EV.flyTo(EV.home); } else if(e.key===' '){ e.preventDefault(); $('play').click(); }
  else if(/^[1-7]$/.test(e.key)) EV.setMode(+e.key-1); });
})();
