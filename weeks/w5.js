// w5 페이지: 폴링 타임라인, EIRQ 라우터, 인터럽트 Stepper, Tail-chaining, 디바운싱, 퀴즈
(function () {
  const { h } = EV;
  const $ = (id) => document.getElementById(id);

  /* ---------- 01. 폴링 vs 인터럽트 ---------- */
  // 폴링 루프 한 바퀴 = 확인 2 + LCD 작업 18 (설명용 단위). 버튼은 다음 "확인" 때에야 발견된다.
  const LOOP = 20, CHECK = 2, T = 100, SX = 6; // SX: 1단위 = 6px
  function drawPoll() {
    const t = Number($("pressT").value);
    const inCheck = t % LOOP < CHECK;
    const pollResp = inCheck ? t : Math.ceil(t / LOOP) * LOOP;
    const x = (v) => 90 + v * SX;

    let blocks = "";
    for (let k = 0; k * LOOP < T; k++) {
      blocks += `<rect class="blk-check" x="${x(k * LOOP)}" y="26" width="${CHECK * SX}" height="26"/>`;
      blocks += `<rect class="blk-work" x="${x(k * LOOP + CHECK)}" y="26" width="${(LOOP - CHECK) * SX}" height="26"/>`;
    }
    const svg = `
<svg class="timeline" viewBox="0 0 700 150" role="img" aria-label="폴링과 인터럽트 응답 시간 비교">
  <text x="0" y="44">폴링</text><text x="0" y="104">인터럽트</text>
  <rect class="lane-bg" x="90" y="26" width="${T * SX}" height="26"/>
  ${blocks}
  <rect class="lag" x="${x(t)}" y="22" width="${(pollResp - t) * SX}" height="34"/>
  <rect class="blk-work" x="90" y="86" width="${T * SX}" height="26"/>
  <rect class="blk-isr" x="${x(t)}" y="86" width="${CHECK * SX}" height="26"/>
  <line class="press" x1="${x(t)}" x2="${x(t)}" y1="12" y2="124"/>
  <line class="resp" x1="${x(pollResp)}" x2="${x(pollResp)}" y1="18" y2="60"/>
  <text x="${Math.min(x(t) + 4, 640)}" y="140" style="fill:var(--on)">버튼!</text>
  <text x="96" y="20">■ 확인  □ LCD 작업(I2C)</text>
  <text x="96" y="80">□ main 작업  ■ ISR</text>
</svg>`;
    $("pollSvg").innerHTML = svg;
    const lag = pollResp - t;
    $("pollResult").innerHTML = `폴링: <b>${lag}</b> 단위 늦게 발견 ${lag === 0 ? "(마침 확인하던 순간)" : "(LCD 작업이 끝날 때까지 못 봄)"} · 인터럽트: <b>0</b> 단위, 하드웨어가 즉시 ISR로 끌고 감`;
  }
  $("pressT").addEventListener("input", drawPoll);
  drawPoll();

  /* ---------- 03. EIRQ 라우팅 ---------- */
  const GROUPS = [0, 1, 2, 3].map((g) => ({
    range: `EIRQ ${g * 8}~${g * 8 + 7}`,
    irqn: `SIUL_${g}_IRQn`,
    irq: 53 + g,
    isr: `SIUL2_EXT_IRQ_${g * 8}_${g * 8 + 7}_ISR`,
  }));
  const groupEls = GROUPS.map((g) =>
    $("groups").appendChild(h("div", { class: "group" }, h("b", {}, g.range), `→ ${g.irqn} (IRQ ${g.irq})`, h("br"), `→ ${g.isr}`))
  );
  let chainChips = [];
  function drawRouter() {
    const n = Number($("eirqN").value);
    const g = GROUPS[n >> 3]; // 8개씩 묶음 = n / 8
    $("eirqLabel").textContent = `EIRQ[${n}]`;
    groupEls.forEach((el, i) => el.classList.toggle("on", i === n >> 3));
    const steps = [
      n === 13 ? "PTB26 (SW5) 상승 에지" : `EIRQ[${n}]에 연결된 핀`,
      `EIRQ[${n}]`,
      `${g.irqn} (IRQ ${g.irq})`,
      "NVIC 우선순위 판정",
      g.isr,
      n === 13 ? "UserSw0_Callback()" : "등록된 콜백",
    ];
    $("chain").replaceChildren();
    chainChips = steps.map((s, i) => {
      if (i) $("chain").append(h("span", { class: "arrow" }, "→"));
      return $("chain").appendChild(h("span", { class: "chip" }, s));
    });
  }
  $("eirqN").addEventListener("input", drawRouter);
  $("sendBtn").addEventListener("click", async () => {
    chainChips.forEach((c) => c.classList.remove("on", "done"));
    for (const c of chainChips) {
      c.classList.add("on");
      await EV.sleep(320);
      c.classList.replace("on", "done");
    }
    chainChips[chainChips.length - 1].classList.add("on");
  });
  drawRouter();

  /* ---------- 04. 인터럽트 Stepper (MCAL / IPL 번갈아 보기) ---------- */
  {
    const STAGES = [
      ["main", "main 루프 실행 중"],
      ["edge", "PTB26 상승 에지 → EIRQ[13]"],
      ["nvic", "NVIC: SIUL_1_IRQn (IRQ 54) pending"],
      ["entry", "자동 PUSH 8개 + 벡터 인출 (동시에)"],
      ["handler", "SIUL2_EXT_IRQ_8_15_ISR: 13번 채널 확인"],
      ["callback", "UserSw0_Callback() 실행"],
      ["return", "EXC_RETURN → 자동 POP, 복귀"],
    ];
    // 프로젝트마다 다른 부분: LED를 쓰는 두 줄, 제목, 핸들러 설명
    const PROJ = {
      mcal: {
        title: "chap05_interrupt_button_mcal (줄임)",
        led: `        Dio_WriteChannel(DioConf_DioChannel_LED_RED,
                         (g_led_request != 0U) ? STD_HIGH : STD_LOW);`,
        ledNote: "g_led_request가 0이라 Dio_WriteChannel로 LED에 STD_LOW를 써요. 꺼져 있어요.",
        handlerNote: "Platform이 등록한 SIUL2_EXT_IRQ_8_15_ISR이 13번 채널의 플래그를 보고, Icu 드라이버가 Icu_EnableNotification()으로 허용된 알림 함수 UserSw0_Callback()을 불러요.",
      },
      ipl: {
        title: "chap05_interrupt_button_ipl (줄임)",
        led: `        Siul2_Dio_Ip_WritePin(IP_LED_PORT, IP_LED_PIN,
                              (g_led_request != 0U) ? 1U : 0U);`,
        ledNote: "g_led_request가 0이라 LED에 0을 써요. 꺼져 있어요.",
        handlerNote: "RTD 공통 핸들러 SIUL2_EXT_IRQ_8_15_ISR이 SIUL2 상태 플래그를 보고 13번 채널임을 확인한 뒤, 등록된 UserSw0_Callback()을 불러요.",
      },
    };
    const at = (s, patch) => ({ ...s, ...patch, vars: { ...s.vars, ...(patch.vars || {}) } });

    function build(key) {
      const p = PROJ[key];
      const side = h("div");

      const flowEl = side.appendChild(h("div", { class: "flow" }));
      const stageChips = STAGES.map(([, label]) => flowEl.appendChild(h("span", { class: "chip" }, label)));
      const flowView = {
        render(s) {
          const cur = STAGES.findIndex(([k]) => k === s.stage);
          stageChips.forEach((c, i) => {
            c.classList.toggle("on", i === cur);
            c.classList.toggle("done", s.stage !== "main" && i < cur);
          });
        },
      };

      // 스택 프레임: 위가 높은 주소. PUSH 직후 SP는 가장 낮은 주소(R0)를 가리킨다.
      const FRAME = [["xPSR", "상태 레지스터"], ["PC", "돌아올 주소 (17번째 줄)"], ["LR", "main의 LR"], ["R12", ""], ["R3", ""], ["R2", ""], ["R1", ""], ["R0", "← SP"]];
      const stackEl = side.appendChild(
        h("div", { class: "stack" }, h("div", { class: "stack-title" }, h("span", {}, "스택 (위 = 높은 주소)"), h("span", { class: "badge extra", title: "순서는 ARM Cortex-M7 Generic User Guide 기준" })))
      );
      const slots = FRAME.map(([r, d]) => stackEl.appendChild(h("div", { class: "slot" + (r === "R0" ? " sp" : "") }, h("span", {}, r), h("span", {}, d))));
      const lrEl = stackEl.appendChild(h("div", { class: "lr" }));
      const stackView = {
        async render(s, prev) {
          const was = prev && prev.stacked;
          lrEl.innerHTML = `LR: <b>${s.lr}</b>`;
          if (s.stacked === was) return slots.forEach((el) => el.classList.toggle("filled", s.stacked));
          // PUSH는 아래(낮은 주소)부터 차례로, POP은 위로 빠져나가는 느낌만
          const order = s.stacked ? [...slots].reverse() : slots;
          for (const el of order) {
            el.classList.toggle("filled", s.stacked);
            await EV.sleep(60);
          }
        },
      };

      const vars = EV.varsView(side, ["g_press_count", "g_led_request", "last_display_count"]);
      const hw = side.appendChild(h("div", { class: "hw" }));
      const led = EV.ledView(hw, "D13 (PTA29)");
      const lcd = hw.appendChild(h("span", { class: "lcd" }));
      const lcdView = { render: (s) => (lcd.textContent = s.lcd) };

      // 같은 요소에 Stepper를 두 번 만들면 키 핸들러가 쌓이니까 새 요소로 바꿔 끼운다 (id는 xref가 쓰므로 유지)
      const old = $("irqStepper");
      const fresh = h("div", { id: "irqStepper" });
      old.replaceWith(fresh);

      EV.stepper(fresh, {
        title: p.title,
        code: `
static volatile uint32_t g_press_count = 0U;
static volatile uint8_t  g_led_request = 0U;

void UserSw0_Callback(void)
{
    g_press_count++;
    g_led_request ^= 1U;
}

int main(void)
{
    /* ... 초기화 생략 ... */
    for (;;)
    {
${p.led}
        if (g_press_count != last_display_count)
        {
            last_display_count = g_press_count;
            /* Lcd1602_Puts: I2C 전송이라 수 ms 걸림 */
        }
    }
}`,
        initial: { stage: "main", stacked: false, lr: "main 실행 중", led: false, lcd: "Count: 0000", vars: { g_press_count: 0, g_led_request: 0, last_display_count: 0 } },
        intro: "main 루프가 LED와 LCD를 계속 갱신하고 있어요. LCD에는 처음 값 Count: 0000이 이미 찍혀 있다고 할게요.",
        side,
        views: [flowView, stackView, vars, led, lcdView],
        steps: [
          { line: [15, 16], note: p.ledNote, apply: (s) => s },
          { line: 17, note: "g_press_count(0) == last_display_count(0)라서 LCD 갱신은 건너뛰어요.", apply: (s) => s },
          { line: 17, note: "이 줄을 실행하던 중에 SW5(PTB26)를 눌러요. 누르면 High라서 상승 에지가 생기고, SIUL2 EIRQ[13] 플래그가 켜져요.", apply: (s) => at(s, { stage: "edge" }) },
          { line: 17, note: "EIRQ 13은 8~15 그룹이라 SIUL_1_IRQn(IRQ 54)이 NVIC에 pending돼요. main은 일반 실행 중이라 바로 받아들여요.", apply: (s) => at(s, { stage: "nvic" }) },
          { line: 17, note: "하드웨어가 R0~R3, R12, LR, PC, xPSR 8개를 스택에 자동으로 PUSH해요. 동시에 벡터 테이블에서 핸들러 주소를 꺼내요. PC 칸에는 '돌아와서 실행할 다음 명령' 주소가 들어가요.", apply: (s) => at(s, { stage: "entry", stacked: true, lr: "EXC_RETURN (예: 0xFFFFFFFD)" }), predict: { q: "하드웨어가 스택에 자동으로 PUSH하는 레지스터는 몇 개?", choices: ["4개", "8개", "13개", "16개"], answer: 1 } },
          { line: 4, note: p.handlerNote, apply: (s) => at(s, { stage: "handler" }) },
          { line: 6, note: "콜백 1줄째: 누른 횟수를 1 올려요.", apply: (s) => at(s, { stage: "callback", vars: { g_press_count: s.vars.g_press_count + 1 } }) },
          { line: 7, note: "콜백 2줄째: LED 요청 플래그를 0 ↔ 1로 뒤집어요. ISR은 이렇게 두 줄로 끝내요(Fast Exit).", apply: (s) => at(s, { vars: { g_led_request: s.vars.g_led_request ^ 1 } }) },
          { line: 8, note: "리턴할 때 LR에 있던 EXC_RETURN을 보고 하드웨어가 8개 레지스터를 자동으로 POP해요. 그래서 17번째 줄 실행하던 자리로 정확히 돌아가요.", apply: (s) => at(s, { stage: "return", stacked: false, lr: "main 실행 중" }), predict: { q: "ISR이 끝나면 main의 어느 줄로 돌아갈까?", choices: ["13번째 줄 (for 처음)", "17번째 줄 (끼어든 곳)", "1번째 줄"], answer: 1 } },
          { line: 17, note: "다시 main. 이번엔 g_press_count(1) != last_display_count(0)라서 if 안으로 들어가요. volatile 덕분에 ISR이 바꾼 값을 메모리에서 새로 읽어요.", apply: (s) => at(s, { stage: "main" }) },
          { line: 19, note: "표시한 값을 기억해 둬요.", apply: (s) => at(s, { vars: { last_display_count: s.vars.g_press_count } }) },
          { line: 20, note: "LCD 출력은 I2C로 수십 바이트를 보내서 느려요. 그래서 ISR이 아니라 main에서 해요.", apply: (s) => at(s, { lcd: "Count: " + String(s.vars.g_press_count).padStart(4, "0") }) },
          { line: [15, 16], note: "다음 바퀴에서 g_led_request(1)대로 LED를 켜요. 버튼 한 번 = 토글 한 번.", apply: (s) => at(s, { led: s.vars.g_led_request === 1 }) },
        ],
      });
    }
    EV.projTabs(".case-row [data-proj]", build);
  }

  /* ---------- 05. Tail-chaining ---------- */
  {
    const parts = [["push", "PUSH"], ["isr", "ISR A"], ["pop x", "POP"], ["push x", "PUSH"], ["isr", "ISR B"], ["pop", "POP"]];
    const els = parts.map(([cls, label]) => $("tailBars").appendChild(h("span", { class: cls }, label)));
    let on = true;
    function draw() {
      els.forEach((el) => el.classList.toggle("gone", on && el.classList.contains("x")));
      $("tailBtn").textContent = on ? "Tail-chaining 켜짐" : "Tail-chaining 꺼짐 (가정)";
      $("tailBtn").setAttribute("aria-pressed", on);
      $("tailNote").textContent = on
        ? "ISR A가 끝나자마자 ISR B로 바로 들어가요. 가운데 POP → PUSH(약 30 클럭)가 사라졌어요."
        : "만약 꼬리 물기가 없다면: 스택을 복원했다가 똑같은 걸 다시 저장해요. 낭비예요.";
    }
    $("tailBtn").addEventListener("click", () => ((on = !on), draw()));
    draw();
  }

  /* ---------- 07. 채터링 & 디바운싱 ---------- */
  // 상승 에지 시각(ms). 한 번 누를 때 접점이 몇 번 튄다. 마지막 에지 뒤로는 계속 High.
  const PRESSES = [
    { edges: [0, 0.6, 1.3, 2.1, 3.0], release: 30 },
    { edges: [45, 45.5, 46.4, 47.2], release: 72 },
  ];
  const BOUNCE_HIGH = 0.3; // 튈 때 High로 머무는 시간
  const XS = 8, X0 = 20, W = 80;
  function drawBounce() {
    const th = Number($("deb").value);
    $("debLabel").textContent = `${th} ms`;
    const px = (ms) => X0 + ms * XS;
    const hi = 30, lo = 90;

    // 파형 경로 만들기
    let d = `M${px(0) - 12} ${lo}`;
    for (const p of PRESSES) {
      p.edges.forEach((e, i) => {
        const last = i === p.edges.length - 1;
        d += ` L${px(e)} ${lo} L${px(e)} ${hi}`;
        const end = last ? p.release : e + BOUNCE_HIGH;
        d += ` L${px(end)} ${hi} L${px(end)} ${lo}`;
      });
    }
    d += ` L${px(W)} ${lo}`;

    // 디바운싱: 직전에 "받아들인" 에지와 th 이상 떨어진 에지만 인정
    let lastOk = -Infinity, count = 0, marks = "", wins = "";
    for (const p of PRESSES) {
      for (const e of p.edges) {
        const ok = e - lastOk >= th;
        if (ok) {
          lastOk = e;
          count++;
          if (th > 0) wins += `<rect class="win" x="${px(e)}" y="${hi - 10}" width="${th * XS}" height="${lo - hi + 20}"/>`;
        }
        marks += ok ? `<circle class="dot-ok" cx="${px(e)}" cy="${hi - 14}" r="4"/>` : `<circle class="dot-skip" cx="${px(e)}" cy="${hi - 14}" r="3.5"/>`;
      }
    }
    let ticks = "";
    for (let ms = 0; ms <= W; ms += 10) ticks += `<text x="${px(ms) - 6}" y="118">${ms}</text>`;

    $("bounceSvg").innerHTML = `
<svg class="timeline" viewBox="0 0 680 130" role="img" aria-label="버튼 채터링 파형과 디바운싱">
  ${wins}<path class="wave" d="${d}"/>${marks}${ticks}
  <text x="${px(W) - 6}" y="128">ms</text>
</svg>`;
    $("bounceResult").innerHTML =
      `ISR 호출로 인정된 에지: <b>${count}</b>번 (실제로 누른 횟수: 2번) ` +
      (count === 2 ? "→ 딱 맞아요" : count > 2 ? "→ 접점 튐까지 세고 있어요. 무시 구간을 늘려 보세요" : "→ 너무 길어서 진짜 누름도 놓쳤어요");
  }
  $("deb").addEventListener("input", drawBounce);
  drawBounce();

  /* ---------- 08. 초기화 순서 칩 ---------- */
  document.querySelectorAll(".order").forEach((box) => {
    box.dataset.order.split("|").forEach((name, i) => {
      if (i) box.append(h("span", { class: "arrow" }, "→"));
      box.append(h("span", { class: "chip" }, " " + name));
    });
  });

  /* ---------- 09. 퀴즈 ---------- */
  EV.quiz($("quiz"), [
    { q: "PTB26 버튼(EIRQ[13])의 인터럽트 벡터로 맞는 것은?", choices: ["SIUL_0_IRQn (IRQ 53)", "SIUL_1_IRQn (IRQ 54)", "SIUL_2_IRQn (IRQ 55)", "SIUL_3_IRQn (IRQ 56)"], answer: 1, why: "EIRQ는 8개씩 묶여 벡터를 공유해요. 13은 8~15 그룹이라 SIUL_1_IRQn, 핸들러는 SIUL2_EXT_IRQ_8_15_ISR이에요." },
    { q: "Cortex-M NVIC에서 우선순위 0과 10 중 더 높은(먼저 처리되는) 것은?", choices: ["10 (숫자가 크니까)", "0 (숫자가 작을수록 높음)", "둘이 같다", "그룹마다 다르다"], answer: 1, why: "ARM Cortex-M은 숫자가 작을수록 우선순위가 높아요. 그래서 우선순위 0~5인 인터럽트는 10인 버튼 ISR을 선점할 수 있어요." },
    { q: "인터럽트에 진입할 때 하드웨어가 스택에 자동으로 PUSH하는 레지스터 8개는?", answer: "R0, R1, R2, R3, R12, LR, PC, xPSR", why: "복귀할 때는 EXC_RETURN을 보고 하드웨어가 같은 8개를 자동으로 POP해서 원래 코드로 돌아가요." },
  ]);
})();
