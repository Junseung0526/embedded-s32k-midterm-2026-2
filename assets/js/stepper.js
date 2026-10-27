// Stepper: 코드를 한 줄씩 실행하며 상태 변화를 보여 주는 위젯.
//
// EV.stepper(root, {
//   title:   "마스킹 4공식",
//   code:    "C 코드 문자열",
//   initial: { regs: { REG: 0 }, led: false, ... },  // 0번째 step의 상태
//   intro:   "처음 화면의 설명",
//   steps:   [{ line: 3 | [1, 7], note: "설명", apply: (s) => ({ ...s, ... }),
//              predict: { q: "질문", choices: ["A", "B"], answer: 1 } }],   // predict는 선택
//   side:    HTMLElement,           // 오른쪽 칸에 넣을 그림·레지스터들
//   views:   [{ render(state, prev) }],
// })
//
// 규칙: apply는 순수 함수다. 받은 상태를 고치지 말고 새 객체를 돌려준다.
// "이전"은 initial부터 목표 step까지 apply를 다시 실행해서 구한다.
// predict가 있는 step은 → 로 들어가기 전에 결과를 먼저 맞혀 보게 한다(한 번만). 슬라이더로 건너뛰면 묻지 않는다.
EV.stepper = function (root, opt) {
  const { h } = EV;
  const lines = opt.code.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  const total = opt.steps.length;
  const PLAY_MS = 1500;

  const lineEls = lines.map((l, i) =>
    h("span", { class: "ln", "data-n": i + 1, html: EV.highlightC(l) || " " })
  );
  const counter = h("span");
  const note = h("div", { class: "st-note", "aria-live": "polite" });
  const slider = h("input", { type: "range", min: 0, max: total, value: 0, "aria-label": "단계 이동" });
  const btn = (label, aria, fn) => h("button", { class: "key", type: "button", "aria-label": aria, onclick: fn }, label);
  const playBtn = btn("▶", "자동 재생", () => (timer ? stop() : play()));
  playBtn.classList.add("play");

  root.classList.add("stepper");
  root.tabIndex = 0;
  root.append(
    h("div", { class: "st-head" }, h("span", {}, opt.title || "코드 한 줄씩"), counter),
    h(
      "div",
      { class: "st-body" + (opt.side ? "" : " solo") },
      h("pre", { class: "code" }, lineEls),
      opt.side ? h("div", { class: "st-side" }, opt.side) : null
    ),
    note,
    h(
      "div",
      { class: "st-ctrl" },
      playBtn,
      btn("⟲", "처음으로", () => (stop(), go(0))),
      btn("←", "이전", () => (stop(), go(index - 1))),
      slider,
      btn("→", "다음", () => (stop(), next())),
      h("span", { class: "hint" }, "← → 또는 스페이스로 재생")
    )
  );

  // Stepper가 화면을 쥐고 있는 동안 레지스터 비트를 손으로 바꾸지 못하게 한다.
  const views = opt.views || [];
  views.forEach((v) => v.setEditable && v.setEditable(false));

  let index = 0;
  let shown = opt.initial;
  let timer = null;
  let asking = false;
  let verdict = null; // 방금 맞힌 예측 결과를 다음 설명 앞에 붙인다
  const answered = new Set();

  function stateAt(i) {
    let s = opt.initial;
    for (let k = 0; k < i; k++) s = opt.steps[k].apply ? opt.steps[k].apply(s) : s;
    return s;
  }

  function go(i) {
    asking = false;
    index = Math.max(0, Math.min(total, i));
    const prev = shown;
    shown = stateAt(index);
    views.forEach((v) => v.render(shown, prev));

    const step = index > 0 ? opt.steps[index - 1] : null;
    const cur = step && step.line != null ? [].concat(step.line) : [];
    const seen = new Set();
    for (let k = 0; k < index; k++) [].concat(opt.steps[k].line ?? []).forEach((n) => seen.add(n));
    lineEls.forEach((el, n) => {
      el.classList.toggle("cur", cur.includes(n + 1));
      el.classList.toggle("seen", seen.has(n + 1));
    });

    note.replaceChildren();
    if (verdict) note.append(verdict), (verdict = null);
    note.append(step ? step.note : opt.intro || "→ 를 눌러 시작하세요.");
    note.classList.remove("ask");
    counter.textContent = `${index} / ${total}`;
    slider.value = index;
    if (index === total) stop();
  }

  // 다음 줄로. 예측 문제가 걸린 줄이면 먼저 묻는다.
  function next() {
    if (asking || index >= total) return;
    const step = opt.steps[index];
    if (!step.predict || answered.has(index)) return go(index + 1);
    ask(index, step.predict);
  }

  function ask(k, p) {
    asking = true;
    stop();
    note.classList.add("ask");
    note.replaceChildren(
      h("b", { class: "ask-q" }, "먼저 맞혀 보세요 · " + p.q),
      h("div", { class: "ask-choices" }, p.choices.map((c, i) =>
        h("button", { class: "choice", type: "button", onclick: () => {
          answered.add(k);
          const ok = i === p.answer;
          verdict = h("b", { class: ok ? "ask-ok" : "ask-no" }, ok ? "✓ 맞았어요. " : `✗ 정답은 ${p.choices[p.answer]}. `);
          go(k + 1);
        } }, c)
      ))
    );
    note.querySelector(".choice").focus({ preventScroll: true });
  }

  function play() {
    if (index >= total) go(0);
    playBtn.innerHTML = '<i class="bars"></i>';
    playBtn.setAttribute("aria-label", "일시정지");
    timer = setInterval(next, EV.reducedMotion ? PLAY_MS * 1.5 : PLAY_MS);
    next();
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    playBtn.textContent = "▶";
    playBtn.setAttribute("aria-label", "자동 재생");
  }

  slider.addEventListener("input", () => (stop(), go(Number(slider.value))));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select") || (asking && e.target.closest(".ask-choices"))) return;
    if (e.key === "ArrowRight") (stop(), next(), e.preventDefault());
    if (e.key === "ArrowLeft") (stop(), go(index - 1), e.preventDefault());
    if (e.key === " " && e.target === root) (timer ? stop() : play(), e.preventDefault());
  });

  go(0);
  return { go, get index() { return index; } };
};
