// 보드 허브: 부품 클릭 = 주차로 줌인 후 이동, SW5 버튼 = 허브 안 인터럽트 미니 애니메이션
(function () {
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";

  // MCU 다리: 칩 몸체(x 232~368, y 160~296) 네 변의 가운데에 8개씩 고르게
  const pins = svg.querySelector(".mcu-pins");
  const CHIP = { x: 232, y: 160, size: 136 }, N = 8, GAP = 15;
  const start = (CHIP.size - GAP * (N - 1)) / 2;
  for (let i = 0; i < N; i++) {
    const ox = CHIP.x + start + i * GAP;
    const oy = CHIP.y + start + i * GAP;
    const r = CHIP.x + CHIP.size, b = CHIP.y + CHIP.size;
    for (const [x1, y1, x2, y2] of [[ox, CHIP.y - 8, ox, CHIP.y], [ox, b, ox, b + 8], [CHIP.x - 8, oy, CHIP.x, oy], [r, oy, r + 8, oy]]) {
      const l = document.createElementNS(NS, "line");
      Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v));
      pins.append(l);
    }
  }

  const HINT = {
    pUart: "OpenSDA USB: printf가 LPUART6 → VCOM을 타고 PC로 나가는 길 → <b>1주차 UART</b>",
    pLed: "D13 빨간 LED (PTA29): 주소에 직접 써서 켜기 → <b>2주차 GPIO</b> (끝에서 3주차 IPL/MCAL로)",
    pLcd: "1602 LCD + PCF8574: SDA·SCL 두 선으로 글자 쓰기 → <b>4주차 I2C</b>",
    pPot: "가변저항 ADC_POT0 (R393 → PTA11 = ADC1_S10): 돌린 전압을 숫자로 바꾸고 평균 내기 → <b>6주차 ADC</b>",
    pBtn: "SW5 (USER_SW0, PTB26): 눌러 보세요. 여기서 인터럽트 흐름이 재생돼요",
    pIrq: "인터럽트를 처음부터 끝까지 → <b>5주차 인터럽트</b>",
  };
  const IDLE = "부품을 눌러 보세요. 마우스를 올리면 어느 주차인지 먼저 알려 줘요.";
  let busy = false;
  const say = (html) => (status.innerHTML = html);

  for (const id of Object.keys(HINT)) {
    const el = $(id);
    const on = () => !busy && say(HINT[id]);
    const off = () => !busy && say(IDLE);
    el.addEventListener("mouseenter", on);
    el.addEventListener("focus", on);
    el.addEventListener("mouseleave", off);
    el.addEventListener("blur", off);
  }

  /* ---------- 줌인 이동 (dive) ----------
     ① 보드가 누른 부품을 중심으로 커지며 다가가고 ② 같은 지점에서 바탕색 원이 퍼져 화면을 덮으면
     ③ 다음 페이지로 이동한다. 도착 페이지는 같은 바탕색에서 떠오른다(vt.js, base.css). */
  const wrap = svg.closest(".board-wrap");
  let cover = null, leaving = false;
  function dive(a, href) {
    leaving = true;
    const r = a.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (wrap.contains(a)) {
      const w = wrap.getBoundingClientRect();
      wrap.style.transformOrigin = `${cx - w.left}px ${cy - w.top}px`;
      wrap.classList.add("diving");
    }
    cover = document.body.appendChild(document.createElement("div"));
    cover.className = "dive-cover";
    cover.style.setProperty("--cx", cx + "px");
    cover.style.setProperty("--cy", cy + "px");
    a.classList.add("hot");
    try { sessionStorage.setItem("dive", "1"); } catch (_) {}
    let gone = false;
    const go = () => { if (!gone) { gone = true; location.href = href; } };
    cover.addEventListener("animationend", go);
    setTimeout(go, 900); // 애니메이션 이벤트가 안 와도 이동은 보장
  }
  // 이어서 보기: 마지막으로 본 주차 (이 브라우저에만 저장)
  try {
    const last = JSON.parse(localStorage.getItem("ev-last"));
    if (last) {
      const r = $("resume");
      r.href = "weeks/" + last[0];
      r.querySelector("b").textContent = `${last[1]} · ${last[2]} →`;
      r.hidden = false;
    }
  } catch (_) {}

  document.querySelectorAll("#board a.part, a.hint-card, a.resume, .toc a").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || EV.reducedMotion) return;
      e.preventDefault();
      if (!leaving) dive(a, a.getAttribute("href"));
    });
  });
  // 뒤로 가기로 돌아오면(bfcache 포함) 확대와 덮개를 원래대로
  window.addEventListener("pageshow", () => {
    leaving = false;
    wrap.classList.remove("diving");
    cover && cover.remove();
    cover = null;
    document.querySelectorAll(".hot").forEach((el) => el.classList.remove("hot"));
  });

  /* ---------- SW5 버튼: 인터럽트 미니 애니메이션 ---------- */
  let count = 0, ledOn = false;
  const btn = $("pBtn"), irq = $("irqPath"), mcu = $("mcu"), led = $("pLed");
  const wires = [...svg.querySelectorAll(".wire.data, .wire.clk")];

  async function press() {
    if (busy) return;
    busy = true;
    btn.classList.add("down");
    setTimeout(() => btn.classList.remove("down"), 140);

    const chain = [];
    const step = async (text, ms = 650) => {
      chain.push(text);
      say(chain.join(" → "));
      await EV.sleep(ms);
    };
    irq.classList.remove("run");
    void irq.getBBox();
    irq.classList.add("run");
    await step("PTB26 상승 에지 → <b>EIRQ[13]</b>");
    mcu.classList.add("hit");
    await step("8~15 그룹이라 <b>SIUL_1_IRQn</b> (IRQ 54) → NVIC");
    await step("레지스터 8개 자동 PUSH → SIUL2_EXT_IRQ_8_15_ISR → <b>UserSw0_Callback()</b>");
    count++;
    await step("g_press_count++, g_led_request ^= 1U → POP, main 복귀");
    mcu.classList.remove("hit");
    irq.classList.remove("run");
    ledOn = !ledOn;
    led.classList.toggle("on", ledOn);
    wires.forEach((w) => w.classList.add("go"));
    $("lcdRow1").textContent = "Count: " + String(count).padStart(4, "0");
    await step("main 루프가 <b>LED 토글</b>, I2C로 <b>LCD 갱신</b>", 900);
    wires.forEach((w) => w.classList.remove("go"));
    say(chain.join(" → ") + '<br>버튼 한 번 = 인터럽트 한 번. 한 단계씩 보려면 <a href="weeks/w5-interrupt.html">5주차 →</a>');
    busy = false;
  }
  btn.addEventListener("click", press);
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") (e.preventDefault(), press());
  });
})();
