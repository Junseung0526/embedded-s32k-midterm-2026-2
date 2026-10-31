// exam 페이지: 예상문제 카드 하나. 실제 기출이 아니라 각 주차 페이지 내용으로 만든 연습 문제다.
import { makeSet, shuffle } from "./exam-gen.js";

(function () {
  const { h } = EV;
  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가: 이번 방문 동안만 유지 */ } },
  };

  /* ---------- 오답 노트: 이 브라우저에만 저장 ---------- */
  const KEY = "exam-wrong-v1";
  let note = store.get(KEY, {});
  const save = () => { store.set(KEY, note); renderNote(); };
  const addWrong = (it) => {
    const prev = note[it.q];
    note[it.q] = { t: it.t, q: it.q, choices: it.choices, answer: it.answer, why: it.why, n: (prev ? prev.n : 0) + 1, at: Date.now() };
    save();
  };
  const dropWrong = (it) => { if (note[it.q]) { delete note[it.q]; save(); } };

  function renderNote() {
    const all = Object.values(note);
    const by = {};
    for (const it of all) by[it.t] = (by[it.t] || 0) + 1;
    $("noteReview").textContent = `오답 다시 풀기 (${all.length})`;
    $("noteReview").title = Object.entries(by).map(([t, n]) => `${t} ${n}`).join(", ");
    $("noteReview").disabled = $("noteClear").disabled = !all.length;
  }

  /* ---------- 문제 카드: 한 번에 한 문제, 첫 시도로 채점 ---------- */
  const box = $("qBox");
  let set = [], i = 0;

  function start(items, title) {
    set = items.map((it) => ({ it, pick: null, ok: null, shown: false }));
    i = 0;
    $("boxTitle").textContent = title;
    render();
  }
  // 주제별 이해도: 최근 20번의 첫 시도 결과 (메인 페이지 hub.js가 읽는다)
  const STATS = "exam-stats-v1";
  const record = (t, ok) => {
    const st = store.get(STATS, {});
    st[t] = [...(st[t] || []), ok ? 1 : 0].slice(-20);
    store.set(STATS, st);
  };
  function grade(s, ok) {
    if (s.ok !== null) return;
    s.ok = ok;
    record(s.it.t, ok);
    ok ? dropWrong(s.it) : addWrong(s.it);
    render();
    box.querySelector(".ex-next").focus({ preventScroll: true });
  }
  const go = (k) => { i = Math.max(0, Math.min(set.length, k)); render(); };

  function render() {
    if (i >= set.length) return renderEnd();
    const s = set[i], it = s.it, locked = s.ok !== null;
    const right = set.filter((x) => x.ok === true).length, wrong = set.filter((x) => x.ok === false).length;

    const prog = h("div", { class: "ex-prog", role: "group", "aria-label": "문제 진행" },
      set.map((x, k) => h("button", {
        type: "button", "aria-label": `${k + 1}번 문제${x.ok === true ? " 맞힘" : x.ok === false ? " 틀림" : ""}`,
        "aria-current": k === i ? "step" : false,
        class: "ex-seg" + (k === i ? " cur" : "") + (x.ok === true ? " ok" : x.ok === false ? " ng" : ""),
        onclick: () => go(k),
      })));
    const meta = h("div", { class: "ex-meta" },
      h("span", { class: "chip" }, it.t), `${i + 1} / ${set.length}`,
      h("span", { class: "ex-score" }, "맞힘 ", h("b", {}, right), " · 틀림 ", h("b", {}, wrong)));

    const body = [];
    if (it.choices) {
      body.push(h("div", { class: "ex-choices" }, it.choices.map((c, k) => {
        const isRight = locked && k === it.answer, isWrong = locked && k === s.pick && !isRight;
        return h("button", {
          type: "button", disabled: locked,
          class: "ex-choice" + (isRight ? " right" : "") + (isWrong ? " wrong" : "") + (locked && !isRight && !isWrong ? " dim" : ""),
          onclick: () => { s.pick = k; grade(s, k === it.answer); },
        }, h("kbd", {}, k + 1), h("span", {}, c), h("span", { class: "mark", "aria-hidden": "true" }, isRight ? "✓" : isWrong ? "✕" : ""));
      })));
    } else if (!s.shown) {
      body.push(h("div", { class: "row" }, h("button", { type: "button", class: "key ex-show", onclick: () => { s.shown = true; render(); } }, "정답 보기 (Space)")));
    }
    if (locked || s.shown) {
      const verdict = it.choices ? (s.ok ? "정답이에요" : "아쉬워요, 오답 노트에 넣었어요")
        : s.ok === null ? "내 답과 비교해 보세요" : s.ok ? "맞았어요" : "오답 노트에 넣었어요";
      body.push(h("div", { class: "ex-why" + (s.ok === true ? " ok" : s.ok === false ? " ng" : ""), role: "status" },
        h("b", {}, verdict),
        h("p", {}, "정답: ", h("span", { class: "ex-ans" }, it.choices ? it.choices[it.answer] : it.answer)),
        h("p", {}, it.why)));
    }
    if (!it.choices && s.shown && !locked) {
      body.push(h("div", { class: "row" },
        h("button", { type: "button", class: "key", onclick: () => grade(s, true) }, "맞았어요 (O)"),
        h("button", { type: "button", class: "key", onclick: () => grade(s, false) }, "틀렸어요 (X)")));
    }

    const last = i === set.length - 1;
    const nav = h("div", { class: "ex-nav" },
      h("button", { type: "button", class: "key", disabled: i === 0, onclick: () => go(i - 1) }, "← 이전"),
      h("span", { class: "ex-hint" }, it.choices ? "숫자 1~4로 고르기 · Enter 다음 · ← → 이동" : "Space 정답 보기 · O / X 채점 · ← → 이동"),
      h("button", { type: "button", class: "key ex-next" + (locked ? " ready" : ""), onclick: () => go(i + 1) }, last ? "결과 보기 →" : locked ? "다음 →" : "건너뛰기 →"));

    box.replaceChildren(h("div", { class: "ex-card" }, prog, meta, h("p", { class: "ex-q" }, it.q), ...body, nav));
    if (box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: "start", behavior: EV.reducedMotion ? "auto" : "smooth" });
  }

  function renderEnd() {
    const ok = set.filter((s) => s.ok === true).length;
    const miss = set.filter((s) => s.ok === false), skip = set.filter((s) => s.ok === null);
    const msg = !miss.length && !skip.length ? "다 맞혔어요!" :
      [miss.length && `틀린 ${miss.length}문제는 오답 노트에 들어갔어요.`, skip.length && `안 푼 문제 ${skip.length}개가 있어요.`].filter(Boolean).join(" ");
    box.replaceChildren(h("div", { class: "ex-card ex-end" },
      h("p", { class: "ex-big" }, `${ok} / ${set.length}`),
      h("p", {}, msg),
      h("ol", { class: "ex-list" }, set.map((s, k) => h("li", { class: s.ok === true ? "ok" : s.ok === false ? "ng" : "" },
        h("button", { type: "button", onclick: () => go(k) },
          h("span", { "aria-label": s.ok === true ? "맞힘" : s.ok === false ? "틀림" : "안 품" }, s.ok === true ? "○" : s.ok === false ? "✕" : "–"),
          h("span", {}, `[${s.it.t}] ${s.it.q}`))))),
      h("div", { class: "row" },
        miss.length ? h("button", { type: "button", class: "key", onclick: () => start(miss.map((s) => shuffle(s.it)), "틀린 문제 다시") }, "틀린 것만 다시") : null,
        h("button", { type: "button", class: "key ex-next ready", onclick: deal }, "새 문제 10개"))));
    box.querySelector(".ex-next").focus({ preventScroll: true });
  }

  // 키보드: 1~4 고르기, Enter/→ 다음, ← 이전, Space 정답 보기, O/X 자가 채점
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (i >= set.length) return;
    const s = set[i], onButton = e.target.tagName === "BUTTON";
    const n = Number(e.key);
    if (s.it.choices && n >= 1 && n <= s.it.choices.length && s.ok === null) { s.pick = n - 1; grade(s, n - 1 === s.it.answer); }
    else if (e.key === "ArrowRight" || (e.key === "Enter" && !onButton && s.ok !== null)) go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === " " && !onButton && !s.it.choices && !s.shown) { s.shown = true; render(); }
    else if (/^[oOxX]$/.test(e.key) && !s.it.choices && s.shown && s.ok === null) grade(s, /o/i.test(e.key));
    else return;
    e.preventDefault();
  });

  /* ---------- 주제 바 ---------- */
  const TOPICS = [["", "전체"], ["힌트", "힌트"], ["W1", "1주"], ["W2", "2주"], ["W3", "3주"], ["W4", "4주"], ["W5", "5주"], ["W6", "6주"], ["서술", "서술"]];
  // 메인 페이지 이해도 패널에서 exam.html?t=W2 처럼 주제를 골라 들어온다
  const fromUrl = new URLSearchParams(location.search).get("t");
  let topic = TOPICS.some(([t]) => t === fromUrl) ? fromUrl : store.get("exam-topic", "");
  const topicBox = $("rndTopics");
  const press = (t) => topicBox.querySelectorAll(".key").forEach((k) => k.setAttribute("aria-pressed", k.dataset.t === t));
  function deal() {
    start(makeSet(10, topic || undefined), "랜덤 문제");
    press(topic);
  }
  for (const [t, label] of TOPICS) {
    topicBox.append(h("button", { class: "key", type: "button", "data-t": t, onclick: () => { topic = t; store.set("exam-topic", t); deal(); } }, label));
  }
  $("rndNew").addEventListener("click", deal);
  $("noteReview").addEventListener("click", () => {
    // 많이 틀린 순서로, 보기는 다시 섞어서
    start(Object.values(note).sort((a, b) => b.n - a.n).map(shuffle), "오답 다시 풀기");
    press(null);
  });
  $("noteClear").addEventListener("click", () => {
    if (!confirm("오답 노트를 모두 지울까요?")) return;
    note = {};
    save();
    deal();
  });
  renderNote();
  deal();
})();
