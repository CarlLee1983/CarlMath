// rehype-katex 會把錯誤吞成 vfile message；排在它之後，把錯誤升級成例外讓 build 失敗
export default function rehypeKatexStrict() {
  return (_tree, file) => {
    const errors = file.messages.filter((m) => m.source === "rehype-katex");
    if (errors.length === 0) return;
    const detail = errors
      .map((m) => `  ${m.line ?? "?"}:${m.column ?? "?"} ${m.cause?.message ?? m.reason}`)
      .join("\n");
    throw new Error(`KaTeX 無法渲染 ${file.path ?? ""}：\n${detail}`, { cause: errors });
  };
}
