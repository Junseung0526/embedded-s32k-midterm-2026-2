// w6 페이지: 양자화, SAR 비트 결정, 가변저항→채널, 두 평균 비교, adc_filter Stepper, 14-bit 함정, 콜백 경로, 퀴즈
(function () {
  const { h } = EV;
  const $ = (id) => document.getElementById(id);
  const VREF = 5000; // 교재 예제 기준 mV
  const chips = (box, labels) =>
    labels.map((s, i) => {
      if (i) box.append(h("span", { class: "arrow" }, "→"));
      return box.appendChild(h("span", { class: "chip" }, s));
    });

  /* ---------- 01. 양자화와 분해능 ---------- */
  function drawQuant() {
    const bits = Number($("bits").value), vin = Number($("vin").value);
    const levels = 2 ** bits - 1;
    const code = Math.round((vin * levels) / VREF);
    const back = (code * VREF) / levels;
    const X0 = 50, X1 = 680, Y0 = 170, Y1 = 20;
    const px = (v) => X0 + (v / VREF) * (X1 - X0);
    const py = (c) => Y0 - (c / levels) * (Y0 - Y1);

    let stairs;
    if (levels <= 256) {
      // 코드 k는 (k-0.5)~(k+0.5) LSB 구간의 입력을 맡는다
      let d = `M${px(0)} ${py(0)}`;
      for (let k = 0; k < levels; k++) d += ` H${px(((k + 0.5) * VREF) / levels)} V${py(k + 1)}`;
      stairs = `<path class="stairs" d="${d} H${px(VREF)}"/>`;
    } else {
      stairs = `<path class="stairs" d="M${px(0)} ${py(0)} L${px(VREF)} ${py(levels)}"/>`;
    }
    $("quantSvg").innerHTML = `
<svg class="plot" viewBox="0 0 700 200" role="img" aria-label="입력 전압과 ADC 코드의 계단 관계">
  <line class="axis" x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}"/><line class="axis" x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y1}"/>
  <path class="ideal" d="M${px(0)} ${py(0)} L${px(VREF)} ${py(levels)}"/>
  ${stairs}
  <line class="guide" x1="${px(vin)}" y1="${Y0}" x2="${px(vin)}" y2="${py(code)}"/><line class="guide" x1="${X0}" y1="${py(code)}" x2="${px(vin)}" y2="${py(code)}"/>
  <circle class="mark" cx="${px(vin)}" cy="${py(code)}" r="5"/>
  <text x="${X0 - 6}" y="${Y1 + 4}" text-anchor="end">${levels}</text><text x="${X0 - 6}" y="${Y0 + 4}" text-anchor="end">0</text>
  <text x="${X1}" y="${Y0 + 18}" text-anchor="end">${VREF} mV</text><text x="${X0}" y="${Y0 + 18}">0</text>
  <text x="${X0 + 8}" y="${Y1 + 4}">코드</text>
</svg>`;
    $("quantResult").innerHTML =
      `${bits}-bit: 코드 <b>0~${levels}</b> (${levels + 1}단계) · 1 LSB ≈ <b>${(VREF / levels).toFixed(3)} mV</b><br>` +
      `입력 ${vin} mV → 코드 <b>${code}</b> → 환산 ${back.toFixed(1)} mV (양자화 오차 ${Math.abs(back - vin).toFixed(1)} mV)`;
  }
  $("bits").addEventListener("input", drawQuant);
  $("vin").addEventListener("input", drawQuant);
  drawQuant();

  /* ---------- 02. SAR 비트 결정 ---------- */
  function drawSar() {
    const target = Number($("sarIn").value), s = Number($("sarStep").value);
    let acc = 0, rows = "";
    for (let i = 0; i < 12; i++) {
      const bit = 11 - i, w = 1 << bit, trial = acc | w;
      if (i < s) {
        const keep = trial <= target;
        if (keep) acc = trial;
        rows += `<tr class="${i === s - 1 ? "cur" : ""}"><td>bit ${bit}</td><td>${trial}</td><td>${Math.round((trial * VREF) / 4095)} mV</td><td>${trial <= target ? "DAC ≤ 입력" : "DAC > 입력"}</td><td><b>${keep ? 1 : 0}</b></td></tr>`;
      } else {
        rows += `<tr class="wait"><td>bit ${bit}</td><td>·</td><td>·</td><td>·</td><td>?</td></tr>`;
      }
    }
    $("sarT").innerHTML = `<thead><tr><th>비트</th><th>켜 본 코드</th><th>DAC 출력</th><th>비교</th><th>결정</th></tr></thead><tbody>${rows}</tbody>`;
    let bin = "";
    for (let b = 11; b >= 0; b--) {
      bin += b >= 12 - s ? ((acc >> b) & 1) : "·";
      if (b % 4 === 0 && b) bin += "_";
    }
    $("sarResult").innerHTML = `입력 코드 <b>${target}</b> = ${target.toString(2).padStart(12, "0").replace(/(.{4})(?=.)/g, "$1_")} · 지금까지 결정: <b>${bin}</b>` + (s === 12 ? ` = ${acc}. 비트 12번 비교로 코드가 정해졌어요` : "");
  }
  $("sarIn").addEventListener("input", drawSar);
  $("sarStep").addEventListener("input", drawSar);
  drawSar();

  /* ---------- 03. 가변저항 → ADC1_S10 ---------- */
  chips($("potChain"), ["R393 가변저항 (10 kΩ)", "PTA11 (160번 핀)", "ADC1_S10", "12-bit 코드"]);
  let adcSel = 1;
  function drawPot() {
    const k = Number($("knob").value);
    const mv = (VREF * k) / 100, code = Math.round((mv * 4095) / VREF);
    $("knobLabel").textContent = `${(mv / 1000).toFixed(2)} V`;
    $("adc0").setAttribute("aria-pressed", adcSel === 0);
    $("adc1").setAttribute("aria-pressed", adcSel === 1);
    $("potResult").innerHTML =
      adcSel === 1
        ? `ADC1 채널 10 선택 → PTA11의 전압이 들어와요. 코드 <b>${code}</b> (0~4095)`
        : `ADC0 선택 → PTA11은 ADC0이 아니라 <b>ADC1_S10</b>에 연결돼 있어요. 가변저항 값을 읽을 수 없어요`;
    $("potResult").classList.toggle("bad", adcSel === 0);
  }
  $("knob").addEventListener("input", drawPot);
  $("adc0").addEventListener("click", () => ((adcSel = 0), drawPot()));
  $("adc1").addEventListener("click", () => ((adcSel = 1), drawPot()));
  drawPot();

  /* ---------- 04. 하드웨어 평균 + 이동 평균 ---------- */
  chips($("avgChain"), ["ADC1_S10", "8회 연속 변환 평균", "hw_avg", "최근 8개 이동 평균", "filtered", "mV (× 5000 / 4095)"]);
  const READS = 40, STEP_AT = 12, LOW = 1800, HIGH = 2600;
  // 노이즈 모양은 고정해 두고(재현 가능) 슬라이더로 크기만 곱한다. 읽기 한 번 = 변환 8번.
  const rnd = (() => {
    let a = 20262;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const unit = Array.from({ length: READS }, () => Array.from({ length: 8 }, () => (rnd() + rnd() + rnd() - 1.5) * 2));
  const sd = (xs) => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  };
  function drawFilt() {
    const sigma = Number($("noise").value), N = Number($("winN").value);
    const hw = [], ma = [];
    for (let n = 0; n < READS; n++) {
      const truth = n < STEP_AT ? LOW : HIGH;
      hw.push(Math.round(unit[n].reduce((a, z) => a + truth + sigma * z, 0) / 8));
      const win = hw.slice(Math.max(0, n - N + 1), n + 1);
      ma.push(Math.round(win.reduce((a, b) => a + b, 0) / win.length));
    }
    const X = (n) => 40 + n * 16, Y = (v) => 180 - ((v - 1500) / 1400) * 160;
    const line = (arr) => arr.map((v, n) => `${n ? "L" : "M"}${X(n)} ${Y(v)}`).join(" ");
    const truth = `M${X(0)} ${Y(LOW)} H${X(STEP_AT)} V${Y(HIGH)} H${X(READS - 1)}`;
    $("filtSvg").innerHTML = `
<svg class="plot" viewBox="0 0 700 200" role="img" aria-label="하드웨어 평균과 이동 평균의 응답 비교">
  <path class="ideal" d="${truth}"/>
  <path class="l-hw" d="${line(hw)}"/><path class="l-ma" d="${line(ma)}"/>
  <text x="46" y="16" style="fill:var(--data)">── hw_avg</text><text x="130" y="16" style="fill:var(--on)">── filtered (이동 평균)</text><text x="300" y="16">┄ 실제 값</text>
  <text x="${X(STEP_AT) + 6}" y="196">노브 돌림</text>
</svg>`;
    const settle = ma.findIndex((v, n) => n >= STEP_AT && Math.abs(v - HIGH) <= 40);
    $("filtResult").innerHTML =
      `정지 구간 흔들림(표준편차): hw_avg <b>${sd(hw.slice(0, STEP_AT)).toFixed(1)}</b> → filtered <b>${sd(ma.slice(0, STEP_AT)).toFixed(1)}</b> LSB<br>` +
      `새 값(±40 LSB)까지 따라붙는 데 filtered는 <b>${settle < 0 ? "40번 안에 못 도달" : settle - STEP_AT + 1 + "번 읽기"}</b> · 한 번 읽기 = 변환 8회, filtered 하나 = 변환 <b>${8 * N}</b>회`;
  }
  $("noise").addEventListener("input", drawFilt);
  $("winN").addEventListener("input", drawFilt);
  drawFilt();

  /* ---------- 05. AdcFilter_Update Stepper ---------- */
  {
    const N = 4;
    const side = h("div");
    const bufEl = side.appendChild(h("div", { class: "buf", id: "bufView" }));
    const slots = Array.from({ length: N }, (_, i) => bufEl.appendChild(h("div", { class: "slot" }, h("span", {}, `buf[${i}]`), h("span", { class: "v" }), h("span", { class: "p" }))));
    const info = side.appendChild(h("div", { class: "buf-info" }));
    const bufView = {
      render(s) {
        slots.forEach((el, i) => {
          el.classList.toggle("filled", !!s.w[i]);
          el.classList.toggle("next", i === s.index);
          el.querySelector(".v").textContent = s.buf[i];
          el.querySelector(".p").textContent = i === s.index ? "← index" : "";
        });
        info.innerHTML = `sum <b>${s.sum}</b> · count <b>${s.count}</b> · index <b>${s.index}</b><br>반환값 <b>${s.out}</b>` + (s.sample != null ? ` · 방금 넣은 sample <b>${s.sample}</b>` : "");
      },
    };

    const st = (s, p) => ({ ...s, ...p });
    const sub = (s) => st(s, { sum: s.sum - s.buf[s.index] });
    const put = (x) => (s) => {
      const buf = [...s.buf], w = [...s.w];
      buf[s.index] = x;
      w[s.index] = 1;
      return st(s, { buf, w, sample: x });
    };
    const add = (x) => (s) => st(s, { sum: s.sum + x });
    const adv = (s) => st(s, { index: (s.index + 1) % N });
    const cnt = (s) => st(s, { count: Math.min(N, s.count + 1) });
    const ret = (s) => st(s, { out: Math.floor(s.sum / s.count) });
    const seq = (...fs) => (s) => fs.reduce((a, f) => f(a), s);

    const steps = [
      { line: [5, 5], note: "첫 호출(sample = 1000). 가장 오래된 값 buf[index]를 합에서 빼요. 처음엔 0이라 합이 그대로예요.", apply: sub },
      { line: 6, note: "buf[index] 자리에 새 값을 덮어써요.", apply: put(1000) },
      { line: 7, note: "합에 새 값을 더해요. 덧셈 두 번으로 합이 갱신돼요. 매번 N개를 다시 더하지 않아요.", apply: add(1000) },
      { line: 8, note: "index를 한 칸 옮겨요. N이 되면 0으로 돌아가는 원형 버퍼예요.", apply: adv },
      { line: 9, note: "아직 다 안 찼으니 count를 올려요. 최대 N까지만 올라가요.", apply: cnt },
      { line: 10, note: "합 ÷ count를 돌려줘요. 4칸 중 1칸만 찼으니 4가 아니라 1로 나눠요.", apply: ret, predict: { q: "count가 1일 때 반환값은?", choices: ["250 (1000 ÷ 4)", "1000 (1000 ÷ 1)", "0"], answer: 1 } },
    ];
    // 2~4번째 호출: 위 여섯 단계를 두 단계로 묶어서
    [[1040, "2번째"], [960, "3번째"], [1000, "4번째"]].forEach(([x, nth]) => {
      steps.push(
        { line: [5, 8], note: `${nth} 호출(sample = ${x}). 빼기 → 덮어쓰기 → 더하기 → index 이동을 한 번에 해요.`, apply: seq(sub, put(x), add(x), adv) },
        { line: [9, 10], note: "count를 올리고 합 ÷ count를 돌려줘요.", apply: seq(cnt, ret) }
      );
    });
    steps.push(
      { line: [5, 8], note: "5번째 호출(sample = 2000). 버퍼가 다 찼고 index는 0으로 돌아와 있어요. 가장 오래된 값(1000)을 빼고 그 자리에 2000을 써요.", apply: seq(sub, put(2000), add(2000), adv), predict: { q: "5번째 값이 들어오면 어느 칸이 덮어써질까?", choices: ["buf[0] (가장 오래된 값)", "buf[3] (가장 최근 값)", "칸이 하나 더 생긴다"], answer: 0 } },
      { line: [9, 10], note: "count는 이미 N이라 그대로예요. 합 5000 ÷ 4 = 1250. 입력이 1000에서 2000으로 뛰었지만 필터 출력은 천천히 따라와요.", apply: seq(cnt, ret), predict: { q: "반환값은?", choices: ["2000", "1500", "1250", "1000"], answer: 2 } }
    );

    EV.stepper($("filterStepper"), {
      title: "adc_filter.c · AdcFilter_Update (N=4로 줄임)",
      code: `
#define ADC_FILTER_N   4U   /* 그림에서는 4, 실습은 8U */

uint16_t AdcFilter_Update(AdcFilter_t *f, uint16_t sample)
{
    f->sum -= f->buf[f->index];
    f->buf[f->index] = sample;
    f->sum += sample;
    f->index = (uint8_t)((f->index + 1U) % ADC_FILTER_N);
    if (f->count < ADC_FILTER_N) { f->count++; }
    return (uint16_t)(f->sum / f->count);
}`,
      initial: { buf: [0, 0, 0, 0], w: [0, 0, 0, 0], sum: 0, index: 0, count: 0, out: "-", sample: null },
      intro: "AdcFilter_Init()을 막 마친 상태예요. buf는 전부 0, sum·index·count도 0이에요.",
      side,
      views: [bufView],
      steps,
    });
  }

  /* ---------- 06. 14-bit 기본값 함정 ---------- */
  let resBits = 14;
  function drawTrap() {
    const k = Number($("trapKnob").value);
    const levels = 2 ** resBits - 1;
    const raw = Math.round((levels * k) / 100);
    const mv = Math.floor((raw * 5000) / 4095); // 코드는 항상 4095로 환산
    const truth = (VREF * k) / 100;
    $("res14").setAttribute("aria-pressed", resBits === 14);
    $("res12").setAttribute("aria-pressed", resBits === 12);
    const pad = (s) => s.padEnd(16, " ");
    $("trapLcd").textContent = pad(`HW:${String(raw).padStart(4, "0")} MA:${String(raw).padStart(4, "0")}`) + "\n" + pad(`Voltage: ${Math.floor(mv / 1000)}.${String(mv % 1000).padStart(3, "0")}`);
    const bad = raw > 4095;
    $("trapResult").innerHTML = `실제 입력 ${(truth / 1000).toFixed(3)} V · 코드 범위 0~${levels} · 화면 ${(mv / 1000).toFixed(3)} V` + (bad ? ` → <b>코드가 4095를 넘고, 전압이 약 ${(mv / Math.max(truth, 1)).toFixed(1)}배</b>로 나와요` : " → 맞게 나와요");
    $("trapResult").classList.toggle("bad", bad);
  }
  $("trapKnob").addEventListener("input", drawTrap);
  $("res14").addEventListener("click", () => ((resBits = 14), drawTrap()));
  $("res12").addEventListener("click", () => ((resBits = 12), drawTrap()));
  drawTrap();

  /* ---------- 07. 초기화 순서 칩, 콜백 경로 ---------- */
  document.querySelectorAll(".order").forEach((box) => {
    box.dataset.order.split("|").forEach((name, i) => {
      if (i) box.append(h("span", { class: "arrow" }, "→"));
      box.append(h("span", { class: "chip" }, " " + name));
    });
  });

  const CB = ["ADC1 변환 완료", "ADC1_IRQn", "Adc_Sar_1_Isr (Platform 등록)", "RTD normal ISR 처리", "group 상태 = COMPLETED", "Adc1_Callback()", "AdcConvDone = TRUE"];
  const cbChips = chips($("cbChain"), CB);
  let running = false;
  $("cbBtn").addEventListener("click", async () => {
    if (running) return;
    running = true;
    cbChips.forEach((c) => c.classList.remove("on", "done", "bad"));
    $("cbResult").classList.remove("bad");
    $("cbResult").textContent = "";
    const open = $("cbNotif").checked;
    for (let i = 0; i < cbChips.length; i++) {
      if (i === 5 && !open) {
        cbChips[i].classList.add("bad");
        $("cbResult").classList.add("bad");
        $("cbResult").innerHTML = "Adc_Init() 직후 notification은 꺼져 있어서 콜백이 <b>불리지 않아요</b>. main은 while(AdcConvDone == FALSE)에서 영원히 대기해요";
        running = false;
        return;
      }
      cbChips[i].classList.add("on");
      await EV.sleep(320);
      cbChips[i].classList.replace("on", "done");
    }
    cbChips[cbChips.length - 1].classList.add("on");
    $("cbResult").innerHTML = "플래그가 서고, main이 Adc_ReadGroup()으로 결과 버퍼를 읽어요";
    running = false;
  });

  /* ---------- 09. 퀴즈 ---------- */
  EV.quiz($("quiz"), [
    { q: "보드 내장 가변저항(ADC_POT0, PTA11)을 읽을 ADC 입력은?", choices: ["ADC0 채널 10", "ADC1 채널 10", "ADC0 채널 11", "채널은 코드에서 아무거나 골라도 된다"], answer: 1, why: "채널은 핀이 정해요. PTA11은 ADC1의 S10이에요. MCAL 설정에서는 S10_ChanNum34로 보여요." },
    { q: "하드웨어 8회 평균 위에 N=8 이동 평균을 쓰면 filtered 하나에 들어가는 변환은 몇 회일까?", choices: ["8회", "16회", "64회", "4095회"], answer: 2, why: "filtered 1개 = 최근 8번 읽기, 읽기 1번 = 8회 변환이라 8 × 8 = 64회예요. 대신 새 값을 다 따라가는 데 8번을 더 읽어야 해요." },
    { q: "분해능을 기본값 그대로 두면 전압이 약 4배로 표시되는 이유는?", choices: ["Vref가 4배라서", "기본값이 14-bit라 코드가 0~16383까지 나오는데 식은 4095로 나누기 때문", "하드웨어 평균이 꺼져서", "좌측 정렬이라서"], answer: 1, why: "Conversion resolution 기본값은 14-bit(RESN)예요. RESOLUTION_12로 바꿔야 코드가 0~4095가 돼요." },
    { q: "ISR(콜백)에서 세운 플래그를 main이 읽을 때, 컴파일러가 값을 캐싱하지 못하게 변수에 붙이는 키워드는?", answer: "volatile", why: "빠지면 콜백은 호출되는데 main이 계속 대기해요. AdcConvDone을 static volatile로 선언해요." },
  ]);
})();
