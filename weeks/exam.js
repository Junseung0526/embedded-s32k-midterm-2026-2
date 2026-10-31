// exam 페이지: 주차별 예상문제. 실제 기출이 아니라 각 주차 페이지 내용으로 만든 연습 문제다.
import { makeSet, shuffle } from "./exam-gen.js";

(function () {
  const $ = (id) => document.getElementById(id);
  /* ---------- 오답 노트: 이 브라우저에만 저장 ---------- */
  const KEY = "exam-wrong-v1";
  let note = {};
  try { note = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { note = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(note)); } catch { /* 저장 불가: 이번 방문 동안만 유지 */ } renderNote(); };
  const addWrong = (it) => {
    const prev = note[it.q];
    note[it.q] = { t: it.t, q: it.q, choices: it.choices, answer: it.answer, why: it.why, n: (prev ? prev.n : 0) + 1, at: Date.now() };
    save();
  };
  const dropWrong = (it) => { if (note[it.q]) { delete note[it.q]; save(); } };

  // 문제를 한 번에 하나씩 보여 주고 이전/다음으로 넘긴다. 첫 시도 결과로 오답 노트를 갱신한다.
  function paged(root, items, tag) {
    root.replaceChildren();
    EV.quiz(root, tag ? items.map((it) => ({ ...it, q: `[${it.t}] ${it.q}` })) : items);
    const list = [...root.children];
    list.forEach((el, k) => {
      const it = items[k];
      el.style.counterSet = `q ${k}`; // 숨긴 문제는 counter를 안 올려서 번호를 직접 맞춘다
      if (it.choices) {
        el.addEventListener("click", (e) => {
          const c = e.target.closest(".choice");
          if (!c || el.dataset.tried) return;
          el.dataset.tried = "1";
          c.classList.contains("right") ? dropWrong(it) : addWrong(it);
        });
      } else {
        el.append(EV.h("button", { class: "key", type: "button", onclick: (e) => { addWrong(it); e.currentTarget.textContent = "오답 노트에 넣었어요"; } }, "틀렸어요 → 오답 노트"));
      }
    });
    const count = EV.h("span", { class: "chip", "aria-live": "polite" });
    const prev = EV.h("button", { class: "key", type: "button", onclick: () => show(i - 1) }, "← 이전");
    const next = EV.h("button", { class: "key", type: "button", onclick: () => show(i + 1) }, "다음 →");
    root.append(EV.h("div", { class: "row" }, prev, count, next));
    let i = 0;
    function show(n) {
      i = n;
      list.forEach((el, k) => (el.hidden = k !== i));
      count.textContent = `${i + 1} / ${list.length}`;
      prev.disabled = i === 0;
      next.disabled = i === list.length - 1;
    }
    show(0);
  }
  function renderNote() {
    const all = Object.values(note);
    const by = {};
    for (const it of all) by[it.t] = (by[it.t] || 0) + 1;
    $("noteReview").textContent = `오답 다시 풀기 (${all.length})`;
    $("noteReview").title = Object.entries(by).map(([t, n]) => `${t} ${n}`).join(", ");
    $("noteReview").disabled = $("noteClear").disabled = !all.length;
  }

  /* ---------- 문제 칸 하나: 랜덤 출제와 오답 다시 풀기가 같은 칸을 쓴다 ---------- */
  const box = $("qBox");
  const TOPICS = [["", "전체"], ["힌트", "힌트"], ["W1", "1주"], ["W2", "2주"], ["W3", "3주"], ["W4", "4주"], ["W5", "5주"], ["W6", "6주"], ["서술", "서술"]];
  let topic = "";
  const topicBox = $("rndTopics");
  const press = (t) => topicBox.querySelectorAll(".key").forEach((k) => k.setAttribute("aria-pressed", k.dataset.t === t));
  function deal() {
    paged(box, makeSet(10, topic || undefined), true);
    $("boxTitle").textContent = "랜덤 문제";
    press(topic);
  }
  for (const [t, label] of TOPICS) {
    topicBox.append(EV.h("button", { class: "key", type: "button", "data-t": t, onclick: () => { topic = t; deal(); } }, label));
  }
  $("rndNew").addEventListener("click", deal);
  $("noteReview").addEventListener("click", () => {
    // 많이 틀린 순서로, 보기는 다시 섞어서
    paged(box, Object.values(note).sort((a, b) => b.n - a.n).map(shuffle), true);
    $("boxTitle").textContent = "오답 다시 풀기";
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
