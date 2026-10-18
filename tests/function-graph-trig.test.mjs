import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFunctionGraph as resolve } from "../src/lib/function-graph.ts";
const base = { id:"trig", xRange:[-Math.PI,2*Math.PI], yRange:[-2,2], xPiStep:1, fn:{sin:[1,1]} };
const actual = [
  {...base, points:[{at:[Math.PI/2,1],name:"A"},{at:[3*Math.PI/2,-1],name:"B"}]},
  {...base, fn:{cos:[1,1]}, points:[{at:[0,1],name:"A"},{at:[Math.PI,-1],name:"B"}]},
  {...base, fn:{sin:[2,2]}, yRange:[-3,3], points:[{at:[Math.PI/4,2],name:"A"},{at:[3*Math.PI/4,-2],name:"B"}]},
];
const inverse = (p, input) => [input.xRange[0]+(p.x-60)*(input.xRange[1]-input.xRange[0])/360,input.yRange[1]-(p.y-54)*(input.yRange[1]-input.yRange[0])/360];
test("三張教材波形保留零點與峰谷，π刻度無重複0或1π",()=>{
  for(const input of actual) {
    const out=resolve(input);
    assert.equal(out.trigCurves.length,1);
    assert.equal(out.endpoints.length,0);
    assert.equal(out.curve,undefined);
    assert.deepEqual(out.texts.filter(t=>t.axis==="x").map(t=>t.text),["−π","π","2π"]);
    assert.deepEqual(out.xTicks.map(p=>p.x),[60,300,420]);
    assert.equal(out.texts.filter(t=>t.text==="O").length,1);
    for(const point of out.points) assert.ok(out.trigCurves[0].some(p=>Math.hypot(p.x-point.x,p.y-point.y)<1e-9));
    const kind=Object.keys(input.fn)[0], [a,b]=input.fn[kind];
    for(let k=-2*b;k<=4*b;k++){
      const x=k*Math.PI/(2*b),y=a*Math[kind](b*x);
      assert.ok(out.trigCurves[0].some(p=>{const [px,py]=inverse(p,input);return Math.abs(px-x)<1e-12&&Math.abs(py-y)<1e-12}));
    }
  }
});
test("每段三角誤差界重新計算且獨立密集探針不超出0.1",()=>{
  for(const input of [...actual,{...base,fn:{sin:[-1,1]}},{...base,fn:{cos:[1,0.5]}}]){
    const out=resolve(input), kind=Object.keys(input.fn)[0],[a,b]=input.fn[kind],yu=360/(input.yRange[1]-input.yRange[0]);
    out.trigCurves.forEach((nodes,j)=>nodes.slice(1).forEach((p,i)=>{
      const [u,y0]=inverse(nodes[i],input),[v,y1]=inverse(p,input);
      const bound=(v-u)**2*Math.abs(a)*b*b*yu/8;
      assert.ok(bound<=out.trigErrorBounds[j][i]+1e-10);
      assert.ok(out.trigErrorBounds[j][i]<=.1);
      for(let k=0;k<=20;k++){const t=k/20,x=u+(v-u)*t;assert.ok(Math.abs(a*Math[kind](b*x)-(y0+(y1-y0)*t))*yu<=.100001);}
    }));
  }
});
test("三角族與π步長拒絕退化、未知、混用及不可辨識頻率",()=>{
  for(const fn of [{sin:[0,1]},{cos:[1,0]},{sin:[1,-1]},{cos:[1,Infinity]},{sin:[NaN,1]},{sin:[1]},{sin:[1,1,0]},{sin:[1,1],phase:1},{cos:[1,1],sin:[1,1]}]) assert.throws(()=>resolve({...base,fn}),/fn/);
  for(const xPiStep of [0,-1,.5,Infinity,NaN,"1"]) assert.throws(()=>resolve({...base,xPiStep}),/xPiStep/);
  assert.throws(()=>resolve({...base,xStep:1}),/xPiStep/);
  assert.throws(()=>resolve({...base,fn:{constant:1}}),/xPiStep/);
  assert.throws(()=>resolve({...base,fn:{sin:[1,6]}}),/週期/);
  assert.throws(()=>resolve({...base,fn:{sin:[1,Number.MAX_VALUE]}}),/週期/);
  assert.throws(()=>resolve({...base,fn:{sin:[1,Number.MIN_VALUE]}}),/週期/);
  assert.throws(()=>resolve({...base,xRange:[-10*Math.PI,10*Math.PI]}),/刻度/);
  assert.throws(()=>resolve({...base,xRange:[-10000*Math.PI,10000*Math.PI],xPiStep:10000}),/刻度/);
  assert.throws(()=>resolve({...base,fn:{sin:[1e100,1]}}),/精度/);
  assert.doesNotThrow(()=>resolve({...base,xRange:[-3,3],xPiStep:undefined}));
});
test("上下裁切分離分支而不新增端點，真域端點與單點域獨立",()=>{
  const input={...base,yRange:[-1,1],fn:{sin:[2,1]}},out=resolve(input);
  assert.equal(out.trigCurves.length,4);
  assert.equal(out.endpoints.length,0);
  for(const nodes of out.trigCurves) for(const p of nodes) assert.ok(p.y>=54-1e-6&&p.y<=414+1e-6);
  const domain={from:0,to:Math.PI,openFrom:true,openTo:false};
  assert.deepEqual(resolve({...base,domain}).endpoints.map(p=>p.open),[true,false]);
  const singleton=resolve({...base,domain:{from:Math.PI/2,to:Math.PI/2,openFrom:false,openTo:false}});
  assert.equal(singleton.trigCurves.length,0); assert.equal(singleton.endpoints.length,1);
  assert.throws(()=>resolve({...base,domain,points:[{at:[0,0]}]}),/points/);
  assert.throws(()=>resolve({...base,points:[{at:[Math.PI/2,.99]}]}),/曲線/);
  assert.throws(()=>resolve({...base,domain:{from:20,to:30,openFrom:false,openTo:false}}),/可見/);
});
test("相切不變穿越，開域唯一接觸點不補回",()=>{
  const out=resolve({...base,fn:{cos:[1,1]},yRange:[-1,1]});
  assert.equal(out.trigCurves.length,1);
  assert.ok(out.trigCurves[0].some(p=>p.y===54));
  assert.ok(out.trigCurves[0].some(p=>p.y===414));
  assert.ok(out.trigCurves[0].every(p=>p.y>=54&&p.y<=414));
  assert.throws(()=>resolve({...base,yRange:[-2,0],domain:{from:0,to:Math.PI,openFrom:true,openTo:true}}),/可見/);
});
test("字框包含完整波峰谷範圍，避開真函數與近似曲線",()=>{
  for(const input of actual){
    const out=resolve(input),kind=Object.keys(input.fn)[0],[a,b]=input.fn[kind];
    for(const t of out.texts){
      const half=t.text.length*15/2+3,box={left:t.x-half,right:t.x+half,top:t.y-23,bottom:t.y+5};
      for(let i=0;i<=15000;i++){
        const x=input.xRange[0]+(input.xRange[1]-input.xRange[0])*i/15000;
        const px=60+(x-input.xRange[0])*360/(input.xRange[1]-input.xRange[0]),py=54+(input.yRange[1]-a*Math[kind](b*x))*360/(input.yRange[1]-input.yRange[0]);
        assert.ok(!(px>box.left-2&&px<box.right+2&&py>box.top-2.1&&py<box.bottom+2.1),`label ${t.text}`);
      }
    }
  }
});
test("微分教材同尺度 sin/cos 無命名原點，反射與有限單側裁切保留真值",()=>{
  const sine=resolve(base),cosine=resolve({...base,fn:{cos:[1,1]}});
  assert.deepEqual(sine.origin,cosine.origin);
  assert.deepEqual(sine.xTicks,cosine.xTicks);
  assert.equal(sine.points.length,0); assert.equal(cosine.points.length,0);
  const reflected=resolve({...base,fn:{sin:[-1,1]}});
  assert.equal(sine.trigCurves[0].length,reflected.trigCurves[0].length);
  sine.trigCurves[0].forEach((p,i)=>{
    assert.equal(p.x,reflected.trigCurves[0][i].x);
    assert.ok(Math.abs(p.y+reflected.trigCurves[0][i].y-468)<1e-10);
  });
  for(const yRange of [[-1,2],[-2,1]]) {
    const out=resolve({...base,fn:{sin:[2,1]},yRange});
    assert.ok(out.trigCurves.length>1); assert.equal(out.endpoints.length,0);
  }
  assert.throws(()=>resolve({...base,yRange:[-1e-12,1e-12],fn:{sin:[1e-13,1]},points:[{at:[Math.PI/2,1.1e-13]}]}),/曲線/);
});
