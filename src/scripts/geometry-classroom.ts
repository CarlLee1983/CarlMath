import { layerArea, normalizeDimensions, volume } from '../lib/geometry-model';
import { createGeometryRenderer } from '../lib/geometry-renderer';
const root = document.querySelector<HTMLElement>('[data-geometry-classroom]');
if (root) {
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const dimensions = ['length', 'width', 'height'] as const;
  const inputs = Object.fromEntries(dimensions.map(k => [k, get<HTMLInputElement>(`input[name=${k}]`)])) as Record<typeof dimensions[number], HTMLInputElement>;
  const cube = get<HTMLInputElement>('input[name=cube]');
  let d = {length:3,width:2,height:2}; let layers=1;
  const set = (selector:string,value: string|number) => {get(selector).textContent=String(value)};
  const status=get('[data-render-status]');
  const fallback=()=>{ status.dataset.state='fallback';status.textContent='目前無法顯示 3D。請用下方俯視圖與逐層計數繼續探索；公式、滑桿和練習仍可使用。'; };
  let renderer: ReturnType<typeof createGeometryRenderer> | undefined;
  try { renderer=createGeometryRenderer(get('[data-scene]'),fallback);if(status.dataset.state!=='fallback'){status.dataset.state='ready';status.textContent='3D 模型已準備好，可以拖曳觀察。';} } catch { fallback(); }
  function update() {
    for(const k of dimensions){inputs[k].value=String(d[k]);set(`[data-dimension=${k}]`,d[k]);}
    inputs.width.disabled=cube.checked;inputs.height.disabled=cube.checked;
    const area=layerArea(d);set('[data-layer-area]',area);set('[data-target-height]',d.height);set('[data-layer-count]',layers);set('[data-stacked-count]',area*layers);set('[data-volume]',volume(d));
    set('[data-area-formula]',`${d.length} × ${d.width} = ${area}`);set('[data-volume-formula]',`${d.length} × ${d.width} × ${d.height}`);set('[data-shape-note]',cube.checked?'正方體體積 = 邊長 × 邊長 × 邊長':'長方體體積 = 長 × 寬 × 高');
    get<HTMLButtonElement>('[data-add-layer]').disabled=layers>=d.height;
    const grid=get('[data-layer-grid]');grid.style.gridTemplateColumns=`repeat(${d.length},1fr)`;grid.setAttribute('aria-label',`長${d.length}格、寬${d.width}格，一層${area}塊`);grid.replaceChildren(...Array.from({length:area},()=>document.createElement('span')));
    get('[data-scene]').setAttribute('aria-label', `長 ${d.length} 公分、寬 ${d.width} 公分、高 ${d.height} 公分的長方體，目前顯示 ${layers} 層、${area*layers} 塊單位積木。`);
    renderer?.update({...d,visibleLayers:layers});
  }
  function changed(){d=normalizeDimensions({length:Number(inputs.length.value),width:Number(inputs.width.value),height:Number(inputs.height.value)},cube.checked);layers=1;update();}
  dimensions.forEach(k=>inputs[k].addEventListener('input',changed));cube.addEventListener('change',changed);
  get('[data-add-layer]').addEventListener('click',()=>{layers=Math.min(layers+1,d.height);update()});
  get('[data-show-all]').addEventListener('click',()=>{layers=d.height;update()});
  get('[data-reset-stack]').addEventListener('click',()=>{layers=1;update()});
  get('[data-reset-view]').addEventListener('click',()=>renderer?.resetView());
  get<HTMLFormElement>('[data-practice]').addEventListener('submit',e=>{
    e.preventDefault();const input=get<HTMLInputElement>('input[name=answer]');const answer=Number(input.value);const feedback=get('[data-feedback]');
    const valid=input.value.trim()!=='' && Number.isInteger(answer) && answer>0;
    feedback.dataset.state=!valid?'invalid':answer===24?'correct':'incorrect';
    feedback.textContent=!valid?'請輸入大於 0 的整數，再試一次。':answer===24?'答對了！每層 12 塊，2 層共 24 塊，體積是 24 立方公分。':'再想想：一層有 4 × 3 塊，共有 2 層。可以調整上面的積木來驗證。';
  });
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.addEventListener('click',()=>renderer?.setView(button.dataset.view as 'front'|'top'|'side')));
  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach(button=>button.addEventListener('click',()=>renderer?.zoomBy(Number(button.dataset.zoom))));
  update();window.addEventListener('pagehide',event=>{if(!event.persisted) renderer?.dispose();});
}
