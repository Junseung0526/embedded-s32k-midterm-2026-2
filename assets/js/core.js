// 모든 위젯이 쓰는 작은 도우미 모음. file://에서도 돌아가도록 ES module 대신 전역 EV 하나만 쓴다.
window.EV = window.EV || {};

// 시스템이 동작 줄이기여도 vt.js가 html.motion-ok를 붙였으면(사용자가 직접 켬) 애니메이션을 쓴다
EV.osReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
EV.reducedMotion = EV.osReducedMotion && !document.documentElement.classList.contains("motion-ok");

// EV.h("div", { class: "x", onclick: fn }, "텍스트", 자식요소...)
EV.h = function (tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
};

// 숫자를 0x0000002A처럼 고정 자리수 16진수로
EV.hex = function (n, digits = 8) {
  return "0x" + (n >>> 0).toString(16).toUpperCase().padStart(digits, "0");
};

// 클래스를 뺐다 다시 넣어서 CSS 애니메이션을 처음부터 다시 재생
EV.pulse = function (el, cls = "pulse") {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
};

EV.sleep = (ms) => new Promise((r) => setTimeout(r, EV.reducedMotion ? 0 : ms));

// C 코드 한 줄을 색칠한다. 줄 단위로만 처리하므로 여러 줄 주석은 쓰지 않는다.
const C_TOKEN = new RegExp(
  [
    "(\\/\\/.*$|\\/\\*.*?\\*\\/)", // 1 주석
    '("(?:[^"\\\\]|\\\\.)*")', // 2 문자열
    "(^\\s*#\\s*\\w+)", // 3 전처리기
    "\\b(0x[0-9A-Fa-f]+[uUlL]*|\\d+[uUlL]*)\\b", // 4 숫자
    "\\b(if|else|for|while|return|static|volatile|void|int|char|typedef|struct|const|unsigned|sizeof)\\b", // 5 키워드
    "\\b(u?int(?:8|16|32)_t|bool|msr|MSR_Type)\\b", // 6 타입
  ].join("|"),
  "g"
);
EV.highlightC = function (line) {
  const esc = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(C_TOKEN, (m, c, s, p, n, k, t) => {
    const cls = c ? "c" : s ? "s" : p ? "p" : n ? "n" : k ? "k" : "t";
    return `<span class="${cls}">${m}</span>`;
  });
};

// 정적인 코드 블록: <pre data-code>에 넣은 코드를 줄 번호와 함께 색칠
EV.codeBlock = function (pre, src) {
  const text = (src ?? pre.textContent).replace(/^\n/, "").replace(/\s+$/, "");
  pre.classList.add("code");
  pre.innerHTML = text
    .split("\n")
    .map((line, i) => `<span class="ln" data-n="${i + 1}">${EV.highlightC(line) || " "}</span>`)
    .join("");
  return pre;
};

// 변수 표: state.vars의 값을 보여 주고, 바뀐 값은 빨갛게
// EV.varsView(root, ["g_press_count", ...], { g_press_count: (v) => 표시문자열 })
EV.varsView = function (root, keys, fmt = {}) {
  const dl = EV.h("dl", { class: "vars" });
  const dd = {};
  for (const k of keys) {
    dd[k] = EV.h("dd");
    dl.append(EV.h("dt", {}, k), dd[k]);
  }
  root.append(dl);
  return {
    render(state, prev) {
      for (const k of keys) {
        const v = state.vars[k];
        dd[k].textContent = fmt[k] ? fmt[k](v) : String(v);
        dd[k].classList.toggle("changed", !!prev && prev.vars && prev.vars[k] !== v);
      }
    },
  };
};

// LED 하나: state.led가 true면 켜짐
EV.ledView = function (root, label) {
  const el = EV.h("span", { class: "led" }, EV.h("i"), label);
  root.append(el);
  return { render: (state) => el.classList.toggle("on", !!state.led) };
};

// 말풍선 캐릭터: 다리 두 개 달린 작은 칩
EV.CHIP_SVG =
  '<svg viewBox="0 0 52 52" aria-hidden="true">' +
  '<g stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
  '<path d="M10 18H5M10 26H5M10 34H5M42 18h5M42 26h5M42 34h5"/></g>' +
  '<rect x="10" y="10" width="32" height="32" rx="4" fill="#2B2C29"/>' +
  '<circle cx="20" cy="24" r="3" fill="#E6E4DE"/><circle cx="32" cy="24" r="3" fill="#E6E4DE"/>' +
  '<path d="M21 33q5 3 10 0" stroke="#E6E4DE" stroke-width="2" fill="none" stroke-linecap="round"/>' +
  '<circle cx="36" cy="15" r="2.5" fill="#E8412C"/></svg>';

// 끌어서 바꾸는 숫자 (Bret Victor의 Explorable Explanations 방식).
// <span class="tangle" data-bind="입력요소id">29</span> → 좌우로 끌거나 방향키로 그 range/number 입력값을 바꾼다.
// 입력값이 다른 곳에서 바뀌면 숫자도 따라 바뀐다. 계산은 원래 위젯이 하던 그대로.
EV.tangle = function (span) {
  const input = document.getElementById(span.dataset.bind);
  if (!input) return;
  const min = Number(input.min), max = Number(input.max), step = Number(input.step) || 1;
  const set = (v) => {
    v = Math.min(max, Math.max(min, Math.round(v / step) * step));
    if (String(v) === input.value) return;
    input.value = v;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const show = () => (span.textContent = input.value);
  span.tabIndex = 0;
  span.setAttribute("role", "slider");
  span.setAttribute("aria-label", span.dataset.label || "끌어서 값 바꾸기");
  span.title = "좌우로 끌거나 ← → 키로 바꿔 보세요";
  const sync = () => (show(), span.setAttribute("aria-valuenow", input.value));
  input.addEventListener("input", sync);
  sync();

  let x0 = 0, v0 = 0;
  span.addEventListener("pointerdown", (e) => {
    x0 = e.clientX;
    v0 = Number(input.value);
    span.setPointerCapture(e.pointerId);
    span.classList.add("drag");
    e.preventDefault();
  });
  span.addEventListener("pointermove", (e) => {
    if (span.classList.contains("drag")) set(v0 + ((e.clientX - x0) / 10) * step); // 10px = 한 칸
  });
  const end = () => span.classList.remove("drag");
  span.addEventListener("pointerup", end);
  span.addEventListener("pointercancel", end);
  span.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d) (set(Number(input.value) + d * step), e.preventDefault());
  });
};

// 본문 단어 ↔ 그림 연결 (Ciechanowski, samwho 방식).
// <span class="xref" data-hl="CSS 선택자">SDA</span> 에 마우스를 올리거나 포커스하면 선택자에 맞는 그림 요소가 빛난다.
// 위젯은 다시 그려지기도 해서 대상은 그때그때 찾는다. 터치에서는 누르면 잠깐 켜진다.
EV.xref = function (span) {
  const targets = () => document.querySelectorAll(span.dataset.hl);
  const on = () => targets().forEach((el) => el.classList.add("hl"));
  const off = () => targets().forEach((el) => el.classList.remove("hl"));
  span.tabIndex = 0;
  span.addEventListener("mouseenter", on);
  span.addEventListener("mouseleave", off);
  span.addEventListener("focus", on);
  span.addEventListener("blur", off);
  span.addEventListener("click", () => (on(), setTimeout(off, 1600)));
};

// MCAL / IPL 프로젝트 전환 버튼. 수업 실습이 주로 MCAL이라 페이지에 들어오면 항상 MCAL 코드부터 보인다.
// EV.projTabs("버튼 선택자", (key) => 화면을 key 프로젝트로 바꾸는 함수)
// 같은 페이지의 버튼들은 함께 움직이고, data-pane="mcal|ipl" 요소는 hidden으로 보였다 숨긴다.
EV.projTabs = function (selector, apply) {
  const btns = [...document.querySelectorAll(selector)];
  const panes = [...document.querySelectorAll("[data-pane]")];
  const pick = (key) => {
    btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.proj === key));
    panes.forEach((p) => (p.hidden = p.dataset.pane !== key));
    apply(key);
  };
  btns.forEach((b) => b.addEventListener("click", () => pick(b.dataset.proj)));
  pick("mcal");
};

// 페이지 순서 (허브 목록과 같은 순서). [파일, 번호, 제목]
EV.PAGES = [
  ["hints.html", "HINT", "교수님 힌트 1 · 2"],
  ["w1-uart.html", "W1", "S32K3 개요와 UART"],
  ["w2-gpio-bare.html", "W2", "GPIO, 주소 직접 접근"],
  ["w3-ipl-mcal.html", "W3", "GPIO, IPL과 MCAL"],
  ["w4-i2c-lcd.html", "W4", "I2C와 캐릭터 LCD"],
  ["w5-interrupt.html", "W5", "인터럽트 처리"],
  ["w6-adc.html", "W6", "ADC와 이동 평균 필터"],
];

// 주차 페이지 맨 아래: 이전 / 보드 허브 / 다음. 그리고 허브의 "이어서 보기"용으로 마지막 페이지를 기억
function pageNav() {
  if (!location.pathname.includes("/weeks/")) return;
  const i = EV.PAGES.findIndex((p) => p[0] === location.pathname.split("/").pop());
  if (i < 0) return;
  try { localStorage.setItem("ev-last", JSON.stringify(EV.PAGES[i])); } catch (_) {}
  const link = (p, dir) =>
    p ? EV.h("a", { href: p[0], class: "pn " + dir }, EV.h("small", {}, dir === "prev" ? "← 이전" : "다음 →"), `${p[1]} · ${p[2]}`) : EV.h("span");
  document.querySelector("main.page").append(
    EV.h("nav", { class: "pagenav", "aria-label": "주차 이동" },
      link(EV.PAGES[i - 1], "prev"),
      EV.h("a", { href: "../index.html", class: "pn hub" }, EV.h("small", {}, "처음으로"), "보드 허브"),
      link(EV.PAGES[i + 1], "next"))
  );
}

// 넓은 화면 오른쪽 목차 (지금 읽는 섹션 표시) + 맨 위 읽기 진행 바
function tocRail() {
  const secs = [...document.querySelectorAll("main.page > section")].filter((s) => s.querySelector("h2"));
  if (secs.length < 3) return;
  const rail = EV.h("nav", { class: "toc-rail", "aria-label": "이 페이지 목차" });
  const links = secs.map((sec, i) => {
    sec.id = sec.id || "s" + (i + 1);
    const h2 = sec.querySelector("h2");
    const num = h2.querySelector(".num");
    const title = [...h2.childNodes].filter((n) => n !== num).map((n) => n.textContent).join("").trim();
    return rail.appendChild(EV.h("a", { href: "#" + sec.id }, num ? EV.h("span", {}, num.textContent) : null, title));
  });
  document.body.append(rail);

  const bar = document.body.appendChild(EV.h("div", { class: "progress", "aria-hidden": "true" }));
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    // 지금 읽는 섹션 = 화면 40% 지점보다 위에서 시작한 마지막 섹션 (섹션 사이 여백에서도 끊기지 않게)
    let cur = 0;
    secs.forEach((s, j) => s.getBoundingClientRect().top < innerHeight * 0.4 && (cur = j));
    links.forEach((l, j) => l.classList.toggle("on", j === cur));
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

// 시스템이 "동작 줄이기"일 때만 상단에 켜기/끄기 버튼을 둔다. 선택은 이 브라우저에만 저장하고 새로고침으로 적용한다.
function motionToggle() {
  if (!EV.osReducedMotion) return;
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  const on = document.documentElement.classList.contains("motion-ok");
  (bar.lastElementChild || bar).append(EV.h("button", {
    class: "motion-btn", type: "button", "aria-pressed": on,
    title: "시스템이 '동작 줄이기'로 설정돼 있어요. 이 사이트의 애니메이션만 따로 켜거나 끌 수 있어요.",
    onclick: () => {
      try { on ? localStorage.removeItem("ev-motion") : localStorage.setItem("ev-motion", "1"); } catch (_) {}
      location.reload();
    },
  }, on ? "애니메이션 끄기" : "애니메이션 켜기"));
}

// 사이트 안 페이지 이동: 화면이 살짝 사라진 뒤 이동하고, 도착 페이지는 떠오른다(vt.js).
// 허브의 부품 클릭처럼 이미 다른 전환을 건 링크(defaultPrevented)는 건드리지 않는다.
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
  const href = a.getAttribute("href");
  if (/^[a-z]+:/i.test(href) || !/\.html$/.test(href)) return;
  e.preventDefault();
  try { sessionStorage.setItem("dive", "1"); } catch (_) {}
  if (EV.reducedMotion) return void (location.href = href);
  document.documentElement.classList.add("leaving");
  setTimeout(() => (location.href = href), 200);
});
addEventListener("pageshow", () => document.documentElement.classList.remove("leaving"));

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("pre[data-code]").forEach((pre) => EV.codeBlock(pre));
  document.querySelectorAll(".bubble .who").forEach((w) => (w.innerHTML = EV.CHIP_SVG));
  pageNav();
  tocRail();
  motionToggle();
  document.querySelectorAll(".tangle[data-bind]").forEach(EV.tangle);
  document.querySelectorAll(".xref[data-hl]").forEach(EV.xref);

  // 스크롤하면 섹션이 살짝 떠오른다. 모션 줄이기나 구형 브라우저면 아무것도 숨기지 않는다.
  if (EV.reducedMotion || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("reveal-on");
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
    { rootMargin: "0px 0px -10% 0px" }
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
});
