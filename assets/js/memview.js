// 메모리 띠 그림: 4바이트 칸이 주소 순서로 쌓여 있고, Stepper 상태에 따라 한 칸을 가리킨다.
//
// EV.memview(root, { base: 0x10002000, words: 5, names: ["v0", ...] })
// 상태: state.mem = [값|null, ...], state.focus = 칸 번호|null, state.op = "addr"|"read"|"write"
EV.memview = function (root, opt) {
  const { h } = EV;
  const rows = [];
  root.classList.add("memview");
  for (let i = 0; i < opt.words; i++) {
    const addr = opt.base + i * 4;
    const val = h("span", { class: "mv-val" }, "?");
    const row = h(
      "div",
      { class: "mv-row" },
      h("span", { class: "mv-addr" }, EV.hex(addr)),
      h("span", { class: "mv-off" }, "+" + EV.hex(i * 4, 2)),
      h("span", { class: "mv-name" }, opt.names ? opt.names[i] : ""),
      val,
      h("span", { class: "mv-op" })
    );
    rows.push({ row, val });
    root.append(row);
  }

  const OP = { addr: "← 여기 주소", read: "← 읽기", write: "← 쓰기" };
  return {
    render(state) {
      rows.forEach(({ row, val }, i) => {
        const v = state.mem ? state.mem[i] : null;
        const text = v == null ? "?" : EV.hex(v);
        if (val.textContent !== text) {
          val.textContent = text;
          EV.pulse(row, "flash");
        }
        const focus = state.focus === i;
        row.classList.toggle("focus", focus);
        row.dataset.op = focus ? state.op || "" : "";
        row.lastChild.textContent = focus ? OP[state.op] || "" : "";
      });
    },
  };
};
