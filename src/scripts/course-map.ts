// 課程地圖頁的瀏覽器端行為：搜尋與篩選列、先修標籤跳轉。
// 沒有這支 script 時，篩選列保持隱藏，所有單元照順序列出。

const filters = document.querySelector<HTMLElement>(".map-filters");
const search = filters?.querySelector<HTMLInputElement>('input[type="search"]');
const familyOnly = filters?.querySelector<HTMLInputElement>('[data-filter="family"]');
const writtenOnly = filters?.querySelector<HTMLInputElement>('[data-filter="written"]');
const count = filters?.querySelector<HTMLElement>(".map-count");
const empty = document.querySelector<HTMLElement>(".map-empty");

if (filters && search && familyOnly && writtenOnly && count && empty) {
  const rows = [...document.querySelectorAll<HTMLElement>(".map-row")];
  const stages = [...document.querySelectorAll<HTMLElement>(".map-stage")];

  const applyFilters = () => {
    const keyword = search.value.trim().toLocaleLowerCase();
    for (const row of rows) {
      const matches =
        (keyword === "" || (row.dataset.search ?? "").toLocaleLowerCase().includes(keyword)) &&
        (!familyOnly.checked || row.dataset.family === "true") &&
        (!writtenOnly.checked || row.dataset.written === "true");
      row.hidden = !matches;
    }
    // 整個階段都沒有符合的單元時，連標題一起收起來
    for (const stage of stages) stage.hidden = !stage.querySelector(".map-row:not([hidden])");
    const visible = rows.filter((row) => !row.hidden).length;
    count.textContent = `顯示 ${visible} 個單元`;
    empty.hidden = visible > 0;
  };

  const clearFilters = () => {
    search.value = "";
    familyOnly.checked = false;
    writtenOnly.checked = false;
    applyFilters();
  };

  search.addEventListener("input", applyFilters);
  familyOnly.addEventListener("change", applyFilters);
  writtenOnly.addEventListener("change", applyFilters);

  // 跳轉目標（單元列或階段）被篩掉時，先同步清掉篩選；不 preventDefault，瀏覽器接著跳到已顯示的錨點。
  const links = document.querySelectorAll<HTMLAnchorElement>('.map-prereq a, nav[aria-label="階段"] a');
  for (const link of links) {
    link.addEventListener("click", () => {
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (target?.hidden) clearFilters();
    });
  }

  // 網址 ?written=1、?family=1 預先勾選
  const params = new URLSearchParams(location.search);
  familyOnly.checked = params.get("family") === "1";
  writtenOnly.checked = params.get("written") === "1";
  applyFilters();
  filters.hidden = false;
}
