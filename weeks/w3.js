// w3 페이지: 층 엘리베이터, Half 계산, IPL/MCAL Stepper, Port/Dio 분류, 핀 변경 영향, .text 조각, 퀴즈
(function () {
  const { h } = EV;
  const $ = (id) => document.getElementById(id);
  const press = (group, el) => group.forEach((b) => b.setAttribute("aria-pressed", b === el));

  /* ---------- 02. 층 엘리베이터 ---------- */
  {
    const FLOORS = [
      ["app", "Application", "Lamp, Motor, Sensor 같은 응용 로직 · main.c"],
      ["bsw", "AUTOSAR BSW / RTE", "서비스, 차량 네트워크, OS (이번 실습엔 없음)"],
      ["mcal", "MCAL (HLD)", "Port, Dio, Can, Spi · AUTOSAR 표준"],
      ["ipl", "IPL", "Siul2_Port_Ip, Siul2_Dio_Ip · NXP 전용"],
      ["hw", "SIUL2 레지스터", "MSCR, GPDO, IMCR … 실리콘"],
    ];
    const WAYS = {
      bare: {
        path: ["app", "hw"],
        code: "SIUL2_GPDO(29U) = 1U;   // 0x4029131E 에 직접",
        facts: { "제어 수단": "매크로 + 직접 주소 역참조", "하드웨어 주소": "응용 코드에 그대로 노출", "핀 지정": "물리 번호 29", "초기화": "MSCR 직접 비트 연산 (OBE, SSS)", "이식성": "최하: 칩이 바뀌면 전면 재작성", "학습 비용": "낮음 (C 문법만)" },
      },
      ipl: {
        path: ["app", "ipl", "hw"],
        code: "Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 1U);",
        facts: { "제어 수단": "NXP RTD C 함수", "하드웨어 주소": "드라이버 안으로 숨겨짐", "핀 지정": "포트 Half + 상대 번호 13U", "초기화": "Siul2_Port_Ip_Init(핀먹스 배열)", "이식성": "NXP S32K 계열 안에서만", "학습 비용": "중간" },
      },
      mcal: {
        path: ["app", "mcal", "ipl", "hw"],
        code: "Dio_WriteChannel(LED_CHANNEL, STD_HIGH);\n// LED_CHANNEL = DioConf_DioChannel_RGBLED0_RED",
        facts: { "제어 수단": "AUTOSAR 표준 API", "하드웨어 주소": "드라이버 + 생성 구조체 안으로 완전히 숨겨짐", "핀 지정": "기호 이름 RGBLED0_RED", "초기화": "Port_Init(NULL_PTR)", "이식성": "최상: AUTOSAR라 다른 MCU에서도 재사용", "학습 비용": "높음 (Config Tools, BSW 구조)" },
      },
    };
    const floorEls = {};
    for (const [k, name, desc] of FLOORS) floorEls[k] = $("floors").appendChild(h("div", { class: "floor" + (k === "hw" ? " hw" : "") }, name, h("small", {}, desc)));
    let way = "ipl", busy = false;
    const btns = [...document.querySelectorAll("#lift [data-way]")];

    function show() {
      const w = WAYS[way];
      FLOORS.forEach(([k]) => {
        floorEls[k].classList.remove("pass", "entry");
        floorEls[k].classList.toggle("skip", !w.path.includes(k));
      });
      floorEls.app.classList.add("entry");
      EV.codeBlock($("liftCode"), w.code);
      $("liftFacts").replaceChildren(...Object.entries(w.facts).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
      $("liftLed").classList.remove("on");
    }
    btns.forEach((b) => b.addEventListener("click", () => {
      if (busy) return;
      way = b.dataset.way;
      press(btns, b);
      show();
    }));
    $("liftRun").addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      show();
      for (const k of WAYS[way].path) {
        floorEls[k].classList.add("pass");
        await EV.sleep(340);
      }
      $("liftLed").classList.add("on");
      busy = false;
    });
    show();
  }

  /* ---------- 03. Half 계산 ---------- */
  {
    const halves = [
      { title: "Low Half", range: "PTA[15:0]", lo: 0 },
      { title: "High Half · PTA_H_HALF", range: "PTA[31:16]", lo: 16 },
    ].map((hf) => {
      const pins = [];
      const box = h("div", { class: "half" }, h("div", { class: "half-title" }, h("span", {}, hf.title), h("span", {}, hf.range)));
      const grid = box.appendChild(h("div", { class: "half-pins" }));
      for (let i = 15; i >= 0; i--) pins[i] = grid.appendChild(h("span", {}, hf.lo + i, h("small", {}, i)));
      $("halves").append(box);
      return { ...hf, box, pins };
    });
    function draw() {
      const n = Number($("ptaN").value);
      const hi = n >= 16;
      const rel = n - (hi ? 16 : 0);
      $("ptaLabel").textContent = `PTA${n}`;
      halves.forEach((hf, i) => {
        hf.box.classList.toggle("on", (i === 1) === hi);
        hf.pins.forEach((p, k) => p.classList.toggle("on", (i === 1) === hi && k === rel));
      });
      $("halfCalc").innerHTML = hi
        ? `PTA${n} → High Half → ${n} − 16 = <b>${rel}U</b> → <code>Siul2_Dio_Ip_WritePin(PTA_H_HALF, ${rel}U, 레벨)</code>`
        : `PTA${n} → Low Half(PTA[15:0]) → 상대 번호 = <b>${rel}U</b> 그대로 <span class="hint">(Low Half 매크로 이름은 생성 헤더에서 확인)</span>`;
    }
    $("ptaN").addEventListener("input", draw);
    draw();
  }

  /* ---------- 04. main.c Stepper (IPL / MCAL) ---------- */
  {
    const PROJ = {
      ipl: {
        title: "chap03_gpio_ipl · main.c",
        code: `
int main(void)
{
    Siul2_Port_Ip_Init(NUM_OF_CONFIGURED_PINS0, g_pin_mux_InitConfigArr0);
    Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 0U);
    for (;;)
    {
        Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 0U); // LED OFF
        Delay(4000000UL);
        Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 1U); // LED ON
        Delay(4000000UL);
    }
    return 0;
}`,
        intro: "Pins 도구에서 PTA29를 SIUL2:gpio 29, Output, Initial Low로 설정하고, Drivers에 Siul2_Dio를 추가해 [Update Code]까지 한 상태예요.",
        steps: [
          { line: 3, note: "Pins 도구가 생성한 핀먹스 배열(g_pin_mux_InitConfigArr0)을 넘겨서 SIUL2 포트를 초기화해요. 2주차에 손으로 하던 MSCR의 OBE·SSS 설정을 이 함수가 대신해요.", apply: (s) => ({ ...s, vars: { ...s.vars, "PTA29": "GPIO Output, Initial Low", "마지막 호출": "Siul2_Port_Ip_Init (IPL)" } }) },
          { line: 4, note: "초기 상태를 LED OFF(0U)로 확실히 정해요. PTA29 = High Half의 13번 → (PTA_H_HALF, 13U).", apply: (s) => ({ ...s, led: false, vars: { ...s.vars, "마지막 호출": "Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 0U)" } }), predict: { q: "PTA29를 IPL로 쓸 때 두 번째 인자(핀 번호)는?", choices: ["29U", "13U", "16U"], answer: 1 } },
          { line: 7, note: "루프 시작. 0U를 써서 꺼요(Active High).", apply: (s) => ({ ...s, led: false }) },
          { line: 8, note: "volatile count로 400만 번 돌며 기다려요.", apply: (s) => s },
          { line: 9, note: "1U를 써서 켜요. 주소 0x4029131E는 코드 어디에도 안 보여요. 드라이버 안에 숨어 있어요.", apply: (s) => ({ ...s, led: true, vars: { ...s.vars, "마지막 호출": "Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 1U)" } }) },
          { line: 10, note: "다시 기다린 뒤 7번째 줄로. 이렇게 깜빡여요.", apply: (s) => s },
        ],
      },
      mcal: {
        title: "chap03_gpio_mcal · main.c",
        code: `
#define LED_CHANNEL  (DioConf_DioChannel_RGBLED0_RED)

int main(void)
{
    Port_Init(NULL_PTR);
    Dio_WriteChannel(LED_CHANNEL, STD_LOW);
    for (;;)
    {
        Dio_WriteChannel(LED_CHANNEL, STD_LOW);  // LED OFF
        Delay(4000000UL);
        Dio_WriteChannel(LED_CHANNEL, STD_HIGH); // LED ON
        Delay(4000000UL);
    }
    return 0;
}`,
        intro: "Peripherals에 Port와 Dio를 추가(Siul2_Port는 제거)하고, Dio에서 Port Id = 1, short name = RGBLED0_RED, Channel Id = 13으로 설정한 뒤 [Update Code]를 한 상태예요.",
        steps: [
          { line: 1, note: "Config Tools가 Dio_Cfg.h에 만들어 준 기호 이름을 씀. 이 파일 어디에도 13이나 29가 없어요.", apply: (s) => s },
          { line: 5, note: "AUTOSAR 표준 Port 드라이버 초기화. NULL_PTR이면 생성된 기본 설정 구조체를 써요. 핀의 Mux, 방향, 초기 레벨은 여기서 정해져요.", apply: (s) => ({ ...s, vars: { ...s.vars, "PTA29": "Port가 설정 (Output)", "마지막 호출": "Port_Init (MCAL)" } }) },
          { line: 6, note: "Dio로 초기 레벨 OFF.", apply: (s) => ({ ...s, led: false, vars: { ...s.vars, "마지막 호출": "Dio_WriteChannel(LED_CHANNEL, STD_LOW)" } }) },
          { line: 9, note: "루프 시작. STD_LOW로 꺼요.", apply: (s) => ({ ...s, led: false }) },
          { line: 10, note: "기다려요.", apply: (s) => s },
          { line: 11, note: "STD_HIGH로 켜요. LED가 다른 핀으로 옮겨 가도 이 줄은 안 바뀌어요.", apply: (s) => ({ ...s, led: true, vars: { ...s.vars, "마지막 호출": "Dio_WriteChannel(LED_CHANNEL, STD_HIGH)" } }) },
          { line: 12, note: "다시 기다린 뒤 9번째 줄로.", apply: (s) => s },
        ],
      },
    };
    let root = $("mainStepper");
    function build(key) {
      const side = h("div");
      const vars = EV.varsView(side, ["PTA29", "마지막 호출"]);
      const led = EV.ledView(side, "D13 RGBLED0_RED");
      // 같은 요소에 Stepper를 두 번 만들면 키 핸들러가 쌓이니까 새 요소로 바꿔 끼운다
      const fresh = h("div");
      root.replaceWith(fresh);
      root = fresh;
      const p = PROJ[key];
      EV.stepper(root, {
        title: p.title, code: p.code, intro: p.intro, steps: p.steps, side, views: [vars, led],
        initial: { led: false, vars: { "PTA29": "아직 설정 안 됨", "마지막 호출": "-" } },
      });
    }
    const btns = [...document.querySelectorAll(".case-row [data-proj]")];
    btns.forEach((b) => b.addEventListener("click", () => (press(btns, b), build(b.dataset.proj))));
    build("mcal");
  }

  /* ---------- 05. Port vs Dio 분류 ---------- */
  {
    const ITEMS = [
      ["핀 Mux(기능) 선택", "port"],
      ["입력/출력 방향 정하기", "port"],
      ["Pull-up 같은 전기적 속성", "port"],
      ["핀 초기 레벨", "port"],
      ["실행 중에 HIGH/LOW 쓰기", "dio"],
      ["핀 값 읽기", "dio"],
      ["토글 (Flip)", "dio"],
    ];
    let done = 0;
    const lists = { port: $("binPort").querySelector(".bin-list"), dio: $("binDio").querySelector(".bin-list") };
    const status = () => ($("sortOut").innerHTML = done === ITEMS.length ? "<b>✓ 전부 맞혔어요.</b> Port = 시작할 때 핀의 정체를 정함, Dio = 실행 중에 값만 읽고 씀" : `${done} / ${ITEMS.length}`);
    for (const [text, ans] of ITEMS) {
      const item = h("span", { class: "key" }, text);
      const pick = item.appendChild(h("span", { class: "pick" }));
      for (const [label, val] of [["Port", "port"], ["Dio", "dio"]]) {
        pick.append(h("button", { type: "button", onclick: () => {
          if (val !== ans) return EV.pulse(item, "wrong");
          item.remove();
          lists[ans].append(h("span", {}, text));
          done++;
          status();
        } }, label));
      }
      $("sortItems").append(item);
    }
    status();
  }

  /* ---------- 06. 핀이 바뀌면 ---------- */
  {
    const SNIP = {
      bare: { el: "mvBare", count: "cBare", flags: [1, 2], code: `
#define LED_RED_MSCR_INDEX    (29UL)
#define LED_RED_GPDO_INDEX    (29UL)
GpioBare_SetOutput(LED_RED_MSCR_INDEX);
GpioBare_Write(LED_RED_GPDO_INDEX, level);`, msg: "코드 2줄 + IOMUX 표에서 새 MSCR 번호와 GPIO 번호를 다시 찾아야 해요." },
      ipl: { el: "mvIpl", count: "cIpl", flags: [2, 3, 4], code: `
Siul2_Port_Ip_Init(NUM_OF_CONFIGURED_PINS0, g_pin_mux_InitConfigArr0);
Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 0U);
Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 0U);
Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 1U);`, msg: "코드 3줄(Half와 상대 번호) + Pins 설정도 바꿔야 해요." },
      mcal: { el: "mvMcal", count: "cMcal", flags: [], code: `
#define LED_CHANNEL  (DioConf_DioChannel_RGBLED0_RED)
Port_Init(NULL_PTR);
Dio_WriteChannel(LED_CHANNEL, STD_LOW);
Dio_WriteChannel(LED_CHANNEL, STD_HIGH);`, msg: "코드 0줄. Config Tools에서 핀 매핑만 바꾸고 [Update Code]." },
    };
    let moved = false;
    for (const s of Object.values(SNIP)) EV.codeBlock($(s.el), s.code);
    function draw() {
      for (const s of Object.values(SNIP)) {
        $(s.el).querySelectorAll(".ln").forEach((ln, i) => ln.classList.toggle("cur", moved && s.flags.includes(i + 1)));
        $(s.count).textContent = moved ? s.msg : "";
      }
      $("moveBtn").textContent = moved ? "원래대로" : "LED 핀 옮기기";
      $("moveBtn").setAttribute("aria-pressed", moved);
      $("moveNote").textContent = moved ? "MCAL main.c는 기호 이름만 쓰니까 한 줄도 안 바뀌어요. 이게 '설정과 코드를 분리'한다는 뜻이에요." : "";
    }
    $("moveBtn").addEventListener("click", () => ((moved = !moved), draw()));
    draw();
  }

  /* ---------- 07. .text 조각 ---------- */
  {
    const PARTS = {
      trace: ["설정 추적성", "어떤 설정이 어떤 코드로 생성됐는지 따라갈 수 있게 해 주는 정보예요."],
      api: ["AUTOSAR 표준 API 레이어", "어느 MCU에서나 같은 함수 이름과 규격으로 부를 수 있게 감싼 층이에요."],
      check: ["파라미터 유효성 검사", "잘못된 채널 번호 같은 입력을 걸러내는 코드예요."],
      asil: ["ASIL 기능안전 구조체", "ISO 26262 기능안전을 위한 구조와 데이터예요."],
    };
    const segs = [...document.querySelectorAll("#sizeLab .ext")];
    const chips = Object.entries(PARTS).map(([k, [label]]) => $("sizeParts").appendChild(h("span", { class: "chip", "data-part": k }, label)));
    function pick(k) {
      segs.forEach((s) => s.classList.toggle("on", s.dataset.part === k));
      chips.forEach((c) => c.classList.toggle("on", c.dataset.part === k));
      $("sizeNote").textContent = PARTS[k][0] + ": " + PARTS[k][1];
    }
    [...segs, ...chips].forEach((el) => el.addEventListener("click", () => pick(el.dataset.part)));
  }

  /* ---------- 09. 퀴즈 ---------- */
  EV.quiz($("quiz"), [
    { q: "IPL로 PTA29의 LED를 켜는 올바른 호출은?", choices: ["Siul2_Dio_Ip_WritePin(PTA_H_HALF, 29U, 1U);", "Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 1U);", "Siul2_Dio_Ip_WritePin(29U, 1U);", "Dio_WriteChannel(29U, STD_HIGH);"], answer: 1, why: "SIUL2는 포트를 16비트 Half로 나눠요. PTA29는 High Half(PTA_H_HALF)에 있고 상대 번호는 29 − 16 = 13U예요." },
    { q: "AUTOSAR MCAL에서 핀의 방향(입력/출력)과 Mux를 정하는 모듈은?", choices: ["Dio", "Port", "Mcu", "Platform"], answer: 1, why: "Port 모듈이 시작할 때 Port_Init()으로 Mux, 방향, 전기적 속성, 초기 레벨을 정해요. Dio는 이미 정해진 핀의 값을 읽고 쓰기만 해요." },
    { q: "임베디드 소프트웨어에서 '추상화'의 올바른 의미를 한 문장으로?", answer: "하드웨어 의존성을 코드의 어디에 모아 둘지 결정하는 설계 방법", why: "하드웨어를 숨기거나 모르게 만드는 게 아니에요. 의존성을 한곳(드라이버, 설정)에 모아 두면 보드가 바뀌어도 응용 코드는 그대로 둘 수 있어요." },
  ]);
})();
