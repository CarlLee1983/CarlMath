---
status: accepted
---

# 課程地圖是獨立於教材檔的單一來源，單元網址扁平

單元的階段、建議閱讀順序、先修、親子共學標記與課綱附註，只記錄在 `content/course-map.yaml`；教材檔的 frontmatter 只以 `unit` 指向單元 id，撰寫與否由教材檔存在與否推導。課程地圖從第一版就要列出到微積分的全部單元，而大多數單元沒有教材檔，若像 CarlStack 把 `series`／`seriesOrder` 寫在文章 frontmatter，未撰寫的單元就無處存放，順序與先修也會散落在上百個檔案中難以檢查是否成環。代價是寫教材時要對照另一個檔案，且驗證腳本須檢查兩邊的 id 對得上。

單元網址為 `/units/<unit-id>/`，不含階段與編號，讓單元調整所屬階段或順序時不改網址。

**Falsified if:** 所有單元都已有教材檔，且 `content/course-map.yaml` 的欄位與教材 frontmatter 開始需要互相同步（例如教材需要覆寫地圖上的標題或先修）；這時把單元資料併回教材 frontmatter 會比較簡單。
