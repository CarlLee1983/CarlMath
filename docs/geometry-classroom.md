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
