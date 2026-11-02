/* modes.js (1/3) — 공용 라이브러리 + 보드 둘러보기 + 1주차 */
(function(){
const EV=window.B3D, T=EV.T, V=EV.vec, $=id=>document.getElementById(id);
EV.cleanup=[];
const pre=s=>'<pre>'+s+'</pre>';
const K=s=>`<span class="k">${s}</span>`, Cm=s=>`<span class="c">${s}</span>`, Hh=s=>`<span class="h">${s}</span>`;
const note=s=>`<div class="note">${s}</div>`, warn=s=>`<div class="warn">${s}</div>`;
EV.lib = {pre,K,Cm,Hh,note,warn};
const wg = html => { const e=$('wg'); e.innerHTML=html; return e; };
EV.wg = wg;

/* 임시 경로 (이름 재사용) */
function tpath(name, pts, color){ const old=EV.paths[name]; if(old){ [old.tube,old.head,...old.trail].forEach(o=>EV.scene.remove(o)); delete EV.paths[name]; } return EV.makePath(name, pts, color); }
EV.tpath = tpath;

/* ---------- 칩 내부 블록 (홀로그램) ---------- */
const DIE_Y=4.2, DS=1.0;
const DD = {
  core:[0,-.4,2.6,1.7,'Cortex-M7','120 MHz',0x4f7cff],
  nvic:[0,1.7,2.6,1.0,'NVIC','pending · 우선순위',0x9b6cff],
  clk:[0,-2.55,2.6,1.2,'클럭 MC_CGM','FIRC·SIRC·FXOSC→PLL',0xffb347],
  cflash:[-4.1,-2.6,2.4,1.2,'Code Flash','코드·RO',0x2f9c7e],
  dflash:[-4.1,-1.2,2.4,1.0,'Data Flash','설정값',0x2f9c7e],
  sram:[-4.1,.1,2.4,1.1,'SRAM','변수·스택',0x3a86d1],
  tcm:[-4.1,1.5,2.4,1.0,'TCM','빠른 메모리',0x3a86d1],
  siul2:[4.1,-2.6,2.4,1.2,'SIUL2','MSCR·GPDO',0xe56b6f],
  uart:[4.1,-1.2,2.4,1.0,'LPUART6','TX · RX',0xff9f43],
  i2c:[4.1,.1,2.4,1.0,'LPI2C1','SDA · SCL',0xe3b53a],
  adc:[4.1,1.5,2.4,1.0,'ADC1','S10 ← PTA11',0xb36bff],
};
const die = new T.Group(); die.userData.mode=true; die.position.set(EV.CHIP.x,DIE_Y,EV.CHIP.z); die.scale.setScalar(DS);
const plate = new T.Group();
{ const pw=11.8, pd=7.0;
  EV.rbox(pw,.12,pd,EV.pmat(0x0e1219,{transparent:true,opacity:.78,clearcoat:.8,roughness:.3,envMapIntensity:.5}),0,0,0,plate);
  const pt=EV.tex(1180,700,(c,W,H)=>{ c.clearRect(0,0,W,H); c.strokeStyle='rgba(120,200,210,.10)'; c.lineWidth=1.2; for(let x=0;x<=W;x+=59){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); } for(let y=0;y<=H;y+=58.3){ c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
    c.strokeStyle='rgba(47,192,192,.85)'; c.lineWidth=4; const L=46; [[10,10,1,1],[W-10,10,-1,1],[10,H-10,1,-1],[W-10,H-10,-1,-1]].forEach(([x,y,sx,sy])=>{ c.beginPath(); c.moveTo(x,y+sy*L); c.lineTo(x,y); c.lineTo(x+sx*L,y); c.stroke(); });
    c.fillStyle='rgba(180,210,220,.55)'; c.font='600 22px "DejaVu Sans Mono",monospace'; c.textAlign='left'; c.fillText('S32K312 · 내부 블록 (개념도)',30,H-26); },{});
  const pl=new T.Mesh(new T.PlaneGeometry(pw,pd),new T.MeshBasicMaterial({map:pt.t,transparent:true,depthWrite:false})); pl.rotation.x=-Math.PI/2; pl.position.y=.07; plate.add(pl); }
plate.position.set(0,-.25,-.55); die.add(plate);
die.blocks={};
for(const [k,[x,z,w,d,t,s,c]] of Object.entries(DD)){ const b=EV.slab({w,h:.4,d,color:c,title:t,sub:s,opacity:.97,fs:58}); b.position.set(x,.05,z); die.add(b); die.blocks[k]=b; b.userData.base=c; }
[-2.1,2.1].forEach(x=>{ EV.rbox(.26,.14,6.2,new T.MeshStandardMaterial({color:0x1b3a3c,emissive:0x2fc0c0,emissiveIntensity:.9,roughness:.3,metalness:.3}),x,-.04,-.45,die); });
{ const gm=new T.MeshStandardMaterial({color:0x1b3a3c,emissive:0x2fc0c0,emissiveIntensity:.6,roughness:.3,metalness:.3});
  const link=(x1,x2,z)=>{ EV.rbox(Math.abs(x2-x1),.08,.12,gm,(x1+x2)/2,-.02,z,die); };
  [[-2.9,-2.1,-2.6],[-2.9,-2.1,-1.2],[-2.9,-2.1,.1],[-2.9,-2.1,1.5],[2.1,2.9,-2.6],[2.1,2.9,-1.2],[2.1,2.9,.1],[2.1,2.9,1.5],[-1.3,-2.1,-.4],[1.3,2.1,-.4],[-1.3,-2.1,1.7],[1.3,2.1,1.7],[-1.3,-2.1,-2.55],[1.3,2.1,-2.55]].forEach(a=>link(...a)); }
// 칩에서 올라오는 빔
{ const lm=new T.LineBasicMaterial({color:0x6ea8ff,transparent:true,opacity:.45}); const pts=[];
  [[-1.43,-1.43,-5.8,-3.9],[1.43,-1.43,5.8,-3.9],[-1.43,1.43,-5.8,2.8],[1.43,1.43,5.8,2.8]].forEach(([cx,cz,px,pz])=>{ pts.push(V(cx/DS,(.5-DIE_Y)/DS,cz/DS),V(px,-.25,pz)); });
  for(let i=0;i<pts.length;i+=2){ const a=pts[i],b=pts[i+1]; const mid=a.clone().add(b).multiplyScalar(.5), len=a.distanceTo(b); const cyl=new T.Mesh(new T.CylinderGeometry(.018,.018,len,8),new T.MeshBasicMaterial({color:new T.Color(0x6ee0e0).multiplyScalar(1.4),transparent:true,opacity:.5,blending:T.AdditiveBlending,depthWrite:false})); cyl.position.copy(mid); cyl.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize()); die.add(cyl); } }
EV.reg('die',die); EV.die=die;
EV.diePos=(k,y=.6)=>die.localToWorld(V(DD[k][0],y,DD[k][1]));
EV.dieHL=(names=[],color=0xffffff,v=1.0)=>{ for(const k in die.blocks) die.blocks[k].setGlow(names.includes(k)?v:0, names.includes(k)?color:null); };
/* 칩 내부 신호 경로: 이름 배열 → 월드 좌표 */
EV.diePath=(name,keys,color,y=.75)=>tpath(name, keys.map(k=>typeof k==='string'?EV.diePos(k,y):k), color);

/* ---------- 층 쌓기 슬랩 묶음 ---------- */
EV.makeStack=(name,items,o={})=>{
  const {w=6.8,d=2.2,gap=1.9,y0=3.2,x=EV.CHIP.x,z=-.5,sh=.9}=o;
  const g=new T.Group(); g.userData.mode=true; g.slabs=[];
  items.forEach((it,i)=>{ const s=EV.slab({w,h:sh,d,color:it.c,title:it.t,sub:it.s,fs:o.fs||40,top:false}); s.position.set(0,0,0); g.add(s); g.slabs.push(s); });
  const conn=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x8fd8e0,transparent:true,opacity:.38})); g.add(conn);
  g.layout=(gp)=>{ g.slabs.forEach((s,i)=>s.position.y=(items.length-1-i)*gp);
    const pts=[]; const hx=w/2*.9, hz=d/2*.86; for(let i=0;i<items.length-1;i++){ const y1=g.slabs[i].position.y-sh/2, y2=g.slabs[i+1].position.y+sh/2; [[-hx,-hz],[hx,-hz],[-hx,hz],[hx,hz]].forEach(([px,pz])=>{ pts.push(V(px,y1,pz),V(px,y2,pz)); }); }
    conn.geometry.setFromPoints(pts); };
  g.layout(gap); g.position.set(x,y0,z);
  g.at=(i,y=.5)=>g.localToWorld(V(0,g.slabs[i].position.y+y,0));
  g.hl=(ids=[],c=0xffffff,v=1)=>g.slabs.forEach((s,i)=>s.setGlow(ids.includes(i)?v:0,ids.includes(i)?c:null));
  EV.reg(name,g); return g;
};

/* ---------- 스코프(카메라에 붙은 떠 있는 파형판) ---------- */
{
  EV.scene.add(EV.cam);
  const g=new T.Group(); g.userData.mode=true;
  const sc=EV.tex(2048,512); const mesh=new T.Mesh(new T.PlaneGeometry(14,3.5), new T.MeshBasicMaterial({map:sc.t,transparent:true,depthWrite:false,depthTest:false}));
  mesh.renderOrder=40; g.add(mesh); g.userData.mode=true; g.position.set(-2.3,-3.1,-16); g.scale.setScalar(.78);
  EV.layoutHUD=()=>{ const asp=EV.cam.aspect||1.5, dist=16, halfH=dist*Math.tan(EV.cam.fov*Math.PI/360), halfW=halfH*asp; const hudW=Math.min(halfW*1.9,12.5); const sc=hudW/14; g.scale.setScalar(sc); g.position.set(-halfW+hudW/2+.45,-halfH+3.5*sc/2+.55,-dist); }; EV.cam.add(g); EV.groups.scope=g; g.visible=false; EV.scopeMesh=mesh;
  { const c=sc.ctx, d=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'font');
    Object.defineProperty(c,'font',{configurable:true,get(){return d.get.call(c);},set(v){ d.set.call(c,String(v).replace(/(\d+(?:\.\d+)?)px/,(a,n)=>(n*1.32).toFixed(1)+'px')); }}); }
  EV.scope={tex:sc,
    draw(fn){ sc.redraw((c,W,H)=>{ c.fillStyle='rgba(8,12,28,.93)'; c.fillRect(0,0,W,H); c.strokeStyle='#5b74e0'; c.lineWidth=5; c.strokeRect(3,3,W-6,H-6); c.textAlign='left'; c.textBaseline='alphabetic'; c.setLineDash([]); fn(c,W,H); }); },
    show(on=true){ g.visible=on; }
  };
}
/* 디지털 파형 그리기: 샘플 배열 [0/1...], 구간 [x0,x1], 줄 중심 y */
EV.drawDigital=(c,samples,x0,x1,yTop,h,color,upto=1,lw=5)=>{
  const n=samples.length, dx=(x1-x0)/n, lim=Math.floor(n*upto);
  c.strokeStyle=color; c.lineWidth=lw; c.lineJoin='miter'; c.beginPath();
  let py=null;
  for(let i=0;i<=Math.min(lim,n-1);i++){ const y=yTop+(samples[i]?0:h), xa=x0+i*dx, xb=xa+dx*(i===lim&&lim<n?(n*upto-lim):1);
    if(py===null) c.moveTo(xa,y); else if(py!==y) c.lineTo(xa,y); c.lineTo(xb,y); py=y; }
  c.stroke();
};

/* ---------- 라벨: 캡션 ---------- */
EV.defLabel('cap','',v=>v.set(0,7.4,0));
EV.caption=(html,pos)=>{ EV.setLabel('cap',html); if(pos) EV.labelDefs.cap.posFn=v=>v.set(...pos); const ids=(EV.curLabels||[]).filter(x=>x!=='cap'); EV.labels([...ids,'cap'],EV.curHot||[]); EV.labelDefs.cap.el&&EV.labelDefs.cap.el.classList.add('hot'); };

/* ---------- 부품 정보 / 보드 둘러보기 ---------- */
const INFO = {
 chip:{t:'S32K312 MCU (U9)',s:'Cortex-M7 · 120 MHz · QFP-172',h:'차량용 Arm <b>Cortex-M7(120 MHz)</b> MCU. ECC·Lockstep·감시회로 같은 <b>안전 메커니즘</b>(ISO 26262 ASIL)을 내장했어요. 매뉴얼 기준 부품은 <code>P32K312NHVPBS0P09C</code>.',w:1,wt:'1주차 UART로'},
 opensda:{t:'OpenSDA (K26 디버거)',s:'USB 디버그 + VCOM',h:'보드에 붙은 온보드 디버거(K26). USB 한 줄로 <b>다운로드/디버깅 + VCOM(시리얼)</b>을 해결해요. <code>PTA15/PTA16(LPUART6)</code>을 USB 시리얼로 바꿔 PC에 보내요.',w:1,wt:'1주차 UART로'},
 usb:{t:'micro-USB (J40)',s:'PC 연결',h:'PC와 연결. <code>S32K312(LPUART6) → OpenSDA(VCOM) → USB → PuTTY</code> 경로의 끝.',w:1,wt:'1주차 UART로'},
 led:{t:'D13 · RGB LED (PTA29 빨강)',s:'Active High',h:'RGB LED 하나에 <b>PTA29(R) · PTA30(G) · PTA31(B)</b>, 모두 <b>Active High</b>(1=점등). NPN 트랜지스터로 구동돼요. 2주차에는 SIUL2 레지스터를 직접 써서, 3주차에는 IPL/MCAL로 켜요.',w:2,wt:'2주차 GPIO로'},
 sw5:{t:'SW5 · USER_SW0 (PTB26)',s:'사용자 버튼',h:'<b>PTB26</b> → SIUL2 <b>EIRQ[13]</b>. 누르면 High(Rising Edge, 풀다운 + VDD_HV_B). 5주차 인터럽트 실습의 입력.',w:5,wt:'5주차 인터럽트로'},
 sw6:{t:'SW6 · USER_SW1 (PTB19)',s:'사용자 버튼',h:'매뉴얼 기본 연결은 <b>PTB19</b>. 실습에서는 쓰지 않지만 같은 구조의 두 번째 사용자 버튼이에요.'},
 reset:{t:'SW2 · RESET',s:'리셋 스위치',h:'RESET 신호를 수동으로 인가. 누르는 동안 RESET LED(D22)가 켜져요.'},
 pot:{t:'가변저항 ADC_POT0 (R393)',s:'PTA11 = ADC1_S10',h:'<b>PTA11 = ADC1_S10</b>. 핀이 곧 채널이에요. ADC0이 아니라 <b>ADC1</b>! 0 V ~ VDD_HV_A 사이 전압을 만들어요.',w:6,wt:'6주차 ADC로'},
 lcd:{t:'1602 LCD (HD44780)',s:'16×2 문자 LCD',h:'표시할 문자는 <b>DDRAM</b>에 ASCII로 저장돼요. 1행 <code>0x00~0x0F</code>, 2행 <code>0x40~0x4F</code>. (보드에 없고 외부 모듈로 연결)',w:4,wt:'4주차 I2C로'},
 pcf:{t:'PCF8574 백팩',s:'I2C 0x27',h:'I2C로 받은 <b>1바이트를 8개 출력 핀</b>으로 내보내는 I/O 확장기. P0=RS, P1=R/W, P2=E, P3=BL, P4~P7=DB4~DB7.',w:4,wt:'4주차 I2C로'},
 pc:{t:'PC 터미널',s:'PuTTY · 115200 8N1',h:'PuTTY / Tera Term. <code>115200 8N1</code>로 열면 <code>printf()</code> 결과가 보여요.',w:1,wt:'1주차 UART로'},
 xtal:{t:'X1 · FXOSC 외부 크리스털',s:'정밀 클럭원',h:'외부 정밀 발진기. 내부 RC(FIRC/SIRC)보다 정확한 클럭원. PLL이 이걸 체배해 고속 시스템 클럭을 만들어요.',w:1,wt:'1주차 클럭으로'},
 barrel:{t:'J14 · +12 V 전원 잭',s:'2.1 mm 배럴',h:'외부 전원 <b>+12 V / ≥2 A</b> 입력. 안에서 FS26 전원 SBC가 <b>5.0 V, 3.3 V, 1.5 V</b>를 만들어 MCU 전원 영역(VDD_HV_A/B)에 공급해요.'},
 sw1:{t:'SW1 · 전원 스위치',s:'보드 전원 ON/OFF',h:'보드 전원 스위치. 점퍼를 바꿀 땐 반드시 전원을 끈 상태에서 해야 해요.'},
 fs26:{t:'FS26 전원 SBC',s:'U1 · 시스템 베이스 칩',h:'12 V를 받아 <b>+5.0 V, +3.3 V, +1.5 V</b>를 만드는 전원관리 IC. 옆의 주황 LED(D2/D4/D5)가 12 V/5 V/3.3 V 상태를 보여줘요.'},
 can:{t:'J32 · CAN 커넥터',s:'TJA1043 · CAN FD',h:'CANH0 / CANL0 / GND. MCU의 CAN0(PTA6 RX, PTA7 TX)이 TJA1043 트랜시버를 통해 나와요.'},
 lin:{t:'J23 · LIN 커넥터',s:'TJA1021 ×2',h:'LIN1(LPUART9: PTB9/PTB10), LIN2(LPUART5: PTB28/PTB27) 트랜시버 출력이 모여 있어요.'},
 jtag:{t:'J50 · 10핀 Cortex 디버그',s:'SWD / JTAG / ETM',h:'외부 디버거용 10핀 커넥터. TRACE 신호(PTC2, PTD7 등)는 기본적으로 <b>Disabled</b>.'},
 touchA:{t:'TOUCH_A 터치 패드',s:'정전식 전극',h:'정전식 터치 전극. 보드에 터치 패드 2개가 있어요.'},
 touchB:{t:'TOUCH_B 터치 패드',s:'정전식 전극',h:'정전식 터치 전극. 보드에 터치 패드 2개가 있어요.'},
};
EV.partInfo=INFO;
function showInfo(id){
  const i=INFO[id]; if(!i) return; EV.clearGlow(); EV.glow(id,0xe8412c,.8); EV.focusPart(id);
  const b=$('sbody'); b.innerHTML=`<h3>${i.t}</h3><p>${i.h}</p>`+(i.w!=null?`<p><button id="goW" style="background:#2a3b86;color:#fff;border:1px solid #5b74e0;border-radius:8px;padding:6px 12px;cursor:pointer">${i.wt} →</button></p>`:'');
  const gb=$('goW'); if(gb) gb.onclick=()=>EV.setMode(i.w);
}
EV.onPick=(id)=>{ if(EV.mode===0) showInfo(id); else if(INFO[id]&&EV.modes[EV.mode].pick!==false){ const m=EV.modes[EV.mode]; /* 다른 모드에서는 이름만 */ } };

const modes=EV.modes;
modes.push({id:'board',tab:'보드 둘러보기',kicker:'S32K312EVB-Q172 · 개념 3D 모델',title:'보드를 돌려 보고, 부품을 눌러 보세요',
 steps:null,
 enter(){
   EV.resetScene(); EV.flyTo(EV.home);
   EV.labels(['chip','opensda','usb','led','sw5','pot','lcd','pcf','pc']); EV.autoRotate=true;
   $('sbody').innerHTML=`<p>레포(<code>embedded-s32k-midterm-2026-2</code>)의 1~6주차 내용을 보드 위에서 직접 따라가 볼 수 있어요.</p>
   <p>① 부품을 <b>클릭</b>하면 설명과 해당 주차로 가는 버튼이 나와요.<br>② 위 탭에서 <b>W1~W6</b>을 고르면 단계별로 3D 애니메이션이 재생돼요.</p>
   <table><tr><th>주차</th><th>주제</th><th>볼 부품</th></tr>
   <tr><td>W1</td><td>UART·부팅·클럭·메모리맵</td><td>칩, OpenSDA, PC</td></tr>
   <tr><td>W2</td><td>MMIO · SIUL2 · GPIO</td><td>LED</td></tr>
   <tr><td>W3</td><td>IPL vs MCAL</td><td>계층 탑</td></tr>
   <tr><td>W4</td><td>I2C · PCF8574 · LCD</td><td>LCD</td></tr>
   <tr><td>W5</td><td>인터럽트 · NVIC</td><td>SW5</td></tr>
   <tr><td>W6</td><td>ADC · SAR · 평균</td><td>가변저항</td></tr></table>
   ${note('모델은 NXP <b>S32K312EVB-Q172 HWUM 사진</b>의 배치를 따랐어요. mm 단위 정밀 복제는 아니에요. 부품의 실제 위치·크기·핀 번호 배치는 실물 보드와 다릅니다. 핀 이름(PTA16 등)과 신호 경로는 수업 자료 기준이에요.')}`;
 }});

/* ===================== W1 UART ===================== */
const UART_TXT='Hello S32K3\r\n';
const frameOf=(ch)=>{ const b=ch.charCodeAt(0)&255; const bits=[]; for(let i=0;i<8;i++) bits.push((b>>i)&1); return [1,0,...bits,1,1]; };
function drawUartScope(ch,prog,title){
  const f=frameOf(ch), lab=['Idle','Start','D0','D1','D2','D3','D4','D5','D6','D7','Stop','Idle'];
  EV.scope.draw((c,W,H)=>{
    c.fillStyle='#e7ebf7'; c.font='bold 46px system-ui,"Noto Sans KR",sans-serif'; c.textAlign='left';
    const shown=ch==='\r'?'\\r (0x0D)':ch==='\n'?'\\n (0x0A)':`'${ch}' (0x${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')})`;
    c.fillText(title||`TX (PTA16)  ·  115200 8N1  ·  ${shown}`,40,70);
    const x0=120,x1=W-80,n=f.length,dx=(x1-x0)/n;
    c.strokeStyle='#26335f'; c.lineWidth=2;
    for(let i=0;i<=n;i++){ c.beginPath(); c.moveTo(x0+i*dx,130); c.lineTo(x0+i*dx,440); c.stroke(); }
    c.font='30px system-ui,sans-serif'; c.textAlign='center';
    for(let i=0;i<n;i++){ c.fillStyle=i===1?'#ff9b9b':(i===10?'#9bffb8':(i>1&&i<10?'#35c4c4':'#7d8bb8')); c.fillText(lab[i],x0+(i+.5)*dx,172);
      if(i>1&&i<10){ c.fillStyle='#fff'; c.font='bold 40px monospace'; c.fillText(f[i],x0+(i+.5)*dx,420); c.font='30px system-ui,sans-serif'; } }
    c.fillStyle='#7d8bb8'; c.textAlign='right'; c.fillText('HIGH',100,236); c.fillText('LOW',100,366);
    EV.drawDigital(c,f,x0,x1,220,150,'#4ade80',prog,7);
    if(prog<1){ c.strokeStyle='#35c4c4'; c.lineWidth=3; c.beginPath(); c.moveTo(x0+(x1-x0)*prog,130); c.lineTo(x0+(x1-x0)*prog,440); c.stroke(); }
  });
}
modes.push({id:'w1',tab:'W1 UART',kicker:'1주차 · chap01_hello_uart · LPUART6 · 115200 8N1',title:'전원 ON → main() → printf가 PC 화면까지',
 steps:[
 {t:'전원이 들어와서 main()까지',cam:{tx:0,ty:5.5,tz:0,rad:23,th:.3,ph:.85},
  html:`<p>리셋이 풀리면 코어는 <b>정해진 순서</b>대로 깨어나요.</p>
  ${pre(`Power-On Reset → ${K('BAF')} → ${K('IVT')} 확인 → 사용자 벡터 테이블
 → startup(Reset Handler) → 런타임 초기화 → ${K('main()')}`)}
  <p><b>BAF</b>(Boot Assist Flash)는 NXP 내장 부팅 보조 코드, <b>IVT</b>(Image Vector Table)는 부팅 이미지·사용자 코드 진입 정보예요.</p>
  ${note('벡터 테이블 <b>0번 = 초기 스택 포인터(MSP)</b>, <b>1번 = Reset Handler 주소</b>.')}
  <p>▶ 재생: 위 사슬이 순서대로 켜지고, 칩 안에서 Code Flash(벡터 테이블)와 Cortex-M7이 차례로 깨어나요.</p>`,
  enter(){
    let bg=EV.groups.boot; if(bg){ EV.scene.remove(bg); }
    const items=[['Power-On Reset','POR',0xe5484d],['BAF','Boot Assist Flash',0xf08a24],['IVT','Image Vector Table',0xe3b53a],['벡터 테이블','0:MSP · 1:Reset',0x3aa88a],['startup','Reset Handler',0x3a86d1],['main()','사용자 코드',0x8a6cff]];
    bg=new T.Group(); bg.userData.mode=true; bg.slabs=[];
    items.forEach(([t,s,c],i)=>{ const sl=EV.slab({w:2.3,h:.45,d:1.4,color:c,title:t,sub:s,fs:38}); sl.position.set(-6.25+i*2.5,0,0); bg.add(sl); bg.slabs.push(sl); });
    bg.position.set(0,9.6,0); EV.reg('boot',bg,true);
    EV.show('die','boot'); EV.dieHL([]); EV.labels([]);
    EV.pathsBoot=[]; for(let i=0;i<5;i++){ EV.pathsBoot.push(tpath('b'+i,[bg.localToWorld(V(-6.25+i*2.5+1.2,0,0)),bg.localToWorld(V(-6.25+(i+1)*2.5-1.2,0,0))],0xffd166)); }
  },
  play(){ const bg=EV.groups.boot; let i=0;
    const next=()=>{ if(i>=6){ EV.dieHL(['cflash'],0x6effa0,1); EV.wait(.6,()=>{ EV.dieHL(['core'],0xffd166,1); EV.caption('<b>main()</b> 진입 — 이제 C 코드가 실행돼요'); }); return; }
      bg.slabs.forEach((s,k)=>s.setGlow(k===i?1.2:(k<i?.35:0),k===i?0xffffff:0x88aaff));
      if(i<5){ EV.pathSend('b'+i,.55,()=>{i++;next();}); } else { i++; next(); } };
    EV.caption('전원 ON…'); next(); }},
 {t:'클럭 트리: 모든 건 클럭으로 돈다',cam:{tx:0,ty:4,tz:0,rad:17,th:.3,ph:.82},
  html:`<p>CPU·버스·UART 같은 주변장치는 <b>클럭이 공급될 때만</b> 동작해요(클럭 게이팅).</p>
  ${pre(`${K('FIRC')} / ${K('SIRC')} / ${K('FXOSC')}  →  ${K('PLL')}  →  System / Bus / Peripheral Clock`)}
  <table><tr><th>소스</th><th>설명</th></tr><tr><td>FIRC</td><td>내부 고속 RC (리셋 후 기본)</td></tr><tr><td>SIRC</td><td>내부 저속·저전력 RC</td></tr><tr><td>FXOSC</td><td>외부 정밀 크리스털 (보드의 X1)</td></tr><tr><td>PLL</td><td>입력을 체배해 고속 클럭 생성</td></tr></table>
  <p>Cortex-M7 코어 <b>120 MHz</b>, 이번 실습에서 <b>LPUART6_CLK = 30 MHz</b>.</p>`,
  enter(){
    EV.show('die'); EV.dieHL(['clk'],0xffb347,.9); EV.labels(['xtal'],['xtal']); EV.glow('xtal',0xffb347,.9);
    EV.diePath('c_core',['clk','core'],0xffb347); EV.diePath('c_uart',['clk',V(EV.diePos('clk').x+2.2,EV.diePos('clk').y,EV.diePos('clk').z),'uart'],0xff9f43);
    const st={pll:true,uart:true};
    const e=wg(`<div class="box"><div class="row"><button id="bPll" class="on">PLL 켜기</button><button id="bUc" class="on">LPUART6 클럭 enable</button></div><div id="clkOut" style="font-size:12.5px;line-height:1.6"></div></div>`);
    const upd=()=>{ EV.pathFlow('c_core',st.pll,.25); EV.pathFlow('c_uart',st.uart,.25);
      EV.dieHL(['clk',...(st.uart?['uart']:[]),'core'],0xffb347,.8); if(!st.uart) EV.dieHL(['clk','core'],0xffb347,.8);
      $('clkOut').innerHTML=`코어 클럭: <b>${st.pll?'PLL → 120 MHz':'FIRC (리셋 직후, 느림)'}</b><br>LPUART6_CLK: <b style="color:${st.uart?'#6effa0':'#ff8f8f'}">${st.uart?'30 MHz 공급 중':'차단 → UART 동작 안 함'}</b>`;
      $('bPll').classList.toggle('on',st.pll); $('bUc').classList.toggle('on',st.uart); };
    $('bPll').onclick=()=>{st.pll=!st.pll;upd();}; $('bUc').onclick=()=>{st.uart=!st.uart;upd();}; upd();
  }},
 {t:'메모리 맵: 주소가 다 RAM은 아니다',cam:{tx:0,ty:4,tz:-.5,rad:20,th:.45,ph:1.18},
  html:`<p>RAM·Flash·주변장치 레지스터가 <b>하나의 주소 공간</b>에 놓여요. CPU는 같은 load/store 명령으로 다 다뤄요.</p>
  ${pre(`${K('*ptr = 1U;')}   ${Cm('// ptr이 가리키는 곳에 따라 의미가 달라짐')}`)}
  <ul style="margin:.3em 0;padding-left:1.1em"><li>SRAM 주소 → <b>변수 값</b>만 바뀜</li><li>Peripheral 주소 → <b>핀 전압·송수신·인터럽트</b> 등 물리 하드웨어가 즉시 바뀜</li></ul>
  <p>아래 버튼으로 두 경우를 직접 비교해 보세요.</p>`,
  enter(){
    const st=EV.makeStack('mem',[{t:'Peripheral',s:'SIUL2_BASE 0x40290000 · UART · GPIO',c:0xe56b6f},{t:'SRAM',s:'전역 변수 · 스택 · 힙',c:0x3a86d1},{t:'TCM',s:'빠르고 예측 가능한 코드/데이터',c:0x4a6fd1},{t:'Data Flash',s:'전원 꺼도 유지되는 설정값',c:0x2f9c7e},{t:'Code Flash',s:'실행 코드 · RO 데이터',c:0x24826a}],{w:7.2,d:2.0,gap:1.5,y0:1.0,z:-.5,sh:.95});
    EV.show('mem'); EV.labels(['led'],[]);
    const e=wg(`<div class="box"><div class="row"><button id="mS">*ptr → SRAM</button><button id="mP">*ptr → Peripheral(GPDO)</button></div><div id="mOut" style="font-size:12.5px">버튼을 눌러 보세요.</div></div>`);
    const pkt=new T.Mesh(new T.SphereGeometry(.3,16,16),new T.MeshBasicMaterial({color:0xffd166})); pkt.position.set(-6.5,3.4,-.5); st.add(pkt);
    pkt.position.set(-6.5,3.4,0); st.userData.pkt=pkt;
    const go=(idx,html,led)=>{ EV.led(false); st.hl([]); const y=st.slabs[idx].position.y+.4; EV.tween(.7,k=>{ pkt.position.set(-6.5+k*6.2,3.4+(y-3.4)*k,0); },()=>{ st.hl([idx],idx===0?0xff8f8f:0x8fc2ff,1); $('mOut').innerHTML=html; if(led){ EV.led(true); } }); $('mOut').innerHTML='…'; };
    $('mS').onclick=()=>go(1,'SRAM 변수가 <b>1</b>로 바뀜. 보드의 LED는 그대로 — 눈에 보이는 변화 없음.');
    $('mP').onclick=()=>go(0,'GPDO 레지스터에 1을 쓰자 <b>LED(PTA29)가 실제로 켜짐</b>! 같은 문장, 다른 결과.',true);
  }},
 {t:'printf()가 LPUART까지 내려가는 길',cam:{tx:0,ty:5,tz:-.5,rad:21,th:.4,ph:1.2},
  html:`<p>MCU엔 기본 화면이 없어요. <code>printf()</code>는 최종적으로 저수준 <code>_write()</code>를 부르니, <b>_write()를 직접 구현</b>해 바이트를 LPUART로 보내요(Retargeting).</p>
  ${pre(`${K('int')} _write(${K('int')} file, ${K('char')} *ptr, ${K('int')} len) {
    ${Cm('/* ptr의 len 바이트를 LPUART로 송신 */')}
    Lpuart_Uart_Ip_SyncSend(INST_LPUART6,
        (${K('const uint8_t')}*)ptr, len, TIMEOUT);
    ${K('return')} len;
}`)}
  <p>초기화 순서: <code>Clock_Ip_Init()</code> → <code>Siul2_Port_Ip_Init()</code> → <code>Lpuart_Uart_Ip_Init()</code></p>
  ${warn('클럭 → 핀 mux → UART 순서가 거꾸로면 출력이 아예 안 나와요.')}`,
  enter(){
    EV.makeStack('chain',[{t:'printf("Hello S32K3")',s:'C 표준 라이브러리',c:0x6c8cff},{t:'_write()',s:'리타게팅: 직접 구현',c:0x9b6cff},{t:'Lpuart_Uart_Ip_SyncSend()',s:'RTD IPL (LPUART6 · 115200 8N1)',c:0x2fa88a},{t:'LPUART6 → DATA 레지스터',s:'STAT[TDRE]=1 이면 쓰기 가능',c:0xe5963a},{t:'TX 핀 PTA16',s:'→ OpenSDA VCOM → USB',c:0xe5484d}],{w:7.4,d:2.0,gap:1.7,y0:1.0,z:-.5,sh:.95});
    EV.show('chain'); EV.labels([]);
  },
  play(){ const g=EV.groups.chain; const hd=new T.Mesh(new T.SphereGeometry(.3,16,16),new T.MeshBasicMaterial({color:0xffd166})); EV.scene.add(hd); EV.cleanup.push(()=>EV.scene.remove(hd));
    let i=0; const step=()=>{ if(i>=5){ EV.caption('TX 핀으로 비트가 흘러나가요',[0,.5,-.5]); return; }
      g.hl([i],0xffffff,.9); const p=g.at(i,.8); EV.tween(.6,k=>{ hd.position.lerp(p,.35+.65*k); },()=>{ i++; EV.wait(.25,step); }); };
    hd.position.copy(g.at(0,.8)); step(); }},
 {t:'8N1 프레임과 PC 터미널까지',cam:{tx:-15,ty:0,tz:2,rad:30,th:.5,ph:.98},
  html:`<p>UART는 <b>클럭선 없이 TX/RX 두 선</b>, 양쪽 보율이 같아야 해요.</p>
  ${pre(`[Idle:HIGH] → [Start:LOW] → [D0(LSB) … D7(MSB)] → [Stop:HIGH]`)}
  <p>경로: <code>LPUART6(PTA16) → OpenSDA(VCOM) → USB → PC 터미널</code></p>
  <p><b>보율</b>: baud = clk / ((OSR+1) × SBR). 예시: 30 MHz, OSR=15, SBR=16 → <code>30e6/(16×16)=117,188</code> (115,200 대비 약 1.7% 오차, UART는 이 정도 허용).</p>
  <p>비트 1개 ≈ <b>8.68 µs</b>, 프레임 10비트 ≈ <b>86.8 µs</b>.</p>`,
  enter(){
    EV.markPins(['TX']); EV.labels(['pTX','opensda','usb','pc'],['pTX']); EV.show('scope'); EV.scope.show(true);
    EV.glow('opensda',0xff9f43,.5); drawUartScope('H',1);
    wg(`<div class="box"><div class="row"><input id="uTxt" type="text" value="Hello S32K3" style="width:170px"><button id="uSend">보내기</button><button id="uClr">화면 지우기</button></div><div style="font-size:12px;color:#9aa6cf">'A'(0x41) = 01000001 → 전송순서 D0부터: 1 0 0 0 0 0 1 0</div></div>`);
    $('uSend').onclick=()=>send($('uTxt').value+'\r\n'); $('uClr').onclick=()=>EV.term.clear();
  },
  play(){ EV.term.clear(); send(UART_TXT); }}
 ]});
function send(str){
  const chars=[...str]; let i=0;
  const one=()=>{ if(i>=chars.length){ EV.scope.draw((c,W,H)=>{ c.fillStyle='#6effa0'; c.font='bold 54px system-ui,"Noto Sans KR",sans-serif'; c.fillText('전송 완료 ✔',60,120); c.fillStyle='#9aa6cf'; c.font='36px system-ui,"Noto Sans KR",sans-serif'; c.fillText('PC 터미널에 글자가 나타났어요',60,190); }); return; }
    const ch=chars[i++]; EV.tween(.38,k=>drawUartScope(ch,k));
    EV.pathSend('uart',.55,()=>{ if(ch==='\n') EV.term.nl(); else if(ch!=='\r') EV.term.print(ch); one(); }); };
  one();
}

/* ===================== W2 GPIO / SIUL2 ===================== */
const hex=(n,w=0)=>'0x'+n.toString(16).toUpperCase().padStart(w,'0');
function bitsWidget(el,val,fields,onChange){ // 32비트 클릭 위젯
  const render=()=>{ let h='<div class="bits">'; for(let half=1;half>=0;half--){ for(let b=half*16+15;b>=half*16;b--){ const f=fields.find(f=>b<=f.hi&&b>=f.lo); h+=`<div class="bit${(val>>>b)&1?' on':''}${f?' f':''}" data-b="${b}"><small>${b}</small>${(val>>>b)&1}</div>`; } } h+='</div>'; el.innerHTML=h;
    el.querySelectorAll('.bit').forEach(d=>d.onclick=()=>{ val=(val^(1<<+d.dataset.b))>>>0; render(); onChange(val); }); };
  render(); return { set(v){val=v>>>0;render();}, get:()=>val };
}
modes.push({id:'w2',tab:'W2 GPIO',kicker:'2주차 · chap02_gpio_bare · PTA29 = D13 LED',title:'주소에 값을 쓰면 LED가 켜진다',
 steps:[
 {t:'같은 문장, 다른 결과 (Memory-Mapped I/O)',cam:{tx:1,ty:3.5,tz:-1,rad:19,th:.4,ph:.85},
  html:`<p>RAM·Flash·레지스터가 한 주소 공간에 있고, CPU는 <b>같은 store 명령</b>을 써요.</p>
  ${pre(`${K('#define')} STATUS_REG (*(${K('volatile')} uint32_t *) 0x40000000UL)
${K('while')} (STATUS_REG == 0U) { }  ${Cm('// volatile 없으면 1회만 읽고 무한루프')}`)}
  <p><b>volatile</b> = "이 접근을 <b>매번 실제로</b> 수행하고, 생략·재배치하지 마라." 없으면 LED 쓰기가 삭제되거나 Delay 루프가 통째로 사라져 점멸이 멈춰요.</p>`,
  enter(){
    EV.show('die'); EV.dieHL(['core']); EV.labels(['led'],[]);
    EV.diePath('toSram',['core',V(EV.diePos('core').x-1.9,EV.diePos('core').y,EV.diePos('core').z),V(EV.diePos('sram').x+1.0,EV.diePos('sram').y,EV.diePos('sram').z),'sram'],0x6ea8ff);
    EV.diePath('toSiul',['core',V(EV.diePos('core').x+1.9,EV.diePos('core').y,EV.diePos('core').z),V(EV.diePos('siul2').x-1.0,EV.diePos('siul2').y,EV.diePos('siul2').z),'siul2'],0xff8f8f);
    wg(`<div class="box"><div class="row"><button id="aS">*ptr = 1 (SRAM 주소)</button><button id="aP">*ptr = 1 (GPDO 주소)</button></div><div id="aOut" style="font-size:12.5px">누르면 칩 안에서 store가 어디로 가는지 보여요.</div></div>`);
    $('aS').onclick=()=>{ EV.led(false); EV.dieHL(['core']); EV.pathSend('toSram',1.1,()=>{ EV.dieHL(['core','sram'],0x8fc2ff,1); $('aOut').innerHTML='SRAM 변수만 바뀜 — 보드에는 변화 없음'; }); };
    $('aP').onclick=()=>{ EV.led(false); EV.dieHL(['core']); EV.pathSend('toSiul',1.1,()=>{ EV.dieHL(['core','siul2'],0xff8f8f,1); EV.pathSend('chipLED',.9,()=>{ EV.led(true); $('aOut').innerHTML='GPDO에 쓰기 → <b>핀 전압 변화 → LED 점등</b>'; }); }); };
  }},
 {t:'SIUL2의 MSCR: 이 핀을 무엇으로 쓸까 (먹스)',cam:{tx:1.5,ty:3,tz:-1,rad:17,th:.3,ph:.95},
  html:`<p><b>SIUL2</b>는 핀 기능·GPIO 입출력·핀 다중화·입력 신호 라우팅·출력 드라이버를 맡는 주변장치예요.</p>
  <table><tr><th>레지스터</th><th>역할</th></tr><tr><td>MSCR[n]</td><td>핀 속성: 출력/입력 enable, mux(핀 기능), 전기적 속성</td></tr><tr><td>IMCR[n]</td><td>주변장치 <b>입력</b> 신호가 받을 Pad 선택</td></tr><tr><td>GPDO[n] / GPDI[n]</td><td>GPIO 출력값 쓰기 / 입력값 읽기</td></tr></table>
  <p>MSCR의 <b>SSS</b> 필드가 먹스 선택선이에요. 아래에서 바꿔 보세요.</p>`,
  enter(){
    const g=new T.Group(); g.userData.mode=true; g.position.set(0,3.2,-.5);
    const ins=[['GPIO','SSS = 0000b',0xe56b6f],['LPUART TX','SSS = ALT',0xff9f43],['eMIOS','SSS = ALT',0xb36bff]];
    g.ins=ins.map(([t,s,c],i)=>{ const sl=EV.slab({w:3.0,h:.4,d:1.1,color:c,title:t,sub:s,fs:38}); sl.position.set(-4.2,0,-2+i*2); g.add(sl); return sl; });
    g.mux=EV.slab({w:1.8,h:.5,d:4.6,color:0x3a4a96,title:'MSCR',sub:'mux',fs:44}); g.mux.position.set(0,0,0); g.add(g.mux);
    g.pad=EV.slab({w:2.6,h:.4,d:1.4,color:0xd7b04a,title:'Pad PTA29',sub:'→ 핀',fs:40,tc:'#222'}); g.pad.position.set(4.2,0,0); g.add(g.pad);
    EV.reg('mux',g,true); EV.show('mux'); EV.labels([]);
    const sel=(i)=>{ g.ins.forEach((s,k)=>s.setGlow(k===i?1:0,0xffffff)); g.pad.setGlow(.8,[0xe56b6f,0xff9f43,0xb36bff][i]);
      const pts=[V(-2.8,3.85,-.5+(-2+i*2)),V(-1.0,3.85,-.5+(-2+i*2)),V(-1.0,3.85,-.5),V(2.8,3.85,-.5)];
      tpath('muxp',pts,[0xe56b6f,0xff9f43,0xb36bff][i]); EV.pathFlow('muxp',true,.3);
      $('mxOut').innerHTML=i===0?'패드가 <b>GPIO</b>(GPDO)와 연결 → LED 제어 가능':'패드가 <b>'+ins[i][0]+'</b>와 연결 → GPIO 값은 핀에 안 나감'; };
    wg(`<div class="box"><div class="row"><button id="s0">SSS=GPIO</button><button id="s1">SSS=LPUART TX</button><button id="s2">SSS=eMIOS</button></div><div id="mxOut" style="font-size:12.5px"></div></div>`);
    ['s0','s1','s2'].forEach((id,i)=>$(id).onclick=()=>sel(i)); sel(0);
  }},
 {t:'MSCR 비트와 주소 계산',cam:{tx:1,ty:3,tz:-1,rad:19,th:.4,ph:.85},
  html:`<p>GPIO 출력으로 만들려면 <b>① SSS=0000b(GPIO)</b> <b>② OBE(비트 21) Set</b>. 다른 필드를 건드리지 않게 <b>Read-Modify-Write</b>로요.</p>
  ${pre(`reg |=  (1U << n);        ${Cm('// Set')}
reg &= ~(1U << n);        ${Cm('// Clear')}
reg ^=  (1U << n);        ${Cm('// Toggle')}
reg = (reg & ~mask) | value; ${Cm('// 필드 변경')}`)}
  <p>주소: <code>MSCR[n] = 0x40290000 + 0x0240 + 4×n</code></p>`,
  enter(){
    EV.show('die'); EV.dieHL(['siul2'],0xe56b6f,1); EV.labels([]);
    const e=wg(`<div class="box"><div style="font-size:12px;color:#9aa6cf;margin-bottom:2px">MSCR[n] 32비트 (클릭해서 토글) — 파란 테두리: OBE(21), SSS[3:0]</div><div id="bw"></div><div class="row"><span>n =</span><input id="mn" type="number" value="29" min="0" max="511"><span id="mAddr"></span></div><div id="mOut2" style="font-size:12.5px"></div></div>`);
    let w;
    const upd=(v)=>{ const n=+$('mn').value||0; const addr=0x40290000+0x240+4*n; const obe=(v>>>21)&1, sss=v&15;
      $('mAddr').innerHTML=`→ 주소 <code>${hex(addr,8)}</code>`; $('mOut2').innerHTML=`값 <code>${hex(v>>>0,8)}</code> · OBE=<b>${obe}</b> · SSS=<b>${sss.toString(2).padStart(4,'0')}b</b> → ${obe&&sss===0?'<b style="color:#6effa0">GPIO 출력으로 설정됨</b>':'아직 GPIO 출력이 아니에요 (OBE=1, SSS=0000b 필요)'}`; if(obe&&sss===0) EV.glow('led',0xff8f8f,.3); else EV.clearGlow(); };
    w=bitsWidget($('bw'),0,[{hi:21,lo:21},{hi:3,lo:0}],upd); $('mn').oninput=()=>upd(w.get()); upd(0);
  }},
 {t:'GPDO는 4개씩 거꾸로 놓여 있다',cam:{tx:1.2,ty:2.5,tz:-1,rad:15,th:.25,ph:1.0},
  html:`<p><code>GPDO</code>는 8비트 레지스터 배열(<code>0x1300~</code>)인데 <b>워드(4개) 단위로 역순</b>이에요.</p>
  <table><tr><th>오프셋</th><th>레지스터</th><th>오프셋</th><th>레지스터</th></tr><tr><td>0x1300</td><td>GPDO3</td><td>0x131C</td><td>GPDO31</td></tr><tr><td>0x1301</td><td>GPDO2</td><td>0x131D</td><td>GPDO30</td></tr><tr><td>0x1302</td><td>GPDO1</td><td>0x131E</td><td><b>GPDO29</b></td></tr><tr><td>0x1303</td><td>GPDO0</td><td>0x131F</td><td>GPDO28</td></tr></table>
  ${pre(`${K('#define')} SIUL2_GPDO_BYTE_OFFSET(i) \\
  (0x1300UL + (((i) & ~3UL) + (3UL - ((i) & 3UL))))`)}
  ${warn('MSCR 번호와 GPIO 번호는 <b>서로 다른 레지스터의 인덱스</b>. 한 변수로 취급하면 안 돼요.')}`,
  enter(){
    const g=new T.Group(); g.userData.mode=true; g.position.set(0,2.6,-.5); g.cells=[];
    for(let c=0;c<4;c++){ const s=EV.slab({w:1.9,h:.6,d:2.0,color:0x3a6fd1,title:'',sub:'',fs:40}); s.position.set(-3.15+c*2.1,0,0); g.add(s); g.cells.push(s); }
    EV.reg('gpdo',g,true); EV.show('gpdo'); EV.labels([]);
    wg(`<div class="box"><div class="row"><span>GPIO 번호 i =</span><input id="gi" type="number" value="29" min="0" max="31"></div><div id="gOut" style="font-size:12.5px;line-height:1.6"></div></div>`);
    const upd=()=>{ const i=Math.max(0,Math.min(31,+$('gi').value||0)); const base=i&~3, off=0x1300+base+(3-(i&3)); const col=i&3;
      g.cells.forEach((s,c)=>{ const idx=base+(3-c), o=0x1300+base+c; s.retitle('GPDO'+idx,hex(o,4)); s.setGlow(c===3-(i&3)?1.1:0,0xffd166); });
      $('gOut').innerHTML=`(${i} & ~3) + (3 − (${i} & 3)) = ${base} + ${3-(i&3)} = <b>${base+3-(i&3)}</b><br>최종 오프셋 = 0x1300 + 0x${(base+3-(i&3)).toString(16).toUpperCase()} = <code>${hex(off,4)}</code><br>주소 = <code>${hex(0x40290000+off,8)}</code>`; };
    $('gi').oninput=upd; upd();
  }},
 {t:'GPDO29에 1을 써서 LED 켜기',cam:{tx:2,ty:2,tz:-2.5,rad:17,th:.2,ph:.9},
  html:`<p>D13 LED = <b>PTA29</b>, <b>Active High</b>(1=점등). 두 가지 접근:</p>
  ${pre(`${Cm('// 직접 주소')}
SIUL2_MSCR(29U)  = (MSCR & ~SSS) | OBE;
SIUL2_GPDO(29U)  = 1U;
${Cm('// SDK 헤더')}
IP_SIUL2->MSCR[29] = value;
IP_SIUL2->GPDO29   = 1U;`)}
  <table><tr><th>비교</th><th>직접 주소</th><th>SDK 헤더</th></tr><tr><td>레지스터 구조 이해</td><td>높음</td><td>낮음</td></tr><tr><td>가독성/이식성</td><td>낮음</td><td>높음</td></tr><tr><td>오타 위험</td><td>높음</td><td>낮음</td></tr></table>
  <p>Active Low였다면 1은 소등이에요. <b>보드 매뉴얼(HWUM) → IOMUX 표 → RTD 헤더</b> 순으로 핀 정보를 확인하세요.</p>`,
  enter(){
    EV.show('die'); EV.dieHL(['core']); EV.labels(['led','pLED'],['led']); EV.markPins(['LED']);
    EV.diePath('wr',['core',V(EV.diePos('core').x+1.9,EV.diePos('core').y,EV.diePos('core').z),V(EV.diePos('siul2').x-1.0,EV.diePos('siul2').y,EV.diePos('siul2').z),'siul2'],0xff8f8f);
    let on=false;
    wg(`<div class="box"><div class="row"><button id="g1">GPDO29 = 1</button><button id="g0">GPDO29 = 0</button><button id="gb">Delay 점멸</button></div><div id="gOut2" style="font-size:12.5px">현재: LED 꺼짐</div></div>`);
    const write=(v,cb)=>{ EV.dieHL(['core']); EV.pathSend('wr',.8,()=>{ EV.dieHL(['core','siul2'],0xff8f8f,1); EV.pathSend('chipLED',.7,()=>{ EV.led(v); $('gOut2').innerHTML='현재: LED '+(v?'<b style="color:#ff8f8f">켜짐</b>':'꺼짐'); cb&&cb(); }); }); };
    $('g1').onclick=()=>write(1); $('g0').onclick=()=>write(0);
    let blink=false; $('gb').onclick=()=>{ blink=!blink; if(!blink) return; let v=0; const loop=()=>{ if(!blink) return; v^=1; write(v,()=>EV.wait(.5,loop)); }; loop(); };
    EV.cleanup.push(()=>{ blink=false; });
  },
  play(){} }
 ]});

/* ===================== W3 IPL vs MCAL ===================== */
const LAY=[{t:'Application',s:'응용 로직',c:0x6c8cff},{t:'AUTOSAR BSW / RTE',s:'서비스 · 통신 · OS',c:0x8a6cff},{t:'MCAL (HLD)',s:'Port · Dio · Adc · Can ...',c:0xb04fd0},{t:'IPL (IP Level Driver)',s:'Siul2_Dio_Ip · Lpuart_Uart_Ip ...',c:0x2fa88a},{t:'레지스터 / 베어메탈',s:'SIUL2 MSCR · GPDO (2주차)',c:0xe5963a}];
function stackScene(y0=1.4){ const g=EV.makeStack('stack',LAY,{w:7.4,d:2.4,gap:1.85,y0,z:-.5,sh:.95}); EV.show('stack'); return g; }
function drop(g,idxs,color,done,caps){ const hd=new T.Mesh(new T.SphereGeometry(.3,16,16),new T.MeshBasicMaterial({color})); EV.scene.add(hd); EV.cleanup.push(()=>EV.scene.remove(hd));
  hd.position.copy(g.at(idxs[0],.9)); let i=0; const step=()=>{ if(i>=idxs.length){ EV.pathSend('chipLED',.9,()=>{ EV.led(true); EV.scene.remove(hd); done&&done(); }); return; }
    g.hl([idxs[i]],color,1); caps&&caps[i]&&EV.caption(caps[i],[0,g.at(idxs[i],1.2).y,-.5]); const p=g.at(idxs[i],.9); EV.tween(.55,k=>hd.position.lerp(p,.4+.6*k),()=>{ i++; EV.wait(.45,step); }); }; step(); }
modes.push({id:'w3',tab:'W3 IPL/MCAL',kicker:'3주차 · chap03_gpio_ipl / chap03_gpio_mcal',title:'같은 LED, 다른 길: 추상화 계층',
 steps:[
 {t:'추상화 계층: 하드웨어 의존성을 어디에 모을까',cam:{tx:0,ty:5,tz:-.5,rad:23,th:.4,ph:1.2},
  html:`<p>추상화는 하드웨어를 숨기는 게 아니라 <b>하드웨어 의존성을 어느 계층에 모아둘지</b> 정하는 설계예요.</p>
  <p>흔히 말하는 <b>HAL = IPL + MCAL</b>. NXP RTD는 <b>HLD(MCAL용 인터페이스)</b>와 <b>IPL(가장 낮은 레벨)</b>로 나뉘어요.</p>
  ${note('<b>대가</b>: 코드가 늘고 빌드 크기가 커져요. <b>이득</b>: 이식성·안전성·검증 비용 절감.')}`,
  enter(){ const g=stackScene(); g.hl([]); EV.labels(['led'],[]); },
  play(){ const g=EV.groups.stack; let i=0; const t=()=>{ if(i>=5){ g.hl([]); return; } g.hl([i],0xffffff,.9); i++; EV.wait(.6,t); }; t(); }},
 {t:'MCU를 바꿔도 위는 그대로 (이식성)',cam:{tx:0,ty:5,tz:-.5,rad:23,th:.4,ph:1.2},
  html:`<p>MCU가 바뀌면 <b>맨 아래 두 층(IPL·레지스터)</b>만 교체돼요. 위쪽 응용 코드는 <code>Dio_WriteChannel()</code> 같은 표준 호출 그대로예요.</p>
  <p>이미 검증된 드라이버를 여러 차종에 재사용할 수 있어, 도구·구조체·생성 단계의 번거로움보다 <b>검증 비용 절감</b>이 커요 (ASIL 인증).</p>`,
  enter(){ const g=stackScene(); g.hl([]); EV.labels([]); },
  play(){ const g=EV.groups.stack; let on=false; const flip=()=>{ on=!on; g.slabs[3].setGlow(on?1.1:0,0xff6b6b); g.slabs[4].setGlow(on?1.1:0,0xff6b6b); g.slabs[0].setGlow(.5,0x6effa0); g.slabs[1].setGlow(.5,0x6effa0); g.slabs[2].setGlow(.4,0x6effa0); EV.caption(on?'아래 두 층만 <b>다른 MCU용으로 교체</b>':'위 세 층은 <b>그대로 재사용</b>',[0,9.4,-.5]); EV.wait(1.1,flip); }; flip(); }},
 {t:'IPL 경로: Siul2_Dio_Ip_WritePin',cam:{tx:1,ty:5,tz:-1.5,rad:25,th:.4,ph:1.2},
  html:`<p>IPL은 특정 IP(SIUL2 등)에 맞춘 <b>벤더 전용 저수준 드라이버</b>예요. 호출 단위는 <b>포트 half + 핀 번호</b>.</p>
  ${pre(`Siul2_Port_Ip_Init(...);  ${Cm('// Pins Tool 생성')}
${K('Siul2_Dio_Ip_WritePin')}(${Hh('PTA_H_HALF')}, ${Hh('13U')}, level);`)}
  <p><b>왜 13U?</b> PTA29는 포트 A의 <b>상위 half(핀 16~31)</b> 안에서 <code>29−16 = 13</code>번째 핀이에요.</p>
  <div class="box"><div class="bits" id="halfBits" style="grid-template-columns:repeat(16,1fr)"></div></div>`,
  enter(){ const g=stackScene(); g.hl([]); EV.labels(['led','pLED'],['led']); EV.markPins(['LED']);
    let h='';for(let i=16;i<32;i++) h+=`<div class="bit${i===29?' on':''}"><small>${i}</small>${i-16}</div>`; $('wg').innerHTML=`<div class="box" style="font-size:11px">PTA_H_HALF (핀 16~31) — 위: 포트 핀 번호, 아래: half 안 번호<div class="bits">${h}</div></div>`; },
  play(){ const g=EV.groups.stack; drop(g,[0,3,4],0xffd166,null,['Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 1)','IPL: 주소 계산·접근 폭은 드라이버 안에','GPDO29 = 1 → LED']); }},
 {t:'MCAL 경로: Port_Init + Dio_WriteChannel',cam:{tx:1,ty:5,tz:-1.5,rad:25,th:.4,ph:1.2},
  html:`<p>MCAL은 AUTOSAR 표준 API. <b>설정은 코드에 쓰지 않고</b> Config Tools가 만든 구조체에 담아요.</p>
  ${pre(`${K('Port_Init')}(NULL_PTR);                      ${Cm('// 정적 설정 로드 (1회)')}
${K('Dio_WriteChannel')}(${Hh('DioConf_DioChannel_RGBLED0_RED')}, STD_HIGH); ${Cm('// 동작만')}`)}
  <table><tr><th>모듈</th><th>역할</th></tr><tr><td><b>Port</b></td><td>하드웨어 <b>정적</b> 특성(모드·방향·전기적 속성·초기 상태)</td></tr><tr><td><b>Dio</b></td><td>런타임 <b>동적</b> 레벨 제어(읽기·쓰기·토글)</td></tr></table>
  <p>물리 핀 번호 대신 <b>심볼</b>을 써서 핀이 바뀌어도 코드는 그대로예요. 내부에서는 결국 IPL을 호출합니다.</p>`,
  enter(){ const g=stackScene(); g.hl([]); EV.labels(['led'],['led']); },
  play(){ const g=EV.groups.stack; EV.caption('<b>Port_Init</b> (정적 · 1회)',[0,g.at(2,1.2).y,-.5]); g.hl([2],0x6ea8ff,1);
    EV.wait(1.2,()=>drop(g,[0,2,3,4],0xffd166,null,['Dio_WriteChannel(RGBLED0_RED, STD_HIGH)','MCAL: 심볼 → 채널 → 핀 (Config 생성)','IPL 호출로 위임','GPDO29 = 1 → LED'])); }},
 {t:'비교 + LED 핀이 바뀌면 어디를 고칠까',cam:{tx:0,ty:5,tz:-.5,rad:23,th:.4,ph:1.2},
  html:`<table><tr><th>비교</th><th>IPL</th><th>MCAL</th></tr><tr><td>호출 단위</td><td>포트 half + 핀</td><td>Dio 채널 ID</td></tr><tr><td>설정</td><td>Pins 설정 + 생성 구조체</td><td>Config Tools Port/Dio</td></tr><tr><td>이식성</td><td>같은 SIUL2 IP 계열</td><td>지원 MCU/보드 범위</td></tr><tr><td>검증 단위</td><td>IP API + 생성 코드</td><td>API + 설정 + 생성 코드</td></tr></table>
  ${warn('<b>.text 크기만 보고 판단하면 안 돼요.</b> MCAL이 크지만 얻는 건 검증/이식성이에요. 빌드 콘솔의 <code>arm-none-eabi-size</code>로 비교하되 의미를 함께 보세요.')}`,
  enter(){ const g=stackScene(); g.hl([]); EV.labels([]);
    wg(`<div class="box"><div class="row"><button id="cIpl">IPL: LED 핀을 바꾸면?</button><button id="cMcal">MCAL: LED 핀을 바꾸면?</button></div><div id="cOut" style="font-size:12.5px">버튼을 눌러 보세요.</div></div>`);
    $('cIpl').onclick=()=>{ g.hl([0,3],0xffb347,1); $('cOut').innerHTML='<b>Pins 설정 재생성</b> + 응용 코드의 <code>(PTA_H_HALF, 13U)</code> 호출부 수정 → 소스가 IP·핀에 직접 의존'; };
    $('cMcal').onclick=()=>{ g.hl([2],0x6effa0,1); $('cOut').innerHTML='<b>Config(Port/Dio)</b>만 수정, 심볼 이름을 유지하면 <b>응용 코드는 그대로</b>'; }; }}
 ]});

/* ===================== W4 I2C + LCD ===================== */
const b8=n=>[7,6,5,4,3,2,1,0].map(i=>(n>>i)&1);
function i2cWave(addr,data){
  const scl=[],sda=[],marks=[]; const push=(a,b)=>{scl.push(a);sda.push(b);};
  push(1,1);marks.push([0,'']);push(1,0);marks.push([1,'S']);push(0,0);
  const bytes=[[ ((addr<<1)&0xFE)|0, 'A'],[data,'D']];
  const seq=[...b8((addr<<1)&0xFE).map((b,i)=>[b,i<7?'A'+(6-i):'W']),['ACK','ACK'],...b8(data).map((b,i)=>[b,'D'+(7-i)]),['ACK','ACK']];
  seq.forEach(([b,l])=>{ const ack=b==='ACK'; marks.push([scl.length,l]); const v=ack?0:b; [0,1,1,0].forEach(c=>{ scl.push(c); sda.push(v); }); });
  push(0,0); push(1,0); push(1,1);
  return {scl,sda,marks,ackIdx:[0,1].map(k=>marks.findIndex((m,i)=>m[1]==='ACK'&&i>=0)),total:scl.length};
}
function drawI2c(addr,data,prog){
  const w=i2cWave(addr,data), n=w.total;
  EV.scope.draw((c,W,H)=>{
    c.fillStyle='#e7ebf7'; c.font='bold 44px system-ui,"Noto Sans KR",sans-serif'; c.textAlign='left';
    c.fillText(`I2C 쓰기 · 0x${addr.toString(16).toUpperCase()}+W = 0x${((addr<<1)&0xFE).toString(16).toUpperCase()} · 데이터 0x${data.toString(16).toUpperCase()}`,40,66);
    const x0=150,x1=W-50;
    c.fillStyle='#E9A23B'; c.font='bold 34px sans-serif'; c.fillText('SCL',30,200); c.fillStyle='#35c4c4'; c.fillText('SDA',30,380);
    c.strokeStyle='#26335f'; c.lineWidth=1.5; const dx=(x1-x0)/n;
    w.marks.forEach(([i,l])=>{ if(!l) return; const x=x0+i*dx; c.strokeStyle=l==='ACK'?'#2b5a3a':'#26335f'; c.beginPath(); c.moveTo(x,100); c.lineTo(x,440); c.stroke();
      c.fillStyle=l==='ACK'?'#6effa0':(l==='S'?'#ff9b9b':'#9aa6cf'); c.font='bold 22px monospace'; c.textAlign='left'; c.fillText(l,x+3,100); });
    EV.drawDigital(c,w.scl,x0,x1,140,90,'#E9A23B',prog,5); EV.drawDigital(c,w.sda,x0,x1,320,90,'#35c4c4',prog,5);
    if(prog<1){ c.strokeStyle='#fff'; c.lineWidth=2; c.setLineDash([8,6]); c.beginPath(); c.moveTo(x0+(x1-x0)*prog,110); c.lineTo(x0+(x1-x0)*prog,440); c.stroke(); c.setLineDash([]); }
    c.fillStyle='#7d8bb8'; c.font='24px system-ui,"Noto Sans KR",sans-serif'; c.textAlign='left'; c.fillText('SCL이 LOW일 때 SDA 변경 · SCL이 HIGH일 때 읽힘 · ACK = 9번째 클럭에서 수신 측이 SDA를 LOW로',40,478);
  });
}
const PCFMAP=['P0 RS','P1 R/W','P2 E','P3 BL','P4 DB4','P5 DB5','P6 DB6','P7 DB7'];
modes.push({id:'w4',tab:'W4 I2C·LCD',kicker:'4주차 · LPI2C1 100 kHz · PCF8574(0x27) · HD44780',title:'SDA·SCL 두 선으로 LCD에 글자 쓰기',
 steps:[
 {t:'오픈 드레인과 풀업: 아무도 안 당기면 HIGH',cam:{tx:1.8,ty:3,tz:-1,rad:18,th:.15,ph:1.05},
  html:`<p>I2C 장치는 <b>LOW만 끌어내리고</b>, HIGH는 <b>풀업 저항(보통 4.7 kΩ)</b>에 맡겨요. 그래서 여러 장치가 충돌 없이 한 선을 나눠 써요.</p>
  <p>아래 버튼으로 장치가 SDA를 당겨 보세요. <b>한 명이라도 당기면 LOW</b>, 아무도 안 당기면 HIGH.</p>
  ${note('SDA/SCL에 풀업이 없으면 선이 영원히 HIGH가 못 돼요. 통신이 안 될 때 가장 먼저 의심할 곳!')}`,
  enter(){
    const g=new T.Group(); g.userData.mode=true; g.position.set(0,.5,-1);
    const rail=EV.slab({w:9,h:.2,d:.7,color:0xe5484d,title:'3.3 V',sub:'',fs:44}); rail.position.set(-.3,6,0); g.add(rail);
    const rm=EV.mat(0xd7b04a,{metalness:.5,roughness:.4}); const res=EV.cyl(.28,1.6,rm,-4.8,5.0,0,g); const rl=EV.sprite('풀업 4.7kΩ',{size:.6,w:512,h:128,fs:50}); rl.position.set(-4.0,5.0,0); g.add(rl);
    const lm=EV.mat(0x4ade80,{emissive:0x4ade80,emissiveIntensity:.8}); const line=EV.rbox(10.4,.22,.22,lm,0,3.8,0,g); line.userData.glowOK=false; g.line=line;
    EV.rbox(.12,1.2,.12,rm,-4.8,4.4,0,g); EV.rbox(.12,.12,.12,rm,-4.8,6.0,0,g);
    const devs=[['Master','S32K312',-3.6],['Slave 0x27','PCF8574',0],['Slave','다른 장치',3.6]];
    g.devs=devs.map(([t,s,x],i)=>{ const d=EV.slab({w:2.6,h:.5,d:1.3,color:i===0?0x4f7cff:(i===1?0x2fa88a:0x7a7a99),title:t,sub:s,fs:38}); d.position.set(x,1.2,0); g.add(d);
      const lk=EV.rbox(.14,2.1,.14,EV.mat(0x4a5688),x,2.5,0,g); lk.userData.glowOK=false; d.link=lk; d.pull=false; return d; });
    EV.reg('od',g,true); EV.show('od'); EV.labels([]);
    const gnd=EV.slab({w:10,h:.2,d:.7,color:0x444b6e,title:'GND',sub:'',fs:40}); gnd.position.set(0,.3,0); g.add(gnd);
    wg(`<div class="box"><div class="row"><button id="o0">Master가 당김</button><button id="o1">PCF8574가 당김</button><button id="o2">다른 장치가 당김</button></div><div id="oOut" style="font-size:13px"></div></div>`);
    const upd=()=>{ const low=g.devs.some(d=>d.pull); lm.color.setHex(low?0x333a55:0x4ade80); lm.emissive.setHex(low?0x000000:0x4ade80); lm.emissiveIntensity=low?0:.8;
      g.devs.forEach((d,i)=>{ d.link.material.color.setHex(d.pull?0xff6b6b:0x4a5688); d.setGlow(d.pull?.9:0,0xff6b6b); $('o'+i).classList.toggle('on',d.pull); });
      $('oOut').innerHTML=`SDA 레벨: <b style="color:${low?'#ff9b9b':'#6effa0'}">${low?'LOW (0)':'HIGH (1) — 풀업이 올림'}</b>`; };
    [0,1,2].forEach(i=>$('o'+i).onclick=()=>{ g.devs[i].pull=!g.devs[i].pull; upd(); }); upd();
  }},
 {t:'I2C 프레임 한 장을 비트 단위로',cam:{tx:1.5,ty:1,tz:-6,rad:22,th:.25,ph:.95},
  html:`<table><tr><th>요소</th><th>조건</th></tr><tr><td>START</td><td>SCL HIGH 동안 SDA HIGH→LOW</td></tr><tr><td>데이터</td><td>SCL LOW일 때 SDA 변경, HIGH일 때 읽힘</td></tr><tr><td>주소+R/W</td><td>7비트 주소 뒤 방향 비트</td></tr><tr><td>ACK</td><td>9번째 클럭에 수신 측이 SDA를 LOW</td></tr><tr><td>STOP</td><td>SCL HIGH 동안 SDA LOW→HIGH</td></tr></table>
  <p>주소 <code>0x27</code>, 쓰기 → 첫 바이트 <code>(0x27&lt;&lt;1)|0 = 0x4E</code>. 칩 PTC6(SDA)·PTC7(SCL)에서 점퍼선을 타고 PCF8574까지 신호가 이동해요.</p>`,
  enter(){
    EV.markPins(['SDA','SCL']); EV.labels(['pSDA','pSCL','pcf'],['pSDA','pSCL']); EV.show('scope'); EV.scope.show(true);
    EV.pathFlow('sda',true,.22); EV.pathFlow('scl',true,.5);
    wg(`<div class="box"><div class="row"><span>주소</span><input id="iA" type="text" value="27"><span>데이터</span><input id="iD" type="text" value="4D"><button id="iGo">다시 보내기</button></div></div>`);
    const run=()=>{ const a=parseInt($('iA').value,16)&127, d=parseInt($('iD').value,16)&255; EV.pcfSet(0); drawI2c(a,d,0); EV.tween(7,k=>drawI2c(a,d,k),()=>EV.pcfSet(d)); };
    $('iGo').onclick=run; EV.cleanup.push(()=>EV.pcfSet(0)); drawI2c(0x27,0x4D,1);
  },
  play(){ const a=0x27,d=0x4D; EV.tween(7,k=>drawI2c(a,d,k),()=>EV.pcfSet(d)); }},
 {t:'I2C 스캐너: 누가 ACK 하나?',cam:{tx:0,ty:3,tz:-1.5,rad:17,th:.2,ph:.9},
  html:`<p>주소 <b>0x03 ~ 0x77</b>에 차례로 0바이트 쓰기를 시도해서 <b>ACK가 돌아오는 주소</b>를 찾아요. 이 보드에서는 <code>0x27</code>이 응답해요 (백팩 PCF8574).</p>
  ${pre(`${K('for')} (addr = 0x03; addr <= 0x77; addr++) {
    status = I2c_Write0(addr);   ${Cm('// 0바이트 쓰기')}
    ${K('if')} (status == OK) printf("found 0x%02X\\r\\n", addr);   ${Cm('// ACK!')}
}`)}
  <p>LCD가 안 나올 때 가장 먼저 해 볼 디버깅이에요 (주소를 몰라서 실패하는 경우가 많아요).</p>`,
  enter(){
    const g=new T.Group(); g.userData.mode=true; g.position.set(0,2.4,-1.2); g.cells=[];
    for(let a=3;a<=0x77;a++){ const i=a-3, col=i%13,row=Math.floor(i/13); const m=EV.mat(0x2a3b86,{emissive:0x000000,roughness:.5}); const b=EV.rbox(.72,.3,.72,m,(col-6)*.85,0,(row-4)*.85,g); b.userData.a=a; g.cells.push(b); }
    EV.reg('scan',g,true); EV.show('scan'); EV.labels(['pcf']); EV.pathFlow('sda',true,.3);
    wg(`<div class="box"><div id="scOut" style="font-size:13px">▶ 재생을 눌러 스캔을 시작하세요.</div></div>`);
  },
  play(){ const g=EV.groups.scan; g.cells.forEach(b=>{ b.material.color.setHex(0x2a3b86); b.material.emissive.setHex(0); }); let found=[];
    EV.tween(6.5,k=>{ const n=Math.floor(k*g.cells.length); g.cells.forEach((b,i)=>{ if(i<=n&&!b.userData.done){ b.userData.done=true; const ack=b.userData.a===0x27; b.material.color.setHex(ack?0x38e07a:0x3d4f9a); b.material.emissive.setHex(ack?0x2bd16b:0x000000); b.material.emissiveIntensity=ack?1.4:0; if(ack){ found.push(b.userData.a); b.position.y=.5; } } });
      const a=3+Math.min(n,g.cells.length-1); $('scOut').innerHTML=`시험 주소: <code>0x${a.toString(16).toUpperCase().padStart(2,'0')}</code> ${found.length?`· <b style="color:#6effa0">ACK: 0x${found[0].toString(16)}</b>`:'· 응답 없음(NACK)'}`; },
      ()=>{ $('scOut').innerHTML='완료 — <b style="color:#6effa0">0x27</b>에서 ACK. LCD 백팩 주소를 찾았어요.'; g.cells.forEach(b=>b.userData.done=false); }); }},
 {t:'PCF8574: 1바이트가 LCD 제어선 8개로',cam:{tx:4.6,ty:0,tz:-11.7,rad:13,th:.12,ph:.85},
  html:`<p>PCF8574는 <b>I2C로 받은 1바이트를 8개 출력 핀</b>에 그대로 내보내요. 백팩이 LCD에 배선돼 있어서 <b>1바이트 = LCD 제어선 8개</b>.</p>
  <table><tr><th>핀</th><th>P0</th><th>P1</th><th>P2</th><th>P3</th><th>P4~P7</th></tr><tr><td>LCD</td><td>RS</td><td>R/W</td><td>E</td><td>BL</td><td>DB4~DB7</td></tr></table>
  <p>데이터선은 <b>상위 4개(DB4~DB7)</b>만 연결 → 한 글자(8비트)를 <b>상위 니블 → 하위 니블</b> 두 번에 나눠 보내요. 니블마다 <b>E를 1→0</b>으로 내려야 LCD가 래치(<code>Lcd1602_PulseEnable</code>).</p>
  <p>예: <code>'A' = 0x41</code>, RS=1(데이터), BL=1 → <code>0x4D → 0x49 → 0x1D → 0x19</code></p>`,
  enter(){
    EV.show(); EV.labels([]); EV.pcfSet(0); EV.lcd.set('',''); 
    for(let i=0;i<8;i++){ const id='pb'+i; if(!EV.labelDefs[id]) EV.defLabel(id,'',v=>EV.pcfBits[i].getWorldPosition(v).add(V(0,.5+(i%2)*.75,0))); EV.setLabel(id,PCFMAP[7-i].replace(' ','·')); }
    EV.labels(['pb0','pb1','pb2','pb3','pb4','pb5','pb6','pb7','lcd']);
    wg(`<div class="box"><div class="row"><span>글자</span><input id="pc1" type="text" value="A" style="width:44px" maxlength="1"><button id="pcGo">니블 2번 전송</button></div><div id="pcOut" style="font-size:12.5px;line-height:1.55"></div></div>`);
    const send=()=>{ const ch=($('pc1').value||'A')[0], v=ch.charCodeAt(0), hi=v&0xF0, lo=(v&0x0F)<<4, f=0x09; const seq=[hi|f|4,hi|f,lo|f|4,lo|f];
      const names=['상위 니블 · E=1','상위 니블 · E=0 (래치)','하위 니블 · E=1','하위 니블 · E=0 (래치)']; let i=0; EV.lcd.set('','');
      const step=()=>{ if(i>=4){ EV.lcd.set(ch,'',[0,1]); return; } EV.pcfSet(seq[i]); $('pcOut').innerHTML=seq.slice(0,i+1).map((b,k)=>`${k+1}. <code>0x${b.toString(16).toUpperCase().padStart(2,'0')}</code> ${names[k]}`).join('<br>'); i++; EV.wait(1.0,step); };
      step(); };
    $('pcGo').onclick=send; EV.cleanup.push(()=>EV.pcfSet(0));
  },
  play(){ $('pcGo').click(); }},
 {t:'DDRAM과 커서 위치',cam:{tx:5,ty:0,tz:-13,rad:13,th:.08,ph:.75},
  html:`<p>표시할 문자는 <b>DDRAM</b>에 ASCII 코드로 저장돼요(80바이트). 1행 <code>0x00~0x0F</code>, 2행 <code>0x40~0x4F</code>. 커서 이동 명령은 <code>0x80 | 주소</code>.</p>
  <table><tr><th>제어 핀</th><th>0</th><th>1</th></tr><tr><td>RS</td><td>명령(IR)</td><td>데이터(DR)</td></tr><tr><td>R/W</td><td>쓰기</td><td>읽기</td></tr><tr><td>E</td><td colspan="2">HIGH→LOW 하강 에지에 래치</td></tr></table>
  <p>CGROM: 기본 5×8 폰트 · CGRAM: 사용자 정의 폰트</p>`,
  enter(){
    EV.labels(['lcd']); EV.lcd.set('Hello S32K3','Count: 0000');
    wg(`<div class="box"><div class="row"><span>DDRAM 주소(hex)</span><input id="dA" type="text" value="40"></div><div id="dOut" style="font-size:12.5px"></div></div>`);
    const upd=()=>{ const a=parseInt($('dA').value,16)||0; const row=a>=0x40?1:0, col=a&0x3F; $('dOut').innerHTML=`명령 바이트 <code>0x${(0x80|a).toString(16).toUpperCase()}</code> → ${row+1}행 ${col+1}번째 칸`+(col>15?' <b style="color:#ff9b9b">(화면 밖)</b>':''); EV.lcd.cursor=col<16?[row,col]:null; EV.lcd.draw(); };
    $('dA').oninput=upd; upd();
  },
  play(){ let n=0; const loop=()=>{ if(n>8) return; EV.lcd.set('Hello S32K3','Count: '+String(n).padStart(4,'0'),[1,7+3]); n++; EV.wait(.6,loop); }; loop(); }},
 {t:'IPL ↔ MCAL: 맨 아래 함수 하나만 바꾼다',cam:{tx:0,ty:4.5,tz:-.5,rad:21,th:.4,ph:1.2},
  html:`<p>LCD 드라이버는 <b>모듈화</b>돼 있어요(<code>lcd1602.c/.h</code>): 응용 API(<code>Init / Clear / SetCursor / Putc / Puts</code>) 아래에 <b>전송 계층 함수 하나</b>만 있어요.</p>
  ${pre(`IPL : ${K('Lpi2c_Ip_MasterSendDataBlocking')}(...)
MCAL: ${K('I2c_SyncTransmit')}(...)`)}
  <p>이 하나만 교체해도 같은 화면이 나오면 <b>계층 분리가 잘 된 것</b>이에요. 설정: LPI2C1 Master, 100 kHz, 핀 Open-Drain.</p>`,
  enter(){ const g=EV.makeStack('stack4',[{t:'Lcd1602_Puts / Putc / SetCursor',s:'응용 API (lcd1602.c)',c:0x6c8cff},{t:'I2c_Lcd1602_Write',s:'전송 계층 — 여기만 교체',c:0xe5963a},{t:'Lpi2c_Ip_MasterSendDataBlocking',s:'IPL 버전',c:0x2fa88a},{t:'LPI2C1 → PTC6 SDA · PTC7 SCL',s:'100 kHz · Open-Drain',c:0xe5484d}],{w:7.8,d:2.2,gap:1.8,y0:1.2,z:-.5,sh:.95}); EV.show('stack4'); EV.labels([]); },
  play(){ const g=EV.groups.stack4; let ipl=true; g.slabs[1].setGlow(1,0xffd166); const tg=()=>{ if(ipl) g.slabs[2].retitle('Lpi2c_Ip_MasterSendDataBlocking','IPL 버전'); else g.slabs[2].retitle('I2c_SyncTransmit','MCAL 버전'); g.slabs[2].setGlow(1.1,ipl?0x38e07a:0xc07bff); EV.caption(ipl?'IPL 버전':'MCAL 버전 — 위 코드는 그대로',[0,8,-.5]); ipl=!ipl; EV.wait(1.5,tg); }; tg(); }}
 ]});

/* ===================== W5 인터럽트 ===================== */
let irq={count:0,led:false,busy:false};
modes.push({id:'w5',tab:'W5 인터럽트',kicker:'5주차 · SW5(PTB26) → EIRQ[13] → NVIC → ISR',title:'버튼 한 번이 코드에 닿기까지',
 steps:[
 {t:'폴링 vs 인터럽트',cam:{tx:3,ty:0,tz:2,rad:17,th:.5,ph:.95},
  html:`${pre(`폴링:     main loop → 버튼 읽기 → 처리 → 버튼 읽기 → ...
인터럽트: main 실행 중 → 버튼 edge → ${K('ISR 진입')} → 플래그 갱신 → main 복귀`)}
  <p>폴링은 단순하지만 <b>CPU를 낭비</b>하고 늦게 반응할 수 있어요. 인터럽트는 즉각 반응하지만 <b>비동기라 설계가 까다로워요</b>(공유 변수, 실행 순서).</p>
  <p>이벤트 시각과 폴링 주기를 움직여 보세요.</p>`,
  enter(){
    EV.labels(['sw5'],['sw5']); EV.glow('sw5',0x8affb0,.5); EV.show('scope'); EV.scope.show(true);
    wg(`<div class="box"><div class="row"><span>이벤트 시각</span><input id="pe" type="range" min="1" max="99" value="23"></div><div class="row"><span>폴링 주기</span><input id="pp" type="range" min="10" max="50" value="30"></div><div id="pOut" style="font-size:12.5px"></div></div>`);
    const draw=()=>{ const E=+$('pe').value, P=+$('pp').value; const poll=Math.ceil(E/P)*P; EV.scope.draw((c,W,H)=>{
      const x0=170,x1=W-50,X=t=>x0+(x1-x0)*t/100; c.font='bold 40px system-ui,"Noto Sans KR",sans-serif'; c.fillStyle='#e7ebf7'; c.fillText('폴링 vs 인터럽트: 반응 시점',40,60);
      c.font='30px system-ui,"Noto Sans KR",sans-serif'; c.fillStyle='#9aa6cf'; c.fillText('폴링',30,170); c.fillText('인터럽트',30,350);
      // 폴링 레인
      c.fillStyle='#26335f'; c.fillRect(x0,140,x1-x0,50); for(let t=P;t<=100;t+=P){ c.fillStyle=t===poll?'#35c4c4':'#6ea8ff'; c.fillRect(X(t)-5,130,10,70); }
      c.fillStyle='#4ade80'; c.fillRect(X(E)-3,100,6,120); c.font='26px sans-serif'; c.fillText('이벤트',X(E)-30,92);
      if(poll<=100){ c.fillStyle='#35c4c4'; c.fillText(`반응(+${poll-E})`,X(poll)-40,222); c.strokeStyle='#35c4c4'; c.lineWidth=3; c.beginPath(); c.moveTo(X(E),205); c.lineTo(X(poll),205); c.stroke(); }
      // 인터럽트 레인
      c.fillStyle='#26335f'; c.fillRect(x0,320,x1-x0,50); c.fillStyle='#4ade80'; c.fillRect(X(E)-3,280,6,120); c.fillStyle='#c07bff'; c.fillRect(X(E),320,30,50); c.fillStyle='#fff'; c.font='22px sans-serif'; c.fillText('ISR',X(E)+2,352);
      c.fillStyle='#6effa0'; c.font='26px sans-serif'; c.fillText('즉시 반응(+0)',X(E)+40,352);
      c.fillStyle='#6ea8ff'; c.font='24px sans-serif'; c.fillText('▮ 버튼 읽기(폴링)',x0,440); });
      $('pOut').innerHTML=`폴링 지연 <b>+${poll<=100?poll-E:'—'}</b> · 인터럽트 지연 <b>≈0</b>`; };
    $('pe').oninput=draw; $('pp').oninput=draw; draw();
  }},
 {t:'Cortex-M7 벡터 테이블',cam:{tx:0,ty:5,tz:-.5,rad:21,th:.4,ph:1.2},
  html:`<p>예외·인터럽트 핸들러 주소를 담은 배열 <code>__Vectors[]</code>.</p>
  <table><tr><th>벡터</th><th>내용</th></tr><tr><td>0</td><td>초기 스택 포인터(MSP)</td></tr><tr><td>1</td><td>Reset 핸들러</td></tr><tr><td>2</td><td>NMI</td></tr><tr><td>3</td><td>HardFault</td></tr><tr><td>0~15</td><td>ARM 코어 예외</td></tr><tr><td><b>16~</b></td><td><b>외부 인터럽트 IRQ 0~</b> (NVIC)</td></tr></table>
  <p>NVIC 레지스터: <code>ISER/ICER</code>(enable), <code>ISPR/ICPR</code>(pending), <code>IPR</code>(우선순위, <b>숫자가 작을수록 높음</b>).</p>`,
  enter(){ EV.makeStack('vec',[{t:'0 · 초기 MSP',s:'스택 포인터',c:0x4f7cff},{t:'1 · Reset_Handler',s:'리셋 시 시작점',c:0x4f7cff},{t:'2 · NMI',s:'',c:0xb05555},{t:'3 · HardFault',s:'',c:0xb05555},{t:'4 ~ 15 · 기타 코어 예외',s:'',c:0x7a6a9a},{t:'16 ~ · 외부 IRQ 0 ~',s:'NVIC 관리',c:0x2fa88a},{t:'IRQ 53 ~ 56 · SIUL2 EIRQ',s:'EIRQ 32개를 4벡터로',c:0xe56b6f}],{w:6.4,d:1.4,gap:1.35,y0:.8,z:-.5,sh:.9}); EV.show('vec'); EV.labels([]); },
  play(){ const g=EV.groups.vec; g.hl([0,1],0xffd166,1); EV.wait(1.2,()=>{ g.hl([5],0x6effa0,1); EV.wait(1.2,()=>g.hl([6],0xff8f8f,1.2)); }); }},
 {t:'EIRQ 32개 → NVIC 벡터 4개',cam:{tx:1,ty:3.5,tz:-1,rad:19,th:.35,ph:.9},
  html:`<p>외부 핀 입력은 <b>SIUL2</b>를 거쳐 인터럽트 이벤트가 되고, <b>32개 EIRQ가 4개 NVIC 벡터(IRQ 53~56)</b>로 묶여요. RTD에서는 <code>Siul2_Icu_Ip</code>가 담당.</p>
  <p>SW5(PTB26) → <b>EIRQ[13]</b> → <code>SIUL_1_IRQn</code>(EIRQ 8~15 공유) → ISR <code>SIUL2_EXT_IRQ_8_15_ISR</code>, 우선순위 <b>10</b>.</p>
  ${note('8개가 한 벡터를 <b>공유</b>하므로, 어느 EIRQ가 눌렸는지는 ISR/드라이버가 플래그로 구분해요.')}`,
  enter(){
    const g=new T.Group(); g.userData.mode=true; g.position.set(-1,3.6,-.5); g.cubes=[];
    for(let r=0;r<4;r++){ for(let c=0;c<8;c++){ const i=r*8+c; const m=EV.mat(0x3a4f9a,{emissive:0,roughness:.5}); const b=EV.rbox(.7,.5,.7,m,-4+c*.9,0,(r-1.5)*1.7,g); b.userData.i=i; g.cubes.push(b); }
      const vs=EV.slab({w:3.2,h:.6,d:1.25,color:r===1?0xe56b6f:0x7a4f9a,title:'IRQ '+(53+r),sub:r===1?'SIUL_1_IRQn':'EIRQ '+(r*8)+'~'+(r*8+7),top:false}); vs.position.set(6.2,0,(r-1.5)*1.7); g.add(vs); g['v'+r]=vs;
      const ls=EV.sprite('EIRQ '+(r*8)+'~'+(r*8+7),{size:.8,fs:60,color:'#ffffff'}); ls.position.set(-6.6,.4,(r-1.5)*1.7); g.add(ls); }
    EV.reg('eirq',g,true); EV.show('eirq'); EV.labels(['sw5','pSW'],['sw5']); EV.markPins(['SW']);
    g.cubes[13].material.color.setHex(0xffd166); g.cubes[13].material.emissive.setHex(0x7a5a10);
    const p=g.localToWorld(V(-4+5*.9,.5,(1-1.5)*1.7)); tpath('eirqp',[V(PN_SW()[0],.3,PN_SW()[1]),V(EV.CHIP.x+2.9,.3,PN_SW()[1]),V(EV.CHIP.x+2.9,2,.8),p],0x8affb0);
  },
  play(){ const g=EV.groups.eirq; EV.pathSend('eirqp',1.4,()=>{ g.cubes.slice(8,16).forEach(b=>b.material.emissive.setHex(0x3a2a70)); g.cubes[13].material.emissive.setHex(0xaa8820); g.v1.setGlow(1.2,0xff8f8f); EV.caption('EIRQ[13] → IRQ 54(SIUL_1) 벡터',[1,8,-.5]); }); }},
 {t:'인터럽트 한 번, 처음부터 끝까지',cam:{tx:1.8,ty:3,tz:0,rad:15.5,th:.4,ph:.92},
  html:`<p>SW5를 누르면: <b>Rising Edge → EIRQ[13] pending → NVIC → CPU가 8개 레지스터 자동 push → ISR(콜백) → <code>EXC_RETURN</code>으로 복귀(자동 복원) → main이 플래그를 보고 처리</b>.</p>
  ${pre(`${Cm('// 콜백 — 플래그만 갱신 (짧게!)')}
${K('void')} UserSw0_Callback(${K('void')}) {
    g_press_count++;  g_led_request ^= 1U;   ${Cm('// volatile')}
}
${Cm('// main 루프 — 무거운 일은 여기서')}
${K('if')} (g_led_request != led) { toggle LED; LCD 출력; }`)}
  ${warn('ISR 안에서 <b>LCD 출력·printf</b>는 금지. blocking I2C가 길어 다른 인터럽트가 밀려요.')}`,
  enter(){
    EV.show('die'); EV.dieHL([]); EV.labels(['sw5','led','lcd'],[]); EV.markPins(['SW','LED']);
    const fr=new T.Group(); fr.userData.mode=true; fr.position.set(EV.CHIP.x+8.4,1.0,EV.CHIP.z); fr.s=[]; ['xPSR','PC','LR','R12','R3','R2','R1','R0'].forEach((n,i)=>{ const s=EV.slab({w:2.2,h:.3,d:1.0,color:0xc07bff,title:n,sub:'',fs:46}); s.position.set(0,i*.42,0); s.visible=false; fr.add(s); fr.s.push(s); });
    EV.reg('frame',fr,true); EV.show('die','frame'); EV.fr=fr;
    EV.defLabel('frcap','스택 프레임<small>8 레지스터 자동 push</small>',v=>v.set(EV.CHIP.x+8.4,4.8,EV.CHIP.z)); EV.labels(['sw5','led','lcd','frcap'],[]);
    EV.lcd.set('Hello S32K3','Count: '+String(irq.count).padStart(4,'0')); EV.led(irq.led);
    irq.busy=false; EV.diePath('i_core',['siul2',V(EV.diePos('nvic').x+0,EV.diePos('siul2').y,EV.diePos('siul2').z),V(EV.diePos('nvic').x+0,EV.diePos('nvic').y,EV.diePos('nvic').z)],0xe56b6f);
    wg(`<div class="box"><div class="row"><button id="iPress" class="pri">SW5 누르기</button><span id="iCnt" style="font-size:13px"></span></div><div id="iOut" style="font-size:12.5px;color:#9aa6cf">재생하면 한 번의 인터럽트가 단계별로 나타나요.</div></div>`);
    $('iPress').onclick=fire; showCnt();
  },
  play(){ fire(); }},
 {t:'채터링과 디바운싱',cam:{tx:3,ty:1,tz:2,rad:18,th:.5,ph:.95},
  html:`<p>기계식 버튼은 한 번 눌러도 접점이 <b>여러 번 붙었다 떨어져요</b>. 인터럽트에서는 <b>카운터가 여러 번 증가</b>하는 현상으로 나타나요.</p>
  ${pre(`${K('if')} ((now - last) < DEBOUNCE_TICKS) { ${K('return')}; }
last = now;`)}
  <p>슬라이더로 디바운스 시간을 늘려 보세요. 일정 시간 안의 edge는 무시돼요.</p>`,
  enter(){
    EV.labels(['sw5'],['sw5']); EV.show('scope'); EV.scope.show(true);
    wg(`<div class="box"><div class="row"><span>디바운스 창</span><input id="dbw" type="range" min="0" max="40" value="0"><span id="dbv"></span></div><div id="dbOut" style="font-size:12.5px"></div><div class="row"><button id="dbPress">눌러 보기</button></div></div>`);
    const tr=[0,3,6,11,14,22,25]; // 0.1ms 단위: 상승/하강 전이 (0에서 상승, 이후 교대)
    const draw=(prog=1)=>{ const D=+$('dbw').value; const rises=tr.filter((_,i)=>i%2===0); let last=-999,ok=0; const acc=rises.map(t=>{ if(t-last>=D||last<0){ last=t; ok++; return true; } return false; });
      if(D===0) { ok=rises.length; acc.fill(true); }
      $('dbv').textContent=(D/10).toFixed(1)+' ms'; $('dbOut').innerHTML=`raw 상승 edge <b>${rises.length}</b>번 → 카운트 <b style="color:${ok===1?'#6effa0':'#ff9b9b'}">${ok}</b>번 ${ok===1?'✔ 한 번 눌림으로 인식':'✘ 채터링으로 오염'}`;
      EV.scope.draw((c,W,H)=>{ c.fillStyle='#e7ebf7'; c.font='bold 40px system-ui,"Noto Sans KR",sans-serif'; c.fillText('PTB26 신호 (채터링)',40,60); const x0=100,x1=W-60,T=30,X=t=>x0+(x1-x0)*t/T;
        const pts=[[0,0]]; tr.forEach((t,i)=>{ pts.push([t,i%2?1:0]); pts.push([t,i%2?0:1]); }); const lastT=tr[tr.length-1]; pts.push([T,1]);
        // pts: build step wave: start low
        c.strokeStyle='#8affb0'; c.lineWidth=6; c.beginPath(); let level=0; c.moveTo(X(0),360); tr.forEach((t,i)=>{ c.lineTo(X(t),level?160:360); level=level?0:1; c.lineTo(X(t),level?160:360); }); c.lineTo(X(T*prog>lastT?T:lastT+0.0),level?160:360); c.lineTo(X(T),level?160:360); c.stroke();
        rises.forEach((t,i)=>{ c.fillStyle=acc[i]?'#6effa0':'#ff6b6b'; c.beginPath(); c.arc(X(t),130,16,0,7); c.fill(); c.fillStyle='#0a0f1e'; c.font='bold 22px sans-serif'; c.textAlign='center'; c.fillText(acc[i]?'✔':'✘',X(t),138); c.textAlign='left'; });
        if(D>0){ const t0=rises[0]; c.fillStyle='rgba(255,209,102,.16)'; c.fillRect(X(t0),110,X(t0+D)-X(t0),280); c.fillStyle='#35c4c4'; c.font='26px sans-serif'; c.fillText('디바운스 창',X(t0)+6,420); }
        c.fillStyle='#9aa6cf'; c.font='24px sans-serif'; c.fillText('● 초록=카운트됨  ● 빨강=무시됨',x0,470); }); };
    $('dbw').oninput=()=>draw(1); $('dbPress').onclick=()=>{ EV.press(true); EV.wait(.25,()=>EV.press(false)); }; draw(1);
  }},
 {t:'Tail-chaining과 ISR 3대 원칙',cam:{tx:0,ty:3,tz:-.5,rad:18,th:.3,ph:1.0},
  html:`<p><b>Tail-chaining</b>: 연속된 인터럽트는 <b>복원 → 재 push를 생략</b>하고 바로 이어 처리해서 빨라요.</p>
  <ol style="margin:.3em 0;padding-left:1.2em"><li>ISR은 <b>짧게</b> — 플래그/카운터만</li><li>ISR·main 공유 변수는 <b>volatile</b></li><li>LCD 출력·<code>printf()</code>는 ISR 밖에서</li></ol>
  <p>8개 레지스터 자동 push: <code>xPSR, PC, LR, R12, R3, R2, R1, R0</code>. 복귀는 <code>EXC_RETURN</code> 특수값.</p>`,
  enter(){
    const g=new T.Group(); g.userData.mode=true; g.position.set(0,3,-.5);
    const row=(label,items,z)=>{ const total=items.reduce((a,b)=>a+b[1]+.12,0); let x=-total/2; const ls=EV.sprite(label,{size:.6,fs:48}); ls.position.set(-8.4,.5,z); ls.scale.multiplyScalar(1.3); g.add(ls); items.forEach(([t,w,c])=>{ const s=EV.slab({w,h:.4,d:1.1,color:c,title:t,sub:'',fs:46}); s.position.set(x+w/2,0,z); g.add(s); x+=w+.12; return s; }); };
    const P=['push',1.1,0xe5963a],O=['pop',1.1,0x38b06a],A=['ISR A',2.0,0x6c8cff],Bb=['ISR B',2.0,0x9b6cff];
    row('Tail-chaining (빠름)',[P,A,Bb,O],-1.4); row('매번 복원/재 push',[P,A,O,P,Bb,O],1.2);
    EV.reg('tail',g,true); EV.show('tail'); EV.labels([]);
  }}
 ]});
function PN_SW(){ return EV.PN.SW; }
function showCnt(){ const e=$('iCnt'); if(e) e.innerHTML=`카운트 <b>${irq.count}</b> · LED <b>${irq.led?'ON':'OFF'}</b>`; }
function fire(){
  if(irq.busy) return; irq.busy=true; EV.led(irq.led); EV.dieHL([]); const fr=EV.fr; fr.s.forEach(s=>s.visible=false);
  const say=(h)=>{ const o=$('iOut'); if(o) o.innerHTML=h; };
  const q=[
   [.2,()=>{ EV.press(true); say('① 버튼 눌림 — PTB26에 <b>Rising Edge</b>'); }],
   [.9,()=>EV.pathSend('sw',.9)],
   [.9,()=>{ EV.dieHL(['siul2'],0xff8f8f,1); say('② SIUL2: 핀 입력이 <b>EIRQ[13]</b> 이벤트로 (IMCR 라우팅)'); }],
   [.5,()=>EV.pathSend('i_core',.8)],
   [.9,()=>{ EV.dieHL(['nvic'],0xc07bff,1); say('③ NVIC: <b>pending</b> + 우선순위(10) 확인 → CPU에 전달'); }],
   [.9,()=>{ EV.dieHL(['core'],0xffd166,1); say('④ CPU가 <b>8개 레지스터를 스택에 자동 push</b> (xPSR…R0)'); fr.s.forEach((s,i)=>EV.wait(i*.12,()=>s.visible=true)); }],
   [1.4,()=>{ say('⑤ <b>ISR(콜백)</b>: g_press_count++, g_led_request ^= 1 (플래그만)'); irq.count++; irq.led=!irq.led; showCnt(); EV.caption('<b>ISR 실행 중</b> — 짧게!',[0,7.4,0]); }],
   [1.1,()=>{ say('⑥ <b>EXC_RETURN</b> → 레지스터 자동 복원, main으로 복귀'); EV.press(false); [...fr.s].reverse().forEach((s,i)=>EV.wait(i*.1,()=>s.visible=false)); EV.dieHL(['core'],0x6effa0,1); }],
   [1.0,()=>{ say('⑦ main 루프가 플래그를 보고 <b>LED 토글 + LCD 카운트</b> (ISR 밖에서)'); EV.led(irq.led); EV.lcd.set('Hello S32K3','Count: '+String(irq.count).padStart(4,'0')); EV.caption('main(): LED·LCD 처리',[0,7.4,0]); }],
   [.4,()=>{ irq.busy=false; }]
  ];
  let i=0; const next=()=>{ if(i>=q.length) return; const [d,f]=q[i++]; EV.wait(d,()=>{ f(); next(); }); }; next();
}

/* ===================== W6 ADC ===================== */
const ADC={frac:.55,vref:3.3,buf:new Array(8).fill(0),idx:0,sum:0,count:0,filt:0,hw:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const knob=()=>EV.potAngle(-2.3+ADC.frac*4.6);
function adcReset(){ ADC.buf.fill(0); ADC.idx=0; ADC.sum=0; ADC.count=0; ADC.filt=0; ADC.hw=0; }
modes.push({id:'w6',tab:'W6 ADC',kicker:'6주차 · ADC1_S10 · 12-bit · HW 평균 8 + SW 이동평균 8',title:'가변저항 전압이 숫자가 되기까지',
 steps:[
 {t:'양자화와 분해능',cam:{tx:2.5,ty:2.5,tz:-.5,rad:17,th:.3,ph:.95},
  html:`<p>ADC는 연속적인 전압을 <b>정수 코드</b>로 바꿔요. 12-bit면 <b>0~4095</b>.</p>
  <p><code>V = code × Vref / 4095</code> → Vref=3.3 V면 <b>1 LSB ≈ 0.8 mV</b></p>
  ${warn('ADC 값은 "정확한 전압"이 아니에요. 센서·회로·기준전압·샘플링 조건의 결과입니다.')}
  <p>슬라이더로 가변저항을 돌려 보세요. 3D 계단은 <b>4-bit(16단계)로 단순화</b>한 그림이에요.</p>`,
  enter(){
    const g=new T.Group(); g.userData.mode=true; g.position.set(-1,2.2,-.5); g.bars=[];
    for(let i=0;i<16;i++){ const h=.35+i*.28; const m=EV.mat(0x3a4f9a,{emissive:0x000000}); const b=EV.rbox(.8,h,.9,m,(i-7.5)*.95,h/2,0,g); g.bars.push(b); }
    g.mk=new T.Mesh(new T.SphereGeometry(.28,16,16),new T.MeshBasicMaterial({color:0xffd166})); g.add(g.mk);
    EV.reg('quant',g,true); EV.show('quant'); EV.labels(['pot','pADC'],['pot']); EV.markPins(['ADC']); EV.glow('pot',0xd18bff,.35);
    wg(`<div class="box"><div class="row"><span>회전</span><input id="qv" type="range" min="0" max="1000" value="${Math.round(ADC.frac*1000)}"></div><div class="row"><span>Vref</span><button id="r33" class="on">3.3 V</button><button id="r50">5.0 V</button></div><div id="qOut" style="font-size:12.5px;line-height:1.6"></div></div>`);
    const upd=()=>{ ADC.frac=+$('qv').value/1000; const v=ADC.frac*ADC.vref, code=Math.round(ADC.frac*4095), idx=Math.min(15,Math.floor(ADC.frac*16));
      g.bars.forEach((b,i)=>{ b.material.color.setHex(i<=idx?0xffd166:0x3a4f9a); b.material.emissive.setHex(i<=idx?0x4a3a08:0); }); g.mk.position.set((idx-7.5)*.95,.35+idx*.28+.55,0); knob();
      $('r33').classList.toggle('on',ADC.vref===3.3); $('r50').classList.toggle('on',ADC.vref===5);
      $('qOut').innerHTML=`전압 <b>${v.toFixed(3)} V</b> → 코드 <b>${code}</b> (<code>0x${code.toString(16).toUpperCase()}</code>)<br>1 LSB = ${(ADC.vref/4095*1000).toFixed(3)} mV · 14-bit면 코드 ${Math.round(ADC.frac*16383)}`; };
    $('qv').oninput=upd; $('r33').onclick=()=>{ADC.vref=3.3;upd();}; $('r50').onclick=()=>{ADC.vref=5;upd();}; upd();
  }},
 {t:'SAR ADC: 비트를 위에서부터 하나씩',cam:{tx:3.6,ty:3,tz:0,rad:14,th:.12,ph:.85},
  html:`<p><b>샘플-홀드</b>가 입력 전압을 잠시 잡아 두면, <b>SAR</b>이 내부 DAC와 비교기로 <b>MSB부터 한 비트씩</b> 결정해요(이진 탐색). 12-bit는 12번 비교.</p>
  ${pre(`result = 0;
${K('for')} (b = 11; b >= 0; b--) {
    trial = result | (1 << b);
    ${K('if')} (DAC(trial) <= Vin) result = trial;  ${Cm('// 켜 두기')}
}`)}
  ${note('입력 임피던스가 높거나 샘플 시간이 짧으면 커패시터가 덜 충전돼 <b>값이 흔들려요</b>.')}`,
  enter(){
    const g=new T.Group(); g.userData.mode=true; g.position.set(0,3.3,-.5); g.cubes=[];
    for(let i=0;i<12;i++){ const c=EV.rbox(.7,.5,.7,EV.mat(0x3a4f9a,{emissive:0x000000}),-4.7+i*.855,0,1.6,g); g.cubes.push(c); const l=EV.sprite('b'+(11-i),{size:.7,fs:60}); l.position.set(-4.7+i*.855,.95,1.6); g.add(l); }
    const X=c=>-5+10*c/4095; g.X=X;
    EV.rbox(10.2,.1,.3,EV.mat(0x4a5688),0,0,-1.4,g);
    const l0=EV.sprite('0 V',{size:.5,fs:50}); l0.position.set(-5.2,.7,-1.4); g.add(l0); const l1=EV.sprite('Vref',{size:.5,fs:50}); l1.position.set(5.3,.7,-1.4); g.add(l1);
    g.vin=new T.Mesh(new T.ConeGeometry(.28,.6,16),new T.MeshBasicMaterial({color:0x4ade80})); g.vin.rotation.x=Math.PI; g.add(g.vin);
    g.dac=new T.Mesh(new T.SphereGeometry(.3,16,16),new T.MeshBasicMaterial({color:0xff9f43})); g.add(g.dac);
    const lv=EV.sprite('Vin',{size:.45,fs:50,color:'#4ade80'}); lv.position.set(0,.4,0); g.vin.add(lv); lv.rotation.x=Math.PI; lv.position.set(0,.8,0);
    EV.reg('sar',g,true); EV.show('sar'); EV.labels(['pot'],[]); EV.glow('pot',0xd18bff,.3);
    wg(`<div class="box"><div class="row"><span>Vin</span><input id="sv" type="range" min="0" max="4095" value="${Math.round(ADC.frac*4095)}"><button id="sGo">변환 시작</button></div><div id="sOut" style="font-size:12.5px;line-height:1.55"></div></div>`);
    const place=()=>{ const code=+$('sv').value; ADC.frac=code/4095; knob(); g.vin.position.set(X(code),.9,-1.4); g.dac.position.set(X(0),.25,-1.4); g.cubes.forEach(c=>{c.material.color.setHex(0x3a4f9a);c.material.emissive.setHex(0);}); $('sOut').innerHTML=`Vin 코드 목표: <b>${code}</b> (${code.toString(2).padStart(12,'0')}b)`; };
    $('sv').oninput=place; place();
    EV.runSAR=()=>{ const code=+$('sv').value; place(); let res=0,b=11; const log=[]; const stepBit=()=>{ if(b<0){ $('sOut').innerHTML=`<b style="color:#6effa0">완료: ${res}</b> = ${res.toString(2).padStart(12,'0')}b<br>`+log.join(''); return; }
        const trial=res|(1<<b), ci=11-b; const from=g.dac.position.x, to=X(trial);
        EV.tween(.28,k=>{ g.dac.position.x=from+(to-from)*k; },()=>{ const keep=trial<=code; if(keep) res=trial; g.cubes[ci].material.color.setHex(keep?0x38e07a:0x7a3a3a); g.cubes[ci].material.emissive.setHex(keep?0x1a6a3a:0x401818);
          log.push(`b${b}: 시험 ${trial} ${keep?'≤':'>'} Vin → <b>${keep?1:0}</b><br>`); $('sOut').innerHTML=log.slice(-3).join(''); b--; EV.wait(.22,stepBit); }); }; stepBit(); };
    $('sGo').onclick=EV.runSAR;
  },
  play(){ EV.runSAR(); }},
 {t:'가변저항에서 ADC1_S10까지',cam:{tx:-1,ty:3,tz:0,rad:21,th:.35,ph:.9},
  html:`<p>보드의 가변저항 <b>ADC_POT0(R393)</b> → <b>PTA11</b> → <b>ADC1 채널 S10</b>.</p>
  ${warn('<b>핀이 곧 채널</b>이에요. 채널은 고르는 게 아니라 핀이 결정합니다. <b>ADC0이 아니라 ADC1!</b>')}
  <p>ADC0/ADC1 두 개가 있고, 변환 모드는 단발(One-shot) / 연속 / 트리거(eMIOS·BCTU). 이번 실습은 <b>단발 + 소프트웨어 트리거</b>.</p>`,
  enter(){
    EV.show('die'); EV.dieHL(['adc'],0xb36bff,1); EV.labels(['pot','pADC'],['pot']); EV.markPins(['ADC']); EV.glow('pot',0xd18bff,.4);
    const a=EV.diePos('adc',.4); tpath('adcDie',[V(EV.PN.ADC[0],.3,EV.PN.ADC[1]),V(EV.PN.ADC[0],.3,2.6),V(EV.CHIP.x+2.2,1.2,2.6),a],0xd18bff);
    wg(`<div class="box"><div style="font-size:13px;margin-bottom:6px">PTA11은 어느 ADC의 채널일까요?</div><div class="row"><button id="qa0">ADC0 S10</button><button id="qa1">ADC1 S10</button></div><div id="qaOut" style="font-size:12.5px"></div></div>`);
    $('qa0').onclick=()=>{ $('qaOut').innerHTML='<b style="color:#ff9b9b">✘</b> ADC0이 아니에요. 핀이 채널을 결정해요.'; }; $('qa1').onclick=()=>{ $('qaOut').innerHTML='<b style="color:#6effa0">✔</b> PTA11 = ADC1_S10'; };
  },
  play(){ let k=0; const sweep=()=>{ EV.tween(1.6,t=>{ ADC.frac=t; knob(); },()=>{ EV.tween(1.0,t=>{ ADC.frac=1-t*.45; knob(); }); }); }; sweep(); EV.pathFlow('adc',true,.35); EV.pathFlow('adcDie',true,.35); }},
 {t:'하드웨어 평균 8 × 소프트웨어 이동평균 8',cam:{tx:1.5,ty:3,tz:-.5,rad:15,th:.2,ph:.85},
  html:`<p>변환 한 번에 같은 채널을 <b>8회</b> 연속 변환해 평균 하나를 저장(<code>MCR[AVGEN]=1, AVGS</code>) → 그걸 <b>최근 8개 이동 평균</b>. filtered 1개 = <b>8 × 8 = 64회 변환</b>.</p>
  <table><tr><th></th><th>HW 묶음 평균</th><th>SW 이동 평균</th></tr><tr><td>대상</td><td>연속 변환 8개</td><td>지난 8번 읽은 값</td></tr><tr><td>이전 값 기억</td><td>없음</td><td>있음(원형 버퍼)</td></tr><tr><td>줄이는 노이즈</td><td>순간 노이즈</td><td>읽기 사이 흔들림</td></tr><tr><td>비용</td><td>변환 시간↑</td><td>N번 읽어야 반영</td></tr></table>
  ${pre(`sum -= buf[index];  buf[index] = sample;  sum += sample;
index = (index + 1) % N;  ${K('if')}(count < N) count++;
${K('return')} sum / count;  ${Cm('// 초기엔 채운 개수로 나눔')}`)}`,
  enter(){
    adcReset(); const g=new T.Group(); g.userData.mode=true; g.position.set(0,2.6,-.5); g.bars=[];
    for(let i=0;i<8;i++){ const m=EV.mat(0x3a6fd1,{emissive:0x000000}); const b=EV.rbox(.85,1,.85,m,-3.5+i*1.0,.5,0,g); b.scale.y=.02; b.position.y=.01; g.bars.push(b); }
    g.hw=EV.slab({w:2.8,h:.5,d:1.4,color:0xb36bff,title:'HW 평균 ×8',sub:'ADC 내부',fs:40}); g.hw.position.set(-7.0,.3,0); g.add(g.hw);
    g.out=EV.slab({w:2.8,h:.5,d:1.4,color:0x2fa88a,title:'filtered',sub:'—',fs:40}); g.out.position.set(6.8,.3,0); g.add(g.out);
    g.ptr=new T.Mesh(new T.ConeGeometry(.22,.5,12),new T.MeshBasicMaterial({color:0xffd166})); g.ptr.rotation.x=Math.PI; g.add(g.ptr);
    const ml=EV.sprite('원형 버퍼 buf[8]',{size:.9,fs:60}); ml.position.set(0,4.4,0); g.add(ml);
    EV.reg('ring',g,true); EV.show('ring'); EV.labels([]);
    wg(`<div class="box"><div class="row"><span>회전</span><input id="av" type="range" min="0" max="1000" value="${Math.round(ADC.frac*1000)}"><button id="aAdd">측정 +1</button></div><div id="aOut" style="font-size:12.5px;line-height:1.6"></div></div>`);
    const render=()=>{ g.bars.forEach((b,i)=>{ const h=Math.max(.02,ADC.buf[i]/4095*3.4); b.scale.y=h; b.position.y=h/2; b.material.color.setHex(i===(ADC.idx+7)%8&&ADC.count?0xffd166:0x3a6fd1); }); g.ptr.position.set(-3.5+ADC.idx*1.0,3.7,0);
      g.out.retitle('filtered',String(ADC.filt)); $('aOut').innerHTML=`hw_avg <b>${ADC.hw}</b> · sum <b>${ADC.sum}</b> · count <b>${ADC.count}</b><br>filtered = ${ADC.sum} / ${ADC.count || 1} = <b style="color:#6effa0">${ADC.filt}</b> · mV(5000) = <b>${Math.round(ADC.filt*5000/4095)}</b>`; };
    g.render=render;
    EV.addSample=()=>{ ADC.frac=+$('av').value/1000; knob(); const base=ADC.frac*4095; const hw=clamp(Math.round(base+(Math.random()-.5)*90),0,4095); ADC.hw=hw;
      ADC.sum-=ADC.buf[ADC.idx]; ADC.buf[ADC.idx]=hw; ADC.sum+=hw; ADC.idx=(ADC.idx+1)%8; ADC.count=Math.min(8,ADC.count+1); ADC.filt=Math.round(ADC.sum/ADC.count);
      g.hw.setGlow(1.2,0xffffff); EV.wait(.25,()=>g.hw.setGlow(0)); render(); };
    $('aAdd').onclick=EV.addSample; $('av').oninput=()=>{ ADC.frac=+$('av').value/1000; knob(); }; render();
  },
  play(){ let n=0; const t=()=>{ if(n++>=14) return; EV.addSample(); EV.wait(.55,t); }; t(); }},
 {t:'함정: 기본 분해능은 14-bit',cam:{tx:4,ty:0,tz:-10,rad:17,th:.15,ph:.85},
  html:`<p>분해능을 <b>12-bit로 바꾸지 않으면 기본 14-bit</b>(0~16383). 그러면 <code>mv = filtered × 5000 / 4095</code>가 <b>약 4배</b>로 표시돼요.</p>
  <table><tr><th>설정</th><th>값</th></tr><tr><td>입력</td><td>PTA11 = ADC1_S10 · 소프트웨어 트리거 · One-shot</td></tr><tr><td>분해능</td><td><b>RESOLUTION_12</b>, 우측 정렬</td></tr><tr><td>HW 평균</td><td>Enable, SAMPLES_8</td></tr></table>
  <p><b>IPL</b>: <code>Adc_Sar_Ip_StartConversion → 폴링 → GetConvData</code> / <b>MCAL</b>: 하드웨어 유닛→채널→그룹, 완료 <b>콜백</b>(ISR 안). Vref는 실제 값을 확인하세요.</p>`,
  enter(){
    EV.labels(['pot','lcd','pADC'],['lcd']); EV.glow('pot',0xd18bff,.4);
    wg(`<div class="box"><div class="row"><span>회전</span><input id="tv" type="range" min="0" max="1000" value="${Math.round(ADC.frac*1000)}"></div><div class="row"><span>분해능</span><button id="t12">12-bit (설정함)</button><button id="t14" class="on">14-bit (기본값)</button></div><div id="tOut" style="font-size:12.5px;line-height:1.6"></div></div>`);
    let bits=14; const upd=()=>{ ADC.frac=+$('tv').value/1000; knob(); const full=(1<<bits)-1; const filt=Math.round(ADC.frac*full); const mv=Math.round(filt*5000/4095), real=Math.round(ADC.frac*5000);
      $('t12').classList.toggle('on',bits===12); $('t14').classList.toggle('on',bits===14);
      EV.lcd.set('HW:'+String(filt).padStart(4,' ')+' MA:'+String(filt).padStart(4,' '),(mv/1000).toFixed(3)+' V',null);
      $('tOut').innerHTML=`코드 범위 0~${full} · filtered <b>${filt}</b><br>표시 <b style="color:${bits===12?'#6effa0':'#ff9b9b'}">${mv} mV</b> vs 실제 ≈ ${real} mV ${bits===12?'✔':'✘ (약 4배)'}`; };
    $('tv').oninput=upd; $('t12').onclick=()=>{bits=12;upd();}; $('t14').onclick=()=>{bits=14;upd();}; upd();
  }}
 ]});
})();
