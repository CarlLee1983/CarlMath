# 3D 互動幾何教室

第一版位於 `/geometry/volume/`，沿用 Astro 與既有色票，從主導覽與體積教材進入。原有親子共學教材保留；新增的是孩子可以直接操作的教具頁，依本次需求使用「觀察、操作、推導、練習、驗證」，不另增課程地圖單元或改變既有 MDX 九段結構。

## 邊界與重用

- `geometry-model.ts`：獨立的整數尺寸驗證與數學運算；本版邊長 1–8 公分，最多 512 塊。不把小數邊長誤畫成完整單位方塊。
- `geometry-renderer.ts`：Three.js 程式化幾何、相機、觸控、資源生命週期。依變更渲染，不持續動畫；DPR 上限 2、每層 instancing。未聲稱真機效能基準。
- `VolumeClassroom.astro`／`geometry-classroom.ts`：語意 HTML、教學流程與狀態同步，數學答案不由畫面取樣。新增立體可替換模型和推導，不需引入 Vue 或重建網站。
- 每次修改尺寸先回到一層。畫面與文字分別明示「已堆塊數」及「完整體積」，避免混淆。
- 正方體模式鎖定寬與高；一般長方體也可能三邊相等，正方體是其特殊情況。

## 可及性與降級

滑桿、堆疊、視角、縮放和答案都有鍵盤操作。OrbitControls 提供滑鼠拖曳、滾輪、單指旋轉和雙指縮放。觸控限制只在畫布，其他區域可正常捲動。不使用自動旋轉或計時評分。文字與俯視方格始終保留，WebGL 建立失敗／context lost 顯示替代說明；無 JavaScript 仍可閱讀初始圖、推導、參考答案。不要只靠顏色辨識層數。

## 驗證

執行 `pnpm verify`，包含內容、型別、單元、Playwright、正式 build 與部署 dry-run。新增模型測試遍歷 512 個尺寸；瀏覽器測試明確驗證 WebGL draw call，而非把 fallback 當成功，並獨立封鎖 WebGL 驗證降級。發布依既有 main GitHub Actions，不改憑證與部署設定。

目視應核 320px／桌面、淺深色、完整堆疊、旋轉／縮放、公式與格數；自動瀏覽器測試不代表已驗實體手機。

## 實作參考

- Three.js WebGLRenderer：https://threejs.org/docs/pages/WebGLRenderer.html
- OrbitControls：https://threejs.org/docs/pages/OrbitControls.html
- InstancedMesh：https://threejs.org/docs/pages/InstancedMesh.html
- 資源清理：https://threejs.org/manual/en/cleanup.html

數學定義與體積推導沿用本站 `/units/volume/`；本模組不宣稱涵蓋容積換算、表面積或所有國小幾何學習內容。

## 第二個教室：展開圖與表面積

`/geometry/surface-area/` 銜接體積教室，以有蓋、無重疊、無黏貼邊的理想長方體說明外表面積。這是原互動教具的延伸，不改課程地圖、既有教材結構或 UI 框架。

- 沿用 `geometry-model.ts` 的整數尺寸邊界；`surface-model.ts` 是六面尺寸、展開圖座標與面積的唯一計算來源。模型測試遍歷所有 512 種尺寸。
- `surface-renderer.ts` 使用 5 個真實邊軸，把 6 個剛性長方形從盒子攤成十字形。這只是合法展開圖之一，不主張列舉所有展開圖。邊長與面積不隨展開程度變化。
- 3D 面標籤、平面圖面編號與外部清單對應。平面圖採 480 viewBox、原生 SVG、1 平方公分格線；只在圖內保留數字，面名、邊長、公式放外部清單，以免窄版文字擠在面內。此互動視覺採用原教具的整合頁形式，不另建立 MDX 教材。
- 有蓋盒子的表面積是 `2 × (長×寬 + 長×高 + 寬×高)`；正方體是特殊情況。明確對比體積、只數可見面、高加倍與三邊加倍等迷思。作答可重試，不評分、不計時，不宣稱已測得孩子理解程度。
- 保留可讀的無 JavaScript 初始展開圖與參考思路；無 WebGL／context lost 時滑桿仍同步平面圖與清單。手機觸控、鍵盤按鈕、深淺色、縮放、回復操作均需驗收。

數學依據是長方形面積及六面逐面加總，前置連到 `/units/area-perimeter/`。Three.js 技術沿用上方官方文件；本次不新增外部圖像、模型或追蹤服務。
