import {ARMORY,ARMORY_COSTS,MASTERY_COSTS,blankArmory,blankMastery} from './content.js';
import {HEROES} from './roster.js';

export const KEY='soul_ember_v4';
export const LEGACY_KEY='soul_ember_illustrated_v3';
const base=()=>({version:4,runs:0,gold:0,totalKills:0,bossKills:0,records:[],selected:'cinder',muted:false,reduced:false,armory:blankArmory(),mastery:blankMastery(Object.keys(HEROES))});
const normalize=p=>{const clean=base();return {...clean,...p,version:4,runs:Math.max(0,Number(p?.runs)||0),gold:Math.max(0,Number(p?.gold)||0),records:Array.isArray(p?.records)?p.records.slice(0,10):[],armory:{...clean.armory,...p?.armory},mastery:{...clean.mastery,...p?.mastery}};};

export function readProgress(storage=localStorage){try{const current=JSON.parse(storage.getItem(KEY)||'null');if(current?.version===4)return normalize(current);const legacy=JSON.parse(storage.getItem(LEGACY_KEY)||'null');if(legacy?.version===3)return normalize(legacy);return base();}catch{return base();}}
export function saveProgress(value,storage=localStorage){try{storage.setItem(KEY,JSON.stringify(normalize(value)));return true;}catch{return false;}}
export function buyArmory(progress,id){const rank=progress.armory?.[id]||0,def=ARMORY[id],cost=ARMORY_COSTS[rank];if(!def||rank>=def.max||progress.gold<cost)return false;progress.gold-=cost;progress.armory[id]=rank+1;return true;}
export function buyMastery(progress,hero){const rank=progress.mastery?.[hero]||0,cost=MASTERY_COSTS[rank];if(!HEROES[hero]||rank>=3||progress.gold<cost)return false;progress.gold-=cost;progress.mastery[hero]=rank+1;return true;}
