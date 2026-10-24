// w1 페이지: 레지스터 뱅크, 부팅 흐름, PLL Lock, 메모리 맵, UART 파형, 전송 시간, VCOM 경로, _write Stepper, 퀴즈
(function () {
  const { h } = EV;
  const $ = (id) => document.getElementById(id);
  const press = (group, el) => group.forEach((b) => b.setAttribute("aria-pressed", b === el));

  /* ---------- 02. Cortex-M7 레지스터 ---------- */
  {
    const NOTE = {
      gp: "R0~R12: 범용 레지스터. 연산 중간값이나 임시 데이터를 담아요.",
      SP: "R13 / SP: 스택 포인터. MSP는 리셋 직후와 예외·인터럽트 처리에, PSP는 FreeRTOS 같은 OS에서 태스크별로 스택을 나눌 때 써요.",
      LR: "R14 / LR: 함수를 부른 뒤 돌아갈 주소를 담아요.",
      PC: "R15 / PC: 다음에 실행할 명령어 주소예요.",
      xPSR: "xPSR: 조건 플래그(비교 결과 등)와 예외 상태 정보를 담아요.",
    };
    const btns = [];
    const add = (label, key, wide) => {
      const b = h("button", { type: "button", class: wide ? "wide" : "", onclick: () => (press(btns, b), ($("regNote").textContent = NOTE[key])) }, label);
      btns.push(b);
      $("regBank").append(b);
    };
    for (let i = 0; i <= 12; i++) add("R" + i, "gp");
    add("SP", "SP"); add("LR", "LR"); add("PC", "PC"); add("xPSR", "xPSR", true);
    btns[13].click();
  }

  /* ---------- 03. 부팅 흐름 ---------- */
  {
    const STEPS = ["Power-On Reset", "BAF", "IVT 확인", "사용자 벡터 테이블", "startup", "main()"];
    const chips = STEPS.map((s, i) => {
      if (i) $("bootChain").append(h("span", { class: "arrow" }, "→"));
      return $("bootChain").appendChild(h("span", { class: "chip" }, s));
    });
    let busy = false;
    $("bootBtn").addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      chips.forEach((c) => c.classList.remove("on", "done"));
      for (const c of chips) {
        c.classList.add("on");
        await EV.sleep(380);
        c.classList.replace("on", "done");
      }
      chips[chips.length - 1].classList.add("on");
      busy = false;
    });
  }

  /* ---------- 03-2. PLL Lock ---------- */
  {
    let busy = false;
    const reset = () => {
      $("pllBox").classList.remove("locked");
      $("clkOut").classList.remove("on", "bad");
      $("pllBar").style.transitionDuration = "0s";
      $("pllBar").style.width = "0";
      void $("pllBar").offsetWidth;
      $("pllBar").style.transitionDuration = "";
    };
    $("pllWait").addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      reset();
      $("pllState").textContent = "Lock 중…";
      $("pllResult").textContent = "while (CLOCK_IP_PLL_LOCKED != Clock_Ip_GetPllStatus()) { } 에서 기다리는 중";
      $("pllBar").style.width = "100%";
      await EV.sleep(1250);
      $("pllBox").classList.add("locked");
      $("pllState").textContent = "LOCKED";
      $("clkOut").classList.add("on");
      $("pllResult").innerHTML = '<span class="ok">✓ Lock 확인 후 Clock_Ip_DistributePll(). 코어 120 MHz로 안정적으로 분배돼서 그다음 핀, LPUART6, printf까지 정상이에요.</span>';
      busy = false;
    });
    $("pllRush").addEventListener("click", () => {
      if (busy) return;
      reset();
      $("pllBar").style.width = "30%";
      $("pllState").textContent = "아직 흔들림";
      $("clkOut").classList.add("bad");
      $("pllResult").innerHTML = "<b>HardFault!</b> PLL이 목표 주파수에 고정되기 전에 분배해서, 불안정한 주파수가 시스템 전체로 퍼졌어요. 그래서 Lock 상태를 폴링하는 while 루프가 꼭 필요해요.";
    });
  }

  /* ---------- 04. 메모리 맵 ---------- */
  {
    const REGIONS = [
      ["Code Flash", "실행 코드, 읽기 전용 데이터", "프로그램이 여기 들어 있어요. ELF를 OpenSDA/PEmicro로 플래시에 굽는 곳이에요."],
      ["Data Flash", "전원 꺼져도 남는 설정값", "비휘발성이라 전원이 꺼져도 값이 남아요."],
      ["SRAM", "변수, 스택, 런타임 데이터", "*ptr = value; 를 하면 메모리 한 칸의 값만 바뀌어요. 보통 생각하는 '변수'가 여기 있어요."],
      ["TCM", "빠르고 지연이 예측 가능", "코어에 바짝 붙은 메모리라 접근 시간이 짧고 일정해요."],
      ["Peripheral", "UART, GPIO, I2C… 제어 레지스터", "*ptr = value; 를 하면 하드웨어 레지스터에 써져서 핀 전압이나 송수신 상태가 즉시 바뀔 수 있어요. 이게 Memory-Mapped I/O예요."],
    ];
    const SUB = ["LPUART6: 이번 주 콘솔 UART", "SIUL2 (0x40290000): GPIO, 2주차", "LPI2C1: I2C, 4주차"];
    const btns = [];
    let sub;
    REGIONS.forEach(([name, desc, note], i) => {
      const b = h("button", { type: "button", onclick: () => {
        press(btns, b);
        $("mapNote").textContent = note;
        sub.classList.toggle("open", i === 4);
      } }, h("span", {}, name), h("small", {}, desc));
      btns.push(b);
      $("memMap").append(b);
      if (i === 4) {
        sub = $("memMap").appendChild(h("div", { class: "sub" }, SUB.map((s) => h("span", {}, s))));
      }
    });
    btns[2].click();
  }

  /* ---------- 05. UART 8-N-1 파형 ---------- */
  {
    let pos = 0, slots = [];
    function build() {
      let ch = $("uChar").value || " ";
      let code = ch.charCodeAt(0);
      let warn = "";
      if (code > 0x7f) { warn = " (ASCII가 아니라서 '?'로 대신 보냄)"; ch = "?"; code = 0x3f; }
      slots = [{ k: "idle", v: 1, label: "idle" }, { k: "start", v: 0, label: "Start" }];
      for (let b = 0; b < 8; b++) slots.push({ k: "data", v: (code >> b) & 1, label: "D" + b, b });
      slots.push({ k: "stop", v: 1, label: "Stop" });
      const bin = code.toString(2).padStart(8, "0");
      $("uCode").textContent = `'${ch}' = ${EV.hex(code, 2)} = ${bin.slice(0, 4)} ${bin.slice(4)}${warn} → 선에는 LSB부터 ${bin.split("").reverse().join("")}`;
      $("uPos").max = slots.length - 1;
    }
    const W = 52, X0 = 20, HI = 24, LO = 64;
    function draw() {
      const end = X0 + slots.length * W + 20;
      let d = `M0 ${HI}`, rects = "", labels = "";
      slots.forEach((s, i) => {
        const x = X0 + i * W;
        d += ` H${x} V${s.v ? HI : LO}`;
        const cur = i === pos ? "cur" : "";
        rects += `<rect class="slot ${cur}" x="${x}" y="8" width="${W}" height="66"/>`;
        labels += `<text class="${cur}" x="${x + W / 2}" y="92" text-anchor="middle">${s.label}</text><text class="${cur}" x="${x + W / 2}" y="108" text-anchor="middle">${s.v}</text>`;
      });
      d += ` H${end - 10} V${HI} H${end}`;
      $("uartSvg").innerHTML = `
<svg class="frame" viewBox="0 0 ${end} 114" role="img" aria-label="UART 8-N-1 프레임 파형">
  ${rects}<path class="tx" d="${d}"/>${labels}
</svg>`;
      $("uPos").value = pos;
      const s = slots[pos];
      $("uNote").textContent =
        s.k === "idle" ? "쉬는 동안 TX 선은 HIGH로 있어요." :
        s.k === "start" ? "Start 비트: 선을 LOW로 떨어뜨려 '지금부터 한 글자 간다'를 알려요. 받는 쪽은 이 하강을 보고 약속한 속도로 비트를 세기 시작해요." :
        s.k === "data" ? `데이터 D${s.b} = ${s.v}. LSB(D0)부터 차례로 보내요.${s.b === 7 ? " 이게 마지막(MSB) 비트예요." : ""}` :
        "Stop 비트: 다시 HIGH. N(parity 없음)이라 D7 바로 뒤에 Stop 1개가 와요. 여기까지 1바이트 = 10비트예요.";
    }
    const go = (p) => ((pos = Math.max(0, Math.min(slots.length - 1, p))), draw());
    $("uPrev").addEventListener("click", () => go(pos - 1));
    $("uNext").addEventListener("click", () => go(pos + 1));
    $("uPos").addEventListener("input", () => go(Number($("uPos").value)));
    $("uChar").addEventListener("input", () => (build(), draw()));
    build(); draw();
  }

  /* ---------- 05-2. 전송 시간 ---------- */
  function drawTime() {
    const n = [...$("tText").value].length + ($("tCrlf").checked ? 2 : 0);
    const baud = Number($("tBaud").value);
    const bits = n * 10;
    const sec = bits / baud;
    const fmt = sec < 1e-3 ? `${(sec * 1e6).toFixed(1)} µs` : `${(sec * 1e3).toFixed(2)} ms`;
    $("tOut").innerHTML = `${n}바이트 × 10비트(Start 1 + Data 8 + Stop 1) = ${bits}비트 ÷ ${baud.toLocaleString()} bps = <b>${fmt}</b>` +
      `<br><span class="hint">1바이트만 보내면 ${((10 / baud) * 1e6).toFixed(1)} µs</span>`;
  }
  ["tText", "tCrlf", "tBaud"].forEach((id) => $(id).addEventListener("input", drawTime));
  drawTime();

  /* ---------- 06. VCOM 경로 ---------- */
  {
    let uart = 6, busy = false;
    let chips = [];
    function draw() {
      $("pathChain").replaceChildren();
      const steps = uart === 6
        ? ["printf()", "_write()", "Lpuart_Uart_Ip_SyncSend()", "LPUART6 TX (PTA16)", "OpenSDA VCOM", "USB", "PC 터미널"]
        : ["printf()", "_write()", "Lpuart_Uart_Ip_SyncSend()", "LPUART0 (PTA8/PTA9)", "OpenSDA VCOM", "USB", "PC 터미널"];
      chips = steps.map((s, i) => {
        if (i) $("pathChain").append(h("span", { class: "arrow" + (uart === 0 && i === 4 ? " cut" : "") }, uart === 0 && i === 4 ? "✕" : "→"));
        return $("pathChain").appendChild(h("span", { class: "chip" + (uart === 0 && i >= 4 ? " broken" : "") }, s));
      });
      $("termOut").textContent = "";
    }
    const btns = [...document.querySelectorAll("#pathLab [data-uart]")];
    btns.forEach((b) => b.addEventListener("click", () => {
      if (busy) return;
      uart = Number(b.dataset.uart);
      press(btns, b);
      draw();
    }));
    $("pathSend").addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      chips.forEach((c) => c.classList.remove("on"));
      const reach = uart === 6 ? chips.length : 4;
      for (let i = 0; i < reach; i++) {
        chips[i].classList.add("on");
        await EV.sleep(260);
      }
      $("termOut").textContent += uart === 6
        ? "Hello S32K3, 20261234 HongGildong\n"
        : "";
      if (uart === 0) $("termOut").textContent = "(아무것도 안 나옴: LPUART0은 VCOM에 배선돼 있지 않아요)";
      busy = false;
    });
    draw();
  }

  /* ---------- 07. _write Stepper ---------- */
  {
    const CODE = `
int _write(int file, char *ptr, int len)
{
    (void)file;

    if ((ptr == NULL) || (len <= 0))
    {
        return 0;
    }

    if (LPUART_UART_IP_STATUS_SUCCESS !=
        Lpuart_Uart_Ip_SyncSend(UART_CHANNEL,
                                (const uint8 *)ptr,
                                (uint32)len,
                                UART_TIMEOUT_US))
    {
        return -1;
    }

    return len;
}`;
    const CASES = {
      ok: {
        intro: 'printf("Hello S32K3\\r\\n")가 안에서 _write(file, ptr, 13)을 불렀어요. 13 = 글자 11개 + \\r\\n 2개.',
        initial: { vars: { ptr: "버퍼 주소", len: 13, "반환값": "-" }, status: "-", term: "" },
        steps: [
          { line: 3, note: "(void)file; 은 '이 매개변수는 일부러 안 써요'라고 컴파일러에 알려서 미사용 경고를 끄는 관용구예요.", apply: (s) => s },
          { line: 5, note: "ptr이 NULL도 아니고 len도 0보다 커서 조건은 거짓. 그냥 지나가요.", apply: (s) => s },
          { line: [10, 11, 12, 13, 14], note: "LPUART6(UART_CHANNEL = 6U)로 13바이트를 동기 전송해요. 다 보낼 때까지 기다리고, 최대 UART_TIMEOUT_US = 1,000,000 µs(1초)까지만 기다려요.", apply: (s) => ({ ...s, status: "LPUART_UART_IP_STATUS_SUCCESS", term: "Hello S32K3" }) },
          { line: 19, note: "성공했으니 실제로 보낸 바이트 수 len(13)을 돌려줘요.", apply: (s) => ({ ...s, vars: { ...s.vars, "반환값": 13 } }), predict: { q: "전송에 성공하면 _write()는 무엇을 돌려줄까?", choices: ["0", "-1", "13 (len)"], answer: 2 } },
        ],
      },
      null: {
        intro: "누군가 _write(file, NULL, 13)처럼 잘못된 버퍼를 넘겼다고 해 볼게요.",
        initial: { vars: { ptr: "NULL", len: 13, "반환값": "-" }, status: "-", term: "" },
        steps: [
          { line: 3, note: "file은 안 써요.", apply: (s) => s },
          { line: 5, note: "ptr == NULL 이라 조건이 참이에요. 보낼 게 없으니 전송을 시도하지도 않아요.", apply: (s) => s },
          { line: 7, note: "잘못된 인자 → 0을 돌려줘요.", apply: (s) => ({ ...s, vars: { ...s.vars, "반환값": 0 } }) },
        ],
      },
      fail: {
        intro: "정상 버퍼를 넘겼지만, 예를 들어 LPUART6 초기화를 빼먹어서 전송이 실패한다고 해 볼게요.",
        initial: { vars: { ptr: "버퍼 주소", len: 13, "반환값": "-" }, status: "-", term: "" },
        steps: [
          { line: 3, note: "file은 안 써요.", apply: (s) => s },
          { line: 5, note: "인자는 멀쩡해서 지나가요.", apply: (s) => s },
          { line: [10, 11, 12, 13, 14], note: "SyncSend가 SUCCESS가 아닌 값을 돌려줘요. != 비교가 참이 돼요.", apply: (s) => ({ ...s, status: "SUCCESS 아님 (전송 실패)" }) },
          { line: 16, note: "송신 실패 → -1을 돌려줘요.", apply: (s) => ({ ...s, vars: { ...s.vars, "반환값": -1 } }) },
        ],
      },
    };

    let root = $("writeStepper");
    function build(key) {
      const side = h("div");
      const vars = EV.varsView(side, ["ptr", "len", "반환값"]);
      const status = side.appendChild(h("span", { class: "chip" }));
      const term = side.appendChild(h("div", { class: "term" }, h("span", { class: "term-title" }, "PC 터미널"), h("pre")));
      const view = {
        render(s) {
          status.textContent = "SyncSend: " + s.status;
          status.classList.toggle("on", s.status.startsWith("LPUART"));
          term.querySelector("pre").textContent = s.term;
        },
      };
      // 같은 요소에 Stepper를 두 번 만들면 키 핸들러가 쌓이니까 새 요소로 바꿔 끼운다
      const fresh = h("div");
      root.replaceWith(fresh);
      root = fresh;
      const c = CASES[key];
      EV.stepper(root, { title: "_write() · " + { ok: "정상 전송", null: "ptr == NULL", fail: "송신 실패" }[key], code: CODE, initial: c.initial, intro: c.intro, steps: c.steps, side, views: [vars, view] });
    }
    const btns = [...document.querySelectorAll(".case-row [data-case]")];
    btns.forEach((b) => b.addEventListener("click", () => (press(btns, b), build(b.dataset.case))));
    build("ok");
  }

  /* ---------- 08. 퀴즈 ---------- */
  EV.quiz($("quiz"), [
    { q: "115,200 bps, 8-N-1에서 문자 1개(1바이트)를 보내는 데 걸리는 시간은?", choices: ["69.4 µs", "86.8 µs", "8.68 µs", "1.13 ms"], answer: 1, why: "Start 1 + Data 8 + Stop 1 = 10비트. 10 ÷ 115,200 ≈ 86.8 µs예요. 69.4 µs는 Start/Stop을 빼먹고 8비트로 나눈 값, 1.13 ms는 13글자를 보낼 때예요." },
    { q: "_write()에서 Lpuart_Uart_Ip_SyncSend()가 실패했을 때 돌려주는 값은?", choices: ["0", "-1", "len", "1"], answer: 1, why: "잘못된 인자(ptr == NULL 또는 len <= 0)면 0, 송신 실패면 -1, 성공하면 보낸 바이트 수 len이에요." },
    { q: "S32K312EVB에서 printf 콘솔로 써야 하는 UART 채널과 TX/RX 핀은?", answer: "LPUART6, PTA16 = TX, PTA15 = RX", why: "OpenSDA VCOM이 LPUART6에 배선돼 있어요. LPUART0(PTA8/PTA9)로 설정하면 VCOM에 연결되지 않아 터미널에 아무것도 안 보여요." },
  ]);
})();
