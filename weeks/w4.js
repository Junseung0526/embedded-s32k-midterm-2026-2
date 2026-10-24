// w4 페이지: 오픈 드레인 버스, I2C 프레임 파형, 스캐너, PCF8574 매핑, 4비트 전송 Stepper, DDRAM, 계층 교체, 퀴즈
(function () {
  const { h } = EV;
  const $ = (id) => document.getElementById(id);
  const hex2 = (v) => EV.hex(v, 2);

  // PCF8574 → LCD 비트 (reference/w04-i2c-lcd.md)
  const LCD_RS = 0x01, LCD_E = 0x04, LCD_BACKLIGHT = 0x08, LCD_DATA_MASK = 0xf0;
  const PCF_FIELDS = [
    { name: "DB7~4", lo: 4, hi: 7 },
    { name: "BL", lo: 3, hi: 3 },
    { name: "E", lo: 2, hi: 2 },
    { name: "RW", lo: 1, hi: 1 },
    { name: "RS", lo: 0, hi: 0 },
  ];

  /* ---------- 01. 오픈 드레인 ---------- */
  {
    const devs = ["마스터 (S32K312)", "PCF8574 (0x27)", "다른 장치"].map((name) => ({ name, low: false }));
    const btns = devs.map((d) =>
      $("odDevs").appendChild(h("div", { class: "od-dev" }, h("small", {}, d.name), h("button", { class: "key", type: "button", onclick: () => ((d.low = !d.low), draw()) })))
    );
    function draw() {
      const push = $("odPush").checked;
      const anyLow = devs.some((d) => d.low);
      const anyHigh = devs.some((d) => !d.low);
      const short = push && anyLow && anyHigh;
      btns.forEach((el, i) => (el.querySelector("button").textContent = devs[i].low ? "LOW로 당기는 중" : push ? "HIGH로 미는 중" : "놓음 (High-Z)"));
      $("odLine").classList.toggle("low", anyLow && !short);
      $("odLine").classList.toggle("short", short);
      $("odLevel").textContent = short ? "단락!" : anyLow ? "LOW" : "HIGH";
      $("odNote").textContent = short
        ? "Push-Pull이면 한쪽은 VDD로, 한쪽은 GND로 세게 미니까 두 출력 사이로 큰 전류가 흘러요. 그래서 버스에는 오픈 드레인을 써요."
        : push
          ? "모두 같은 레벨을 낼 때는 괜찮지만, 하나만 다르게 내면 바로 단락이에요. 장치 하나를 LOW로 바꿔 보세요."
          : anyLow
            ? "한 장치라도 당기면 선 전체가 LOW예요. 나머지는 손을 놓고 있을 뿐이라 부딪히지 않아요."
            : "아무도 안 당기니까 풀업 저항이 선을 HIGH로 끌어올려요. 이게 버스가 비어 있는(idle) 상태예요.";
    }
    $("odPush").addEventListener("input", draw);
    draw();
  }

  /* ---------- 02. I2C 프레임 파형 ---------- */
  {
    let rw = 0, nack = false, pos = 0, segs = [];
    const readHex = (id) => {
      const v = parseInt($(id).value, 16);
      return Number.isNaN(v) ? 0 : v;
    };

    function build() {
      const addr = readHex("fAddr") & 0x7f, data = readHex("fData") & 0xff;
      segs = [{ k: "start", label: "S" }];
      for (let b = 6; b >= 0; b--) segs.push({ k: "addr", label: "A" + b, v: (addr >> b) & 1, b, addr });
      segs.push({ k: "rw", label: "R/W", v: rw });
      segs.push({ k: "ack", label: nack ? "NACK" : "ACK", v: nack ? 1 : 0, first: true });
      if (!nack) {
        for (let b = 7; b >= 0; b--) segs.push({ k: "data", label: "D" + b, v: (data >> b) & 1, b });
        segs.push({ k: "ack", label: "ACK", v: 0 });
      }
      segs.push({ k: "stop", label: "P" });
      $("fPos").max = segs.length - 1;
      pos = Math.min(pos, segs.length - 1);
      $("fByte").innerHTML = `버스로 나가는 첫 바이트 = (0x${addr.toString(16).toUpperCase().padStart(2, "0")} &lt;&lt; 1) | R/W ${rw} = <b>${hex2(((addr << 1) | rw) & 0xff)}</b>  ← API에는 7비트 값 ${hex2(addr)} 그대로`;
    }

    const W = 36, X0 = 56, SCL_H = 16, SCL_L = 44, SDA_H = 72, SDA_L = 100;
    // [x, y] 전환점 목록을 계단 모양 path로
    const stairs = (startY, pts, endX) => {
      let d = `M10 ${startY}`;
      for (const [x, y] of pts) d += ` H${x.toFixed(1)} V${y}`;
      return d + ` H${endX}`;
    };

    function draw() {
      const end = X0 + segs.length * W + 20;
      const scl = [], sda = [];
      let rects = "", labels = "";
      segs.forEach((s, i) => {
        const x = X0 + i * W;
        if (s.k === "start") {
          sda.push([x + W * 0.45, SDA_L]);
          scl.push([x + W * 0.8, SCL_L]);
        } else if (s.k === "stop") {
          sda.push([x + W * 0.1, SDA_L], [x + W * 0.6, SDA_H]);
          scl.push([x + W * 0.25, SCL_H]);
        } else {
          sda.push([x + W * 0.1, s.v ? SDA_H : SDA_L]);
          scl.push([x + W * 0.3, SCL_H], [x + W * 0.7, SCL_L]);
        }
        const cur = i === pos ? " cur" : "";
        rects += `<rect class="slot${cur}" x="${x}" y="4" width="${W}" height="108"/>`;
        labels += `<text class="${cur.trim()}" x="${x + W / 2}" y="126" text-anchor="middle">${s.label}</text>`;
        if (s.v !== undefined) labels += `<text class="${cur.trim()}" x="${x + W / 2}" y="140" text-anchor="middle">${s.v}</text>`;
      });
      $("frameSvg").innerHTML = `
<svg class="frame" viewBox="0 0 ${end} 146" role="img" aria-label="I2C 프레임 SDA SCL 파형">
  ${rects}
  <text class="lane" x="4" y="34">SCL</text><text class="lane" x="4" y="90">SDA</text>
  <path class="scl" d="${stairs(SCL_H, scl, end)}"/>
  <path class="sda" d="${stairs(SDA_H, sda, end)}"/>
  ${labels}
</svg>`;
      $("fPos").value = pos;
      $("fNote").textContent = noteFor(segs[pos]);
    }

    function noteFor(s) {
      if (s.k === "start") return "START: SCL이 HIGH인 동안 SDA가 HIGH → LOW로 떨어져요. 평소엔 절대 안 하는 일이라 '이제 시작'이라는 신호가 돼요.";
      if (s.k === "addr") return `주소 비트 A${s.b} = ${s.v}. 7비트 주소 ${hex2(s.addr)}를 MSB(A6)부터 보내요. SDA는 SCL이 LOW일 때 바뀌고, HIGH인 동안엔 가만히 있어요.`;
      if (s.k === "rw") return `R/W = ${s.v} → ${s.v ? "읽기" : "쓰기"}. 주소 7비트 + 이 1비트가 버스 첫 바이트가 돼요.`;
      if (s.k === "ack" && s.v) return "9번째 클럭에 아무도 SDA를 안 당겨서 풀업 때문에 HIGH로 남아요 = NACK. 그 주소엔 장치가 없다는 뜻이라 마스터는 STOP을 보내요.";
      if (s.k === "ack") return `9번째 클럭: 받는 쪽이 SDA를 LOW로 당겨서 ACK("${s.first ? "나 여기 있어요" : "잘 받았어요"}")를 줘요.`;
      if (s.k === "data") return `데이터 비트 D${s.b} = ${s.v}. 8비트를 MSB부터 보내요.`;
      return "STOP: SCL이 HIGH인 동안 SDA가 LOW → HIGH로 올라가요. 버스가 다시 비어요.";
    }

    const go = (p) => ((pos = Math.max(0, Math.min(segs.length - 1, p))), draw());
    $("fPrev").addEventListener("click", () => go(pos - 1));
    $("fNext").addEventListener("click", () => go(pos + 1));
    $("fPos").addEventListener("input", () => go(Number($("fPos").value)));
    $("fRw").addEventListener("click", () => {
      rw ^= 1;
      $("fRw").textContent = `R/W = ${rw} (${rw ? "읽기" : "쓰기"})`;
      $("fRw").setAttribute("aria-pressed", rw === 1);
      build(); draw();
    });
    $("fNack").addEventListener("click", () => {
      nack = !nack;
      $("fNack").setAttribute("aria-pressed", nack);
      build(); draw();
    });
    ["fAddr", "fData"].forEach((id) => $(id).addEventListener("input", () => (build(), draw())));
    build(); draw();
  }

  /* ---------- 03. 스캐너 ---------- */
  {
    let chip = 0x27, running = false;
    const cells = [];
    for (let a = 0; a <= 0x77; a++) {
      cells[a] = $("scanGrid").appendChild(h("span", { class: a < 3 ? "pad" : "" }, a.toString(16).toUpperCase().padStart(2, "0")));
    }
    document.querySelectorAll("#scanLab [data-chip]").forEach((b) =>
      b.addEventListener("click", () => {
        if (running) return;
        chip = parseInt(b.dataset.chip, 16);
        document.querySelectorAll("#scanLab [data-chip]").forEach((x) => x.setAttribute("aria-pressed", x === b));
        reset();
      })
    );
    function reset() {
      cells.forEach((c) => c.classList.remove("probe", "ack", "nack"));
      $("scanOut").textContent = "0x03부터 0x77까지 차례로 두드려 봐요.";
    }
    $("scanBtn").addEventListener("click", async () => {
      if (running) return;
      running = true;
      reset();
      for (let a = 3; a <= 0x77; a++) {
        cells[a].classList.add("probe");
        await EV.sleep(a === chip ? 300 : 14);
        cells[a].classList.remove("probe");
        cells[a].classList.add(a === chip ? "ack" : "nack");
      }
      $("scanOut").innerHTML = `발견: <b>${hex2(chip)}</b> 에서만 ACK. 이 값을 <code>Lcd1602_Init(${hex2(chip)}U)</code>에 그대로 넣어요.`;
      running = false;
    });
    reset();
  }

  /* ---------- 04. PCF8574 매핑 ---------- */
  {
    const pins = {};
    for (const key of ["RS", "RW", "E", "BL", "DB"]) pins[key] = $("pcfPins").appendChild(h("div", { class: "pcf-pin" }, h("small"), h("b")));
    const reg = EV.register($("pcfReg"), { name: "PCF8574 출력 P7..P0", bits: 8, fields: PCF_FIELDS, editable: true, value: LCD_BACKLIGHT, onChange: show });
    function set(key, label, text, hot) {
      pins[key].firstChild.textContent = label;
      pins[key].lastChild.textContent = text;
      pins[key].classList.toggle("hot", !!hot);
    }
    function show() {
      const v = reg.value;
      set("RS", "P0 → RS", v & LCD_RS ? "1 = 데이터 레지스터(DR)" : "0 = 명령 레지스터(IR)", v & LCD_RS);
      set("RW", "P1 → R/W", v & 0x02 ? "1 = 읽기 (실습에선 안 씀)" : "0 = 쓰기", v & 0x02);
      set("E", "P2 → E", v & LCD_E ? "1 (내려갈 때 래치)" : "0", v & LCD_E);
      set("BL", "P3 → 백라이트", v & LCD_BACKLIGHT ? "켜짐" : "꺼짐", v & LCD_BACKLIGHT);
      const nib = (v & LCD_DATA_MASK) >> 4;
      set("DB", "P7..P4 → DB7..DB4", `${nib.toString(2).padStart(4, "0")} (니블 0x${nib.toString(16).toUpperCase()})`, nib);
    }
    show();
  }

  /* ---------- 05. 4비트 전송 Stepper ---------- */
  {
    const side = h("div");
    const pcf = EV.register(side.appendChild(h("div")), { name: "PCF8574 핀 (I2C로 보낸 값)", bits: 8, fields: PCF_FIELDS, stateKey: "PCF" });
    const val = EV.register(side.appendChild(h("div")), { name: "value (지역 변수)", bits: 8, fields: PCF_FIELDS, stateKey: "VAL" });

    const eRow = side.appendChild(h("div", { class: "eline" }, "E", h("span", { html: '<svg viewBox="0 0 140 28"><path d=""/></svg>' }), h("span", { class: "latch" }, "↓ 래치!")));
    const nibRow = side.appendChild(h("div", { class: "nibs" }, "LCD가 받은 니블:", h("span"), h("span")));
    const out = side.appendChild(h("div", { class: "row" }));
    const writes = out.appendChild(h("span", { class: "chip" }));
    const lcd = out.appendChild(h("div", { class: "mini-lcd" }));
    const lcdCells = Array.from({ length: 8 }, () => lcd.appendChild(h("span")));

    const viz = {
      render(s) {
        // E 선 기록을 계단 파형으로
        const step = 140 / 6;
        let d = `M0 22`, x = 0;
        for (const e of s.eHist) { x += step; d += ` H${x} V${e ? 6 : 22}`; }
        eRow.querySelector("path").setAttribute("d", d + " H140");
        eRow.querySelector(".latch").classList.toggle("show", !!s.latch);
        nibRow.querySelectorAll("span").forEach((el, i) => {
          el.textContent = s.nibs[i] ?? "-";
          el.classList.toggle("got", s.nibs[i] != null);
        });
        writes.textContent = `I2C 쓰기 ${s.writes}번`;
        lcdCells.forEach((c, i) => (c.textContent = i === 0 ? s.ch : " "));
      },
    };

    const tx = (s, byte, e, extra = {}) => ({ ...s, regs: { ...s.regs, PCF: byte }, eHist: [...s.eHist, e], writes: s.writes + 1, latch: false, ...extra });

    EV.stepper($("nibbleStepper"), {
      title: "Lcd1602_Putc('A')",
      code: `
static void Lcd1602_PulseEnable(uint8_t value)
{
    I2c_Lcd1602_Write(value | LCD_E);
    Lcd1602_Delay(2000U);
    I2c_Lcd1602_Write(value & (uint8_t)(~LCD_E));
    Lcd1602_Delay(2000U);
}

static void Lcd1602_WriteNibble(uint8_t nibble, uint8_t isData)
{
    uint8_t value = (uint8_t)(nibble & LCD_DATA_MASK) | LCD_BACKLIGHT;
    if (isData != 0U) { value |= LCD_RS; }
    Lcd1602_PulseEnable(value);
}

static void Lcd1602_WriteByte(uint8_t value, uint8_t isData)
{
    Lcd1602_WriteNibble(value, isData);
    Lcd1602_WriteNibble((uint8_t)(value << 4U), isData);
    Lcd1602_Delay(5000U);
}

void Lcd1602_Putc(char c)
{
    Lcd1602_WriteByte((uint8_t)c, 1U);
}`,
      initial: { regs: { PCF: LCD_BACKLIGHT, VAL: 0 }, eHist: [], nibs: [], writes: 0, latch: false, ch: " " },
      intro: "백라이트만 켜진 상태(0x08)에서 시작해요. 아래쪽 Putc부터 위로 따라 올라가요.",
      side,
      views: [pcf, val, viz],
      steps: [
        { line: 25, note: "'A'의 ASCII 코드는 0x41(0100 0001)이에요. 데이터니까 isData = 1로 WriteByte를 불러요.", apply: (s) => s },
        { line: 18, note: "상위 니블부터 보내요. 0x41을 그대로 넘기고, 안에서 0xF0 마스크로 위 4비트(0100)만 남길 거예요.", apply: (s) => s },
        { line: 11, note: "0x41 & 0xF0 = 0x40, 여기에 백라이트 0x08을 OR → 0x48. 데이터 비트는 P7~P4(DB7~DB4) 자리에 그대로 있어요.", apply: (s) => ({ ...s, regs: { ...s.regs, VAL: (0x41 & LCD_DATA_MASK) | LCD_BACKLIGHT } }) },
        { line: 12, note: "데이터라서 RS = 1 → 0x49. (명령이었다면 RS = 0)", apply: (s) => ({ ...s, regs: { ...s.regs, VAL: s.regs.VAL | LCD_RS } }) },
        { line: 3, note: "I2C 쓰기 ①: E를 켠 0x4D를 보내요. PCF8574의 P2(E)가 1이 돼요. LCD는 아직 안 읽어요.", apply: (s) => tx(s, s.regs.VAL | LCD_E, 1), predict: { q: "value(0x49)에 E(0x04)를 켜서 보내는 바이트는?", choices: ["0x49", "0x4D", "0x45", "0x4C"], answer: 1 } },
        { line: 5, note: "I2C 쓰기 ②: E만 끈 0x49. E가 1 → 0으로 떨어지는 순간 LCD가 DB7~DB4의 0100(4)을 래치해요!", apply: (s) => tx(s, s.regs.VAL & ~LCD_E, 0, { latch: true, nibs: ["4"] }) },
        { line: 19, note: "하위 니블. 0x41 << 4 = 0x410인데 uint8_t로 잘려서 0x10. 아래 4비트(0001)가 위 자리로 올라왔어요.", apply: (s) => ({ ...s, latch: false }) },
        { line: [11, 12], note: "같은 과정: 0x10 & 0xF0 = 0x10, 백라이트와 RS를 더해 0x19.", apply: (s) => ({ ...s, regs: { ...s.regs, VAL: (0x10 & LCD_DATA_MASK) | LCD_BACKLIGHT | LCD_RS } }) },
        { line: 3, note: "I2C 쓰기 ③: E를 켠 0x1D.", apply: (s) => tx(s, s.regs.VAL | LCD_E, 1) },
        { line: 5, note: "I2C 쓰기 ④: E를 끈 0x19. 두 번째 래치로 LCD가 4와 1을 합쳐 0x41 = 'A'를 DDRAM에 쓰고 화면에 띄워요.", apply: (s) => tx(s, s.regs.VAL & ~LCD_E, 0, { latch: true, nibs: ["4", "1"], ch: "A" }) },
        { line: 20, note: "LCD가 처리할 시간을 주고 끝. 글자 하나에 I2C 쓰기가 4번 들었어요.", apply: (s) => ({ ...s, latch: false }) },
      ],
    });
  }

  /* ---------- 06. DDRAM ---------- */
  {
    const cells = [];
    for (let i = 0; i < 32; i++) cells.push($("lcd16").appendChild(h("span")));
    function draw() {
      const row = Number($("ddRow").value), col = Number($("ddCol").value);
      const rows = ["Hello S32K3".padEnd(16), " ".repeat(16)].map((r) => r.split(""));
      $("ddText").value.slice(0, 16 - col).split("").forEach((c, i) => (rows[row][col + i] = c));
      rows.flat().forEach((c, i) => {
        cells[i].textContent = c;
        cells[i].classList.toggle("cur", i === row * 16 + col);
      });
      const base = row ? 0x40 : 0x00;
      $("ddCalc").innerHTML =
        `Lcd1602_SetCursor(${row}, ${col}) → 명령 0x80 | ${hex2(base)} | ${col} = <b>${hex2(0x80 | base | col)}</b> · DDRAM 주소 ${hex2(base + col)}` +
        (col === 0 ? ` <span class="hint">(${row ? "2행 시작 = 0xC0" : "1행 시작 = 0x80"})</span>` : "");
    }
    ["ddRow", "ddCol", "ddText"].forEach((id) => $(id).addEventListener("input", draw));
    draw();
  }

  /* ---------- 07. 계층 교체 ---------- */
  {
    const DRV = {
      ipl: {
        box: "RTD IPL: Lpi2c_Ip_MasterSendDataBlocking()",
        code: `
static void I2c_Lcd1602_Write(uint8_t value)
{
    uint8_t tx = value;
    (void)Lpi2c_Ip_MasterSendDataBlocking(1U, &tx, 1U, TRUE, 100U);
}`,
      },
      mcal: {
        box: "RTD MCAL (CDD): I2c_SyncTransmit()",
        code: `
static void I2c_Lcd1602_Write(uint8_t value)
{
    uint8_t tx = value;
    (void)I2cMcal_SyncWrite(g_lcd_addr, &tx, 1U);  // 속: I2c_SyncTransmit(0U, &request)
}`,
      },
    };
    function pick(key) {
      document.querySelectorAll("#layerLab [data-drv]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.drv === key));
      $("drvBox").textContent = DRV[key].box;
      EV.pulse($("drvBox"), "flip");
      EV.codeBlock($("drvCode"), DRV[key].code);
    }
    document.querySelectorAll("#layerLab [data-drv]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.drv)));
    pick("ipl");
  }

  /* ---------- 08. 퀴즈 ---------- */
  EV.quiz($("quiz"), [
    { q: "7비트 주소 0x27인 LCD 백팩에 쓰기를 할 때, 버스로 실제로 나가는 첫 바이트는?", choices: ["0x27", "0x4E", "0x4F", "0x13"], answer: 1, why: "0x27을 왼쪽으로 1칸 밀고 W 비트 0을 붙이면 0100 1110 = 0x4E예요. 0x4F는 읽기(R=1)일 때예요. RTD API에는 0x4E가 아니라 7비트 0x27을 넣어요." },
    { q: "HD44780 LCD가 PCF8574에서 온 데이터 니블을 받아들이는(래치) 순간은?", choices: ["E가 0 → 1로 올라갈 때", "E가 1 → 0으로 떨어질 때", "SCL이 HIGH일 때마다", "ACK를 보낼 때"], answer: 1, why: "E 하강 에지예요. 그래서 니블마다 E=1인 값과 E=0인 값을 연달아 보내고, 글자 하나에 I2C 쓰기가 최소 4번 필요해요." },
    { q: "S32K3 RTD에서 I2C 드라이버가 AUTOSAR 정식 표준 모듈이 아니라 어떤 형태로 제공되는가?", answer: "CDD (Complex Device Driver)", why: "AUTOSAR 표준 BSW에는 CAN, LIN, FlexRay, SPI 같은 차량 주력 버스만 들어 있어요. I2C는 센서·디스플레이용 부가 버스라, 표준 API 모양(Std_ReturnType, 초기화 규격)만 따르는 CDD_I2c로 제공돼요." },
  ]);
})();
