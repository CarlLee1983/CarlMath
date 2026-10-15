// 區塊式數學式在窄螢幕會水平捲動，捲動區域必須能用鍵盤操作（WCAG 2.1.1）。
// 排在 rehypeKatex 之後，替每個 .katex-display 加上 tabindex="0"。
function walk(node) {
  if (node.type === "element") {
    const classes = node.properties?.className;
    if (Array.isArray(classes) && classes.includes("katex-display")) {
      // unified 外掛的慣例是就地修改語法樹，不回傳新樹
      node.properties.tabIndex = 0;
    }
  }
  node.children?.forEach(walk);
}

export default function rehypeKatexFocusable() {
  return (tree) => walk(tree);
}
