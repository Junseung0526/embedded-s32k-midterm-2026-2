// hints 페이지: 비트 연산 놀이터, 마스킹/포인터/구조체 Stepper, volatile 데모, 퀴즈
(function () {
  const { h } = EV;
  const $ = (id) => document.getElementById(id);

  /* ---------- 01. 비트 연산 6종 ---------- */
  const OPS = {
    "&": { usesB: true, desc: "AND: 둘 다 1일 때만 1. 특정 비트만 뽑거나 0으로 지울 때 써요.", f: (a, b) => a & b },
    "|": { usesB: true, desc: "OR: 하나라도 1이면 1. 특정 비트를 1로 켤 때 써요.", f: (a, b) => a | b },
    "^": { usesB: true, desc: "XOR: 서로 다르면 1. 특정 비트를 뒤집을 때 써요.", f: (a, b) => a ^ b },
    "~": { usesB: false, desc: "NOT: 모든 비트를 뒤집어요 (0→1, 1→0).", f: (a) => ~a },
    "<<": { usesN: true, desc: "왼쪽 시프트: n칸 밀고 오른쪽 빈자리는 0. 2ⁿ을 곱한 것과 같아요(넘친 비트는 버려짐).", f: (a, b, n) => a << n },
    ">>": { usesN: true, desc: "오른쪽 시프트: n칸 밀어요. unsigned면 왼쪽 빈자리에 0, signed 음수면 부호 비트 1이 채워져요.", f: (a, b, n, signed) => (signed ? ((a << 24) >> 24) >> n : a >>> n) },
  };
  let op = "&";

  const regA = EV.register($("regA"), { name: "A", bits: 8, editable: true, onChange: (v) => (($("inA").value = hex2(v)), update()) });
  const regB = EV.register($("regB"), { name: "B", bits: 8, editable: true, onChange: (v) => (($("inB").value = hex2(v)), update()) });
  const regR = EV.register($("regR"), { name: "결과", bits: 8 });

  const hex2 = (v) => v.toString(16).toUpperCase().padStart(2, "0");
  const readHex = (input) => {
    const v = parseInt(input.value, 16);
    return Number.isNaN(v) ? 0 : v & 0xff;
  };

  const opsBox = document.querySelector("#bitlab .ops");
  for (const name of Object.keys(OPS)) {
    opsBox.append(
      h("button", { class: "key", type: "button", "aria-pressed": name === op, onclick: () => { op = name; update(); } }, name)
    );
  }

  function update() {
    const a = readHex($("inA"));
    const b = readHex($("inB"));
    const n = Math.max(0, Math.min(7, Number($("inN").value) || 0));
    const signed = $("signed").checked;
    const spec = OPS[op];
    const r = spec.f(a, b, n, signed) & 0xff;

    regA.set(a);
    regB.set(b);
    regR.set(r);
    opsBox.querySelectorAll(".key").forEach((k) => k.setAttribute("aria-pressed", k.textContent === op));

    const showB = !!spec.usesB;
    $("labB").classList.toggle("dim", !showB);
    $("regB").classList.toggle("dim", !showB);
    $("labN").classList.toggle("dim", !spec.usesN);
    $("shiftNote").textContent = spec.usesN ? `A를 ${op === "<<" ? "왼쪽" : "오른쪽"}으로 ${n}칸` : "";
    $("signedWrap").classList.toggle("show", op === ">>");

    const A = "0x" + hex2(a);
    const expr = spec.usesB ? `${A} ${op} 0x${hex2(b)}` : spec.usesN ? `${A} ${op} ${n}` : `~${A}`;
    $("expr").textContent = `${expr} = 0x${hex2(r)}`;
    $("opdesc").textContent = spec.desc;
  }
  ["inA", "inB", "inN", "signed"].forEach((id) => $(id).addEventListener("input", update));
  update();

  /* ---------- 02. 마스킹 4공식 ---------- */
  {
    const side = h("div");
    const mask = EV.register(side.appendChild(h("div")), { name: "MASK", bits: 8 });
    const reg = EV.register(side.appendChild(h("div")), { name: "REG", bits: 8 });
    const extra = side.appendChild(h("div", { class: "row" }));
    const check = h("span", { class: "chip" }, "if 결과: -");
    extra.append(check);
    const led = EV.ledView(extra, "led");
    const checkView = {
      render(s) {
        check.textContent = s.cond == null ? "if 결과: -" : `if 결과: ${s.cond ? "참 (0이 아님)" : "거짓 (0)"}`;
        check.classList.toggle("on", s.cond === true);
      },
    };

    EV.stepper($("maskStepper"), {
      title: "SET · TOGGLE · CHECK · CLEAR",
      code: `
uint8_t REG = 0x00U;
REG |=  (1U << 5);      // SET    : 5번 비트 켜기
REG |=  (1U << 3);      // SET    : 3번 비트 켜기
REG ^=  (1U << 5);      // TOGGLE : 5번 비트 뒤집기
if (REG & (1U << 3))    // CHECK  : 3번 비트 확인
    led = 1;
REG &= ~(1U << 3);      // CLEAR  : 3번 비트 끄기`,
      initial: { regs: { REG: 0, MASK: 0 }, led: false, cond: null },
      intro: "REG는 8비트, 처음엔 전부 0이에요. → 를 눌러 한 줄씩 실행해 보세요.",
      side,
      views: [mask, reg, checkView, led],
      steps: [
        { line: 1, note: "REG를 0x00으로 시작해요.", apply: (s) => s },
        { line: 2, note: "1U << 5 = 0010 0000. OR는 마스크가 1인 칸만 1로 켜고 나머지는 그대로 둬요. → 0x20", apply: (s) => ({ ...s, regs: { MASK: 0x20, REG: s.regs.REG | 0x20 } }) },
        { line: 3, note: "3번 칸도 같은 방법으로 켜요. 5번 칸은 이미 1이라 그대로예요. → 0x28", apply: (s) => ({ ...s, regs: { MASK: 0x08, REG: s.regs.REG | 0x08 } }) },
        { line: 4, note: "XOR는 마스크가 1인 칸만 뒤집어요. 1이던 5번 칸이 0이 돼요. 한 번 더 하면 다시 1이에요. → 0x08", apply: (s) => ({ ...s, regs: { MASK: 0x20, REG: s.regs.REG ^ 0x20 } }), predict: { q: "REG ^= (1U << 5) 다음 REG는? (지금 0x28)", choices: ["0x28", "0x08", "0x20", "0x00"], answer: 1 } },
        { line: 5, note: "AND로 3번 칸만 남겨 봐요. 결과가 0x08(0이 아님)이라 if는 참이에요. 결과는 '1'이 아니라 '0이 아닌 값'이라는 점이 포인트예요.", apply: (s) => ({ ...s, regs: { MASK: 0x08, REG: s.regs.REG }, cond: (s.regs.REG & 0x08) !== 0 }) },
        { line: 6, note: "조건이 참이라 led = 1 이 실행돼요.", apply: (s) => ({ ...s, led: true }) },
        { line: 7, note: "~(1U << 3) = 1111 0111. 3번만 0인 마스크와 AND하면 3번 칸만 0이 되고 나머지는 그대로예요. → 0x00", apply: (s) => ({ ...s, regs: { MASK: 0xf7, REG: s.regs.REG & 0xf7 }, cond: null }) },
      ],
    });
  }

  /* ---------- 03. 포인터 캐스팅 4단계 ---------- */
  const NAMES = ["MSR0", "MSR1", "MSR2", "MSR3", "MSR4"];
  const START_MEM = [0x2a, 0, 0, 0, 0]; // 0x2A는 설명용 예시 값
  {
    const side = h("div");
    side.append(h("p", { class: "widget-title" }, "메모리 (0x2A는 예시 값)"));
    const mem = EV.memview(side.appendChild(h("div")), { base: 0x10002000, words: 5, names: NAMES });
    const vars = EV.varsView(side, ["i"], { i: (v) => (v == null ? "? (아직 없음)" : EV.hex(v)) });
    const kind = side.appendChild(h("span", { class: "chip" }));
    const kindView = { render: (s) => (kind.textContent = "지금 이 식의 정체: " + s.kind) };

    EV.stepper($("ptrStepper"), {
      title: "*((int *)0x10002000) 안쪽부터",
      code: `
0x10002000                       // ① 그냥 32비트 숫자
(int *)0x10002000                // ② "int(4바이트)가 있는 주소"로 형변환
*((int *)0x10002000)             // ③ 그 주소로 찾아가서 4바이트를 읽음
int i = *((int *)0x10002000);    // ④ 읽은 값을 변수 i에 저장
*((int *)0x10002000) = 0x1;      //    쓰기: 같은 주소에 1을 씀`,
      initial: { mem: START_MEM, focus: null, op: null, vars: { i: null }, kind: "-" },
      intro: "0x10002000 번지(MSR0 레지스터)에 예시 값 0x2A가 들어 있다고 해 볼게요.",
      side,
      views: [mem, vars, kindView],
      steps: [
        { line: 1, note: "① 아직은 그냥 정수 상수예요. 컴파일러는 이게 주소인지 몰라요.", apply: (s) => ({ ...s, kind: "정수 (숫자)" }) },
        { line: 2, note: "② (int *)를 붙이면 '4바이트 int가 들어 있는 주소'가 돼요. 아직 메모리에 가지는 않았어요.", apply: (s) => ({ ...s, kind: "int * (주소)", focus: 0, op: "addr" }) },
        { line: 3, note: "③ 맨 앞 *(역참조)가 그 주소로 직접 가서 4바이트를 읽어요. 레지스터 값 0x2A가 나와요.", apply: (s) => ({ ...s, kind: "int (그 칸의 값)", op: "read" }) },
        { line: 4, note: "④ 읽은 값 0x2A를 로컬 변수 i에 넣어요. 판서의 int i = *( (int *)0x10002000 ); 와 같아요.", apply: (s) => ({ ...s, vars: { i: s.mem[0] } }) },
        { line: 5, note: "식 전체에 = 를 붙이면 쓰기가 돼요. 0x10002000 번지에 1이 써지고 하드웨어가 그 값대로 동작해요.", apply: (s) => ({ ...s, op: "write", mem: [1, ...s.mem.slice(1)], kind: "int (그 칸에 쓰기)" }) },
      ],
    });
  }

  /* ---------- 04. 구조체 오프셋 ---------- */
  {
    const side = h("div");
    side.append(h("p", { class: "widget-title" }, "msrstart = (msr *)0x10002000"));
    const mem = EV.memview(side.appendChild(h("div")), { base: 0x10002000, words: 5, names: ["v0", "v1", "v2", "v3", "v4"] });
    const vars = EV.varsView(side, ["read_val"], { read_val: (v) => (v == null ? "?" : EV.hex(v)) });

    EV.stepper($("structStepper"), {
      title: "msrstart->vN",
      code: `
typedef struct {
    int v0;   // +0x00
    int v1;   // +0x04
    int v2;   // +0x08
    int v3;   // +0x0C
    int v4;   // +0x10
} msr;

msr *msrstart = (msr *)0x10002000;
msrstart->v0 = 0x10;
msrstart->v1 = 0x20;
int read_val = msrstart->v2;
msrstart->v3 = 0x30;`,
      initial: { mem: [null, null, 0x55, null, null], focus: null, op: null, vars: { read_val: null } },
      intro: "v2 칸에는 예시 값 0x55가 들어 있다고 해 볼게요.",
      side,
      views: [mem, vars],
      steps: [
        { line: [1, 2, 3, 4, 5, 6, 7], note: "구조체 멤버는 메모리에 순서대로 붙어서 놓여요. int가 4바이트라 각 멤버는 4바이트씩 떨어져 있어요.", apply: (s) => s },
        { line: 9, note: "베이스 주소 0x10002000을 구조체 포인터로 캐스팅해요. 이제 msrstart가 v0 칸을 가리켜요.", apply: (s) => ({ ...s, focus: 0, op: "addr" }) },
        { line: 10, note: "v0는 +0x00이라 0x10002000에 0x10을 써요.", apply: (s) => ({ ...s, focus: 0, op: "write", mem: [0x10, ...s.mem.slice(1)] }) },
        { line: 11, note: "v1은 +0x04. 컴파일러가 자동으로 0x10002004를 계산해서 0x20을 써요.", apply: (s) => ({ ...s, focus: 1, op: "write", mem: [s.mem[0], 0x20, ...s.mem.slice(2)] }) },
        { line: 12, note: "v2는 +0x08. 0x10002008에서 값을 읽어 read_val에 넣어요.", apply: (s) => ({ ...s, focus: 2, op: "read", vars: { read_val: s.mem[2] } }) },
        { line: 13, note: "v3은 +12바이트인데 16진수로는 0x0C예요. 그래서 0x1000200C. 0x10002012가 아니에요!", apply: (s) => ({ ...s, focus: 3, op: "write", mem: [...s.mem.slice(0, 3), 0x30, s.mem[4]] }), predict: { q: "msrstart->v3 의 주소는?", choices: ["0x10002003", "0x1000200C", "0x10002012"], answer: 1 } },
      ],
    });
  }

  // 오프셋 계산기: n번째 멤버의 주소 = 베이스 + n × 4
  function updateOffset() {
    const n = Number($("offN").value);
    const bytes = n * 4;
    $("offName").textContent = `v${n}`;
    const trap = bytes >= 10 ? ` <span class="warn">(10진수 ${bytes}를 그대로 붙여 0x100020${bytes}로 쓰면 틀려요)</span>` : "";
    $("offCalc").innerHTML = `0x10002000 + ${n} × 4 = 0x10002000 + ${bytes}(10진수) = 0x10002000 + ${EV.hex(bytes, 2)} = <b>${EV.hex(0x10002000 + bytes)}</b>${trap}`;
  }
  $("offN").addEventListener("input", updateOffset);
  updateOffset();

  /* ---------- 05. volatile 데모 ---------- */
  {
    const cols = [...document.querySelectorAll("#volatileDemo .vol-col")].map((col) => ({
      isVolatile: col.dataset.kind === "volatile",
      mem: col.querySelector(".mem"),
      cpu: col.querySelector(".cpu"),
      arrow: col.querySelector(".varrow"),
      status: col.querySelector(".vol-status"),
    }));
    let memFlag = 0;
    let ticks = 0;

    function tick() {
      ticks++;
      for (const c of cols) {
        if (c.status.classList.contains("out")) continue;
        // volatile 없음: 처음 한 번만 메모리에서 읽고, 그 뒤로는 레지스터 사본만 다시 본다
        const reads = c.isVolatile || ticks === 1;
        if (reads) {
          c.cpu.querySelector("b").textContent = memFlag;
          EV.pulse(c.cpu, "read");
        }
        c.arrow.classList.toggle("go", reads);
        c.arrow.classList.toggle("cut", !reads);
        const seen = Number(c.cpu.querySelector("b").textContent);
        c.status.textContent = seen === 0 ? (c.isVolatile ? "루프 도는 중 (매번 메모리에서 읽음)" : "루프 도는 중 (사본만 봄)") : "flag = 1 감지, 루프 탈출!";
        c.status.classList.toggle("spin", seen === 0);
        c.status.classList.toggle("out", seen !== 0);
      }
    }

    function reset() {
      memFlag = 0;
      ticks = 0;
      for (const c of cols) {
        c.mem.querySelector("b").textContent = "0";
        c.cpu.querySelector("b").textContent = "0";
        c.status.classList.remove("out");
      }
      tick();
    }

    $("isrBtn").addEventListener("click", () => {
      memFlag = 1;
      cols.forEach((c) => {
        c.mem.querySelector("b").textContent = "1";
        EV.pulse(c.mem, "read");
      });
    });
    $("volReset").addEventListener("click", reset);
    reset();
    setInterval(tick, 900);
  }

  /* ---------- 06. 퀴즈 ---------- */
  EV.quiz($("quiz"), [
    { q: "0x4B & 0x36 의 결과는?", choices: ["0x7F", "0x02", "0x7D", "0xB4"], answer: 1, why: "0100 1011 과 0011 0110 에서 둘 다 1인 칸은 1번 비트뿐이라 0000 0010 = 0x02예요. 0x7F는 OR, 0x7D는 XOR, 0xB4는 ~A예요." },
    { q: "msr *msrstart = (msr *)0x10002000; 일 때 msrstart->v3 의 주소는?", choices: ["0x10002003", "0x10002012", "0x1000200C", "0x10002030"], answer: 2, why: "v3은 네 번째 멤버라 3 × 4 = 12바이트 떨어져 있어요. 12는 16진수로 0x0C라서 0x1000200C예요." },
    { q: "하드웨어 레지스터를 C로 다룰 때, 컴파일러의 캐싱·최적화를 막고 매번 실제 주소에서 읽고 쓰게 강제하는 키워드는?", answer: "volatile", why: "하드웨어나 ISR이 코드와 상관없이 값을 바꿀 수 있으니, 레지스터에 저장해 둔 사본을 쓰지 말고 매번 메모리 버스로 실제 주소를 읽으라는 뜻이에요." },
  ]);
})();
