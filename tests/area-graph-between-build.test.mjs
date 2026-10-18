import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildWith } from "./helpers/build.mjs";
test("第二曲線虛線與反向精確Q區域只包住兩條邊界",()=>{
  const {status,output}=buildWith("tests/fixtures/area-graph-between",outDir=>{
    const html=readFileSync(join(outDir,"units/broken/index.html"),"utf8");
    const svgs=html.match(/<svg\b[^>]*class="ag-fig"[^>]*>[\s\S]*?<\/svg>/g)??[];
    assert.equal(svgs.length,2);
    assert.equal((svgs[0].match(/class="ag-area"/g)??[]).length,1);
    assert.match(svgs[0],/class="ag-curve ag-second"/);
    assert.match(svgs[0],/L 300 174 L 300 174 Q 240 294 180 294 Z/);
    assert.doesNotMatch(svgs[0],/class="ag-negative"|class="ag-rectangle"/);
    assert.equal((svgs[1].match(/class="ag-area"/g)??[]).length,2);
    assert.equal((svgs[1].match(/class="ag-negative"/g)??[]).length,1);
    for(const svg of svgs)assert.doesNotMatch(svg,/NaN|Infinity|ag-endpoint/);
  });
  assert.equal(status,0,output);
});
