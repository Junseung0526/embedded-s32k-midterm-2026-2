/* board.js — S32K312EVB-Q172 3D 모델
   배치 근거: NXP S32K312EVB-Q172 HWUM(REV A3) Figure 2/16/18/20 사진.
   검은 PCB, 위/아래 Arduino 소켓 3개씩, 오른쪽 터치패드 2개 + 가변저항, 왼쪽 전원잭·CAN·LIN,
   왼쪽 아래 OpenSDA(K26)+micro-USB, 아래 중앙 RGB LED, 아래 오른쪽 버튼 3개.
   정확한 mm 치수가 아니라 사진에서 읽은 상대 위치 기반의 모델이에요. */
(function(){
const EV=window.B3D, T=EV.T, scene=EV.scene;
const V=(x,y,z)=>new T.Vector3(x,y,z);
const W=24, D=13.3;                       // 보드 크기 (월드 단위)
const P=(u,v)=>[(u-.5)*W,(v-.5)*D];       // 사진 정규좌표 → 월드(x,z)
const A=EV.anchors={};
let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return (seed-1)/2147483646; };

/* ---------- 기하 헬퍼 ---------- */
function rrShape(w,h,r){ const s=new T.Shape(),x=-w/2,y=-h/2; s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s; }
function rrGeo(w,d,h,r=.08,b=.035){ // 바닥 y=0, 모서리 둥근 상자
  const g=new T.ExtrudeGeometry(rrShape(w-2*b,d-2*b,Math.max(.01,r-b)),{depth:Math.max(.01,h-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:5});
  g.rotateX(-Math.PI/2); g.translate(0,b,0); return g; }
const mesh=(g,m,x=0,y=0,z=0,parent)=>{ const o=new T.Mesh(g,m); o.position.set(x,y,z); o.castShadow=o.receiveShadow=true; if(parent) parent.add(o); return o; };
function merge(geos){ const pos=[],nor=[]; geos.forEach(g=>{ const n=g.index?g.toNonIndexed():g; pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); });
  const o=new T.BufferGeometry(); o.setAttribute('position',new T.Float32BufferAttribute(pos,3)); o.setAttribute('normal',new T.Float32BufferAttribute(nor,3)); return o; }
const bx=(w,h,d,x,y,z)=>{ const g=new T.BoxGeometry(w,h,d); g.translate(x,y,z); return g; };
const gullLead=(lw=.035)=>merge([bx(.16,.03,lw,.08,.2,0),bx(.03,.2,lw,.17,.11,0),bx(.2,.025,lw,.255,.0125,0)]); // +x 방향 갈매기날개
const M={
  metal:()=>EV.mat(0xc7ccd4,{metalness:1,roughness:.3}),
  gold:()=>EV.mat(0xd9ac3c,{metalness:1,roughness:.28}),
  black:()=>EV.mat(0x14161a,{roughness:.5}),
  plastic:()=>EV.mat(0x1b1d22,{roughness:.62}),
};
function part(id,g){ g.userData.part=id; EV.parts[id]=g; scene.add(g); return g; }
const text2d=(c,t,x,y,f,col='#eef2f7',a='left',w='bold')=>{ c.font=`${w} ${f}px "DejaVu Sans","Noto Sans KR",sans-serif`; c.textAlign=a; c.fillStyle=col; c.fillText(t,x,y); };

/* ---------- 스튜디오 바닥 + 접촉 그림자(AO) ---------- */
const radial=(inner,outer,size=256)=>EV.tex(size,size,(c)=>{ const g=c.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2); g.addColorStop(0,inner); g.addColorStop(1,outer); c.fillStyle=g; c.fillRect(0,0,size,size); },{linear:true});
{ // 바닥: 그림자만 받는 투명 재질 → 씬 배경(= 페이지 배경색)이 그대로 보인다
  EV.floorMat=new T.ShadowMaterial({opacity:.38}); EV.floorMat.color=new T.Color(0x000000);
  const fl=new T.Mesh(new T.CircleGeometry(160,96),EV.floorMat); fl.rotation.x=-Math.PI/2; fl.position.y=-.45; fl.receiveShadow=true; scene.add(fl);
  // 데스크 매트 (가죽 질감, 둥근 모서리)
  const matTex=EV.tex(512,512,(c)=>{ c.fillStyle='#34363c'; c.fillRect(0,0,512,512); for(let i=0;i<9000;i++){ const v=44+Math.random()*26; c.fillStyle=`rgb(${v},${v+1},${v+4})`; c.fillRect(Math.random()*512,Math.random()*512,2,2); } },{linear:false}); matTex.t.wrapS=matTex.t.wrapT=T.RepeatWrapping; matTex.t.repeat.set(14,8);
  const dm=new T.Mesh(rrGeo(64,38,.14,3,.05),new T.MeshStandardMaterial({color:0x3f4148,map:matTex.t,bumpMap:matTex.t,bumpScale:1.2,roughness:.8,metalness:0,envMapIntensity:.2}));
  dm.position.set(-14,-.44,-3); dm.receiveShadow=true; dm.userData.glowOK=false; scene.add(dm);
  const sh=radial('rgba(0,0,0,.6)','rgba(0,0,0,0)',512); const sm=new T.Mesh(new T.PlaneGeometry(W+12,D+10),new T.MeshBasicMaterial({map:sh.t,transparent:true,opacity:.8,depthWrite:false})); sm.rotation.x=-Math.PI/2; sm.position.set(0,-.295,.4); scene.add(sm); }
const AOTEX=radial('rgba(0,0,0,.9)','rgba(0,0,0,0)',128);
/* 부품 아래 접촉 그림자: 작은 부품이 "붙어 보이게" 하는 가짜 AO */
function ao(x,z,w,d,k=.5,y=.012){ const m=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:AOTEX.t,transparent:true,opacity:k,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})); m.rotation.x=-Math.PI/2; m.position.set(x,y,z); m.renderOrder=2; scene.add(m); return m; }
EV.ao=ao;
// 플라스틱 미세 범프 (몰드 컴파운드 질감)
const NOISE=EV.tex(256,256,(c)=>{ for(let i=0;i<256*256/3;i++){ const v=110+Math.random()*50; c.fillStyle=`rgb(${v},${v},${v})`; c.fillRect(Math.random()*256,Math.random()*256,2,2); } },{linear:true});
NOISE.t.wrapS=NOISE.t.wrapT=T.RepeatWrapping; NOISE.t.repeat.set(4,4);
const plastic=(col,rough=.55)=>new T.MeshPhysicalMaterial({color:col,roughness:rough,metalness:0,bumpMap:NOISE.t,bumpScale:.6,clearcoat:.15,clearcoatRoughness:.5,envMapIntensity:.55});

/* ---------- 칩/핀 좌표 ---------- */
const CH={x:.96,z:-.08}; EV.CHIP=V(CH.x,0,CH.z);
const HALF=1.43, TIP=HALF+.38, PITCH=.0643, li=i=>-1.35+i*PITCH;
const pin=(s,i)=> s==='L'?[CH.x-TIP,CH.z+li(i)]: s==='R'?[CH.x+TIP,CH.z+li(i)]: s==='T'?[CH.x+li(i),CH.z-TIP]:[CH.x+li(i),CH.z+TIP];
const PN={TX:pin('L',30),RX:pin('L',33),LED:pin('B',2),SW:pin('B',36),SDA:pin('T',19),SCL:pin('T',24),ADC:pin('R',36)};
EV.PN=PN; EV.pinNames={TX:'PTA16',RX:'PTA15',LED:'PTA29',SW:'PTB26',SDA:'PTC6',SCL:'PTC7',ADC:'PTA11'};
const LEDP=P(.47,.93), SW5P=P(.75,.95), SW6P=P(.85,.95), RSTP=P(.64,.95), POTP=P(.965,.69), K26=P(.115,.835), USBP=P(-.012,.815);
const HDRY=1.15; // 소켓 위를 건너뛰는 신호 표시 높이
// 3D 경로용 점 [x,z,y?]
const NETS={
  TX:[PN.TX,[-3.0,PN.TX[1]],[-3.0,2.9],[K26[0]+.45,2.9],[K26[0]+.45,3.75]],
  RX:[PN.RX,[-3.5,PN.RX[1]],[-3.5,3.25],[K26[0]-.45,3.25],[K26[0]-.45,3.75]],
  USBD:[[K26[0]-.95,K26[1]],[-11.0,K26[1]],[-11.3,USBP[1]],[-11.85,USBP[1]]],
  LED:[PN.LED,[PN.LED[0],3.2],[PN.LED[0],3.2,HDRY],[PN.LED[0],5.25,HDRY],[LEDP[0],5.25,.55],[LEDP[0],LEDP[1]-.3,.3]],
  SW:[PN.SW,[PN.SW[0],3.2],[PN.SW[0],3.2,HDRY],[SW5P[0],3.2,HDRY],[SW5P[0],5.35,HDRY],[SW5P[0],5.35,.6],[SW5P[0],SW5P[1]-.4,.45]],
  ADC:[PN.ADC,[8.4,PN.ADC[1]],[8.4,POTP[1]],[POTP[0]-.9,POTP[1]]],
  SDA:[PN.SDA,[PN.SDA[0],-3.6],[1.575,-3.6],[1.575,-5.2],[1.575,-5.2,1.1]],
  SCL:[PN.SCL,[PN.SCL[0],-2.6],[2.045,-2.6],[2.045,-5.2],[2.045,-5.2,1.1]],
};
EV.NETS=NETS;

/* ---------- PCB 본체 (모서리 둥근 + 귀퉁이 모따기) ---------- */
function pcbShape(){ const s=new T.Shape(),x=-W/2,y=-D/2,c=1.1; s.moveTo(x+c,y); s.lineTo(-x-c,y); s.quadraticCurveTo(-x,y,-x,y+c); s.lineTo(-x,-y-c); s.quadraticCurveTo(-x,-y,-x-c,-y); s.lineTo(x+c,-y); s.quadraticCurveTo(x,-y,x,-y-c); s.lineTo(x,y+c); s.quadraticCurveTo(x,y,x+c,y); return s; }
const pcbG=new T.ExtrudeGeometry(pcbShape(),{depth:.3,bevelEnabled:true,bevelThickness:.02,bevelSize:.03,bevelSegments:3,curveSegments:14});
pcbG.rotateX(-Math.PI/2); pcbG.translate(0,-.3,0);
const pcb=mesh(pcbG,new T.MeshStandardMaterial({color:0x07080a,roughness:.5,metalness:.1,envMapIntensity:.5}),0,0,0,scene); pcb.userData.glowOK=false;

/* ---------- PCB 윗면: 색 텍스처 + 범프(마스크 위로 솟은 배선/실크) ---------- */
const PX=112, X=x=>(x+W/2)*PX, Z=z=>(z+D/2)*PX;
function paintTop(c,bump){
  const K=(rgba,h)=>bump?`rgb(${h},${h},${h})`:rgba;
  c.fillStyle=bump?'#737373':'#0c0d10'; c.fillRect(0,0,W*PX,D*PX);
  // 솔더마스크 미세 질감
  for(let k=0;k<(bump?18000:5000);k++){ const x=rnd()*W*PX,y=rnd()*D*PX,v=bump?112+rnd()*10:0; c.fillStyle=bump?`rgb(${v},${v},${v})`:`rgba(255,255,255,${.003+rnd()*.007})`; c.fillRect(x,y,1+rnd()*2,1+rnd()*2); }
  c.lineJoin='round'; c.lineCap='round';
  const trace=(pts,w,col,h)=>{ c.strokeStyle=K(col,h); c.lineWidth=w; c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Z(p[1])):c.moveTo(X(p[0]),Z(p[1]))); c.stroke(); };
  seed=7;
  for(let k=0;k<110;k++){ const x0=-11+rnd()*22,z0=-6+rnd()*12,l=1+rnd()*3.2; trace([[x0,z0],[x0+l,z0],[x0+l+.4,z0+.4*(rnd()<.5?1:-1)]],3.2,'rgba(120,124,138,.20)',150); }
  for(const k in NETS) trace(NETS[k].map(p=>[p[0],p[1]]),6.5,'rgba(214,180,96,.62)',165);
  c.lineWidth=2.2;
  for(let i=0;i<43;i++){ const a=li(i), e=.45+(i%3)*.12;
    [[CH.x-TIP,CH.z+a,-e,0],[CH.x+TIP,CH.z+a,e,0],[CH.x+a,CH.z-TIP,0,-e],[CH.x+a,CH.z+TIP,0,e]].forEach(([x,z,dx,dz])=>{ c.strokeStyle=K('rgba(170,174,188,.26)',150); c.beginPath(); c.moveTo(X(x),Z(z)); c.lineTo(X(x+dx),Z(z+dz)); c.stroke(); }); }
  // 노출 패드(ENIG 금) + 비아: 마스크보다 낮게
  for(let k=0;k<70;k++){ const x=-11.4+rnd()*22.8,z=-6.2+rnd()*12.4,r=2.6+rnd()*1.6; c.fillStyle=K('#a8864a',70); c.beginPath(); c.arc(X(x),Z(z),r,0,7); c.fill(); c.fillStyle=K('#050506',40); c.beginPath(); c.arc(X(x),Z(z),1.6,0,7); c.fill(); }
  // 실크스크린
  const SIL=bump?'#b4b4b4':'rgba(240,243,248,.96)';
  const S=(t,x,z,f=20,a='left')=>text2d(c,t,X(x),Z(z),f*1.4,SIL,a,'600');
  const NXP=P(.575,.24); text2d(c,'NXP',X(NXP[0]),Z(NXP[1]),92,SIL,'center','900');
  S('S32K312EVB-Q172',P(.545,.30)[0]-1.2,P(.545,.30)[1],20); S('© 2021 NXP B.V.',P(.69,.255)[0],P(.69,.255)[1],19);
  c.strokeStyle=SIL; c.lineWidth=3.4; c.strokeRect(X(CH.x-HALF-.62),Z(CH.z-HALF-.62),(HALF+.62)*2*PX,(HALF+.62)*2*PX);
  S('U9',CH.x-HALF-.55,CH.z-HALF-.7,18);
  S('J14 +12V',-11.9,-1.6,17,'center'); S('SW1',-8.2,-6.1,17,'center'); S('J32 CAN',-11.0,-.95,16,'center'); S('J23 LIN',-11.0,3.3,16,'center');
  S('J40 · OpenSDA',-10.3,5.6,17,'center'); S('J50 JTAG',P(.805,.34)[0],P(.805,.34)[1]-.95,16,'center');
  S('D13',LEDP[0],LEDP[1]+.78,18,'center'); S('RGBLED0',LEDP[0]+1.6,LEDP[1]+.15,16);
  S('SW2',RSTP[0],SW5P[1]-1.1,16,'center'); S('SW5',SW5P[0],SW5P[1]-1.1,17,'center'); S('SW6',SW6P[0],SW5P[1]-1.1,17,'center');
  S('USER_SW0 PTB26',SW5P[0]-.3,SW5P[1]+.95,13,'center'); S('RESET',RSTP[0],SW5P[1]+.95,13,'center');
  S('ADC_POT0 R393',POTP[0]-.8,POTP[1]-1.2,15,'center'); S('PTA11',POTP[0]-.8,POTP[1]+1.4,15,'center');
  S('ARDUINO UNO 호환 (개념)',-2.6,-6.2,14,'center'); S('X1',-2.16,-.5,14,'center');
  c.save(); c.translate(X(11.78),Z(-2.8)); c.rotate(Math.PI/2); text2d(c,'TOUCH_A',0,0,22,SIL,'center'); c.restore();
  c.save(); c.translate(X(11.78),Z(.05)); c.rotate(Math.PI/2); text2d(c,'TOUCH_B',0,0,22,SIL,'center'); c.restore();
  // 바코드 스티커
  const st=P(.805,.62); c.fillStyle=K('#e9ebef',150); c.fillRect(X(st[0]-.7),Z(st[1]-1.55),1.4*PX,3.1*PX);
  c.fillStyle=K('#222',130); for(let k=0;k<30;k++){ c.fillRect(X(st[0]-.55),Z(st[1]-1.35)+k*17,(.25+rnd()*.7)*PX*.8,Math.max(3,Math.round(rnd()*8))); }
  c.save(); c.translate(X(st[0]+.2),Z(st[1]+.5)); c.rotate(-Math.PI/2); text2d(c,'S32K312EVB-Q172',0,0,21,bump?'#777':'#222','center'); c.restore();
  // WEEE / ESD 기호
  const wp=P(.725,.655); c.strokeStyle=SIL; c.lineWidth=4; c.strokeRect(X(wp[0]-.9),Z(wp[1]-.45),.85*PX,.9*PX);
  c.beginPath(); c.moveTo(X(wp[0]+.15),Z(wp[1]+.45)); c.lineTo(X(wp[0]+.58),Z(wp[1]-.45)); c.lineTo(X(wp[0]+1.0),Z(wp[1]+.45)); c.closePath(); c.stroke();
  // 마운트 홀
  [[-11.2,-5.7],[11.2,-5.7],[-11.2,5.7],[11.2,5.7]].forEach(([x,z])=>{ c.fillStyle=K('#d3aa52',60); c.beginPath(); c.arc(X(x),Z(z),34,0,7); c.fill(); c.fillStyle=K('#030303',20); c.beginPath(); c.arc(X(x),Z(z),19,0,7); c.fill(); });
}
const skinCol=EV.tex(W*PX,D*PX,(c)=>paintTop(c,false));
const skinBump=EV.tex(W*PX,D*PX,(c)=>paintTop(c,true),{linear:true});
[skinCol.t,skinBump.t].forEach(t=>{ t.repeat.set(1/W,1/D); t.offset.set(.5,.5); });
const skinG=new T.ShapeGeometry(pcbShape(),20); skinG.rotateX(-Math.PI/2);
const skin=new T.Mesh(skinG,new T.MeshStandardMaterial({map:skinCol.t,bumpMap:skinBump.t,bumpScale:2.2,roughness:.36,metalness:0,envMapIntensity:.9}));
skin.position.y=.0215; skin.receiveShadow=true; skin.userData.glowOK=false; scene.add(skin);

/* ---------- 모서리 스탠드오프 ---------- */
[[-11.2,-5.7],[11.2,-5.7],[-11.2,5.7],[11.2,5.7]].forEach(([x,z])=>{ const g=new T.Group();
  mesh(new T.CylinderGeometry(.36,.36,.5,6),EV.mat(0xc9a24a,{metalness:1,roughness:.32}),0,.27,0,g);
  mesh(new T.CylinderGeometry(.27,.27,.06,24),M.metal(),0,.55,0,g); mesh(new T.CylinderGeometry(.2,.2,.1,24),EV.mat(0x8f949c,{metalness:1,roughness:.28}),0,.63,0,g);
  mesh(new T.BoxGeometry(.26,.04,.05),EV.mat(0x2a2c30),0,.69,0,g);
  g.position.set(x,0,z); scene.add(g); ao(x,z,1.2,1.2,.45); });

/* ---------- S32K312 칩 (QFP-172, 갈매기날개 리드) ---------- */
{
  const g=new T.Group(), by=.1;
  const body=mesh(rrGeo(HALF*2,HALF*2,.36,.12,.03),plastic(0x131417,.5),0,by,0,g); ao(0,0,HALF*2+1.2,HALF*2+1.2,.55);
  const mk=EV.tex(1024,1024,(c)=>{ c.fillStyle='#17191e'; c.fillRect(0,0,1024,1024);
    text2d(c,'NXP',512,250,76,'#f1f3f8','center','900'); text2d(c,'S32K312',512,400,128,'#e8ebf2','center','bold');
    text2d(c,'Arm Cortex-M7',512,500,62,'#9fd0ff','center'); text2d(c,'P32K312NHVPBS0P09C',512,590,52,'#aab4c8','center','normal'); text2d(c,'QFP-172 · U9',512,660,48,'#8791a8','center','normal');
    c.fillStyle='#0b0c0f'; c.beginPath(); c.arc(130,894,32,0,7); c.fill(); c.strokeStyle='#3a3e48'; c.lineWidth=5; c.stroke(); c.strokeStyle='#2b2f38'; c.lineWidth=7; c.strokeRect(40,40,944,944); });
  const mp=new T.Mesh(new T.PlaneGeometry(HALF*2-.16,HALF*2-.16),new T.MeshBasicMaterial({map:mk.t,transparent:true})); mp.rotation.x=-Math.PI/2; mp.position.y=by+.362; mp.userData.glowOK=false; g.add(mp);
  const LG=gullLead(), lm=EV.mat(0xcdd1d8,{metalness:1,roughness:.3});
  const inst=new T.InstancedMesh(LG,lm,43*4), m4=new T.Matrix4(), q=new T.Quaternion(); let n=0;
  const place=(x,z,ry)=>{ q.setFromEuler(new T.Euler(0,ry,0)); m4.compose(V(x,0,z),q,V(1,1,1)); inst.setMatrixAt(n++,m4); };
  for(let i=0;i<43;i++){ const a=li(i); place(-HALF+.015,a,Math.PI); place(HALF-.015,a,0); place(a,-HALF+.015,Math.PI/2); place(a,HALF-.015,-Math.PI/2); }
  inst.castShadow=true; g.add(inst);
  g.position.set(CH.x,0,CH.z); part('chip',g);
}
/* ---------- 핀 마커 ---------- */
{ const g=new T.Group(); const col={TX:0xff9f43,RX:0x7be0ff,LED:0xff5b5b,SW:0x8affb0,SDA:0xffd166,SCL:0x6ea8ff,ADC:0xd18bff}; EV.pinMarks={};
  for(const k in PN){ const m=new T.Mesh(new T.SphereGeometry(.14,16,16),new T.MeshBasicMaterial({color:col[k]})); m.position.set(PN[k][0],.4,PN[k][1]); m.visible=false; g.add(m); EV.pinMarks[k]=m;
    const r=new T.Mesh(new T.TorusGeometry(.26,.03,8,28),new T.MeshBasicMaterial({color:col[k]})); r.rotation.x=Math.PI/2; m.add(r); }
  scene.add(g); EV.markPins=(names=[])=>{ for(const k in EV.pinMarks) EV.pinMarks[k].visible=names.includes(k); };
  EV.onFrame((dt,t)=>{ let any=false; for(const k in EV.pinMarks){ const m=EV.pinMarks[k]; if(m.visible){ any=true; m.children[0].scale.setScalar(1+.25*Math.sin(t*6)); } } EV.alive=any; }); }

/* ---------- 암 소켓 (Arduino 호환 헤더) ---------- */
function socket(x,z,cols,rows,h=.95){
  const g=new T.Group(), w=cols*.47+.12, d=rows*.47+.12;
  mesh(rrGeo(w,d,h,.06,.025),plastic(0x16171b,.5),0,0,0,g); ao(0,0,w+.8,d+.8,.5);
  const tx=EV.tex(cols*64,rows*64,(c,Wc,Hc)=>{ c.fillStyle='#181a1f'; c.fillRect(0,0,Wc,Hc);
    for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){ const cx=(k+.5)*64, cy=(r+.5)*64; c.fillStyle='#050506'; c.fillRect(cx-17,cy-17,34,34); const gr=c.createLinearGradient(cx-17,cy-17,cx+17,cy+17); gr.addColorStop(0,'#2a2c33'); gr.addColorStop(1,'#000'); c.fillStyle=gr; c.fillRect(cx-13,cy-13,26,26); c.strokeStyle='#8a6e2a'; c.lineWidth=2; c.strokeRect(cx-9,cy-9,18,18); } });
  const pl=new T.Mesh(new T.PlaneGeometry(cols*.47,rows*.47),new T.MeshBasicMaterial({map:tx.t})); pl.rotation.x=-Math.PI/2; pl.position.y=h+.005; pl.userData.glowOK=false; g.add(pl);
  g.position.set(x,0,z); scene.add(g); g.userData.cols=cols; g.userData.rows=rows; return g;
}
const TOPZ=-D/2+.2+.74, BOTZ=P(0,.83)[1];
const sockTop2=socket(P(.595,0)[0],TOPZ,8,3);
socket(P(.39,0)[0],TOPZ,10,3); socket(P(.80,0)[0],TOPZ,10,3);
socket(P(.445,0)[0],BOTZ,8,3); socket(P(.64,0)[0],BOTZ,9,3); socket(P(.84,0)[0],BOTZ,10,3);

/* ---------- 점퍼 (2/3핀 헤더 + 검은 캡) ---------- */
function jumper(x,z,n=2,rot=0,capped=true){ const g=new T.Group();
  mesh(rrGeo(.26*n+.14,.3,.22,.04,.02),EV.mat(0x16171b,{roughness:.55}),0,0,0,g);
  for(let i=0;i<n;i++) mesh(new T.BoxGeometry(.07,.42,.07),M.gold(),(i-(n-1)/2)*.26,.22,0,g);
  if(capped) mesh(rrGeo(.26*n+.04,.32,.34,.05,.02),EV.mat(0x0b0b0d,{roughness:.4}),0,.2,0,g);
  g.rotation.y=rot; g.position.set(x,0,z); scene.add(g); return g; }
[[-.96,-3.39],[3.84,-3.39],[3.9,-1.75],[-7.3,-.95],[-7.3,.05],[-5.2,.75],[-5.2,1.3],[2.9,2.95],[-6.1,3.75],[-4.6,3.75]].forEach(([x,z],i)=>jumper(x,z,i%3===1?3:2,i%2?Math.PI/2:0,i%4!==3));

/* ---------- SMD 수동소자: 몸체 + 은색 단자, 무작위 대신 정렬된 뱅크 ---------- */
{
  const TYPES={ cap:{L:.24,Wd:.14,H:.12,body:0x8a6a3e,end:0xa9adb4}, res:{L:.24,Wd:.14,H:.08,body:0x101113,end:0xa4a8af}, capL:{L:.36,Wd:.22,H:.16,body:0x7a5a30,end:0xa9adb4}, tant:{L:.42,Wd:.26,H:.2,body:0xc08a2e,end:0x2a2b2f} };
  const buckets={}; const add=(t,x,z,r=0)=>{ (buckets[t]||(buckets[t]=[])).push([x,z,r]); };
  const grid=(t,x0,z0,cols,rows,dx,dz,r=0)=>{ for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) add(t,x0+i*dx,z0+j*dz,r); };
  for(let i=1;i<43;i+=3){ const a=li(i); add('cap',CH.x+a,CH.z-TIP-.5,0); add('cap',CH.x+a,CH.z+TIP+.5,0); add('cap',CH.x-TIP-.5,CH.z+a,Math.PI/2); add('cap',CH.x+TIP+.5,CH.z+a,Math.PI/2); }
  grid('cap',-4.7,2.05,3,3,.42,.36,Math.PI/2); grid('capL',-4.2,-3.7,3,1,.6,0,0);
  grid('res',-8.0,4.1,6,1,.34,0,0); grid('cap',-8.0,4.9,6,1,.34,0,0);
  grid('res',4.7,-3.4,6,2,.34,.34,0); grid('cap',4.7,-2.4,6,1,.34,0,0);
  grid('res',-3.6,6.15,4,1,.34,0,0); grid('cap',1.0,-4.0,5,1,.34,0,0);
  grid('res',5.55,.2,1,5,0,.34,Math.PI/2); grid('cap',5.9,.2,1,5,0,.34,Math.PI/2);
  grid('res',-3.5,-2.9,5,1,.34,0,0); grid('res',-11.2,-4.2,4,2,.34,.34,0); grid('capL',-6.4,-4.2,2,1,.6,0,0);
  add('tant',-5.1,-3.3,0); add('tant',-5.1,-2.7,0); add('tant',3.2,-2.9,0);
  const m4=new T.Matrix4(), q=new T.Quaternion();
  for(const [t,arr] of Object.entries(buckets)){ const S=TYPES[t];
    const bg=bx(S.L*.62,S.H,S.Wd,0,S.H/2,0), eg=merge([bx(S.L*.2,S.H*1.05,S.Wd*1.04,-S.L*.4,S.H*.525,0),bx(S.L*.2,S.H*1.05,S.Wd*1.04,S.L*.4,S.H*.525,0)]);
    const bi=new T.InstancedMesh(bg,EV.mat(S.body,{roughness:.5,metalness:.05}),arr.length), ei=new T.InstancedMesh(eg,EV.mat(S.end,{roughness:.45,metalness:.9}),arr.length);
    arr.forEach(([x,z,r],i)=>{ q.setFromEuler(new T.Euler(0,r,0)); m4.compose(V(x,.022,z),q,V(1,1,1)); bi.setMatrixAt(i,m4); ei.setMatrixAt(i,m4); });
    scene.add(bi,ei); }
}

/* ---------- SOIC IC (TJA1043 CAN, TJA1021 LIN) + FS26 + K26 ---------- */
function soic(x,z,label,n=7,w=1.5,rot=0){ const g=new T.Group(); mesh(rrGeo(w,.9,.2,.04,.02),EV.mat(0x15171b,{roughness:.55}),0,.07,0,g);
  const LG=gullLead(.045); const inst=new T.InstancedMesh(LG,EV.mat(0xcdd1d8,{metalness:1,roughness:.3}),n*2),m4=new T.Matrix4(),q=new T.Quaternion(); let k=0;
  for(let i=0;i<n;i++){ const a=(i-(n-1)/2)*(w-.3)/(n-1||1); q.setFromEuler(new T.Euler(0,Math.PI/2,0)); m4.compose(V(a,0,.45-.015),q,V(1,1,1)); inst.setMatrixAt(k++,m4); q.setFromEuler(new T.Euler(0,-Math.PI/2,0)); m4.compose(V(a,0,-.45+.015),q,V(1,1,1)); inst.setMatrixAt(k++,m4); }
  g.add(inst); const tx=EV.tex(256,128,(c)=>{ c.fillStyle='#17191e'; c.fillRect(0,0,256,128); text2d(c,label,128,74,36,'#c9d1e6','center','bold'); }); const pl=new T.Mesh(new T.PlaneGeometry(w*.9,.8),new T.MeshBasicMaterial({map:tx.t})); pl.rotation.x=-Math.PI/2; pl.position.y=.277; pl.userData.glowOK=false; g.add(pl);
  g.rotation.y=rot; g.position.set(x,0,z); scene.add(g); return g; }
{ soic(-9.4,-.7,'TJA1043',7); soic(-9.4,1.95,'TJA1021',7); let p;
  p=P(.215,.615); const g=new T.Group(); mesh(rrGeo(1.6,1.6,.2,.05,.02),EV.mat(0x15171b,{roughness:.55}),0,.04,0,g);
  const tx=EV.tex(256,256,(c)=>{ c.fillStyle='#17191e'; c.fillRect(0,0,256,256); text2d(c,'FS26',128,120,52,'#e6e9f2','center'); text2d(c,'Power SBC',128,175,28,'#8f99b3','center','normal'); }); const pl=new T.Mesh(new T.PlaneGeometry(1.45,1.45),new T.MeshBasicMaterial({map:tx.t})); pl.rotation.x=-Math.PI/2; pl.position.y=.265; pl.userData.glowOK=false; g.add(pl);
  g.position.set(p[0],0,p[1]); scene.add(g); EV.parts.fs26=g; g.userData.part='fs26'; }

/* ---------- OpenSDA (K26) + micro-USB + 케이블 ---------- */
{
  const g=new T.Group(); mesh(rrGeo(1.7,1.7,.22,.07,.02),EV.mat(0x14161a,{roughness:.5}),0,.05,0,g);
  const tx=EV.tex(256,256,(c)=>{ c.fillStyle='#17191e'; c.fillRect(0,0,256,256); text2d(c,'NXP',128,86,40,'#fff','center','900'); text2d(c,'K26',128,150,56,'#e6e9f2','center'); text2d(c,'OpenSDA',128,200,28,'#9fd0ff','center','normal'); c.fillStyle='#000'; c.beginPath(); c.arc(30,226,10,0,7); c.fill(); });
  const pl=new T.Mesh(new T.PlaneGeometry(1.55,1.55),new T.MeshBasicMaterial({map:tx.t})); pl.rotation.x=-Math.PI/2; pl.position.y=.287; pl.userData.glowOK=false; g.add(pl);
  g.position.set(K26[0],0,K26[1]); part('opensda',g); ao(K26[0],K26[1],2.6,2.6,.5);
  // micro-USB 쉘 (사다리꼴 압출)
  const u=new T.Group(); const sh=new T.Shape(); sh.moveTo(-.55,-.7); sh.lineTo(.55,-.7); sh.lineTo(.55,.7); sh.lineTo(-.55,.7); sh.lineTo(-.55,.45); sh.lineTo(-.42,.35); sh.lineTo(-.42,-.35); sh.lineTo(-.55,-.45); sh.closePath();
  const ug=new T.ExtrudeGeometry(sh,{depth:.5,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:1}); ug.rotateX(-Math.PI/2); mesh(ug,M.metal(),0,.02,0,u);
  mesh(new T.BoxGeometry(.2,.2,.62),EV.mat(0x050607,{roughness:.9}),-.43,.28,0,u); mesh(new T.BoxGeometry(.18,.04,.5),M.gold(),-.4,.2,0,u);
  u.position.set(USBP[0]-.4,0,USBP[1]); part('usb',u);
  const cable=new T.CatmullRomCurve3([V(USBP[0]-.95,.3,USBP[1]),V(-14.6,.14,4.7),V(-16.4,.13,3.0),V(-18.0,.13,.3),V(-18.75,.14,-.7)],false,'catmullrom',.4);
  mesh(new T.TubeGeometry(cable,80,.13,12,false),EV.mat(0x0b0c0f,{roughness:.55,metalness:0}),0,0,0,scene);
  // 마이크로USB 부츠
  const bt=mesh(rrGeo(.95,.6,.42,.14,.04),EV.mat(0x101114,{roughness:.6}),USBP[0]-1.1,.03,USBP[1],scene);
  // USB-A 플러그 (노트북 쪽)
  { const pg=new T.Group(); mesh(rrGeo(.9,.7,.34,.1,.03),EV.mat(0x111216,{roughness:.6}),.25,0,0,pg); mesh(rrGeo(.9,.62,.22,.05,.02),M.metal(),-.45,.04,0,pg); mesh(new T.BoxGeometry(.5,.05,.32),EV.mat(0x1a1b1f),-.5,.14,0,pg);
    pg.position.set(-18.9,.02,-.7); pg.rotation.y=.2; scene.add(pg); }
  EV.cableCurve=cable;
}

/* ---------- 왼쪽: 전원잭 · 슬라이드 스위치 · CAN/LIN 커넥터 · 전해 콘덴서 · 인덕터 ---------- */
{
  const p=P(.0,.31), j=new T.Group();
  mesh(rrGeo(2.3,1.7,1.25,.14,.05),EV.mat(0x25272c,{metalness:.2,roughness:.45}),0,0,0,j); mesh(rrGeo(2.34,1.74,.3,.14,.05),EV.mat(0x9aa1ab,{metalness:1,roughness:.3}),0,.95,0,j);
  const hole=mesh(new T.CylinderGeometry(.5,.5,.4,28),EV.mat(0x050507,{roughness:.9}),-1.05,.65,0,j); hole.rotation.z=Math.PI/2;
  const pin=mesh(new T.CylinderGeometry(.09,.09,.45,12),M.gold(),-1.0,.65,0,j); pin.rotation.z=Math.PI/2;
  j.position.set(p[0]-.2,0,p[1]); part('barrel',j);
  const q=P(.16,.10), s=new T.Group();
  mesh(rrGeo(2.1,1.0,.75,.08,.03),EV.mat(0x7d1c22,{roughness:.4}),0,0,0,s);
  [-.5,.5].forEach(o=>mesh(rrGeo(.55,.5,.3,.08,.03),EV.mat(0xe9e7e2,{roughness:.35}),o,.75,0,s));
  [-.6,0,.6].forEach(o=>mesh(new T.BoxGeometry(.1,.15,.1),M.metal(),o,.08,.6,s));
  s.position.set(q[0],0,q[1]); part('sw1',s);
  [['can',P(-.04,.505),4,1],['lin',P(-.04,.67),4,2]].forEach(([id,pp,n,rows])=>{ const g=new T.Group(); mesh(rrGeo(1.7,n*.45+.2,.9,.07,.03),EV.mat(0x1a1b20,{roughness:.6}),0,0,0,g);
    for(let r=0;r<rows;r++)for(let i=0;i<n;i++) mesh(new T.BoxGeometry(.7,.07,.07),M.gold(),.55,.55+r*.22,(i-(n-1)/2)*.4,g);
    g.position.set(pp[0]-.4,0,pp[1]); part(id,g); });
  // 전해 콘덴서
  const c=P(.235,.31), e=new T.Group(); mesh(new T.CylinderGeometry(.42,.42,.18,28),EV.mat(0x111,{roughness:.6}),0,.09,0,e);
  mesh(new T.CylinderGeometry(.38,.38,.5,28),EV.mat(0xcfd3da,{metalness:.9,roughness:.32}),0,.4,0,e);
  const ct=EV.tex(128,128,(cc)=>{ cc.fillStyle='#c9cdd4'; cc.fillRect(0,0,128,128); cc.strokeStyle='#8c9099'; cc.lineWidth=5; cc.beginPath(); cc.moveTo(30,64); cc.lineTo(98,64); cc.moveTo(64,30); cc.lineTo(64,98); cc.stroke(); cc.fillStyle='#222'; cc.fillRect(0,0,128,16); });
  const cp=new T.Mesh(new T.CircleGeometry(.36,28),new T.MeshBasicMaterial({map:ct.t})); cp.rotation.x=-Math.PI/2; cp.position.y=.655; cp.userData.glowOK=false; e.add(cp); e.position.set(c[0],0,c[1]); scene.add(e);
  const l=P(.325,.29); const ind=new T.Group(); mesh(rrGeo(1.0,1.0,.55,.07,.03),EV.mat(0x2a2b30,{metalness:.5,roughness:.45}),0,0,0,ind); mesh(rrGeo(.82,.82,.12,.05,.02),EV.mat(0x9a9ca3,{metalness:.9,roughness:.35}),0,.5,0,ind); ind.position.set(l[0],0,l[1]); scene.add(ind);
  // 전원 표시 LED (D2/D4/D5 + 리셋 LED)
  EV.pwrLeds=[]; [[.435,.29],[.416,.37],[.37,.48],[.375,.53],[.39,.585]].forEach(([u,v],i)=>{ const pp=P(u,v);
    const m=EV.mat(i<3?0xff7a1a:0xff2a2a,{transparent:true,opacity:.92,emissive:i<3?0xff6a00:0xff1010,emissiveIntensity:.22,roughness:.2});
    const d=new T.Mesh(new T.SphereGeometry(.2,20,14,0,Math.PI*2,0,Math.PI/2),m); d.position.set(pp[0],.1,pp[1]); d.userData.glowOK=false; scene.add(d); mesh(new T.CylinderGeometry(.2,.2,.1,20),m,pp[0],.05,pp[1],scene); EV.pwrLeds.push(m); });
}

/* ---------- 크리스털 X1 (FXOSC) ---------- */
{ const g=new T.Group(); const p=P(.41,.52); const body=mesh(rrGeo(1.0,.62,.34,.2,.04),M.metal(),0,0,0,g); mesh(rrGeo(.82,.46,.04,.15,.01),EV.mat(0xe4e7ec,{metalness:.8,roughness:.25}),0,.33,0,g); g.position.set(p[0],0,p[1]); part('xtal',g); ao(p[0],p[1],1.8,1.4,.45); }

/* ---------- J50 JTAG 10핀 헤더 (2x5, 1.27mm) ---------- */
{ const g=new T.Group(), p=P(.805,.34); mesh(rrGeo(1.4,.55,.28,.05,.02),EV.mat(0x17181c,{roughness:.55}),0,0,0,g);
  for(let i=0;i<5;i++)for(let r=0;r<2;r++) mesh(new T.BoxGeometry(.05,.3,.05),M.gold(),(i-2)*.26,.3,(r-.5)*.25,g);
  g.position.set(p[0],0,p[1]); part('jtag',g); ao(p[0],p[1],2.2,1.4,.5); }

/* ---------- RGB LED D13 (돔) ---------- */
{
  const g=new T.Group(); mesh(rrGeo(1.1,1.1,.22,.1,.03),EV.mat(0x9c998e,{roughness:.75}),0,0,0,g);
  const mat=EV.mat(0xaeb1ad,{transparent:true,opacity:.9,roughness:.3,emissive:0xff1818,emissiveIntensity:0});
  const dome=new T.Mesh(new T.SphereGeometry(.34,28,16,0,Math.PI*2,0,Math.PI/2),mat); dome.position.y=.22; dome.castShadow=true; dome.userData.glowOK=false; g.add(dome);
  g.position.set(LEDP[0],0,LEDP[1]); part('led',g); ao(LEDP[0],LEDP[1],2.0,2.0,.45);
  const L=new T.PointLight(0xff2a2a,0,8,1.6); L.position.set(LEDP[0],1.1,LEDP[1]); scene.add(L);
  EV.led=(on)=>{ mat.emissiveIntensity=on?6:0; mat.color.setHex(on?0xff6a6a:0xaeb1ad); L.intensity=on?4.5:0; EV.ledOn=!!on; };
  EV.ledLensMat=mat;
}
/* ---------- 택트 버튼 (RESET · SW5 · SW6) ---------- */
function button(id,p,capCol){ const g=new T.Group();
  mesh(rrGeo(1.35,1.35,.36,.12,.04),M.metal(),0,0,0,g);
  [[-.58,-.58],[.58,-.58],[-.58,.58],[.58,.58]].forEach(([a,b])=>mesh(new T.BoxGeometry(.13,.1,.18),M.gold(),a*1.0,.05,b*1.12,g));
  const prof=[]; for(let i=0;i<=8;i++){ const a=i/8*Math.PI/2; prof.push(new T.Vector2(Math.max(.001,.42*Math.cos(a)*(i>6?1:1)), .04+.26*Math.sin(a)*(1)*(.55+.45*(1-i/8)))); }
  prof.unshift(new T.Vector2(.001,0)); prof.unshift(new T.Vector2(.42,0));
  const cap=new T.Mesh(new T.LatheGeometry(prof,28),EV.mat(capCol,{roughness:.4})); cap.position.y=.36; cap.castShadow=true; g.add(cap); g.userData.cap=cap;
  g.position.set(p[0],0,p[1]); part(id,g); return g; }
const sw5=button('sw5',SW5P,0x23262e); button('sw6',SW6P,0x23262e); button('reset',RSTP,0x7a1f1f); [SW5P,SW6P,RSTP].forEach(p=>ao(p[0],p[1],2.3,2.3,.5));
EV.press=(down)=>{ sw5.userData.cap.position.y=down?.27:.36; };

/* ---------- 가변저항 ADC_POT0 ---------- */
{ const g=new T.Group(); mesh(rrGeo(1.6,1.5,.7,.1,.04),EV.mat(0x1f63c8,{roughness:.35,metalness:.1}),0,0,0,g);
  const prof=[new T.Vector2(.001,0),new T.Vector2(.46,0),new T.Vector2(.46,.22),new T.Vector2(.4,.28),new T.Vector2(.001,.28)];
  const knob=new T.Mesh(new T.LatheGeometry(prof,36),EV.mat(0xd9b24a,{metalness:1,roughness:.3})); knob.position.y=.7; knob.castShadow=true; g.add(knob);
  mesh(new T.BoxGeometry(.85,.07,.14),EV.mat(0x2e2410,{roughness:.6}),0,.285,0,knob);
  g.userData.knob=knob; g.position.set(POTP[0],0,POTP[1]); part('pot',g); ao(POTP[0],POTP[1],2.6,2.6,.5); EV.potAngle=(a)=>{ knob.rotation.y=a; }; }

/* ---------- 터치패드 A/B (금색) ---------- */
[[P(.925,.29),'touchA'],[P(.925,.50),'touchB']].forEach(([p,id])=>{ const g=new T.Group(); const geo=new T.ExtrudeGeometry(rrShape(2.55,2.55,.28),{depth:.05,bevelEnabled:true,bevelThickness:.015,bevelSize:.02,bevelSegments:1}); geo.rotateX(-Math.PI/2);
  mesh(geo,EV.mat(0xe0b13d,{metalness:1,roughness:.26}),0,0,0,g); g.position.set(p[0],.0,p[1]); part(id,g); });

/* ---------- PCF8574 + LCD1602 (보드 북쪽 책상 위) ---------- */
const LCDX=3, LCDZ=-13.4, BY=-.3; A.lcd=V(LCDX,.2,LCDZ);
const FONT57='000000000000005F00000007000700147F147F14242A7F2A12231308646236495620500008070300001C2241000041221C002A1C7F1C2A08083E080800807030000808080808000060600020100804023E5149453E00427F400072494949462141494D331814127F1027454545393C4A49493141211109073649494936464949291E0000140000004034000000081422411414141414004122140802015909063E415D594E7C1211127C7F494949363E414141227F4141413E7F494949417F090909013E414151737F0808087F00417F41002040413F017F081422417F404040407F021C027F7F0408107F3E4141413E7F090909063E4151215E7F09192946264949493203017F01033F4040403F1F2040201F3F4038403F631408146303047804036159494D43007F41414102040810204141417F0004020102044040404040000307080020545478407F284444383844444428384444287F385454541800087E090218A4A49C787F0804047800447D40002040403D007F1028440000417F40007C047804787C080404783844444438FC1824241818242418FC7C08040408485454542404043F44243C4040207C1C2040201C3C4030403C44281028444C9090907C4464544C440008364100000077000000413608000201020402';
const GLY={};
function glyph(ch){ if(GLY[ch]) return GLY[ch]; let code=ch.charCodeAt(0); if(code<32||code>126) code=63; const o=[]; const cols=[0,1,2,3,4].map(c=>parseInt(FONT57.substr((code-32)*10+c*2,2),16)); for(let r=0;r<8;r++){ const row=[]; for(let c=0;c<5;c++) row.push((cols[c]>>r)&1); o.push(row); } return GLY[ch]=o; }
const lcdScreen=EV.tex(1024,224);
EV.lcd={rows:['',''],cursor:null};
EV.lcd.set=function(r0,r1,cursor){ this.rows=[(r0||'').padEnd(16).slice(0,16),(r1||'').padEnd(16).slice(0,16)]; if(cursor!==undefined) this.cursor=cursor; this.draw(); };
EV.lcd.draw=function(){ lcdScreen.redraw((c,Wc,Hc)=>{ c.fillStyle='#2b62e8'; c.fillRect(0,0,Wc,Hc); const cw=Wc/16, ch=Hc/2, dp=10.6, ox=(cw-5*dp)/2+1, oy=(ch-8*dp)/2;
  for(let r=0;r<2;r++)for(let k=0;k<16;k++){ const gl=glyph(this.rows[r][k]||' '); for(let y=0;y<8;y++)for(let x=0;x<5;x++){ c.fillStyle=gl[y][x]?'#f7faff':'#2458da'; c.fillRect(k*cw+ox+x*dp,r*ch+oy+y*dp,dp-1.8,dp-1.8); } }
  if(this.cursor){ const [cr,cc]=this.cursor; c.fillStyle='rgba(255,255,255,.55)'; c.fillRect(cc*cw+ox,cr*ch+oy+7*dp,5*dp-1.8,dp-1.8); } }); };
{
  const g=new T.Group(); mesh(rrGeo(9.4,4.1,.2,.18,.03),EV.mat(0x0c4a38,{roughness:.45}),0,0,0,g);
  mesh(rrGeo(8.2,3.0,.34,.1,.03),EV.mat(0x0d0f14,{roughness:.4,metalness:.4}),0,.2,-.2,g);
  const gl=new T.Mesh(new T.PlaneGeometry(7.3,1.6),new T.MeshBasicMaterial({map:lcdScreen.t,color:new T.Color(1.3,1.3,1.3)})); gl.rotation.x=-Math.PI/2; gl.position.set(0,.555,-.2); gl.userData.glowOK=false; g.add(gl);
  [[-4.3,-1.8],[4.3,-1.8],[-4.3,1.8],[4.3,1.8]].forEach(([x,z])=>mesh(new T.CylinderGeometry(.16,.16,.22,16),M.gold(),x,.13,z,g));
  const pins=new T.InstancedMesh(new T.CylinderGeometry(.045,.045,.5,8),M.gold(),16), m4=new T.Matrix4(); for(let i=0;i<16;i++){ m4.compose(V(-3.0+i*.4,.35,1.9),new T.Quaternion(),V(1,1,1)); pins.setMatrixAt(i,m4); } g.add(pins);
  const sk=EV.tex(512,64,(c)=>{ text2d(c,'1602A  RS RW E · DB4~DB7',10,40,30,'#fff','left'); }); const slk=new T.Mesh(new T.PlaneGeometry(4.2,.52),new T.MeshBasicMaterial({map:sk.t,transparent:true})); slk.rotation.x=-Math.PI/2; slk.position.set(-2.0,.215,1.45); g.add(slk);
  g.position.set(LCDX,BY,LCDZ); part('lcd',g);
  const b=new T.Group(); mesh(rrGeo(7.0,1.5,.16,.1,.03),EV.mat(0x1148a8,{roughness:.45}),0,0,0,b);
  const cm=EV.tex(256,128,(c)=>{ c.fillStyle='#16181d'; c.fillRect(0,0,256,128); text2d(c,'PCF8574',128,58,32,'#e8ecf5','center'); text2d(c,'I2C I/O expander',128,92,20,'#9fb0d8','center','normal'); });
  mesh(rrGeo(1.5,.8,.2,.05,.02),EV.mat(0x15171b,{roughness:.55}),2.3,.16,0,b);
  const cp=new T.Mesh(new T.PlaneGeometry(1.4,.7),new T.MeshBasicMaterial({map:cm.t})); cp.rotation.x=-Math.PI/2; cp.position.set(2.3,.37,0); cp.userData.glowOK=false; b.add(cp);
  mesh(rrGeo(.8,.8,.32,.08,.03),EV.mat(0x1e5be0),-1.2,.16,.15,b); mesh(new T.CylinderGeometry(.2,.2,.1,18),M.gold(),-1.2,.48,.15,b);
  const hp=new T.InstancedMesh(new T.BoxGeometry(.1,.45,.1),M.gold(),4); for(let i=0;i<4;i++){ m4.compose(V(-3.4+i*.4,.38,.5),new T.Quaternion(),V(1,1,1)); hp.setMatrixAt(i,m4); } b.add(hp);
  EV.pcfBits=[]; for(let i=0;i<8;i++){ const l=mesh(rrGeo(.2,.2,.07,.03,.01),EV.mat(0x222a44,{emissive:0x000000}),-1.6+i*.42,.16,-.45,b); l.userData.glowOK=false; EV.pcfBits.push(l); }
  b.position.set(LCDX,BY,LCDZ+2.95-.2); part('pcf',b);
  EV.pcfSet=(byte)=>{ EV.pcfBits.forEach((l,i)=>{ const on=(byte>>(7-i))&1; l.material.emissive.setHex(on?0x6effa0:0); l.material.emissiveIntensity=on?1.6:0; l.material.color.setHex(on?0x6effa0:0x222a44); }); }; EV.pcfSet(0);
  A.pcf=V(LCDX,.4,LCDZ+2.75);
  // 점퍼선 4가닥: 보드 소켓 → 백팩 헤더
  const hx=[.635,1.105,1.575,2.045], cols=[0x111111,0xe53935,0xf2c94c,0x4cc9f0]; EV.wires={};
  hx.forEach((x,i)=>{ const x2=LCDX-3.4+i*.4, z2=LCDZ+2.75-.2+.5+.15; const pts=[V(x,1.05,-5.2),V(x,2.2,-6.4),V((x+x2)/2,2.4,-8.8),V(x2,1.7,z2+.8),V(x2,.62,z2)];
    const cv=new T.CatmullRomCurve3(pts); const m=mesh(new T.TubeGeometry(cv,48,.06,8,false),EV.mat(cols[i],{roughness:.5}),0,0,0,scene); EV.wires[['GND','VCC','SDA','SCL'][i]]=cv;
    mesh(new T.CylinderGeometry(.085,.085,.3,10),EV.mat(0x222222),x,1.0,-5.2,scene); });
}

const __term=EV.tex(1024,640); EV.__termTex=__term.t; EV.term={lines:[],max:10,cursor:true};
EV.term.draw=function(){ __term.redraw((c,Wc,Hc)=>{ c.fillStyle='#0a1a11'; c.fillRect(0,0,Wc,Hc); c.fillStyle='#1b3a29'; c.fillRect(0,0,Wc,46); text2d(c,'PuTTY · COM · 115200 8N1',16,33,28,'#bfe9cf','left'); c.fillStyle='#e8412c'; c.beginPath(); c.arc(Wc-26,23,7,0,7); c.fill(); c.fillStyle='#e9a23b'; c.beginPath(); c.arc(Wc-50,23,7,0,7); c.fill(); c.fillStyle='#4ade80'; c.beginPath(); c.arc(Wc-74,23,7,0,7); c.fill();
  c.font='bold 52px "DejaVu Sans Mono",monospace'; c.fillStyle='#6dffa6'; this.lines.slice(-this.max).forEach((l,i)=>c.fillText(l,20,118+i*58)); if(this.cursor){ const last=this.lines.length?this.lines[this.lines.length-1]:''; const n=this.lines.slice(-this.max).length; c.fillRect(20+last.length*31.2,82+(n-1)*58,26,46); } }); };
EV.term.print=function(s){ if(!this.lines.length) this.lines.push(''); this.lines[this.lines.length-1]+=s; this.draw(); }; EV.term.nl=function(){ this.lines.push(''); this.draw(); }; EV.term.clear=function(){ this.lines=['']; this.draw(); }; EV.term.clear();

/* ---------- 노트북 (알루미늄 본체 · 키보드 · 트랙패드 · 유리 화면 + 터미널) ---------- */
{
  const g=new T.Group();
  const alu=new T.MeshPhysicalMaterial({color:0xcfd2d8,metalness:1,roughness:.34,clearcoat:.25,clearcoatRoughness:.4,envMapIntensity:.9});
  const dark=new T.MeshPhysicalMaterial({color:0x17181c,roughness:.5,metalness:.1,clearcoat:.3,envMapIntensity:.5});
  const BW=13,BD=9;
  mesh(rrGeo(BW,BD,.5,.45,.12),alu,0,0,0,g);                                   // 본체
  mesh(rrGeo(BW-.5,BD-.5,.04,.4,.01),EV.mat(0x2a2c31,{roughness:.5}),0,.5,0,g);  // 상판 오목부(키보드 베젤)
  // 키보드 (인스턴스 키)
  const kg=rrGeo(.74,.7,.16,.1,.03), keys=new T.InstancedMesh(kg,dark,5*14+5), m4=new T.Matrix4(); let n=0;
  for(let r=0;r<5;r++)for(let c=0;c<14;c++){ if(r===4&&c>2&&c<11) continue; m4.compose(V(-5.35+c*.82,.54,-3.4+r*.82),new T.Quaternion(),V(1,1,1)); keys.setMatrixAt(n++,m4); }
  keys.count=n; keys.castShadow=true; g.add(keys);
  const space=mesh(rrGeo(.74*8+.82*7-.74*1.0,.7,.16,.1,.03),dark,0,.54,-3.4+4*.82,g); space.scale.x=1;
  // 키 글자 힌트(밝은 점)
  const kt=EV.tex(1024,512,(c)=>{ c.fillStyle='rgba(0,0,0,0)'; for(let r=0;r<5;r++)for(let cc=0;cc<14;cc++){ c.fillStyle='rgba(210,214,224,.55)'; c.fillRect(50+cc*66,56+r*72,12,12); } });
  // 트랙패드
  mesh(rrGeo(4.6,2.7,.03,.25,.01),EV.mat(0x3a3d44,{roughness:.25,metalness:.2,envMapIntensity:.9}),0,.52,3.15,g);
  // 힌지
  const hg=mesh(new T.CylinderGeometry(.22,.22,10.8,24),EV.mat(0x25262a,{metalness:.8,roughness:.35}),0,.5,-BD/2+.1,g); hg.rotation.z=Math.PI/2;
  // 옆면 USB-A 포트 + 고무 발
  mesh(new T.BoxGeometry(.06,.28,.9),EV.mat(0x050507),BW/2+.0,.25,0,g);
  [[-5.6,-3.6],[5.6,-3.6],[-5.6,3.6],[5.6,3.6]].forEach(([x,z])=>mesh(new T.CylinderGeometry(.35,.35,.08,16),EV.mat(0x101113,{roughness:.9}),x,-.02,z,g));
  // 화면 뚜껑
  const lid=new T.Group(); lid.position.set(0,.5,-BD/2+.1); lid.rotation.x=-.3;
  const LW=13,LH=8.6;
  mesh(rrGeo(LW,.3,LH,.4,.1),alu,0,0,0,lid).position.set(0,0,0);
  const shape=rrShape(LW-.5,LH-.45,.28);
  const bez=new T.Mesh(new T.ShapeGeometry(shape,12),new T.MeshStandardMaterial({color:0x050607,roughness:.3,metalness:.2})); bez.position.set(0,LH/2,.152); lid.add(bez);
  const dw=LW-1.3, dh=dw/1.6;
  const scr=new T.Mesh(new T.PlaneGeometry(dw,dh),new T.MeshBasicMaterial({map:EV.__termTex,color:new T.Color(1.25,1.25,1.25)})); scr.position.set(0,LH/2-.05,.156); scr.userData.glowOK=false; lid.add(scr); EV.__scr=scr;
  const refl=EV.tex(256,256,(c)=>{ const gr=c.createLinearGradient(0,0,256,256); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(.42,'rgba(255,255,255,.0)'); gr.addColorStop(.5,'rgba(255,255,255,.10)'); gr.addColorStop(.58,'rgba(255,255,255,0)'); gr.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=gr; c.fillRect(0,0,256,256); });
  const rf=new T.Mesh(new T.PlaneGeometry(dw,dh),new T.MeshBasicMaterial({map:refl.t,transparent:true,depthWrite:false,blending:T.AdditiveBlending})); rf.position.set(0,LH/2-.05,.16); rf.userData.glowOK=false; lid.add(rf);
  mesh(new T.CylinderGeometry(.07,.07,.02,16),EV.mat(0x151619),0,LH-.3,.155,lid).rotation.x=Math.PI/2;   // 웹캠
  const logo=EV.tex(128,128,(c)=>{ c.strokeStyle='#9aa0ab'; c.lineWidth=7; c.beginPath(); c.arc(64,64,30,0,7); c.stroke(); c.fillStyle='#9aa0ab'; c.fillRect(54,54,20,20); });
  const lg=new T.Mesh(new T.PlaneGeometry(1.4,1.4),new T.MeshBasicMaterial({map:logo.t,transparent:true,opacity:.55})); lg.rotation.y=Math.PI; lg.position.set(0,LH/2,-.152); lg.userData.glowOK=false; lid.add(lg);
  g.add(lid);
  g.position.set(-24.5,-.3,2.5); g.rotation.y=.55; g.userData.lift=.0; part('pc',g); ao(-24.5,2.5,BW+2.2,BD+2.2,.55,-.28);
  A.pc=V(-24.5,2.9,2.5);
}
/* ---------- PuTTY 터미널 텍스처 (노트북 화면에 매핑) ---------- */
/* ---------- 라벨 ---------- */
const L=(id,html,x,y,z)=>EV.defLabel(id,html,v=>v.set(x,y,z));
L('chip','S32K312<small>Cortex-M7 · 120 MHz</small>',CH.x,1.2,CH.z);
L('opensda','OpenSDA (K26)<small>디버거 + VCOM</small>',K26[0],.9,K26[1]);
L('usb','micro-USB<small>PC 연결</small>',USBP[0]-.4,1.1,USBP[1]);
L('led','D13 RGB LED<small>PTA29 · Active High</small>',LEDP[0],1.0,LEDP[1]);
L('sw5','SW5<small>USER_SW0 · PTB26</small>',SW5P[0],1.0,SW5P[1]);
L('sw6','SW6<small>USER_SW1 · PTB19</small>',SW6P[0],1.0,SW6P[1]);
L('pot','ADC_POT0<small>PTA11 → ADC1_S10</small>',POTP[0],1.4,POTP[1]);
L('lcd','1602 LCD<small>HD44780</small>',LCDX,1.1,LCDZ-1.6);
L('pcf','PCF8574<small>I2C 0x27</small>',LCDX-1.8,.9,LCDZ+2.75);
L('pc','노트북 · PuTTY<small>PC 터미널</small>',-24.5,8.6,2.5);
L('xtal','X1<small>FXOSC</small>',P(.41,.52)[0],.8,P(.41,.52)[1]);
L('barrel','J14<small>+12V 전원</small>',P(0,.31)[0],1.7,P(0,.31)[1]);
L('fs26','FS26<small>전원 SBC</small>',P(.215,.615)[0],.8,P(.215,.615)[1]);
L('touchA','TOUCH_A',P(.925,.29)[0],.5,P(.925,.29)[1]); L('touchB','TOUCH_B',P(.925,.5)[0],.5,P(.925,.5)[1]);
L('jtag','J50<small>JTAG/SWD 10핀</small>',P(.805,.34)[0],.9,P(.805,.34)[1]);
L('can','J32<small>CAN</small>',P(-.04,.505)[0]-.4,1.2,P(-.04,.505)[1]); L('lin','J23<small>LIN</small>',P(-.04,.67)[0]-.4,1.2,P(-.04,.67)[1]);
L('sw1','SW1<small>전원 스위치</small>',P(.16,.10)[0],1.6,P(.16,.10)[1]);
L('hdrTop','Arduino 소켓',P(.595,0)[0],1.3,TOPZ);
L('pTX','PTA16<small>LPUART6_TX</small>',PN.TX[0]-.3,.9,PN.TX[1]);
L('pRX','PTA15<small>LPUART6_RX</small>',PN.RX[0]-.3,.9,PN.RX[1]+.6);
L('pLED','PTA29',PN.LED[0],.9,PN.LED[1]+.5);
L('pSW','PTB26<small>EIRQ[13]</small>',PN.SW[0],.9,PN.SW[1]+.5);
L('pSDA','PTC6<small>SDA</small>',PN.SDA[0]-.3,.9,PN.SDA[1]-.5);
L('pSCL','PTC7<small>SCL</small>',PN.SCL[0]+.5,.9,PN.SCL[1]-.5);
L('pADC','PTA11<small>ADC1_S10</small>',PN.ADC[0]+.4,.9,PN.ADC[1]-.5);
L('hSDA','SDA',1.575,1.4,-5.2); L('hSCL','SCL',2.045,1.4,-5.2);
Object.assign(A,{chip:V(CH.x,.9,CH.z),opensda:V(K26[0],.6,K26[1]),usb:V(USBP[0],.9,USBP[1]),led:V(LEDP[0],.7,LEDP[1]),sw5:V(SW5P[0],.9,SW5P[1]),sw6:V(SW6P[0],.9,SW6P[1]),reset:V(RSTP[0],.9,RSTP[1]),pot:V(POTP[0],1.1,POTP[1]),xtal:V(P(.41,.52)[0],.6,P(.41,.52)[1]),barrel:V(P(0,.31)[0],.8,P(0,.31)[1]),fs26:V(P(.215,.615)[0],.5,P(.215,.615)[1]),touchA:V(P(.925,.29)[0],.2,P(.925,.29)[1]),touchB:V(P(.925,.5)[0],.2,P(.925,.5)[1]),jtag:V(P(.805,.34)[0],.5,P(.805,.34)[1]),can:V(P(-.04,.505)[0]-.4,.8,P(-.04,.505)[1]),lin:V(P(-.04,.67)[0]-.4,.8,P(-.04,.67)[1]),sw1:V(P(.16,.10)[0],.8,P(.16,.10)[1]),lcdv:V(LCDX,.3,LCDZ),pcfv:V(LCDX,.3,LCDZ+2.7),pc:V(-24.5,3.0,2.5)});

/* ---------- 신호 경로 (3D) ---------- */
const Y=.3, toV=(p)=>V(p[0],p[2]!=null?p[2]:Y,p[1]);
const cab=EV.cableCurve.getPoints(24);
EV.makePath('uart',[...NETS.TX.map(toV),V(K26[0]+.45,Y,K26[1]),V(K26[0]-.95,Y,K26[1]),...NETS.USBD.map(toV),V(USBP[0]-.9,.3,USBP[1]),...cab],0x2fc0c0);
EV.makePath('led',NETS.LED.map(toV),0xe8412c);
EV.makePath('sw',[...NETS.SW].reverse().map(toV),0xe8412c);
EV.makePath('adc',[...NETS.ADC].reverse().map(toV),0xd18bff);
EV.makePath('sda',[...NETS.SDA.map(toV),...EV.wires.SDA.getPoints(30)],0x2fc0c0);
EV.makePath('scl',[...NETS.SCL.map(toV),...EV.wires.SCL.getPoints(30)],0xe9a23b);
EV.makePath('chipLED',[V(CH.x,Y,CH.z+.6),V(PN.LED[0],Y,CH.z+.6),...NETS.LED.map(toV)],0xe8412c);
EV.billboards=[];
/* ---------- 성능: 인스턴스/스프라이트 레이캐스트 제외, 작은 인스턴스 그림자 제외 ---------- */
scene.traverse(o=>{ if(o.isInstancedMesh){ o.raycast=()=>{}; o.castShadow=false; } if(o.isSprite) o.raycast=()=>{}; });
/* 성능: 움직이지 않는 물체(부품 그룹이 아닌 장식)는 행렬 자동 갱신을 끈다 */
{ const dyn=new Set(Object.values(EV.parts)); Object.values(EV.paths).forEach(p=>{ dyn.add(p.head); dyn.add(p.tube); p.trail.forEach(s=>dyn.add(s)); }); Object.values(EV.pinMarks).forEach(m=>{ dyn.add(m); if(m.parent) dyn.add(m.parent); }); scene.updateMatrixWorld(true);
  scene.children.forEach(o=>{ if(dyn.has(o)||o.isLight||o.userData.mode||o.isCamera) return; o.traverse(x=>{ x.updateMatrix(); x.matrixAutoUpdate=false; }); }); }
})();
