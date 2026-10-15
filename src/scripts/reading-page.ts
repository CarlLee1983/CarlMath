// 閱讀頁的瀏覽器端行為：「已讀」標記（一般篇與親子篇共用），以及側欄目錄版的目錄 scroll-spy、手機目錄按鈕。
// 沒有這支 script 時，目錄連結仍是一般錨點，內容完整可讀。

const READ_KEY = "cm-read";

/** 讀者本機記錄的已讀單元 id。儲存空間讀不到（隱私模式、被停用、內容損毀）時一律當作沒有已讀，不影響閱讀。 */
function readUnits(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** 記下開過這個單元的閱讀頁；寫不進去就算了，已讀只用來在先修標籤加 ✓。 */
function markRead(unitId: string, known: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...new Set([...known, unitId])]));
  } catch {
    // 儲存空間不可用：略過，頁面照常顯示
  }
}

function showReadMarks(root: HTMLElement, read: Set<string>): void {
  for (const chip of root.querySelectorAll<HTMLElement>("[data-unit-id]")) {
    if (!read.has(chip.dataset.unitId ?? "")) continue;
    chip.classList.add("done");
    const mark = document.createElement("span");
    mark.className = "read-mark";
    mark.textContent = "✓";
    const hint = document.createElement("span");
    hint.className = "sr-only";
    hint.textContent = "（已讀）";
    chip.prepend(mark, hint, " ");
  }
}

/** 捲到頁底：頁面捲得動，而且已經沒有往下的空間。 */
function atPageBottom(): boolean {
  const { scrollHeight } = document.documentElement;
  return scrollHeight > window.innerHeight + 1 && window.scrollY + window.innerHeight >= scrollHeight - 1;
}

function setUpScrollSpy(links: HTMLAnchorElement[]): void {
  const headings = links.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))));
  const update = () => {
    const line = window.innerHeight * 0.2;
    let current = 0;
    headings.forEach((heading, i) => {
      if (heading && heading.getBoundingClientRect().top <= line) current = i;
    });
    // 最後一段較短時，標題在頁底也到不了判定線，所以捲到底就直接標最後一段。
    if (atPageBottom()) current = links.length - 1;
    links.forEach((link, i) => {
      if (i === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };
  // 標題進出畫面上方 20% 的區域時重算「目前段落」，往上、往下捲都會觸發。
  const observer = new IntersectionObserver(update, { rootMargin: "0px 0px -80% 0px" });
  for (const heading of headings) if (heading) observer.observe(heading);
  // 標題不動、但捲到或離開頁底時也要重算。
  let wasAtBottom = atPageBottom();
  window.addEventListener(
    "scroll",
    () => {
      if (atPageBottom() !== wasAtBottom) {
        wasAtBottom = !wasAtBottom;
        update();
      }
    },
    { passive: true },
  );
  update();
}

function setUpTocButton(button: HTMLButtonElement, panel: HTMLElement): void {
  const setOpen = (open: boolean) => {
    panel.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  };
  button.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
  panel.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.classList.contains("open")) {
      setOpen(false);
      button.focus();
    }
  });
}

// 一般篇是 .reading（側欄目錄），親子篇是 .family-reading（分段步進，由 family-reading.ts 處理步進）。
const root = document.querySelector<HTMLElement>(".reading, .family-reading");
if (root) {
  const read = readUnits();
  showReadMarks(root, read);
  if (root.dataset.unit) markRead(root.dataset.unit, read);
  const tocLinks = [...root.querySelectorAll<HTMLAnchorElement>("a.toc-link")];
  if (tocLinks.length > 0) setUpScrollSpy(tocLinks);
  const button = root.querySelector<HTMLButtonElement>("#toc-button");
  const panel = root.querySelector<HTMLElement>("#reading-toc");
  if (button && panel) setUpTocButton(button, panel);
}
