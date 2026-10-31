// node weeks/exam-gen.test.mjs : 생성기·문제 은행이 항상 보기 4개, 중복 없음, 정답 위치가 맞는지 검사
import assert from "node:assert/strict";
import { GENS, BANK, makeSet, shuffle } from "./exam-gen.js";

for (const g of GENS) {
  let ok = 0;
  for (let i = 0; i < 2000; i++) {
    const it = g();
    if (!it) continue; // mc()가 null이면 makeSet이 다시 뽑는다
    ok++;
    assert.equal(new Set(it.choices).size, 4, it.q + " " + it.choices);
  }
  assert.ok(ok > 1000, "생성 실패가 너무 잦음: " + g.toString().slice(0, 80));
}
for (const b of BANK) if (b.choices) assert.equal(new Set(b.choices).size, 4, b.q);

const positions = new Set();
for (let i = 0; i < 200; i++) {
  const s = shuffle(BANK[0]);
  assert.equal(s.choices[s.answer], BANK[0].choices[0]);
  positions.add(s.answer);
}
assert.equal(positions.size, 4, "정답 위치가 섞이지 않음");

for (const t of [undefined, "힌트", "W1", "W2", "W3", "W4", "W5", "W6"]) {
  const set = makeSet(20, t);
  assert.equal(set.length, 20);
  if (t) assert.ok(set.every((it) => it.t === t), t);
}
console.log(`ok: 생성기 ${GENS.length}개, 개념 문제 ${BANK.length}개`);
assert.ok(BANK.length >= 200, "개념 문제 200개 미만: " + BANK.length);
const dup = BANK.map((b) => b.q).filter((q, i, a) => a.indexOf(q) !== i);
assert.equal(dup.length, 0, "중복 문제: " + dup);
console.log(`ok: 개념 문제 ${BANK.length}개, 중복 없음`);
const essay = makeSet(10, "서술");
assert.ok(essay.length > 0 && essay.every((it) => it.t === "서술"), "서술 주제");
for (const it of BANK.filter((b) => b.choices)) assert.ok(it.answer >= 0 && it.answer < 4, it.q);
