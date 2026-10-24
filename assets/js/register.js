// Register: 레지스터 값을 비트 칸으로 보여 주는 위젯.
//
// EV.register(root, {
//   name: "MSCR", addr: "0x4029_0300", bits: 32 | 8, value: 0,
//   fields: [{ name: "OBE", lo: 21, hi: 21 }],   // 비트 위에 표시할 필드
//   editable: true,                              // 칸을 눌러 비트 토글
//   onChange(value) {},                          // 손으로 바꿨을 때
//   stateKey: "MSCR",                            // Stepper 상태 state.regs[stateKey]를 그림
// })
//
// 바뀐 비트만 반짝인다. 비교 기준은 "직전에 화면에 보였던 값"이라서
// Stepper가 여러 step을 건너뛰어도 실제로 달라진 칸만 반짝인다.
EV.register = function (root, opt) {
  const { h } = EV;
  const bits = opt.bits || 32;
  const mask = bits === 32 ? 0xffffffff : (1 << bits) - 1;
  let value = (opt.value || 0) & mask;
  let editable = !!opt.editable;

  const hexEl = h("span", { class: "hex" });
  const cells = [];
  for (let b = bits - 1; b >= 0; b--) {
    const cell = h("div", { class: "bit", title: `bit ${b}` }, h("span"), h("small", {}, b));
    cell.addEventListener("click", () => {
      if (!editable) return;
      set(value ^ (1 << b));
      opt.onChange && opt.onChange(value);
    });
    cells[b] = cell;
  }

  const fields = opt.fields || [];
  const fieldRow = h("div", { class: "reg-fields" });
  let col = bits - 1;
  for (const f of [...fields].sort((a, b) => b.hi - a.hi)) {
    if (f.hi < col) fieldRow.append(h("span", { style: `grid-column: span ${col - f.hi}; border-color: transparent` }));
    fieldRow.append(h("span", { style: `grid-column: span ${f.hi - f.lo + 1}`, title: f.name }, f.name));
    for (let b = f.lo; b <= f.hi; b++) cells[b].classList.add("infield");
    col = f.lo - 1;
  }

  root.classList.add("reg", bits === 32 ? "w32" : "w8");
  root.style.setProperty("--bits", bits);
  const parts = [
    h(
      "div",
      { class: "reg-head" },
      h("span", {}, h("span", { class: "name" }, opt.name), " ", opt.addr ? h("span", { class: "addr" }, opt.addr) : null),
      hexEl
    ),
    fields.length ? fieldRow : null,
    h("div", { class: "reg-bits" }, [...cells].reverse()),
    fields.length
      ? h("div", { class: "reg-legend" }, fields.map((f) => `${f.name}=bit${f.hi === f.lo ? f.lo : f.hi + ":" + f.lo}`).join("  "))
      : null,
  ];
  root.append(...parts.filter(Boolean));

  function paint(prev) {
    for (let b = 0; b < bits; b++) {
      const one = ((value >>> b) & 1) === 1;
      cells[b].classList.toggle("one", one);
      cells[b].firstChild.textContent = one ? "1" : "0";
      if (prev !== undefined && one !== (((prev >>> b) & 1) === 1)) EV.pulse(cells[b]);
    }
    hexEl.textContent = EV.hex(value, bits / 4);
  }

  function set(v) {
    const prev = value;
    value = (v & mask) >>> 0;
    paint(prev);
  }

  function setEditable(on) {
    editable = on;
    root.classList.toggle("editable", on);
  }

  setEditable(editable);
  paint();

  return {
    get value() { return value; },
    set,
    setEditable,
    render(state) {
      const v = state.regs && state.regs[opt.stateKey || opt.name];
      if (v !== undefined) set(v);
    },
  };
};
