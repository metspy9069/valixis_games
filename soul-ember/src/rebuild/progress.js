export const KEY='soul_ember_illustrated_v3';
export function readProgress(storage=localStorage){const base={version:3,runs:0,gold:0,totalKills:0,bossKills:0,records:[],selected:'cinder',muted:false,reduced:false};try{const p=JSON.parse(storage.getItem(KEY)||'null');if(p?.version!==3)return base;return {...base,...p,runs:Math.max(0,Number(p.runs)||0),records:Array.isArray(p.records)?p.records.slice(0,10):[]};}catch{return base;}}
export function saveProgress(value,storage=localStorage){try{storage.setItem(KEY,JSON.stringify({...value,version:3}));return true;}catch{return false;}}
