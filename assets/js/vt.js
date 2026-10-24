// 허브에서 줌인으로 들어온 경우에만 등장 애니메이션(base.css의 html.dive-in)을 켠다.
// 첫 화면이 그려지기 전에 클래스를 붙여야 깜빡임이 없어서 <head>에서 불러온다.
try {
  if (sessionStorage.getItem("dive") === "1") {
    sessionStorage.removeItem("dive");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("dive-in");
  }
} catch (_) {}
