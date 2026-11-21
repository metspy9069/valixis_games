import {ARMORY,ARMORY_COSTS,MASTERY_COSTS,blankArmory,blankMastery} from './content.js';
import {HEROES} from './roster.js';

export const KEY='soul_ember_v4';
export const LEGACY_KEY='soul_ember_illustrated_v3';
const base=()=>({version:4,runs:0,victories:0,bestAscension:0,gold:0,totalKills:0,bossKills:0,records:[],selected:'cinder',muted:false,reduced:false,damageNumbers:true,screenShake:1.0,spatialAudio:true,audio:{master:.75,music:.55,sfx:.8,ambience:.5},armory:blankArmory(),mastery:blankMastery(Object.keys(HEROES))});
const volume=value=>Math.max(0,Math.min(1,Number.isFinite(Number(value))?Number(value):.5));
const normalize=p=>{const clean=base();return {...clean,...p,version:4,runs:Math.max(0,Number(p?.runs)||0),victories:Math.max(0,Number(p?.victories)||0),bestAscension:Math.max(0,Number(p?.bestAscension)||0),gold:Math.max(0,Number(p?.gold)||0),totalKills:Math.max(0,Number(p?.totalKills)||0),bossKills:Math.max(0,Number(p?.bossKills)||0),records:Array.isArray(p?.records)?p.records.slice(0,10):[],audio:Object.fromEntries(Object.entries({...clean.audio,...p?.audio}).map(([k,v])=>[k,volume(v)])),armory:{...clean.armory,...p?.armory},mastery:{...clean.mastery,...p?.mastery},damageNumbers:p?.damageNumbers===false?false:true,screenShake:typeof p?.screenShake==='number'?Math.max(0,Math.min(2,p.screenShake)):1,spatialAudio:p?.spatialAudio===false?false:true};};

export function readProgress(storage=localStorage){try{const current=JSON.parse(storage.getItem(KEY)||'null');if(current?.version===4)return normalize(current);const legacy=JSON.parse(storage.getItem(LEGACY_KEY)||'null');if(legacy?.version===3)return normalize(legacy);return base();}catch{return base();}}
export function saveProgress(value,storage=localStorage){try{storage.setItem(KEY,JSON.stringify(normalize(value)));return true;}catch{return false;}}
export function buyArmory(progress,id){const rank=progress.armory?.[id]||0,def=ARMORY[id],cost=ARMORY_COSTS[rank];if(!def||rank>=def.max||progress.gold<cost)return false;progress.gold-=cost;progress.armory[id]=rank+1;return true;}
export function buyMastery(progress,hero){const rank=progress.mastery?.[hero]||0,cost=MASTERY_COSTS[rank];if(!HEROES[hero]||rank>=3||progress.gold<cost)return false;progress.gold-=cost;progress.mastery[hero]=rank+1;return true;}
