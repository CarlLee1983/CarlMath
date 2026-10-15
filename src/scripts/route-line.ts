// 首頁路線數線：range 選定單元；滑鼠移過時先預覽、離開時回到選定的單元；步進按鈕一格一格走或跳到下一篇已撰寫。

interface RouteStop {
  sequence: number;
  href: string;
  title: string;
  coreQuestion: string;
  stage: string;
  grades: string;
  written: boolean;
}

function required<T extends Element>(root: Element, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`路線數線缺少 ${selector}`);
  return el;
}

/** 目前位置之後的第一篇已撰寫單元；後面沒有就回到第一篇。 */
export function nextWritten(stops: RouteStop[], current: number): number {
  const after = stops.find((stop) => stop.written && stop.sequence > current);
  return (after ?? stops.find((stop) => stop.written) ?? stops[0]!).sequence;
}

export function mountRouteLine(root: HTMLElement): void {
  const stops = JSON.parse(required(root, "[data-route-stops]").textContent ?? "[]") as RouteStop[];
  const input = required<HTMLInputElement>(root, ".route-input");
  const line = required<HTMLElement>(root, ".route-line");
  const meta = required(root, "[data-route-meta]");
  const link = required<HTMLAnchorElement>(root, "[data-route-link]");
  const core = required(root, "[data-route-core]");
  const steps = required<HTMLElement>(root, "[data-route-steps]");

  const show = (sequence: number) => {
    const stop = stops[sequence - 1];
    if (!stop) return;
    const metaText = `第 ${stop.sequence} 單元 · ${stop.stage} · ${stop.grades}`;
    line.style.setProperty("--pos", String((sequence - 1) / Math.max(stops.length - 1, 1)));
    meta.textContent = stop.written ? metaText : `${metaText} · 尚未撰寫`;
    link.textContent = stop.title;
    link.href = stop.href;
    core.textContent = stop.coreQuestion;
  };
  const select = (sequence: number) => {
    const clamped = Math.min(Math.max(sequence, 1), stops.length);
    input.value = String(clamped);
    const stop = stops[clamped - 1]!;
    input.setAttribute("aria-valuetext", `第 ${stop.sequence} 單元：${stop.title}`);
    show(clamped);
  };
  const sequenceAt = (clientX: number) => {
    const { left, width } = line.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - left) / width, 0), 1);
    return Math.round(ratio * (stops.length - 1)) + 1;
  };

  input.addEventListener("input", () => select(Number(input.value)));
  line.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" && event.buttons === 0) show(sequenceAt(event.clientX));
  });
  line.addEventListener("pointerleave", () => show(Number(input.value)));
  steps.addEventListener("click", (event) => {
    const step = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-step]")?.dataset.step;
    if (!step) return;
    const current = Number(input.value);
    select(step === "written" ? nextWritten(stops, current) : current + Number(step));
  });

  steps.hidden = false;
  select(Number(input.value));
}
