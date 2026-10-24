// Quiz: 섹션 끝 체크 퀴즈. 저장하지 않는다.
// 객관식은 고르면 바로 채점, 단답은 "정답 보기"로 스스로 확인한다(입력 채점 없음).
//
// EV.quiz(root, [
//   { q: "질문", choices: ["A", "B"], answer: 1, why: "해설" },
//   { q: "질문", answer: "volatile", why: "해설" },
// ])
EV.quiz = function (root, items) {
  const { h } = EV;
  root.classList.add("quiz");
  for (const it of items) {
    const item = h("div", { class: "item" }, h("p", { class: "q" }, it.q));
    const why = h("div", { class: "why" });
    why.innerHTML = it.choices
      ? `<b>정답: ${it.choices[it.answer]}</b><br>${it.why}`
      : `<b>정답: ${it.answer}</b><br>${it.why}`;

    if (it.choices) {
      const box = h("div", { class: "choices" });
      it.choices.forEach((c, i) => {
        box.append(
          h("button", {
            class: "choice", type: "button",
            onclick: (e) => {
              const right = i === it.answer;
              e.currentTarget.classList.add(right ? "right" : "wrong");
              if (right) item.classList.add("open");
            },
          }, c)
        );
      });
      item.append(box);
    } else {
      item.append(h("button", { class: "key", type: "button", onclick: () => item.classList.toggle("open") }, "정답 보기"));
    }
    item.append(why);
    root.append(item);
  }
};
