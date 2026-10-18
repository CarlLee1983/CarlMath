import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildWith } from "./helpers/build.mjs";
for(const [suffix,message] of [["title",/<AreaGraph> 必須有 title/],["desc",/<AreaGraph> 必須有 desc/],["clipped",/<AreaGraph> area-4-left: integrationRange.*完整/]]) {
  test(`AreaGraph ${suffix} 在建置邊界拒絕`,()=>{
    const {status,output}=buildWith(`tests/fixtures/area-graph-${suffix}`);
    assert.notEqual(status,0,output);assert.match(output,message);
  });
}
test("AreaGraph 五張教材圖完整輸出長條、符號紋理和精確Q曲線",()=>{
  const {status,output}=buildWith("tests/fixtures/area-graph",outDir=>{
    const html=readFileSync(join(outDir,"units/broken/index.html"),"utf8");
    const svgs=html.match(/<svg\b[^>]*class="ag-fig"[^>]*>[\s\S]*?<\/svg>/g)??[];
    assert.equal(svgs.length,5);
    assert.deepEqual(svgs.map(svg=>(svg.match(/class="ag-rectangle"/g)??[]).length),[3,4,7,8,0]);
    for(const svg of svgs) assert.doesNotMatch(svg,/NaN|Infinity|ag-endpoint/);
    assert.equal((svgs[4].match(/class="ag-area"/g)??[]).length,2);
    assert.equal((svgs[4].match(/class="ag-negative"/g)??[]).length,1);
    const ids=[...html.matchAll(/<pattern id="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length,5);assert.equal(new Set(ids).size,5);
    assert.match(svgs[4],new RegExp('fill="url\\(#'+ids[4]+'\\)"'));
    for(const svg of svgs.slice(0,4)) {
      assert.match(svg,/<path[^>]+class="ag-curve"[^>]+d="M [^"]+ Q /);
      assert.ok(svg.indexOf('class="ag-rectangle"')<svg.indexOf('class="ag-curve"'));
      assert.doesNotMatch(svg,/class="ag-area"/);
    }
  });
  assert.equal(status,0,output);
});
