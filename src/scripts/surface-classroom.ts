import {normalizeDimensions} from '../lib/geometry-model';
import {netFaces,surfaceArea} from '../lib/surface-model';
import {createSurfaceRenderer} from '../lib/surface-renderer';
const root=document.querySelector<HTMLElement>('[data-surface-classroom]');
if(root){
  const get=<T extends HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const dimensions=['length','width','height'] as const;
  const inputs=Object.fromEntries(dimensions.map(k=>[k,get<HTMLInputElement>(`input[name=${k}]`)])) as Record<typeof dimensions[number],HTMLInputElement>;
  const cube=get<HTMLInputElement>('input[name=cube]');
  const openness=get<HTMLInputElement>('input[name=openness]');
  let d={length:3,width:2,height:2};
  const set=(selector:string,value:string|number)=>{get(selector).textContent=String(value)};
  const status=get('[data-render-status]');
  const fallback=()=>{status.dataset.state='fallback';status.textContent='目前無法顯示 3D。下方平面展開圖、各面清單、邊長滑桿與練習仍可使用，請用它們比較 6 個面的面積。';};
  let renderer:ReturnType<typeof createSurfaceRenderer>|undefined;
  try{renderer=createSurfaceRenderer(get('[data-scene]'),fallback);if(status.dataset.state!=='fallback'){status.dataset.state='ready';status.textContent='3D 模型已準備好，拖曳觀察或慢慢展開。';}}catch{fallback();}
  const svg=root.querySelector<SVGSVGElement>('[data-net]')!;
  const group=svg.querySelector('[data-net-faces]')!;
  function update(){
    for(const k of dimensions){inputs[k].value=String(d[k]);set(`[data-dimension=${k}]`,d[k]);}
    inputs.width.disabled=cube.checked;inputs.height.disabled=cube.checked;
    set('[data-openness]',openness.value);set('[data-surface-area]',surfaceArea(d));
    set('[data-area-formula]',`2 ×（${d.length} × ${d.width} + ${d.length} × ${d.height} + ${d.width} × ${d.height}）`);
    set('[data-shape-note]',cube.checked?`正方體有 6 個一樣大的面：6 × ${d.length} × ${d.length} = ${surfaceArea(d)} 平方公分。`:'將 3 對面的面積相加，不能只算眼前看見的 3 個面。');
    const faces=netFaces(d),scale=420/(d.length+2*d.height),margin=30;
    svg.setAttribute('viewBox',`0 0 480 ${2*margin+(2*d.width+2*d.height)*scale}`);
    const create=(tag:string,attrs:Record<string,string|number>)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
    group.replaceChildren();
    for(const [i,f]of faces.entries()){
      const x=margin+f.x*scale,y=margin+f.y*scale;
      for(let col=1;col<f.width;col++)group.append(create('line',{class:'unit-line',x1:x+col*scale,x2:x+col*scale,y1:y,y2:y+f.height*scale}));
      for(let row=1;row<f.height;row++)group.append(create('line',{class:'unit-line',x1:x,x2:x+f.width*scale,y1:y+row*scale,y2:y+row*scale}));
      group.append(create('rect',{'data-face':f.id,x,y,width:f.width*scale,height:f.height*scale}));
      const label=create('text',{x:x+f.width*scale/2,y:y+f.height*scale/2});label.textContent=String(i+1);group.append(label);
    }
    const descriptions=faces.map(f=>`${f.label}：${f.width} × ${f.height} = ${f.area} 平方公分`);
    svg.querySelector('desc')!.textContent=`長 ${d.length}、寬 ${d.width}、高 ${d.height} 公分。${descriptions.join('；')}。`;
    get('[data-face-list]').replaceChildren(...descriptions.map(t=>{const li=document.createElement('li');li.textContent=t.slice(2);return li;}));
    get('[data-scene]').setAttribute('aria-label',`長 ${d.length}、寬 ${d.width}、高 ${d.height} 公分，展開 ${openness.value}%，6 個面的總面積 ${surfaceArea(d)} 平方公分。`);
    renderer?.update(d,Number(openness.value)/100);
  }
  function changed(){d=normalizeDimensions({length:Number(inputs.length.value),width:Number(inputs.width.value),height:Number(inputs.height.value)},cube.checked);update();}
  dimensions.forEach(k=>inputs[k].addEventListener('input',changed));cube.addEventListener('change',changed);openness.addEventListener('input',update);
  get('[data-fold]').addEventListener('click',()=>{openness.value='0';update();});
  get('[data-unfold]').addEventListener('click',()=>{openness.value='100';update();renderer?.setView('top');});
  get('[data-reset-view]').addEventListener('click',()=>renderer?.resetView());
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>renderer?.setView(b.dataset.view as 'front'|'top'|'side')));
  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach(b=>b.addEventListener('click',()=>renderer?.zoomBy(Number(b.dataset.zoom))));
  get<HTMLFormElement>('[data-practice]').addEventListener('submit',e=>{
    e.preventDefault();const input=get<HTMLInputElement>('input[name=answer]'),answer=Number(input.value),feedback=get('[data-feedback]');
    const valid=input.value.trim()!==''&&Number.isInteger(answer)&&answer>0;
    feedback.dataset.state=!valid?'invalid':answer===52?'correct':'incorrect';
    feedback.textContent=!valid?'請輸入大於 0 的整數，再試一次。':answer===52?'答對了！上下共 24、前後共 16、左右共 12，合計 52 平方公分。':answer===24?'24 是長 × 寬 × 高的體積數值。這次要把 6 個面的面積相加，單位是平方公分。':answer===26?'26 只算到每對中的一個面。別忘了底面、後面與另一個側面，再試一次。':'先找 3 對一樣大的面：4 × 3、4 × 2、3 × 2，每一對都要算 2 次。';
  });
  update();window.addEventListener('pagehide',event=>{if(!event.persisted)renderer?.dispose();});
}
