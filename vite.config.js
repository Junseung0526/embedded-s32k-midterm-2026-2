import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const pages = ["index", "weeks/hints", "weeks/w1-uart", "weeks/w2-gpio-bare", "weeks/w3-ipl-mcal", "weeks/w4-i2c-lcd", "weeks/w5-interrupt"];

// vt.js는 첫 화면이 그려지기 전에 html.dive-in을 붙여야 해서, 모듈(defer)이 아니라 <head>에 인라인으로 넣는다.
const inlineVt = {
  name: "inline-vt",
  transformIndexHtml: () => [{ tag: "script", children: readFileSync(resolve(import.meta.dirname, "assets/js/vt.js"), "utf8"), injectTo: "head" }],
};

export default defineConfig({
  base: "./", // GitHub Pages 저장소 이름과 상관없이 동작하도록 상대 경로
  plugins: [inlineVt],
  build: {
    rollupOptions: { input: Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, p + ".html")])) },
  },
});
