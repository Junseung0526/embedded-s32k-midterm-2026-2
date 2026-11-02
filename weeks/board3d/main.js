// 3D 보드 페이지 진입점. three@0.128 + 후처리(블룸·MSAA)를 불러온 뒤 core → board → modes → boot 순서로 실행한다.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// 어떤 오류도 페이지 전체를 멈추지 않게: 화면 구석(#err)에 짧게 알리고 콘솔에는 전체를 남긴다
let errAt=0, errN=0;
window.B3D_ERR = (e, where) => {
  console.error("[board3d]" + (where ? " " + where : ""), e);
  const el = document.getElementById("err"); if (!el) return;
  const now = Date.now(); if (now - errAt < 1500 && errN > 2) return; errAt = now; errN++;
  const msg = (e && e.message) ? e.message : String(e);
  el.textContent = "일부 동작에 문제가 생겼어요" + (where ? " (" + where + ")" : "") + ": " + msg.slice(0, 120);
  clearTimeout(window.__errT); window.__errT = setTimeout(() => { el.textContent = ""; errN = 0; }, 8000);
};
window.addEventListener("error", (ev) => { if (ev.target && ev.target !== window) return; window.B3D_ERR(ev.error || ev.message, "스크립트"); });
window.addEventListener("unhandledrejection", (ev) => { window.B3D_ERR(ev.reason, "비동기"); });
window.B3D_SAFE = (fn, where) => { try { return fn(); } catch (e) { window.B3D_ERR(e, where); } };

window.THREE = THREE;
window.B3D_FX = { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass };

// WebGL을 못 쓰는 환경이면 안내 카드를 보여 주고 주차 페이지로 보낸다
const glOk = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (_) { return false; } })();
const showFail = (msg) => { document.getElementById("load")?.classList.add("done"); const f = document.getElementById("fail"); if (f) { f.hidden = false; if (msg) f.querySelector("p").textContent = msg; } };
if (!glOk) showFail();
else import("./core.js")
  .then(() => import("./board.js"))
  .then(() => import("./modes.js"))
  .then(() => import("./boot.js"))
  .then(() => document.getElementById("load")?.classList.add("done"))
  .catch((e) => {
    console.error(e);
    showFail("3D를 불러오지 못했어요: " + e.message + " (새로고침하거나 주차별 페이지에서 같은 내용을 볼 수 있어요)");
  });
