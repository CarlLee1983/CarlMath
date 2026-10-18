import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAreaGraph as resolve } from "../src/lib/area-graph.ts";
const square={id:"area",xRange:[-.5,2.5],yRange:[-.5,4.5],fn:{quadratic:[1,0,0]},integrationRange:[0,2]};
const signed={id:"signed",xRange:[-2,3],yRange:[-2,3],fn:{linear:[1,0]},integrationRange:[-1,2]};
test("四張教材黎曼和精確使用左右端點，長條數增加時逼近積分",()=>{
  const sums=[];
  for(const count of [4,8]) for(const sample of ["left","right"]){
    const out=resolve({...square,rectangles:{count,sample}});
    assert.equal(out.signedArea,8/3);
    assert.equal(out.rectangles.length,count);
    out.rectangles.forEach((r,i)=>{
      assert.equal(r.from,2*i/count); assert.equal(r.to,2*(i+1)/count);
      assert.equal(r.sampleX,2*(i+(sample==="right"?1:0))/count);
      assert.equal(r.height,r.sampleX**2); assert.equal(r.width,240/count);
      assert.equal(r.pixelHeight,r.height*72);
      assert.ok(r.x>=120&&r.x+r.width<=360);
      assert.ok(r.y>=54&&r.y+r.pixelHeight<=414);
    });
    sums.push(out.rectangleSum);
    assert.equal(out.rectangles.filter(r=>r.height===0).length,sample==="left"?1:0);
  }
  assert.deepEqual(sums,[1.75,3.75,2.1875,3.1875]);
  assert.ok(sums[0]<sums[2]&&sums[2]<8/3&&8/3<sums[3]&&sums[3]<sums[1]);
});
test("正負面積沿零點分區；有向積分不是幾何面積",()=>{
  const out=resolve(signed);
  assert.deepEqual(out.areas.map(a=>[a.from,a.to,a.negative,a.signedArea]),[[-1,0,true,-.5],[0,2,false,2]]);
  assert.equal(out.signedArea,1.5);
  assert.equal(out.areas.reduce((s,a)=>s+Math.abs(a.signedArea),0),2.5);
  assert.equal(out.rectangleSum,undefined);assert.equal(out.rectangles.length,0);
  assert.equal(out.endpoints.length,0);
  for(const a of out.areas){assert.match(a.d,/ Z$/);assert.doesNotMatch(a.d,/NaN|Infinity| Q /);}
});
test("二次面積使用精確Q邊界並處理雙根、兩根、無根和負係數",()=>{
  const input={id:"roots",xRange:[-3,3],yRange:[-6,6],xStep:1,yStep:2,integrationRange:[-2,2]};
  for(const [coefficients,count,signs] of [[[1,0,0],2,[false,false]],[[1,0,-1],3,[false,true,false]],[[1,0,1],1,[false]],[[-1,0,1],3,[true,false,true]]]){
    const out=resolve({...input,fn:{quadratic:coefficients}});
    assert.equal(out.areas.length,count);
    assert.deepEqual(out.areas.map(a=>a.negative),signs);
    for(const a of out.areas){
      const m=a.d.match(/L ([^ ]+) ([^ ]+) Q ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) L/);
      assert.ok(m);
      const [x0,y0,cx,cy,x1,y1]=m.slice(1).map(Number);
      for(let i=0;i<=20;i++){
        const t=i/20,px=(1-t)**2*x0+2*(1-t)*t*cx+t*t*x1,py=(1-t)**2*y0+2*(1-t)*t*cy+t*t*y1;
        const x=-3+(px-60)/60,y=6-(py-54)/30;
        assert.ok(Math.abs(y-((coefficients[0]*x+coefficients[1])*x+coefficients[2]))<1e-10);
      }
    }
  }
  assert.equal(resolve(square).areas.length,1);
});
test("負長條向基線下方畫，跨零取樣不冒充曲線正負分區",()=>{
  const out=resolve({...signed,rectangles:{count:3,sample:"left"}});
  assert.deepEqual(out.rectangles.map(r=>r.height),[-1,0,1]);
  assert.equal(out.rectangles[0].y,out.origin.y);
  assert.equal(out.rectangles[0].negative,true);
  assert.equal(out.rectangleSum,0);
  const crossing=resolve({...signed,integrationRange:[-.5,.5],rectangles:{count:1,sample:"left"}});
  assert.equal(crossing.rectangles[0].height,-.5);assert.equal(crossing.rectangles[0].width,72);
});
test("非法族、區間、長條配置與圖外積分面積拒絕",()=>{
  for(const fn of [{constant:1},{cubic:[1,0,0,0]},{exponential:[2]},{linear:[0,1]},{quadratic:[0,1,0]},{linear:[1,0],quadratic:[1,0,0]},{linear:[Infinity,0]}]) assert.throws(()=>resolve({...square,fn}),/AreaGraph/);
  for(const integrationRange of [null,[0],[2,0],[1,1],[-1,2],[0,3],[0,Infinity]]) assert.throws(()=>resolve({...square,integrationRange}),/integrationRange/);
  for(const rectangles of [null,{},[],{count:0,sample:"left"},{count:33,sample:"left"},{count:1.5,sample:"left"},{count:4,sample:"midpoint"},{count:4,sample:"left",partition:[]}]) assert.throws(()=>resolve({...square,rectangles}),/rectangles/);
  assert.throws(()=>resolve({...square,rectangles:{count:32,sample:"left"}}),/過密/);
  assert.throws(()=>resolve({...square,yRange:[-.5,3.5]}),/完整/);
  assert.throws(()=>resolve({...square,fn:{quadratic:[-1,2,4]},yRange:[-.5,4.5]}),/完整/);
  assert.throws(()=>resolve({...square,integrationRange:[0,.001],rectangles:{count:1,sample:"right"}}),/過密|高度/);
  assert.throws(()=>resolve({...square,fn:{quadratic:[1e308,0,0]}}),/精度|溢位/);
});
test("所有字框避開真曲線、長條填色與正負面積",()=>{
  const inputs=[signed,square,...[4,8].flatMap(count=>["left","right"].map(sample=>({...square,rectangles:{count,sample}})))];
  for(const input of inputs){
    const out=resolve(input),xu=360/(input.xRange[1]-input.xRange[0]),yu=360/(input.yRange[1]-input.yRange[0]);
    const f=x=>"linear" in input.fn?input.fn.linear[0]*x+input.fn.linear[1]:(input.fn.quadratic[0]*x+input.fn.quadratic[1])*x+input.fn.quadratic[2];
    for(const t of out.texts){
      const box={left:t.x-t.text.length*7.5-3,right:t.x+t.text.length*7.5+3,top:t.y-23,bottom:t.y+5};
      for(const r of out.rectangles.filter(r=>r.height!==0)) assert.ok(!(box.left<r.x+r.width+2&&box.right>r.x-2&&box.top<r.y+r.pixelHeight+2&&box.bottom>r.y-2));
      for(let i=0;i<=10000;i++){
        const x=input.xRange[0]+(input.xRange[1]-input.xRange[0])*i/10000,y=f(x),px=60+(x-input.xRange[0])*xu,py=54+(input.yRange[1]-y)*yu;
        if(y>=input.yRange[0]&&y<=input.yRange[1]) assert.ok(!(px>box.left-2&&px<box.right+2&&py>box.top-2&&py<box.bottom+2));
        if(!input.rectangles&&x>=input.integrationRange[0]&&x<=input.integrationRange[1]) assert.ok(!(px>box.left-2&&px<box.right+2&&Math.min(py,out.origin.y)<box.bottom+2&&Math.max(py,out.origin.y)>box.top-2));
      }
    }
  }
});
test("後續積分教材保留非整數右界與斜截式正負分區",()=>{
  const input={id:"future",fn:{linear:[2,1]},xRange:[-.5,2.5],yRange:[-.5,5.5]};
  assert.equal(resolve({...input,integrationRange:[0,1]}).signedArea,2);
  const half=resolve({...input,integrationRange:[0,1.5]});
  assert.equal(half.signedArea,3.75);assert.equal(half.areas[0].to,1.5);
  assert.match(half.areas[0].d,/L 300 144 L 300 384 Z$/);
  const crossing={id:"cross",fn:{linear:[2,-2]},xRange:[-.5,3.5],yRange:[-3,5],integrationRange:[0,3]};
  assert.throws(()=>resolve(crossing),/標記/);
  const out=resolve({...crossing,yStep:2});
  assert.deepEqual(out.areas.map(a=>[a.from,a.to,a.signedArea]),[[0,1,-1],[1,3,4]]);
  assert.equal(out.signedArea,3);
});
test("非零長條不可被縮成零高，極端單位與錯誤域不偷偷夾回視窗",()=>{
  assert.throws(()=>resolve({...square,fn:{quadratic:[1e-4,0,0]},rectangles:{count:4,sample:"right"}}),/高度/);
  assert.throws(()=>resolve({...square,xRange:[0,Number.MIN_VALUE],integrationRange:[0,Number.MIN_VALUE]}),/範圍|精度/);
  assert.throws(()=>resolve({...square,rectangles:{count:Number.MAX_SAFE_INTEGER,sample:"right"}}),/rectangles/);
  assert.throws(()=>resolve({...signed,integrationRange:[-3,2]}),/integrationRange/);
});
