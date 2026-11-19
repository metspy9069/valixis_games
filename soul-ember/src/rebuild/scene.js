import * as T from 'three';
import {DungeonView} from './dungeon-view.js';
import {HEROES,MONSTERS,REGIONS} from './roster.js';

const HERO_STYLE={
 cinder:{hood:true,staff:0xff7438},grave:{helm:true,sword:true,armor:true},thorn:{hood:true,bow:true},
 frost:{crown:true,staff:0x8fe6ff},bone:{skull:true,lantern:true},storm:{hair:true,twins:true},
 plague:{hat:true,flask:true},bell:{helm:true,bell:true,armor:true},
};
const HUMANOIDS=new Set(['thrall','shield','censer','ringer','husk','archer','thornling','root','stalker','hex','sentinel','abbot','warden','regent']);
const MONSTER_COLORS={thrall:0x6c5546,shield:0xb4aa91,censer:0x795d4b,ringer:0x806b4d,hound:0x552c25,gargoyle:0x707a74,husk:0x56706b,archer:0xb8ae94,leech:0x4b2426,mimic:0x69503a,spitter:0x63714b,wraith:0x63898c,thornling:0x657044,root:0x596045,stalker:0x625b50,brood:0x5a453a,hex:0x64506f,sentinel:0xc0b495,abbot:0x9a4e35,warden:0x45696c,regent:0x657044};

export class Scene{
 constructor(canvas){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.mobile=matchMedia('(pointer:coarse)').matches;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.15:1.5));
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
  this.renderer.shadowMap.enabled=!this.mobile;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.scene.background=new T.Color(0x111716);this.scene.fog=new T.FogExp2(0x111716,.018);
  this.camera=new T.OrthographicCamera();this.scene.add(new T.HemisphereLight(0xb6c3bb,0x211b15,1.8));
  this.sun=new T.DirectionalLight(0xe5d5b7,2.3);this.sun.position.set(-10,25,11);this.sun.castShadow=!this.mobile;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22});this.scene.add(this.sun,this.sun.target);
  this.dungeon=new DungeonView(this.scene);this.root=new T.Object3D();this.local=new T.Object3D();this.matrix=new T.Matrix4();this.color=new T.Color();
  this.geometries={
   box:new T.BoxGeometry(1,1,1),body:new T.CylinderGeometry(.65,.78,1,8),limb:new T.CylinderGeometry(.5,.42,1,7),
   head:new T.IcosahedronGeometry(.5,1),orb:new T.SphereGeometry(.5,9,7),cone:new T.ConeGeometry(.5,1,8),
   crystal:new T.OctahedronGeometry(.5),wing:new T.ConeGeometry(.5,1,3),ring:new T.TorusGeometry(.5,.08,5,18),
   bow:new T.TorusGeometry(.5,.055,5,20,Math.PI),shadow:new T.CircleGeometry(.72,20),
  };
  this.materials={
   cloth:new T.MeshStandardMaterial({color:0xffffff,roughness:.92}),
   skin:new T.MeshStandardMaterial({color:0xffffff,roughness:.78}),
   metal:new T.MeshStandardMaterial({color:0xffffff,roughness:.4,metalness:.72}),
   bone:new T.MeshStandardMaterial({color:0xffffff,roughness:.88}),
   glow:new T.MeshBasicMaterial({color:0xffffff}),
   ghost:new T.MeshStandardMaterial({color:0xffffff,roughness:.4,transparent:true,opacity:.62,depthWrite:false}),
   shadow:new T.MeshBasicMaterial({color:0x050706,transparent:true,opacity:.35,depthWrite:false}),
   fx:new T.MeshBasicMaterial({color:0xffffff}),
   ring:new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false}),
  };
  this.batches=new Map();this.parts=[];this.resize();window.addEventListener('resize',()=>this.resize());this.lastBiome=-1;
 }
 resize(){const w=innerWidth,h=innerHeight,half=this.mobile?11:10;this.camera.left=-half*w/h;this.camera.right=half*w/h;this.camera.top=half;this.camera.bottom=-half;this.camera.near=.1;this.camera.far=120;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
 shade(hex,factor){return this.color.setHex(hex).multiplyScalar(factor).getHex();}
 queue(geo,material,color,position,scale,rotation=[0,0,0]){
  this.local.position.set(...position);this.local.scale.set(...scale);this.local.rotation.set(...rotation);this.local.updateMatrix();
  this.matrix.multiplyMatrices(this.root.matrix,this.local.matrix);this.parts.push({geo,material,color,matrix:this.matrix.clone()});
 }
 humanoid(entity,base,style={},scale=1,dead=false,time=0,reduced=false){
  const moving=entity.moving??true,attack=entity.attack>0,hit=entity.flash>0,phase=reduced?0:time*9+(entity.id||0)*.37;
  const walk=moving&&!dead?Math.sin(phase)*.58:0,attackSwing=attack?1.25:0,fall=dead?(1-Math.max(0,(entity.life??.65)/.65))*1.45:0;
  const yaw=Math.atan2(entity.dx||0,entity.dz||1),size=scale*(entity.dash?.82:1),bob=moving&&!reduced?Math.abs(Math.sin(phase))*.06:0;
  this.root.position.set(entity.x,bob,entity.z);this.root.rotation.set(fall, yaw, hit?.12*Math.sin(time*45):0);this.root.scale.setScalar(size);this.root.updateMatrix();
  const dark=this.shade(base,.43),mid=this.shade(base,.72),light=this.shade(base,1.18),skin=style.skull?0xd3c9aa:style.monster?this.shade(base,.9):0xb99a7d;
  this.queue('limb','cloth',dark,[-.22,.38,.03],[.25,.68,.25],[walk,0,0]);this.queue('limb','cloth',dark,[.22,.38,.03],[.25,.68,.25],[-walk,0,0]);
  this.queue('body',style.armor?'metal':'cloth',mid,[0,1.02,0],[.72,.88,.55]);this.queue('cone','cloth',dark,[0,.78,-.1],[.88,.92,.55],[0,0,Math.PI]);
  this.queue('limb',style.armor?'metal':'cloth',mid,[-.58,1.05,0],[.22,.75,.22],[-walk*.8-attackSwing,0,-.15]);this.queue('limb',style.armor?'metal':'cloth',mid,[.58,1.05,0],[.22,.75,.22],[walk*.8-attackSwing,0,.15]);
  this.queue('head',style.helm?'metal':style.skull?'bone':'skin',style.helm?light:skin,[0,1.68,.03],[.52,.58,.48]);
  if(style.hood)this.queue('cone','cloth',dark,[0,1.82,0],[.72,.72,.68]);
  if(style.helm){this.queue('box','metal',this.shade(light,.7),[0,1.7,.35],[.56,.16,.12]);this.queue('cone','metal',light,[0,2.15,0],[.16,.6,.16]);}
  if(style.crown)for(let i=-1;i<=1;i++)this.queue('crystal','glow',0x8fe6ff,[i*.25,2.05,0],[.12,.42,.12],[0,0,i*.25]);
  if(style.hair)for(let i=-2;i<=2;i++)this.queue('cone','cloth',0xd1d4df,[i*.13,1.95,-.08],[.14,.55,.14],[.2,0,i*.2]);
  if(style.staff){this.queue('limb','metal',0x6b4c31,[.72,1.0,.13],[.11,1.65,.11],[-attackSwing*.45,0,0]);this.queue('crystal','glow',style.staff,[.72,1.94,.13],[.34,.48,.34],[time,0,0]);}
  if(style.sword){this.queue('box','metal',0xd7d4c3,[.76,1.05,.25],[.14,1.35,.08],[-attackSwing*.75,0,-.22]);this.queue('box','metal',0x7a664b,[.76,.43,.25],[.42,.09,.12],[-attackSwing*.75,0,-.22]);}
  if(style.bow){this.queue('bow','metal',0x8b6a42,[.78,1.15,.2],[1.1,1.45,.7],[Math.PI/2,0,-.25-attackSwing*.2]);this.queue('box','metal',0xb6a17b,[.2,1.15,.45],[.04,.04,1.15],[0,0,0]);}
  if(style.lantern){this.queue('box','metal',0x82704f,[.74,.8,.18],[.44,.55,.4],[0,0,0]);this.queue('orb','glow',0xb6e3c4,[.74,.82,.18],[.24,.3,.24]);}
  if(style.twins)for(const side of [-1,1])this.queue('box','metal',0xc5d1e7,[side*.72,1.03,.3],[.1,1.15,.07],[-attackSwing*(side>0?1:.65),0,side*.18]);
  if(style.hat){this.queue('cone','cloth',0x34382a,[0,2.08,0],[.82,.58,.82]);this.queue('box','cloth',0x34382a,[0,1.91,0],[1.2,.08,1.2]);}
  if(style.flask){this.queue('orb','glow',0x9fc54f,[.72,.8,.2],[.28,.34,.28]);this.queue('limb','metal',0x8d8f70,[.72,1.13,.2],[.1,.25,.1]);}
  if(style.bell){this.queue('cone','metal',0xb69c62,[.75,.78,.22],[.48,.65,.48],[0,0,Math.PI]);this.queue('limb','metal',0x796442,[.75,1.33,.22],[.1,.55,.1]);}
  if(style.shield){this.queue('box','metal',0x858879,[-.72,1.0,.25],[.65,1.15,.18],[0,0,-.08]);this.queue('ring','metal',0xc0ad82,[-.72,1.0,.46],[.46,.7,.3],[Math.PI/2,0,0]);}
  if(style.censer){this.queue('orb','glow',0xe69550,[.78,.58,.38],[.28,.35,.28]);this.queue('limb','metal',0x7d725c,[.72,1.12,.3],[.045,1,.045],[-.7-attackSwing,0,0]);}
  if(style.antlers)for(const side of [-1,1])for(let i=0;i<3;i++)this.queue('limb','bone',0xb6a777,[side*(.3+i*.16),2.05+i*.2,0],[.07,.55,.07],[0,0,side*(.45+i*.18)]);
  if(style.wings)for(const side of [-1,1])this.queue('wing','cloth',dark,[side*.75,1.25,-.25],[1.25,1.55,.22],[0,0,side*(1.1+Math.sin(phase)*.14)]);
  if(style.beak)this.queue('cone','bone',0xc0aa73,[0,1.67,.55],[.18,.5,.18],[Math.PI/2,0,0]);
 }
 creature(entity,type,dead,time,reduced){
  const c=MONSTER_COLORS[type]||0x777266,boss=MONSTERS[type]?.boss,scale=boss?1.65:type==='root'||type==='sentinel'?1.3:1;
  if(HUMANOIDS.has(type)){
   const style={monster:true,armor:['shield','sentinel','warden'].includes(type),helm:['shield','ringer','sentinel','abbot','warden'].includes(type),skull:['shield','archer','sentinel'].includes(type),shield:type==='shield',censer:type==='censer',bell:type==='ringer',bow:type==='archer',wings:type==='stalker',beak:type==='stalker',staff:['hex','abbot'].includes(type)?type==='abbot'?0xff6f3e:0xb48be2:false,sword:['sentinel','warden'].includes(type),antlers:type==='regent'};
   this.humanoid(entity,c,style,scale,dead,time,reduced);return;
  }
  const yaw=Math.atan2(entity.dx||0,entity.dz||1),phase=reduced?0:time*10+entity.id,fall=dead?(1-Math.max(0,(entity.life??.65)/.65)):0;
  this.root.position.set(entity.x,fall*-.25,entity.z);this.root.rotation.set(fall*1.3,yaw,0);this.root.scale.setScalar(entity.elite?1.22:1);this.root.updateMatrix();
  if(type==='hound'){
   this.queue('body','cloth',c,[0,.68,0],[.64,.58,1.15],[Math.PI/2,0,0]);this.queue('head','cloth',this.shade(c,1.2),[0,.82,.78],[.6,.55,.68]);this.queue('cone','bone',0xd1b37b,[0,.76,1.28],[.18,.45,.18],[Math.PI/2,0,0]);
   for(const x of [-.42,.42])for(const z of [-.55,.55])this.queue('limb','cloth',c,[x,.3,z],[.18,.58,.18],[Math.sin(phase+(x+z)*2)*.55,0,0]);
  }else if(type==='gargoyle')this.humanoid(entity,c,{monster:true,armor:true,wings:true,antlers:true},1.18,dead,time,reduced);
  else if(type==='leech')for(let i=0;i<8;i++){const a=i*.78+time;this.queue('ring','ghost',c,[Math.sin(a)*.62,.2+(i%3)*.16,Math.cos(a)*.62],[.35,.22,.5],[Math.PI/2,a,0]);}
  else if(type==='mimic'){
   this.queue('box','cloth',c,[0,.48,0],[1.35,.72,.95]);this.queue('box','metal',this.shade(c,1.25),[0,1.0,-.18],[1.4,.25,.95],[-.55,0,0]);for(let i=-2;i<=2;i++)this.queue('cone','bone',0xe0d1aa,[i*.22,.82,.48],[.09,.3,.09],[Math.PI,0,0]);
  }else if(type==='spitter'){
   this.queue('orb','cloth',c,[0,.48,0],[.95,.72,.85]);this.queue('head','cloth',this.shade(c,1.2),[0,.68,.62],[.68,.55,.58]);for(const x of [-.75,.75])this.queue('limb','cloth',c,[x,.24,-.1],[.25,.75,.25],[0,0,x>0?-1:1]);this.queue('orb','glow',0xb3d35e,[0,.67,1.05],[.18,.18,.18]);
  }else if(type==='wraith'){
   this.queue('cone','ghost',c,[0,.72,0],[.9,1.5,.9],[0,0,Math.PI]);this.queue('head','ghost',0xa9d1ce,[0,1.55,.1],[.52,.6,.48]);this.queue('orb','glow',0x9ed9d3,[.65,.82,.2],[.25,.3,.25]);
  }else if(type==='brood'){
   this.queue('orb','cloth',c,[0,.62,-.18],[1,.72,1.15]);this.queue('head','cloth',this.shade(c,1.2),[0,.62,.72],[.58,.48,.66]);for(const side of [-1,1])for(let i=0;i<4;i++)this.queue('limb','cloth',c,[side*(.65+i*.12),.3,(i-1.5)*.36],[.12,1.15,.12],[0,0,side*(.65+i*.12)]);
  }
 }
 pickup(item,time){
  this.root.position.set(item.x,.32+Math.sin(time*4+item.id)*.08,item.z);this.root.rotation.set(0,time*1.6+item.id,0);this.root.scale.setScalar(1);this.root.updateMatrix();
  if(item.kind==='xp')this.queue('crystal','glow',0xb8d5c4,[0,0,0],[.28,.45,.28]);
  else if(item.kind==='potion'){this.queue('orb','glow',0xb44f4c,[0,0,0],[.3,.4,.3]);this.queue('box','metal',0xc7b895,[0,.34,0],[.18,.18,.18]);}
  else if(item.kind==='chest'){this.queue('box','cloth',0x7b5738,[0,0,0],[.8,.55,.6]);this.queue('box','metal',0xbf9b54,[0,.12,.31],[.13,.48,.05]);}
  else for(let i=0;i<3;i++)this.queue('ring','metal',0xd6ad53,[(i-1)*.15,i*.07,0],[.25,.25,.12],[Math.PI/2,0,0]);
 }
 groundShadow(x,z,size){this.root.position.set(x,.035,z);this.root.rotation.set(0,0,0);this.root.scale.setScalar(1);this.root.updateMatrix();this.queue('shadow','shadow',0x050706,[0,0,0],[size,size,1],[-Math.PI/2,0,0]);}
 marker(x,z,r,color){this.root.position.set(x,.07,z);this.root.rotation.set(-Math.PI/2,0,0);this.root.scale.setScalar(r);this.root.updateMatrix();this.queue('ring','ring',color,[0,0,0],[1,1,1]);}
 spark(x,y,z,size,color,elongate=1,angle=0){this.root.position.set(x,y,z);this.root.rotation.set(0,angle,0);this.root.scale.set(size,size,size*elongate);this.root.updateMatrix();this.queue('orb','fx',color,[0,0,0],[1,1,1]);}
 flush(){
  const grouped=new Map();for(const p of this.parts){const key=`${p.geo}:${p.material}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(p);}
  for(const [key,items]of grouped){let mesh=this.batches.get(key);if(!mesh||mesh.instanceMatrix.count<items.length){if(mesh){this.scene.remove(mesh);mesh.dispose();}const [geo,material]=key.split(':');mesh=new T.InstancedMesh(this.geometries[geo],this.materials[material],Math.max(64,2**Math.ceil(Math.log2(items.length))));mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=!['glow','ghost','shadow','fx','ring'].includes(material);mesh.receiveShadow=material!=='glow';this.batches.set(key,mesh);this.scene.add(mesh);}mesh.count=items.length;items.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);mesh.setColorAt(i,this.color.setHex(p.color));});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  }
  for(const [key,mesh]of this.batches)if(!grouped.has(key))mesh.count=0;this.parts.length=0;
 }
 draw(game,time,hero='cinder',reduced=false){
  const p=game?.player||{id:'hero',x:0,z:0,dx:0,dz:1,moving:false,attack:0,dash:0},biome=game?.biome||0,t=game?.time||time;
  this.camera.position.set(p.x,22,p.z+25);this.camera.lookAt(p.x,0,p.z);this.sun.target.position.set(p.x,0,p.z);this.dungeon.update(p,reduced?0:t,biome,reduced);
  if(this.lastBiome!==biome){this.lastBiome=biome;this.dungeon.floorMaterial.color.setHex([0xaaa592,0x829e99,0x989b78][biome]);this.scene.fog.color.setHex(REGIONS[biome].ground).multiplyScalar(.45);this.scene.background.copy(this.scene.fog.color);}
  const active=game?.hero||hero,h=HEROES[active],heroColor=parseInt(h.color.slice(1),16);
  this.humanoid(p,heroColor,HERO_STYLE[active],1.12,game?.state==='dead',t,reduced);this.groundShadow(p.x,p.z,.74);this.marker(p.x,p.z,.62,0xbba880);
  for(const e of game?.enemies||[]){this.creature(e,e.type,false,t,reduced);this.groundShadow(e.x,e.z,e.boss?1.15:.65);if(e.windup>0){this.marker(e.x,e.z,e.behavior==='pulse'?3:e.behavior==='boss'?4:1.35,0xe79562);if(e.behavior==='charge')for(let i=1;i<6;i++)this.marker(e.x+Math.sin(e.aim)*i,e.z+Math.cos(e.aim)*i,.25,0xe79562);}if(e.elite)this.marker(e.x,e.z,.8,0xd1ac58);}
  for(const e of game?.corpses||[]){this.creature(e,e.type,true,t,reduced);this.groundShadow(e.x,e.z,e.boss?1.15:.65);}for(const l of game?.loot||[])this.pickup(l,t);
  for(const b of game?.bolts||[])this.spark(b.x,.65,b.z,b.enemy?.13:.1,b.enemy?0xe08a69:heroColor,b.kind==='arrow'?5:2,Math.atan2(b.vx,b.vz));
  for(const z of game?.zones||[])this.marker(z.x,z.z,z.radius,z.enemy?(z.warn>0?0xd9b471:0xb65b44):0xa4b16a);
  for(const e of game?.effects||[]){this.marker(e.x,e.z,e.radius*(1-e.life/.7),e.color);if(!reduced)for(let i=0;i<5;i++){const a=i*2.399+e.id,d=(.45-e.life)*5;this.spark(e.x+Math.sin(a)*d,.3+Math.sin(e.life*6)*.7,e.z+Math.cos(a)*d,.035,e.color);}}
  this.flush();this.renderer.render(this.scene,this.camera);
 }
}
