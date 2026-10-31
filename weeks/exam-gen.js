// exam 페이지 랜덤 문제: 숫자 계산 생성기 + 개념 문제 은행. 4지선다 보기는 낼 때마다 섞는다.
// DOM을 쓰지 않아서 node로 바로 검사할 수 있다: node weeks/exam-gen.test.mjs
import { C, MORE, FIXED } from "./exam-bank.js";

const rint = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hx = (v, w = 2) => "0x" + v.toString(16).toUpperCase().padStart(w, "0");
const hx8 = (v) => hx(v >>> 0, 8);

// 정답 + 오답 후보에서 중복을 빼고 4개를 만든다. 후보가 모자라면 null(호출하는 쪽이 다시 뽑음)
function mc(t, q, right, wrongs, why) {
  const choices = [right];
  for (const w of wrongs) if (choices.length < 4 && !choices.includes(w)) choices.push(w);
  return choices.length === 4 ? { t, q, choices, answer: 0, why } : null;
}

export function shuffle(it) {
  if (!it.choices) return it;
  const order = it.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...it, choices: order.map((i) => it.choices[i]), answer: order.indexOf(it.answer) };
}

/* ---------- 숫자 계산 생성기 ---------- */
const OPF = { "&": (a, b) => a & b, "|": (a, b) => a | b, "^": (a, b) => a ^ b };
const MASK = {
  SET: { code: "|= (1U << n)", f: (r, n) => r | (1 << n) },
  CLEAR: { code: "&= ~(1U << n)", f: (r, n) => r & ~(1 << n) & 0xff },
  TOGGLE: { code: "^= (1U << n)", f: (r, n) => r ^ (1 << n) },
};
const bits8 = (v) => v.toString(2).padStart(8, "0");
const lsbFirst = (v) => bits8(v).split("").reverse().join(" ");
const fmtTime = (s) => (s < 1e-3 ? (s * 1e6).toFixed(1) + " µs" : (s * 1e3).toFixed(2) + " ms");

export const GENS = [
  () => {
    const a = rint(0, 255), b = rint(0, 255), op = pick(Object.keys(OPF));
    const others = Object.keys(OPF).filter((o) => o !== op).map((o) => hx(OPF[o](a, b)));
    return mc("힌트", `${hx(a)} ${op} ${hx(b)} 의 결과는?`, hx(OPF[op](a, b)),
      [...others, hx(~a & 0xff), hx(~b & 0xff), hx((a + b) & 0xff)],
      `${bits8(a)} ${op} ${bits8(b)} = ${bits8(OPF[op](a, b))}. 다른 보기는 다른 연산자나 NOT을 쓴 값이에요.`);
  },
  () => {
    const a = rint(1, 255), n = rint(1, 4), r = (a << n) & 0xff;
    return mc("힌트", `unsigned char A = ${hx(a)}; 일 때 (unsigned char)(A << ${n}) 의 값은?`, hx(r),
      [hx(a << n, 3), hx(a >> n), hx((a << (n + 1)) & 0xff), hx((a << (n - 1)) & 0xff), hx(~r & 0xff)],
      `${bits8(a)}를 왼쪽으로 ${n}칸 밀고 8비트를 넘친 위쪽은 버려요 → ${bits8(r)} = ${hx(r)}.`);
  },
  () => {
    const reg = rint(0, 255), n = rint(0, 7), k = pick(Object.keys(MASK));
    const r = MASK[k].f(reg, n);
    const others = Object.keys(MASK).filter((o) => o !== k).map((o) => hx(MASK[o].f(reg, n)));
    return mc("힌트", `REG = ${hx(reg)}; 다음 REG ${MASK[k].code.replace("n", n)}; 를 실행하면 REG는?`, hx(r),
      [...others, hx(reg), hx(1 << n), hx(~reg & 0xff)],
      `${k}예요. ${bits8(reg)}의 ${n}번 비트만 바꾸면 ${bits8(r)} = ${hx(r)}.`);
  },
  () => {
    const base = pick([0x10002000, 0x20000100, 0x40001000, 0x10002100]), k = rint(2, 15);
    return mc("힌트", `uint32_t 멤버 v0~v15로 된 구조체 포인터 p = (msr *)${hx8(base)}; 일 때 p->v${k} 의 주소는?`, hx8(base + 4 * k),
      [hx8(base + parseInt(String(4 * k), 16)), hx8(base + k), hx8(base + 8 * k), hx8(base + 4 * (k + 1)), hx8(base + 4 * (k - 1))],
      `v${k}은 ${k} × 4 = ${4 * k}바이트 뒤예요. ${4 * k}는 16진수로 ${hx(4 * k)}라서 ${hx8(base + 4 * k)}.`);
  },
  () => {
    const baud = pick([9600, 19200, 38400, 57600, 115200]), k = rint(1, 20);
    return mc("W1", `${baud} bps, 8-N-1로 문자 ${k}개를 보내는 데 걸리는 시간은?`, fmtTime((10 * k) / baud),
      [8, 9, 11, 12].map((b) => fmtTime((b * k) / baud)),
      `문자 하나 = Start 1 + Data 8 + Stop 1 = 10비트. 10 × ${k} ÷ ${baud} = ${fmtTime((10 * k) / baud)}.`);
  },
  () => {
    const c = rint(0x21, 0x7e), ch = String.fromCharCode(c);
    const rot = (v) => ((v << 1) | (v >> 7)) & 0xff;
    return mc("W1", `UART로 '${ch}'(${hx(c)} = ${bits8(c)})를 보낼 때 Start 비트 뒤 데이터 비트 순서는?`, lsbFirst(c),
      [bits8(c).split("").join(" "), lsbFirst(~c & 0xff), lsbFirst(rot(c)), bits8(~c & 0xff).split("").join(" ")],
      `UART는 LSB(0번 비트)부터 보내요. ${bits8(c)}를 오른쪽 끝부터 읽으면 ${lsbFirst(c)}.`);
  },
  () => {
    const n = rint(0, 31), off = 4 * Math.floor(n / 4) + (3 - (n % 4)), B = 0x40291300;
    return mc("W2", `GPIO[${n}]의 GPDO 절대 주소는? (GPDO 시작 0x40291300)`, hx8(B + off),
      [hx8(B + n), hx8(B + n + 1), hx8(B + Math.abs(n - 1)), hx8(B + off + 1), hx8(B + Math.abs(off - 1)), hx8(B + 4 * n)],
      `4개 묶음 안에서 거꾸로예요. ${n} 이하인 4의 배수 ${4 * Math.floor(n / 4)} + (3 − ${n % 4}) = ${off} = ${hx(off)}.`);
  },
  () => {
    const n = rint(2, 47), B = 0x40290240;
    return mc("W2", `MSCR[${n}]의 절대 주소는? (MSCR[0] = 0x40290240)`, hx8(B + 4 * n),
      [hx8(B + parseInt(String(4 * n), 16)), hx8(B + n), hx8(0x40290000 + 4 * n), hx8(B + 4 * (n + 1)), hx8(B + 8 * n)],
      `MSCR[n] = 0x40290240 + 4 × n. 4 × ${n} = ${4 * n} = ${hx(4 * n)}이라 ${hx8(B + 4 * n)}.`);
  },
  () => {
    const P = pick(["A", "B"]), n = rint(0, 31), H = n >= 16 ? "H" : "L", O = H === "H" ? "L" : "H";
    return mc("W3", `IPL Siul2_Dio_Ip_WritePin()으로 PT${P}${n}에 쓸 때 (Half, 핀 번호)는?`, `PT${P}_${H}_HALF, ${n % 16}U`,
      [`PT${P}_${O}_HALF, ${n % 16}U`, `PT${P}_${H}_HALF, ${n}U`, `PT${P}_${O}_HALF, ${n}U`, `PT${P}_${H}_HALF, ${(n % 16) + 1}U`, `PT${P}_${H}_HALF, ${(n % 16) + 16}U`, `PT${P}_${O}_HALF, ${(n % 16) + 1}U`],
      `0~15번은 Low Half, 16~31번은 High Half예요. ${n}은 ${H === "H" ? "High" : "Low"} Half, 상대 번호 ${n} − ${n >= 16 ? 16 : 0} = ${n % 16}.`);
  },
  () => {
    const a = rint(0x08, 0x77), rw = rint(0, 1), right = (a << 1) | rw;
    return mc("W4", `7비트 주소 ${hx(a)}인 장치에 ${rw ? "읽기" : "쓰기"}를 할 때 버스에 나가는 첫 바이트는?`, hx(right),
      [hx(a), hx(right ^ 1), hx(a >> 1), hx(((a + 1) << 1) | rw), hx(a | 0x80)],
      `${hx(a)} << 1 = ${hx(a << 1)}, ${rw ? "읽기는 R/W = 1" : "쓰기는 R/W = 0"}을 붙여 ${hx(right)}. RTD API에는 7비트 ${hx(a)}를 그대로 넣어요.`);
  },
  () => {
    const row = rint(0, 1), col = rint(0, 15), addr = row * 0x40 + col;
    return mc("W4", `LCD ${row + 1}행 ${col}번 열(0부터 셈)로 커서를 옮기는 명령 바이트는?`, hx(0x80 | addr),
      [hx(addr), hx(0x80 | (row * 0x10 + col)), hx(0x80 | ((1 - row) * 0x40 + col)), hx(0x80 | (addr + 1)), hx(0x80 | Math.abs(addr - 1))],
      `${row + 1}행 DDRAM 시작은 ${hx(row * 0x40)}, 열 ${col}을 더해 ${hx(addr)}. SetCursor = 0x80 | 주소 = ${hx(0x80 | addr)}.`);
  },
  () => {
    const c = rint(0x21, 0x7e), hi = c >> 4, lo = c & 0xf, n = (v) => hx(v, 1);
    return mc("W4", `'${String.fromCharCode(c)}'(${hx(c)})를 HD44780 4비트 모드로 보낼 때 니블 순서는?`, `${n(hi)} 먼저 → ${n(lo)} 나중`,
      [`${n(lo)} 먼저 → ${n(hi)} 나중`, `${hx(c)} 한 번에`, `${n(hi ^ 1)} 먼저 → ${n(lo)} 나중`, `${n(hi)} 먼저 → ${n(lo ^ 1)} 나중`],
      `상위 니블 ${n(hi)}를 먼저, 하위 니블 ${n(lo)}를 나중에 보내요. 니블마다 E=1, E=0 두 번이라 글자 하나에 I2C 쓰기 4번.`);
  },
  () => {
    const e = rint(0, 31), g = e >> 3;
    return mc("W5", `EIRQ ${e}번에 연결된 외부 인터럽트의 벡터는?`, `SIUL_${g}_IRQn (IRQ ${53 + g})`,
      [0, 1, 2, 3].filter((x) => x !== g).map((x) => `SIUL_${x}_IRQn (IRQ ${53 + x})`),
      `EIRQ는 8개씩 벡터를 공유해요. ${e}는 ${8 * g}~${8 * g + 7} 묶음이라 SIUL_${g}_IRQn, 핸들러 SIUL2_EXT_IRQ_${8 * g}_${8 * g + 7}_ISR.`);
  },
  () => {
    const p = rint(0, 15); let q = rint(0, 15); while (q === p) q = rint(0, 15);
    const hi = Math.min(p, q);
    return mc("W5", `우선순위 ${p}인 ISR이 실행 중일 때 우선순위 ${q}인 인터럽트가 들어왔다. (Cortex-M NVIC)`,
      hi === q ? `${q}가 ${p}를 선점한다` : `${q}는 ${p}가 끝날 때까지 기다린다`,
      [hi === q ? `${q}는 ${p}가 끝날 때까지 기다린다` : `${q}가 ${p}를 선점한다`, "들어온 인터럽트는 버려진다", "숫자가 큰 쪽이 항상 먼저다"],
      `Cortex-M은 숫자가 작을수록 우선순위가 높아요. ${hi}가 더 높아요.`);
  },
  () => {
    const code = rint(100, 4095), mv = Math.floor((code * 5000) / 4095);
    return mc("W6", `12-bit ADC, Vref 5000 mV에서 코드 ${code}는 몇 mV인가? (정수 계산)`, `${mv} mV`,
      [`${code} mV`, `${Math.floor((code * 5000) / 16383)} mV`, `${Math.floor((code * 3300) / 4095)} mV`, `${mv * 4} mV`],
      `전압 = ${code} × 5000 / 4095 = ${mv} mV. 16383으로 나눈 값은 14-bit 식이에요.`);
  },
  () => {
    const v = rint(5, 45) * 100, code = Math.round((v * 16383) / 5000), shown = Math.floor((code * 5000) / 4095);
    return mc("W6", `분해능을 14-bit 기본값 그대로 두고 실제 ${v} mV를 코드 × 5000 / 4095 식으로 계산하면 약?`, `${shown} mV`,
      [`${v} mV`, `${Math.round(v / 4)} mV`, `${v * 2} mV`, `${v * 16} mV`],
      `14-bit 코드는 ${code}(0~16383)인데 4095로 나누니 약 4배 ${shown} mV가 나와요. RESOLUTION_12로 바꿔야 해요.`);
  },
  () => {
    const h = pick([1, 2, 4, 8, 16, 32]), N = pick([2, 4, 8, 16]);
    return mc("W6", `하드웨어 평균 ${h}회 위에 N = ${N} 이동 평균을 쓰면 filtered 하나에 들어가는 변환 횟수는?`, `${h * N}회`,
      [`${h + N}회`, `${h}회`, `${N}회`, `${h * N * 2}회`, `${h * N + h}회`, `${h * N * 4}회`],
      `filtered 1개 = 최근 ${N}번 읽기, 읽기 1번 = ${h}회 변환이라 ${h} × ${N} = ${h * N}회.`);
  },
  () => {
    const b = pick([8, 10, 12, 14, 16]);
    return mc("W6", `${b}-bit SAR ADC의 변환 1회에서 비교 횟수와 최대 코드는?`, `${b}번, ${2 ** b - 1}`,
      [`${2 ** b}번, ${2 ** b - 1}`, `${b}번, ${2 ** b}`, `1번, ${2 ** b - 1}`, `${b * 2}번, ${2 ** (b - 1)}`],
      `SAR은 MSB부터 한 비트씩 정하니 비트 수만큼 ${b}번 비교해요. 코드는 0~${2 ** b - 1}.`);
  },
  () => {
    // 시험 대비 노트의 SIUL2_Type처럼 uint8_t RESERVED 배열이 끼어 있는 구조체
    const mem = [];
    let off = 0, r = 0, m = 1;
    const n = rint(4, 7);
    for (let i = 0; i < n; i++) {
      if (i > 0 && Math.random() < 0.35) { const k = pick([4, 8, 12]); mem.push({ name: `RESERVED_${r++}[${k}]`, type: "uint8_t", off, size: k }); off += k; }
      else { mem.push({ name: `REG${m++}`, type: "uint32_t", off, size: 4 }); off += 4; }
    }
    const regs = mem.filter((x) => x.type === "uint32_t" && x.off > 0);
    if (!regs.length) return null;
    const tgt = pick(regs), base = 0x40290000, idx = mem.indexOf(tgt);
    const def = mem.map((x) => `${x.type} ${x.name};`).join(" ");
    const regIdx = mem.filter((x) => x.type === "uint32_t").indexOf(tgt);
    return mc("힌트", `struct { ${def} } 의 베이스가 0x40290000일 때 ${tgt.name}의 주소는?`, hx8(base + tgt.off),
      [hx8(base + 4 * regIdx), hx8(base + parseInt(String(tgt.off), 16)), hx8(base + tgt.off + 4), hx8(base + tgt.off - 4), hx8(base + idx)],
      `앞 멤버 크기를 더해요: ${mem.slice(0, idx).map((x) => x.size).join(" + ")} = ${tgt.off} = ${hx(tgt.off)}. uint8_t[k]는 k바이트, uint32_t는 4바이트예요.`);
  },
  () => {
    const clk = pick([24, 30, 40, 48]), div = pick([1, 2, 4, 8, 16, 32]), f = clk / div;
    const fmt = (v) => (v >= 1 ? `${+v.toFixed(3)} MHz` : `${+(v * 1000).toFixed(3)} kHz`);
    return mc("W4", `LPI2C 입력 클럭 ${clk} MHz에 Prescaler DIV_${div}를 쓰면 모듈 클럭은?`, fmt(f),
      [fmt(clk * div), fmt(clk / (div * 2)), fmt(clk / (div / 2)), fmt(clk - div), fmt(clk / (div + 1))],
      `${clk} / ${div} = ${fmt(f)}. 이 클럭을 기준으로 High/Low 주기 카운트를 정해 100 kHz 같은 I2C 속도를 만들어요.`);
  },
];

/* ---------- 개념 문제 은행: choices[0]이 정답 ---------- */
const BASE = [
  C("힌트", "1 & 2 와 1 && 2 의 값은 각각?", ["0, 1", "1, 1", "0, 0", "3, 1"], "&는 칸마다 AND라 0001 & 0010 = 0, &&는 '둘 다 참?'이라 1이에요."),
  C("힌트", "레지스터의 특정 비트만 1로 켜는 데 쓰는 연산은?", ["OR (|=)", "AND (&=)", "XOR (^=)", "NOT (~)"], "SET은 OR, CLEAR는 AND + NOT, TOGGLE은 XOR, CHECK는 AND예요."),
  C("힌트", "레지스터의 특정 비트만 뒤집는(토글) 연산은?", ["XOR (^=)", "OR (|=)", "AND (&=)", "시프트 (<<=)"], "XOR은 서로 다르면 1이라, 마스크 비트 자리만 0↔1이 바뀌어요."),
  C("힌트", "마스크를 1 << n 대신 1U << n 으로 만드는 이유는?", ["signed 시프트의 부호 비트 문제를 피하려고", "실행 속도가 빨라서", "메모리를 덜 써서", "컴파일러가 1을 못 읽어서"], "signed 값을 시프트하면 부호 비트가 끼어들 수 있어요. unsigned로 두면 빈자리가 항상 0이에요."),
  C("힌트", "구조체 포인터 msrstart에서 msrstart.v0 이 컴파일 에러인 이유는?", ["포인터에는 -> (또는 (*p).v0)를 써야 해서", "v0이 private이라서", "구조체는 레지스터에 못 써서", "volatile이 빠져서"], "msrstart->v0는 (*msrstart).v0와 같아요. 포인터에 .을 바로 쓰면 에러예요."),
  C("힌트", "uint32_t 레지스터를 구조체로 묶었을 때 멤버 사이 주소 간격은?", ["4바이트", "1바이트", "8바이트", "32바이트"], "32비트 = 4바이트라 +4씩 늘어나요. 3번째 멤버는 +12 = 0x0C."),
  C("힌트", "*((int *)0x10002000) 에서 (int *) 가 하는 일은?", ["숫자 0x10002000을 int를 가리키는 주소로 바꾼다", "주소에 저장된 값을 읽는다", "0x10002000을 int로 반올림한다", "메모리를 새로 할당한다"], "캐스팅으로 숫자를 주소로 바꾸고, 맨 앞 *가 그 주소로 찾아가 값을 읽고 써요."),
  C("힌트", "volatile을 빼면 ISR이 바꾼 flag를 main 루프가 못 보는 이유는?", ["컴파일러가 flag를 CPU 레지스터에 복사해 두고 그것만 다시 읽어서", "ISR이 메모리에 쓰지 않아서", "flag가 스택에 있어서", "인터럽트가 꺼져서"], "volatile은 '매번 실제 주소에서 읽어라'는 표시예요."),
  C("W1", "8-N-1의 뜻은?", ["데이터 8비트, 패리티 없음, Stop 1비트", "8바이트, NRZ, 1채널", "8 MHz, Normal 모드, 1 Stop", "데이터 8비트, 패리티 1개, Stop 없음"], "N = No parity예요. Start 1비트는 항상 붙어서 글자 하나 = 10비트."),
  C("W1", "UART가 baud rate를 양쪽에서 미리 맞춰야 하는 이유는?", ["클럭 선이 없는 비동기 통신이라서", "선이 하나라서", "패리티가 없어서", "속도가 빨라서"], "받는 쪽은 약속한 속도로 비트 길이를 재서 샘플링해요."),
  C("W1", "UART가 데이터 비트를 보내는 순서는?", ["LSB부터", "MSB부터", "Start 비트 다음 패리티부터", "매번 바뀐다"], "가장 작은 비트(0번)부터 보내요."),
  C("W1", "S32K312EVB에서 PC 터미널(OpenSDA VCOM)에 연결된 UART는?", ["LPUART6 (PTA16 TX, PTA15 RX)", "LPUART0 (PTA8, PTA9)", "LPUART1 (PTA16, PTA15)", "LPUART6 (PTA15 TX, PTA16 RX)"], "VCOM은 LPUART6에 배선돼 있어요. TX가 PTA16이에요."),
  C("W1", "PLL이 Lock 되기 전에 클럭을 분배하면?", ["불안정한 클럭이 퍼져 출력이 없거나 HardFault가 날 수 있다", "속도가 2배가 된다", "아무 문제 없다", "UART만 느려진다"], "그래서 Lock을 기다린 뒤 분배해요."),
  C("W1", "_write()가 ptr == NULL 같은 잘못된 인자를 받으면 돌려주는 값은?", ["0", "-1", "len", "1"], "잘못된 인자 0, 송신 실패 -1, 성공 len이에요."),
  C("W1", "부팅 후 printf까지 올바른 준비 순서는?", ["클럭 → 핀 → UART → printf", "핀 → 클럭 → UART → printf", "UART → 핀 → 클럭 → printf", "printf → UART → 핀 → 클럭"], "baud rate가 클럭에서 나오니 클럭이 먼저예요."),
  C("W2", "Memory-Mapped I/O의 뜻은?", ["주변장치 레지스터가 메모리 주소에 배치돼 포인터로 읽고 쓴다", "메모리를 디스크처럼 쓴다", "I/O 전용 명령어로만 접근한다", "레지스터를 RAM으로 복사해 쓴다"], "그래서 *((volatile uint32_t *)주소)로 레지스터를 직접 다뤄요."),
  C("W2", "SIUL2 MSCR에서 OBE 비트의 역할은?", ["출력 버퍼를 켠다 (Output Buffer Enable)", "입력 버퍼를 켠다", "풀업을 켠다", "인터럽트를 켠다"], "OBE(비트 21)를 1로 켜야 GPDO 값이 핀으로 나가요. SSS(비트 3:0)는 신호 Mux 선택이에요."),
  C("W2", "MSCR의 SSS 필드가 정하는 것은?", ["핀에 연결할 신호 소스(Mux, GPIO 등)", "출력 세기", "슬루율", "인터럽트 에지"], "Source Signal Select예요. GPIO로 쓰려면 GPIO 소스를 골라요."),
  C("W2", "핀에 내보낼 출력 값(0/1)을 쓰는 SIUL2 레지스터는?", ["GPDO", "MSCR", "GPDI", "IMCR"], "GPDO = GPIO Pad Data Output. GPDI는 입력 값 읽기예요."),
  C("W2", "MSCR 번호와 GPIO 번호는 항상 같다?", ["아니다. IOMUX 표에서 따로 확인해야 한다", "그렇다, 항상 같다", "MSCR이 항상 +16이다", "포트 A에서만 같다"], "PTA29는 우연히 둘 다 29예요."),
  C("W2", "D13 LED가 Active High라는 뜻은?", ["1을 쓰면 켜진다", "0을 쓰면 켜진다", "전압이 높으면 꺼진다", "토글할 때만 켜진다"], "0 = 켜짐은 Active Low예요."),
  C("W2", "GPDO가 다른 레지스터와 달리 주의해야 하는 배치 특징은?", ["4개 묶음 안에서 바이트 순서가 거꾸로다", "2바이트 간격이다", "8개씩 묶여 있다", "주소가 내려간다"], "그래서 GPIO[29]는 0x131D가 아니라 0x131E예요."),
  C("W3", "임베디드 소프트웨어에서 '추상화'의 올바른 의미는?", ["하드웨어 의존성을 코드의 어디에 모아 둘지 정하는 설계", "하드웨어를 몰라도 되게 숨기는 것", "코드를 짧게 만드는 것", "레지스터를 쓰지 않는 것"], "의존성을 드라이버·설정에 모아 두면 보드가 바뀌어도 응용 코드는 그대로예요."),
  C("W3", "MCAL에서 Port와 Dio의 역할 분담은?", ["Port: 시작 시 Mux·방향 설정, Dio: 실행 중 값 읽고 쓰기", "Port: 값 쓰기, Dio: Mux 설정", "둘 다 같은 일을 한다", "Port: 인터럽트, Dio: 클럭"], "Port_Init()이 핀을 준비하고, Dio_WriteChannel()이 High/Low만 해요."),
  C("W3", "IPL(IP Level Driver)의 설명으로 맞는 것은?", ["특정 MCU 주변장치에 붙은 벤더 저수준 드라이버", "AUTOSAR 표준 API", "응용 계층 라이브러리", "부트로더"], "예: Siul2_Dio_Ip.h. MCAL은 그 위에서 AUTOSAR 표준 모양 API를 줘요."),
  C("W3", "자동 생성된 Dio_Cfg.h에서 식별자 에러가 났을 때 올바른 처리는?", ["Config Tools에서 고친 뒤 [Update Code]", "Dio_Cfg.h를 직접 고친다", "헤더를 지운다", "IPL로 바꾼다"], "생성 파일을 손으로 고치면 다음 생성 때 덮어써져요."),
  C("W3", "Dio_FlipChannel 링크 에러의 흔한 원인은?", ["DioFlipChannelApi를 켜지 않았거나 Update Code를 안 해서", "LED가 Active Low라서", "Port_Init을 두 번 불러서", ".bss가 커서"], "API를 STD_ON으로 켜고 코드를 다시 생성해야 함수가 생겨요."),
  C("W3", "같은 기능에서 MCAL의 .text가 IPL보다 크다. 올바른 해석은?", ["크기만으로 판단할 수 없다. 표준화·이식성·기능안전 이득이 있다", "MCAL은 쓰면 안 된다", "IPL에 버그가 있다", "빌드 설정 오류다"], "추상화 계층이 늘어 코드가 커지는 대신 이식성과 검증 이득을 얻어요."),
  C("W3", "size 출력에서 text, data, bss의 의미로 맞는 것은?", ["text: 코드·읽기 전용, data: 초기값 있는 전역, bss: 0으로 초기화될 전역", "text: 문자열만, data: 스택, bss: 힙", "text: RAM, data: Flash, bss: 레지스터", "셋 다 Flash 크기다"], "text는 Flash, data는 Flash에 초기값 + RAM에 복사, bss는 RAM에서 0으로 채워요."),
  C("W4", "I2C 선(SDA, SCL)에 풀업 저항이 필요한 이유는?", ["오픈 드레인이라 장치는 LOW로 당기기만 하고 HIGH는 풀업이 만든다", "전류를 막으려고", "속도를 높이려고", "ACK를 만들려고"], "그래서 여러 장치가 한 선을 공유해도 충돌이 안 나요."),
  C("W4", "I2C START 조건은?", ["SCL이 HIGH일 때 SDA가 HIGH → LOW", "SCL이 LOW일 때 SDA가 HIGH → LOW", "SDA가 HIGH일 때 SCL이 LOW → HIGH", "SCL이 HIGH일 때 SDA가 LOW → HIGH"], "SCL HIGH 중 SDA 하강이 START, SDA 상승이 STOP이에요."),
  C("W4", "I2C에서 ACK는 어떻게 표시되나?", ["9번째 클럭에서 받는 쪽이 SDA를 LOW로 당긴다", "보내는 쪽이 SDA를 HIGH로 둔다", "SCL을 두 번 친다", "STOP을 보낸다"], "SDA가 HIGH로 남으면 NACK예요. 스캐너는 이걸로 장치 유무를 판단해요."),
  C("W4", "RTD Lpi2c_Ip_MasterSetSlaveAddr()에 LCD 백팩 주소로 넣는 값은?", ["0x27 (7비트)", "0x4E (8비트 쓰기)", "0x4F", "0x13"], "R/W 비트는 드라이버가 붙여요. 0x4E를 넣으면 한 칸 더 밀려요."),
  C("W4", "HD44780이 데이터를 받아들이는 순간은?", ["E가 1 → 0으로 떨어질 때", "E가 0 → 1로 올라갈 때", "SCL이 HIGH일 때마다", "RS가 바뀔 때"], "하강 에지라서 니블마다 E=1, E=0을 연달아 보내요."),
  C("W4", "PCF8574의 역할은?", ["I2C로 받은 바이트를 8비트 병렬 핀으로 내보내는 확장기", "LCD 컨트롤러", "ADC", "레벨 시프터 전용 칩"], "그 8비트가 LCD의 D4~D7, RS, E, 백라이트 등에 연결돼요."),
  C("W4", "I2C 스캔 직후 Lcd1602_Init()을 다시 부르는 이유는?", ["스캐너가 LCD 주소에도 0x00을 보내 핀 상태가 엉켜서", "주소가 바뀌어서", "백라이트가 꺼져서 켜려고", "I2C 속도가 바뀌어서"], "LCD 4비트 동기화가 깨지니 초기화를 다시 해요."),
  C("W4", "S32K3 RTD에서 I2C 드라이버가 제공되는 형태는?", ["CDD (Complex Device Driver)", "AUTOSAR 표준 BSW 모듈", "OS 서비스", "제공 안 됨"], "AUTOSAR 표준에는 CAN, LIN, FlexRay, SPI 같은 차량 주력 버스만 있어요."),
  C("W4", "Lpi2c_Ip_MasterInit()과 I2c_Init()을 한 빌드에서 같이 부르면?", ["같은 하드웨어를 두 드라이버가 잡아 충돌한다", "속도가 2배가 된다", "자동으로 하나만 쓰인다", "문제없다"], "IPL과 MCAL은 대체 관계예요. 하나만 골라요."),
  C("W5", "폴링과 인터럽트의 차이로 맞는 것은?", ["폴링은 CPU가 계속 확인, 인터럽트는 이벤트가 CPU를 부른다", "폴링이 항상 더 빠르다", "인터럽트는 CPU 시간을 더 쓴다", "둘은 같은 말이다"], "택배: 1분마다 문 열기 = 폴링, 초인종 = 인터럽트."),
  C("W5", "ISR 안에서 해도 되는 일은?", ["카운트 증가, 플래그 세우기", "LCD 출력", "printf", "수백 ms Delay"], "ISR은 짧게. 출력은 main이 플래그를 보고 해요."),
  C("W5", "인터럽트 진입 시 하드웨어가 자동으로 PUSH하는 레지스터는?", ["R0~R3, R12, LR, PC, xPSR", "R0~R12 전부", "R4~R11", "SP, PC만"], "복귀 때 EXC_RETURN을 보고 같은 8개를 자동 POP해요. R4~R11은 필요하면 컴파일러가 저장해요."),
  C("W5", "Cortex-M 벡터 테이블 3번은?", ["HardFault", "Reset", "NMI", "SysTick"], "0 = 초기 SP, 1 = Reset, 2 = NMI, 3 = HardFault."),
  C("W5", "MCAL Icu로 버튼 콜백을 받으려면 Icu_Init() 뒤에 필요한 것은?", ["Icu_EnableEdgeDetection()과 Icu_EnableNotification()", "Icu_StartTimestamp()", "Port_Init() 한 번 더", "아무것도 필요 없다"], "Init만으로는 에지 감지와 알림이 꺼져 있어요."),
  C("W5", "NVIC 우선순위 규칙으로 맞는 것은?", ["숫자가 작을수록 높다 (0이 최고)", "숫자가 클수록 높다", "들어온 순서대로다", "IRQ 번호가 작을수록 높다"], "그래서 우선순위 0~5는 10인 버튼 ISR을 선점할 수 있어요."),
  C("W5", "버튼 한 번에 카운트가 여러 번 오르는 원인은?", ["채터링(접점 튐) → 디바운싱으로 해결", "우선순위 설정 오류", "volatile 누락", "벡터 테이블 오류"], "몇 ms 동안 튀는 신호를 시간 조건으로 걸러요."),
  C("W5", "NVIC의 역할은?", ["인터럽트 요청을 우선순위대로 정리해 CPU에 전달한다", "핀 Mux를 정한다", "클럭을 만든다", "메모리를 보호한다"], "Nested Vectored Interrupt Controller. 중첩(선점)과 벡터 분기를 관리해요."),
  C("W6", "보드 가변저항(ADC_POT0)을 읽는 입력은?", ["ADC1 채널 S10 (PTA11)", "ADC0 채널 S10", "ADC1 채널 S11", "아무 채널이나 가능"], "채널은 핀이 정해요. MCAL에서는 S10_ChanNum34로 보여요."),
  C("W6", "Config Tools ADC Conversion resolution의 기본값과 문제는?", ["14-bit라 0~16383이 나와 /4095 식에서 약 4배가 된다", "12-bit라 문제없다", "8-bit라 값이 작다", "10-bit라 1/4이 된다"], "RESOLUTION_12로 바꿔야 0~4095예요."),
  C("W6", "이동 평균 N을 키우면?", ["더 안정되지만 반응이 느려진다", "더 빠르고 더 안정된다", "흔들림이 커진다", "아무 변화 없다"], "안정성과 응답 속도는 서로 바꿔치기예요."),
  C("W6", "MCAL ADC 콜백은 불리는데 main이 계속 대기한다. 먼저 의심할 것은?", ["완료 플래그에 volatile이 빠졌다", "ADC 채널이 틀렸다", "분해능이 14-bit다", "Vref가 낮다"], "AdcConvDone을 static volatile로 선언해야 main이 바뀐 값을 봐요."),
  C("W6", "IPL과 MCAL ADC 실습에서 변환 완료를 아는 방식은?", ["IPL은 플래그 폴링, MCAL은 group notification 콜백", "둘 다 폴링", "둘 다 콜백", "IPL은 콜백, MCAL은 Delay"], "MCAL은 Adc_EnableGroupNotification 등 설정이 모두 맞아야 콜백이 불려요."),
  C("W6", "양자화(quantization)의 뜻은?", ["연속 전압을 유한한 단계의 숫자로 근사하는 것", "신호를 증폭하는 것", "잡음을 없애는 것", "샘플링 주기를 정하는 것"], "12-bit면 4096단계라 1단계 ≈ 5000/4095 ≈ 1.22 mV예요."),
  C("W6", "ADC 콜백 안에서 LCD에 결과를 출력하면 안 되는 이유는?", ["콜백도 ISR 안에서 실행돼 길게 막으면 안 되니까", "콜백에서는 I2C가 하드웨어적으로 막혀서", "LCD가 콜백을 모르므로", "ADC 값이 아직 없어서"], "콜백은 플래그만 세우고, 출력은 main에서 해요."),
];
export const BANK = [...BASE, ...MORE, ...FIXED];

const topicOf = (g) => { let it = null; while (!it) it = g(); return it.t; };

// 숫자 생성기와 개념 문제를 반반 섞어 n개. topic이 있으면 그 주제만.
export function makeSet(n, topic) {
  const gens = GENS.filter((g) => !topic || topicOf(g) === topic);
  const bank = BANK.filter((b) => !topic || b.t === topic);
  const bag = [...bank].sort(() => Math.random() - 0.5);
  const out = [];
  while (out.length < n) {
    let it = null;
    if (gens.length && (out.length % 2 === 0 || !bag.length)) while (!it) it = pick(gens)();
    else if (bag.length) it = bag.pop();
    else break;
    out.push(shuffle(it));
  }
  return out;
}
