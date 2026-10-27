// 시스템이 "동작 줄이기"여도 사용자가 직접 켠 경우(?motion=1 또는 상단 버튼)에는 애니메이션을 쓴다.
// 이 선택은 html.motion-ok 클래스로 CSS와 core.js가 함께 본다. 첫 화면 전에 정해야 해서 <head>에서 불러온다.
try {
  const q = new URLSearchParams(location.search).get("motion");
  if (q === "1") localStorage.setItem("ev-motion", "1");
  if (q === "0") localStorage.removeItem("ev-motion");
  if (localStorage.getItem("ev-motion") === "1") document.documentElement.classList.add("motion-ok");
} catch (_) {}

// 허브에서 줌인으로 들어온 경우에만 등장 애니메이션(base.css의 html.dive-in)을 켠다.
// 첫 화면이 그려지기 전에 클래스를 붙여야 깜빡임이 없다.
try {
  if (sessionStorage.getItem("dive") === "1") {
    sessionStorage.removeItem("dive");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("motion-ok")) document.documentElement.classList.add("dive-in");
  }
} catch (_) {}
