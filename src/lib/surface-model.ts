import { normalizeDimensions, type Dimensions } from './geometry-model.ts';
export function faceAreas(d: Dimensions) {
  const {length:l,width:w,height:h}=normalizeDimensions(d);
  return {base:l*w,front:l*h,side:w*h};
}
export function surfaceArea(d: Dimensions): number {
  const a=faceAreas(d);return 2*(a.base+a.front+a.side);
}
/** A five-hinge cross net. Coordinates use centimetres; faces only share edges. */
export function netFaces(d: Dimensions) {
  const {length:l,width:w,height:h}=normalizeDimensions(d);
  return [
    {id:'bottom',label:'1 底面',x:h,y:w+h,width:l,height:w,area:l*w},
    {id:'top',label:'2 上面',x:h,y:0,width:l,height:w,area:l*w},
    {id:'front',label:'3 前面',x:h,y:2*w+h,width:l,height:h,area:l*h},
    {id:'back',label:'4 後面',x:h,y:w,width:l,height:h,area:l*h},
    {id:'left',label:'5 左面',x:0,y:w+h,width:h,height:w,area:w*h},
    {id:'right',label:'6 右面',x:h+l,y:w+h,width:h,height:w,area:w*h},
  ];
}
