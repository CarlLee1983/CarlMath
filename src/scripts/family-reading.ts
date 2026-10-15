// 親子篇分段步進的瀏覽器端行為：一次顯示一張段落卡，進度點／上下段按鈕換段，目前段與網址 hash 同步。
// 只有 setUp() 成功才在根元素加上 stepping（CSS 靠它收起其他段）；沒有這支 script、停用 JavaScript
// 或腳本失敗時，9 段連續顯示，進度點是一般錨點，內容不被藏住。

const familyRoot = document.querySelector<HTMLElement>(".family-reading");
if (familyRoot) setUp(familyRoot);

function setUp(root: HTMLElement): void {
  const cards = [...root.querySelectorAll<HTMLElement>(".stage > section")];
  const dots = [...root.querySelectorAll<HTMLAnchorElement>(".steps a")];
  const headings = cards.flatMap((card) => card.querySelector<HTMLElement>("h2") ?? []);
  const prev = root.querySelector<HTMLButtonElement>("#step-prev");
  const next = root.querySelector<HTMLButtonElement>("#step-next");
  if (!prev || !next || cards.length === 0 || dots.length !== cards.length || headings.length !== cards.length) return;

  const ids = headings.map((heading) => heading.id);
  const titles = headings.map((heading) => heading.textContent?.trim() ?? "");
  const last = cards.length - 1;
  const seen = new Set<number>();
  let current = 0;
  // 換段後焦點移到新段的標題：標題要能被程式聚焦
  for (const heading of headings) heading.tabIndex = -1;

  /** 網址 hash 對應的段落索引；沒有 hash、hash 損毀或不認得時為 -1。 */
  const indexFromHash = (): number => {
    try {
      return ids.indexOf(decodeURIComponent(location.hash.slice(1)));
    } catch {
      return -1;
    }
  };

  /** 把畫面畫成「目前是第 index 段」；狀態只有 current 與 seen。 */
  const select = (index: number): void => {
    current = index;
    seen.add(index);
    cards.forEach((card, i) => card.classList.toggle("cur", i === current));
    dots.forEach((dot, i) => {
      dot.classList.toggle("cur", i === current);
      dot.classList.toggle("seen", i !== current && seen.has(i));
      if (i === current) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
    prev.hidden = current === 0;
    next.hidden = current === last;
    if (current < last) next.textContent = `下一段：${titles[current + 1]}`;
  };

  /** 使用者操作換段：更新 hash、焦點移到新段標題、捲回頁首。 */
  const goTo = (index: number): void => {
    select(Math.max(0, Math.min(last, index)));
    history.replaceState(null, "", `#${encodeURIComponent(ids[current] ?? "")}`);
    headings[current]?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };

  /** 依網址 hash 換段；hash 不對應任何一段時不動，回傳 false。 */
  const syncFromHash = (): boolean => {
    const index = indexFromHash();
    if (index === -1) return false;
    select(index);
    return true;
  };

  dots.forEach((dot, i) =>
    dot.addEventListener("click", (event) => {
      event.preventDefault();
      goTo(i);
    }),
  );
  prev.addEventListener("click", () => goTo(current - 1));
  next.addEventListener("click", () => goTo(current + 1));
  // 手動改網址 hash、或按瀏覽器的上一頁回到帶 hash 的網址時換段。
  window.addEventListener("hashchange", () => {
    if (syncFromHash()) window.scrollTo(0, 0);
  });

  if (!syncFromHash()) select(0);
  root.classList.add("stepping");
}
