// 進場動態：每一段進入視窗時，段內的元素依序上浮淡入（各差 80ms）。
// 沒有 script、偏好減少動態，或載入時段落已在視窗內，內容一開始就完整可見。

type RevealGroup = [section: string, parts: string];

export function revealOnScroll(groups: RevealGroup[]): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  );
  for (const [sectionSelector, partsSelector] of groups) {
    const section = document.querySelector(sectionSelector);
    if (!section || section.getBoundingClientRect().top < window.innerHeight) continue;
    section.querySelectorAll<HTMLElement>(partsSelector).forEach((el, i) => {
      el.classList.add("reveal");
      el.style.setProperty("--i", String(Math.min(i, 8)));
    });
    observer.observe(section);
  }
  document.documentElement.classList.add("js-motion");
}
