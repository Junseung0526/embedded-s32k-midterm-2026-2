// w2 페이지: Memory-Mapped I/O, MSCR 위젯, 읽기-수정-쓰기, GPDO 역순 지도, main.c Stepper, 퀴즈
(function () {
  const { h } = EV;
  const $ = (id) => document.getElementById(id);

  const SIUL2_BASE = 0x40290000;
  const MSCR_OFFSET = 0x0240;
  const GPDO_OFFSET = 0x1300;
  const OBE = 1 << 21; // 0x00200000
  const SSS_MASK = 0xf;
  const mscrAddr = (n) => SIUL2_BASE + MSCR_OFFSET + 4 * n;
  // GPDO는 4바이트 묶음 안에서 역순: n & ~3 이 묶음 시작, 3 - (n & 3) 이 묶음 안 위치
  const gpdoOffset = (n) => GPDO_OFFSET + (n & ~3) + (3 - (n & 3));

  /* ---------- 01. Memory-Mapped I/O ---------- */
  {
    const REGIONS = [
      ["code", "Code Flash", "실행 코드"],
      ["dflash", "Data Flash", "전원 꺼져도 남는 설정값"],
      ["sram", "SRAM", "변수 counter가 여기"],
      ["tcm", "TCM", "빠른 코드/데이터"],
      ["gpdo", "Peripheral", "SIUL2 GPDO29 = 0x4029131E"],
    ];
    const regionEls = {};
    for (const [key, name, desc] of REGIONS) {
      regionEls[key] = $("mmMap").appendChild(h("div", { class: "mm-region" }, h("b", {}, name), h("small", {}, desc)));
    }
    let target = "sram";
    const sramB = $("mmSram").querySelector("b");
    const led = $("mmBoard").querySelector(".led");

    function pick(t) {
      target = t;
      document.querySelectorAll("#mmio [data-target]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.target === t));
      Object.entries(regionEls).forEach(([k, el]) => el.classList.toggle("target", k === t));
      $("mmioNote").textContent = t === "sram"
        ? "지금 ptr은 SRAM에 있는 변수 counter를 가리켜요. 실행하면 메모리 한 칸의 숫자만 바뀌어요."
        : "지금 ptr은 GPIO 출력 레지스터 GPDO29를 가리켜요. 실행하면 PTA29 핀 전압이 바로 바뀌고 LED가 켜져요.";
    }
    $("mmio").querySelectorAll("[data-target]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.target)));
    $("mmioRun").addEventListener("click", () => {
      EV.pulse(regionEls[target], "hit");
      if (target === "sram") {
        sramB.textContent = "1";
        EV.pulse($("mmSram"), "hit");
      } else {
        led.classList.add("on");
        led.lastChild.textContent = "켜짐";
        EV.pulse($("mmBoard"), "hit");
      }
    });
    $("mmioReset").addEventListener("click", () => {
      sramB.textContent = "0";
      led.classList.remove("on");
      led.lastChild.textContent = "꺼짐";
    });
    pick("sram");
  }

  /* ---------- 03. MSCR 위젯 ---------- */
  const MSCR_FIELDS = [
    { name: "OBE", lo: 21, hi: 21 },
    { name: "SSS", lo: 0, hi: 3 },
  ];
  {
    const reg = EV.register($("mscrReg"), {
      name: "MSCR[29]", addr: EV.hex(mscrAddr(29)), fields: MSCR_FIELDS, editable: true, value: 0x3,
      onChange: explain,
    });
    function explain() {
      const v = reg.value;
      const obe = (v & OBE) !== 0;
      const sss = v & SSS_MASK;
      const ready = obe && sss === 0;
      $("mscrRead").innerHTML =
        `OBE = ${obe ? 1 : 0} → ${obe ? "출력 버퍼 켜짐" : "출력 버퍼 꺼짐"} · ` +
        `SSS = ${sss} → ${sss === 0 ? "GPIO 기능" : `GPIO가 아닌 다른 기능 번호 ${sss}`}<br>` +
        (ready ? '<span class="ok">✓ GPIO 출력으로 쓸 준비 완료</span>' : '<span class="no">아직 GPIO 출력이 아니에요</span>');
    }
    $("mscrGoal").addEventListener("click", () => (reg.set(OBE), explain()));
    $("mscrClear").addEventListener("click", () => (reg.set(0), explain()));
    explain();
  }

  // MSCR[n] 주소 계산기
  function drawMscrCalc() {
    const n = Number($("mscrN").value);
    $("mscrNLabel").textContent = `MSCR[${n}]`;
    $("mscrCalc").innerHTML =
      `0x40290000 + 0x0240 + 4 × ${n} = 0x40290000 + 0x0240 + ${4 * n}(10진수) = 0x40290000 + 0x0240 + ${EV.hex(4 * n, 2)} = <b>${EV.hex(mscrAddr(n))}</b>`;
  }
  $("mscrN").addEventListener("input", drawMscrCalc);
  drawMscrCalc();

  /* ---------- 03-2. 읽기-수정-쓰기 Stepper ---------- */
  {
    const side = h("div");
    const local = EV.register(side.appendChild(h("div")), { name: "value (지역 변수)", fields: MSCR_FIELDS, stateKey: "value" });
    const mscr = EV.register(side.appendChild(h("div")), { name: "MSCR[29]", addr: EV.hex(mscrAddr(29)), fields: MSCR_FIELDS, stateKey: "MSCR29" });
    const bus = side.appendChild(h("p", { class: "addrline" }));
    const busView = { render: (s) => (bus.innerHTML = s.bus ? `버스: <b>${s.bus}</b>` : "버스: (아직 접근 없음)") };

    EV.stepper($("rmwStepper"), {
      title: "GpioBare_SetOutput(29)",
      code: `
static inline void GpioBare_SetOutput(uint32_t mscrIndex)
{
    uint32_t value = SIUL2_MSCR(mscrIndex);
    value &= ~SIUL2_MSCR_SSS_MASK;
    value |= SIUL2_MSCR_OBE_MASK;
    value |= SIUL2_MSCR_SSS_GPIO;
    SIUL2_MSCR(mscrIndex) = value;
}`,
      initial: { regs: { value: 0, MSCR29: 0x3 }, bus: "" },
      intro: "MSCR[29]에 예시로 SSS = 3(다른 기능)이 들어 있다고 해 볼게요. 우리는 OBE와 SSS만 바꾸고 나머지 비트는 그대로 둬야 해요.",
      side,
      views: [local, mscr, busView],
      steps: [
        { line: 3, note: "읽기: 매크로가 0x402902B4 번지에서 32비트를 읽어 value에 복사해요. 지금부터는 레지스터가 아니라 지역 변수를 고쳐요.", apply: (s) => ({ ...s, regs: { ...s.regs, value: s.regs.MSCR29 }, bus: "읽기 0x402902B4 → " + EV.hex(s.regs.MSCR29) }) },
        { line: 4, note: "SSS 필드(비트 3:0)를 먼저 0으로 지워요. ~0xF와 AND하면 하위 4비트만 0이 돼요.", apply: (s) => ({ ...s, regs: { ...s.regs, value: s.regs.value & ~SSS_MASK } }) },
        { line: 5, note: "OBE(비트 21)를 켜요. 1UL << 21 = 0x00200000.", apply: (s) => ({ ...s, regs: { ...s.regs, value: (s.regs.value | OBE) >>> 0 } }) },
        { line: 6, note: "SSS에 GPIO 값(0)을 넣어요. 0을 OR하니까 실제로 바뀌는 건 없지만, '필드 변경 = 지우고 넣기' 패턴을 코드로 드러내려고 써요.", apply: (s) => s },
        { line: 7, note: "쓰기: 고친 value를 다시 0x402902B4에 써요. 이 순간 PTA29가 GPIO 출력 핀이 돼요. → 0x00200000", apply: (s) => ({ ...s, regs: { ...s.regs, MSCR29: s.regs.value }, bus: "쓰기 0x402902B4 ← " + EV.hex(s.regs.value) }), predict: { q: "MSCR[29]에 최종으로 써지는 값은?", choices: ["0x00200003", "0x00200000", "0x00000003"], answer: 1 } },
      ],
    });
  }

  /* ---------- 04. GPDO 역순 지도 ---------- */
  {
    const bytes = [];
    for (let k = 0; k < 32; k++) {
      const holder = (k & ~3) + (3 - (k & 3));
      bytes.push($("gpdoMap").appendChild(
        h("div", { class: "byte" + (k % 4 === 0 && k % 8 !== 0 ? " group-start" : "") }, h("small", {}, "0x" + (GPDO_OFFSET + k).toString(16).toUpperCase()), `GPDO${holder}`)
      ));
    }
    function draw() {
      const n = Number($("gpioN").value);
      const off = gpdoOffset(n);
      $("gpioLabel").textContent = `GPIO[${n}]`;
      bytes.forEach((el, k) => {
        el.classList.toggle("ok", GPDO_OFFSET + k === off);
        el.classList.toggle("wrong", k === n && GPDO_OFFSET + k !== off);
      });
      const base4 = n & ~3, r = n & 3, add = base4 + (3 - r);
      const naive = GPDO_OFFSET + n;
      $("gpdoCalc").innerHTML =
        `4의 배수 ${base4} + (3 − 나머지 ${r}) = ${add} = ${EV.hex(add, 2)} → 오프셋 <b>0x${off.toString(16).toUpperCase()}</b>, 절대 주소 <b>${EV.hex(SIUL2_BASE + off)}</b>` +
        (naive !== off ? `<br><span class="hint">0x1300 + ${n}로 계산하면 0x${naive.toString(16).toUpperCase()}인데, 거기는 GPDO${base4 + (3 - r)} 칸이에요. 다른 핀을 건드리게 돼요.</span>` : "");
    }
    $("gpioN").addEventListener("input", draw);
    draw();
  }

  /* ---------- 05. main.c Stepper ---------- */
  {
    const side = h("div");
    const mscr = EV.register(side.appendChild(h("div")), { name: "MSCR[29]", addr: EV.hex(mscrAddr(29)), fields: MSCR_FIELDS, stateKey: "MSCR29" });
    const gpdo = EV.register(side.appendChild(h("div")), { name: "GPDO29", addr: EV.hex(SIUL2_BASE + gpdoOffset(29)), bits: 8, stateKey: "GPDO29" });
    const hw = side.appendChild(h("div", { class: "row" }));
    const pin = hw.appendChild(h("span", { class: "pin" }, "PTA29", h("i")));
    const led = EV.ledView(hw, "D13 RGBLED0_RED");
    const vars = EV.varsView(side, ["level"], { level: (v) => (v == null ? "-" : String(v)) });
    const bus = side.appendChild(h("p", { class: "addrline" }));
    const hwView = {
      render(s) {
        pin.classList.toggle("high", s.led);
        bus.innerHTML = s.bus ? `버스: <b>${s.bus}</b>` : "버스: (아직 접근 없음)";
      },
    };

    const write = (s, level) => ({ ...s, regs: { ...s.regs, GPDO29: level }, led: level === 1, bus: `쓰기 ${EV.hex(SIUL2_BASE + gpdoOffset(29))} ← ${EV.hex(level, 2)}` });

    EV.stepper($("mainStepper"), {
      title: "chap02_gpio_bare main.c (USE_SDK_HEADER_ACCESS = 0)",
      code: `
#define LED_RED_MSCR_INDEX    (29UL)
#define LED_RED_GPDO_INDEX    (29UL)

static void LedInit(void)
{
    GpioBare_SetOutput(LED_RED_MSCR_INDEX);
    GpioBare_Write(LED_RED_GPDO_INDEX, LedOffLevel());
}

static void LedWrite(uint8_t on)
{
    uint8_t level = (on != 0U) ? LedOnLevel() : LedOffLevel();
    GpioBare_Write(LED_RED_GPDO_INDEX, level);
}

int main(void)
{
    LedInit();
    for (;;)
    {
        LedWrite(1U);
        Delay(4000000UL);
        LedWrite(0U);
        Delay(4000000UL);
    }
}`,
      initial: { regs: { MSCR29: 0, GPDO29: 0 }, led: false, bus: "", vars: { level: null } },
      intro: "전원이 막 들어온 상태예요. MSCR[29]와 GPDO29는 0이라고 할게요.",
      side,
      views: [mscr, gpdo, led, hwView, vars],
      steps: [
        { line: 18, note: "main이 제일 먼저 LedInit()을 불러요.", apply: (s) => s },
        { line: 6, note: "GpioBare_SetOutput(29): 앞에서 본 읽기-수정-쓰기로 MSCR[29]에 OBE = 1, SSS = 0을 써요. 이제 PTA29는 GPIO 출력이에요.", apply: (s) => ({ ...s, regs: { ...s.regs, MSCR29: OBE }, bus: `쓰기 ${EV.hex(mscrAddr(29))} ← ${EV.hex(OBE)}` }) },
        { line: 7, note: "바로 Off 레벨(Active High라 0)을 GPDO29에 써요. 매크로는 0x1300 + 29가 아니라 역순을 계산한 0x131E 번지에 1바이트를 써요.", apply: (s) => write(s, 0), predict: { q: "GpioBare_Write(29, …)가 실제로 쓰는 주소는?", choices: ["0x4029131D", "0x4029131E", "0x4029131C"], answer: 1 } },
        { line: 21, note: "무한 루프 시작. LedWrite(1U)을 불러요.", apply: (s) => s },
        { line: 12, note: "Active High라서 켜짐 레벨은 1이에요. level = 1", apply: (s) => ({ ...s, vars: { level: 1 } }) },
        { line: 13, note: "GPDO29에 1을 써요. PTA29 핀이 High가 되고 D13 빨간 LED가 켜져요.", apply: (s) => write(s, 1) },
        { line: 22, note: "Delay(4000000UL). count가 volatile이라 컴파일러가 빈 루프를 지우지 못하고, 실제로 400만 번 돌면서 LED가 켜진 채로 있어요.", apply: (s) => s },
        { line: 23, note: "LedWrite(0U): level = 0을 GPDO29에 써서 LED를 꺼요.", apply: (s) => ({ ...write(s, 0), vars: { level: 0 } }) },
        { line: 24, note: "다시 기다린 뒤 21번째 줄로 돌아가요. 이렇게 켜짐과 꺼짐을 반복하면서 깜빡여요.", apply: (s) => s },
      ],
    });
  }

  /* ---------- 08. 퀴즈 ---------- */
  EV.quiz($("quiz"), [
    { q: "GPIO[29](D13 LED)의 GPDO 바이트 오프셋은?", choices: ["0x131D", "0x131E", "0x131C", "0x1329"], answer: 1, why: "GPDO는 4개씩 역순이라 28 + (3 − 1) = 30 = 0x1E, 그래서 0x131E예요. 0x131D는 0x1300 + 29로 잘못 계산한 값이에요." },
    { q: "MSCR[29]의 절대 주소는?", choices: ["0x4029025D", "0x402902B4", "0x4029131E", "0x40290269"], answer: 1, why: "MSCR[n] = 0x40290000 + 0x0240 + 4 × n. 4 × 29 = 116 = 0x74, 0x240 + 0x74 = 0x2B4라서 0x402902B4예요." },
    { q: "GPIO[13]의 GPDO 바이트 오프셋은? (계산 과정까지)", answer: "0x130E", why: "13보다 작거나 같은 4의 배수는 12, 나머지는 1. 12 + (3 − 1) = 14 = 0x0E. 그래서 0x1300 + 0x0E = 0x130E예요." },
  ]);
})();
