// 3D 보드 페이지 진입점. three@0.128 + 후처리(블룸·MSAA)를 불러온 뒤 core → board → modes → boot 순서로 실행한다.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

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
