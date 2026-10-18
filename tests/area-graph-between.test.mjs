import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAreaGraph as resolve } from "../src/lib/area-graph.ts";
const actual={id:"between",xRange:[-1,2],yRange:[-1,2],fn:{linear:[1,0]},secondFn:{quadratic:[1,0,0]},integrationRange:[0,1]};
const roomy={id:"roots",xRange:[-3,3],yRange:[-6,6],xStep:3,yStep:3};
test("x與x²之間精確閉合L/Q而不填回x軸，交換後保留有向差",()=>{
  const forward=resolve(actual),reverse=resolve({...actual,fn:actual.secondFn,secondFn:actual.fn});
  assert.equal(forward.areas.length,1);assert.equal(reverse.areas.length,1);
  assert.ok(Math.abs(forward.signedArea-1/6)<1e-14);
  assert.ok(Math.abs(reverse.signedArea+1/6)<1e-14);
  assert.equal(forward.geometricArea,reverse.geometricArea);
  assert.equal(forward.areas[0].negative,false);assert.equal(reverse.areas[0].negative,true);
  assert.match(forward.areas[0].d,/L 300 174 L 300 174 Q 240 294 180 294 Z$/);
  assert.match(reverse.areas[0].d,/Q 240 294 300 174 L 300 174 L 180 294 Z$/);
  assert.ok(forward.secondGraph);assert.equal(forward.rectangles.length,0);assert.equal(forward.endpoints.length,0);
});
test("交點分段涵蓋內部上下交換、兩交點與相切不換號",()=>{
  const crossing=resolve({...roomy,fn:actual.fn,secondFn:actual.secondFn,integrationRange:[-1,1]});
  assert.deepEqual(crossing.areas.map(a=>[a.from,a.to,a.negative]),[[-1,0,true],[0,1,false]]);
  assert.ok(Math.abs(crossing.signedArea+2/3)<1e-14);
  assert.ok(Math.abs(crossing.geometricArea-1)<1e-14);
  const two=resolve({...roomy,fn:{quadratic:[1,0,-1]},secondFn:{linear:[.5,0]},integrationRange:[-2,2]});
  assert.deepEqual(two.areas.map(a=>a.negative),[false,true,false]);
  for(const root of [two.areas[0].to,two.areas[1].to]) assert.ok(Math.abs(root*root-.5*root-1)<1e-14);
  const tangent=resolve({...roomy,fn:{quadratic:[1,1,0]},secondFn:{linear:[1,0]},integrationRange:[-1,1]});
  assert.deepEqual(tangent.areas.map(a=>a.negative),[false,false]);
  assert.deepEqual(tangent.areas.map(a=>[a.from,a.to]),[[-1,0],[0,1]]);
  assert.ok(Math.abs(tangent.signedArea-2/3)<1e-14);
});
test("差函數允許退化一次或非零常數，恆等曲線拒絕",()=>{
  const linear=resolve({...roomy,fn:{quadratic:[1,0,0]},secondFn:{quadratic:[1,1,0]},integrationRange:[-1,1]});
  assert.equal(linear.signedArea,0);assert.equal(linear.geometricArea,1);
  const constant=resolve({...roomy,fn:{quadratic:[1,0,1]},secondFn:{quadratic:[1,0,0]},integrationRange:[-1,1]});
  assert.equal(constant.signedArea,2);assert.equal(constant.areas.length,1);
  assert.throws(()=>resolve({...actual,secondFn:actual.fn}),/重合/);
});
test("兩曲線同在軸上或軸下時不連回0",()=>{
  for(const [fn,secondFn,integrationRange] of [[{linear:[1,2]},{linear:[1,1]},[0,1]],[{linear:[1,-1]},{linear:[1,-2]},[-1,0]]]){
    const out=resolve({...roomy,fn,secondFn,integrationRange});
    assert.equal(out.signedArea,1);
    const coords=[...out.areas[0].d.matchAll(/[ML] ([^ ]+) ([^ ]+)/g)].map(m=>Number(m[2]));
    assert.ok(coords.every(y=>y!==out.origin.y));
  }
});
test("第二族非法、與長條混用、第二曲線超窗及極端差值明確拒絕",()=>{
  for(const secondFn of [null,{constant:0},{linear:[0,0]},{sin:[1,1]},{quadratic:[0,1,0]},{linear:[1,Infinity]},{linear:[1,0],quadratic:[1,0,0]}]) assert.throws(()=>resolve({...actual,secondFn}),/secondFn/);
  assert.throws(()=>resolve({...actual,rectangles:{count:4,sample:"left"}}),/不可.*rectangles/);
  assert.throws(()=>resolve({...actual,secondFn:{quadratic:[-8,8,1]}}),/secondFn.*完整/);
  assert.throws(()=>resolve({...actual,secondFn:{linear:[1e308,1]}}),/溢位|精度|交點/);
  assert.throws(()=>resolve({...actual,fn:{linear:[1,1]},secondFn:{linear:[1,1+Number.EPSILON]},integrationRange:[0,.5]}),/無法分辨/);
});
test("字框避開兩條真曲線與兩曲線間陰影，包括跨極值區域",()=>{
  for(const input of [actual,{...actual,fn:actual.secondFn,secondFn:actual.fn},{...roomy,fn:{quadratic:[1,0,-1]},secondFn:{linear:[.5,0]},integrationRange:[-2,2]}]){
    const out=resolve(input),xu=360/(input.xRange[1]-input.xRange[0]),yu=360/(input.yRange[1]-input.yRange[0]);
    const f=(fn,x)=>"linear"in fn?fn.linear[0]*x+fn.linear[1]:(fn.quadratic[0]*x+fn.quadratic[1])*x+fn.quadratic[2];
    for(const t of out.texts){
      const left=t.x-t.text.length*7.5-5,right=t.x+t.text.length*7.5+5,top=t.y-25,bottom=t.y+7;
      for(let i=0;i<=16000;i++){
        const x=input.xRange[0]+(input.xRange[1]-input.xRange[0])*i/16000,px=60+(x-input.xRange[0])*xu;
        if(px<left||px>right)continue;
        const ys=[f(input.fn,x),f(input.secondFn,x)].map(y=>54+(input.yRange[1]-y)*yu);
        for(const py of ys)if(py>=54&&py<=414)assert.ok(!(py>top&&py<bottom));
        if(x>=input.integrationRange[0]&&x<=input.integrationRange[1])assert.ok(!(Math.min(...ys)<bottom&&Math.max(...ys)>top));
      }
    }
  }
});
test("虛線第二曲線在頂點精確分成兩段並覆蓋完整可見視窗",()=>{
  const out=resolve(actual), curves=out.secondGraph.quadraticCurves;
  assert.equal(curves.length,2);
  assert.deepEqual(curves[0],{from:{x:60,y:174},control:{x:120,y:294},to:{x:180,y:294}});
  assert.deepEqual(curves[0].to,curves[1].from);
  assert.ok(Math.abs(curves[1].control.x-(180+60*Math.SQRT2))<1e-10);
  assert.equal(curves[1].control.y,294);
  assert.ok(Math.abs(curves[1].to.x-(180+120*Math.SQRT2))<1e-10);
  assert.ok(Math.abs(curves[1].to.y-54)<1e-10);
  for(const c of curves)for(let i=0;i<=64;i++){
    const t=i/64,x=(1-t)**2*c.from.x+2*(1-t)*t*c.control.x+t*t*c.to.x;
    const y=(1-t)**2*c.from.y+2*(1-t)*t*c.control.y+t*t*c.to.y;
    assert.ok(Math.abs(y-(294-120*((x-180)/120)**2))<1e-10);
  }
});
