import * as T from 'three';
import {DungeonView} from './dungeon-view.js';
import {HEROES,MONSTERS,REGIONS} from './roster.js';
import {modelFor,actorPhase} from './model-catalog.js';

function surfaceTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#aaa79d';c.fillRect(0,0,128,128);let seed=319;
 for(let i=0;i<2400;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;const r=(seed>>>0)/4294967296;c.fillStyle=r>.5?'#d7d1c914':'#1c211d18';c.fillRect((r*127)|0,((r*97+i*13)%127)|0,1+(i%3),1);}
 const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(2,2);return tex;
}

export class Scene{
 constructor(canvas){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.mobile=matchMedia('(pointer:coarse)').matches;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.25:1.5));this.renderer.shadowMap.enabled=!this.mobile;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
  this.frameAverage=1/60;this.qualitySamples=0;this.scene=new T.Scene();this.scene.background=new T.Color(0x080b0d);this.scene.fog=new T.FogExp2(0x080b0d,.018);this.camera=new T.OrthographicCamera();
  this.scene.add(new T.HemisphereLight(0xc4d2cf,0x24201e,1.85));this.sun=new T.DirectionalLight(0xd8d4c3,2);this.sun.position.set(-12,28,10);this.sun.castShadow=!this.mobile;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26});this.scene.add(this.sun,this.sun.target);
  this.geo={
   box:new T.BoxGeometry(1,1,1),
   gem:new T.OctahedronGeometry(.22),
   orb:new T.SphereGeometry(.16,12,8),
   cone:new T.ConeGeometry(.6,1.4,12),
   cylinder:new T.CylinderGeometry(.5,.7,1,12),
   skull:new T.IcosahedronGeometry(.5,2),
   capsule:new T.CapsuleGeometry(.25,.55,6,12),
   shadow:new T.CircleGeometry(.7,24),
   bow:new T.TorusGeometry(.5,.035,6,24,Math.PI),
   ring:new T.TorusGeometry(1,.035,6,48),
   torus:new T.TorusGeometry(.5,.12,8,24),
   spike:new T.ConeGeometry(.15,.75,8),
   prism:new T.CylinderGeometry(0,.28,.8,4),
   disk:new T.CylinderGeometry(.5,.5,.1,16)
  };
  this.texture=surfaceTexture();this.materials=new Map();this.objects=new Map();this.batches=new Map();this.props=new T.Group();this.temp=new T.Object3D();this.cameraFocus=new T.Vector2();this.dungeon=new DungeonView(this.scene);this.lastBiome=-1;this.hero=null;
  this.light=new T.PointLight(0xffa34e,26,24,2);this.scene.add(this.light);this.hitstop=0;this.currentFrustum=11.5;this.resize();window.addEventListener('resize',()=>this.resize());
 }
 mat(color,style='cloth',glow=false){
  const key=`${color}/${style}/${glow}`;
  if(!this.materials.has(key)){
   const values={cloth:[.88,.04],leather:[.72,.1],metal:[.28,.85],bone:[.65,.08],stone:[.85,.05],glass:[.12,.25],wood:[.75,.05],gold:[.15,.98]}[style]||[.8,.1];
   this.materials.set(key,new T.MeshStandardMaterial({
    color,roughness:values[0],metalness:values[1],map:glow?null:this.texture,
    emissive:glow?color:0,emissiveIntensity:glow?2.2:0,
    transparent:style==='glass',opacity:style==='glass'?.78:1,depthWrite:style!=='glass'
   }));
  }
  return this.materials.get(key);
 }
 mesh(group,geometry,color,scale,pos,style='cloth',glow=false){
  const m=new T.Mesh(geometry,this.mat(color,style,glow));
  m.scale.set(...scale);m.position.set(...pos);m.castShadow=!glow;m.receiveShadow=!glow;m.userData.detail=Math.max(...scale)<.32;group.add(m);return m;
 }
 joint(group,pos=[0,0,0]){const j=new T.Group();j.position.set(...pos);group.add(j);return j;}
 detailPlate(group,color,pos,scale,style='metal'){const plate=this.mesh(group,this.geo.box,color,scale,pos,style);plate.rotation.x=-.06;return plate;}
 buildHumanoid(g,id,spec,data){
  const primary=spec.primary,secondary=spec.secondary,metal=spec.metal||0x8b8779,bone=0xc6bda5;
  // Torso & Runic Core
  data.body=this.mesh(g,this.geo.cylinder,primary,[.75,.88,.65],[0,1.04,0],spec.armor?'metal':'cloth');
  this.mesh(g,this.geo.gem,primary,[.35,.5,.25],[0,1.14,.34],'glass',true);
  // Armor Plates & Belt
  this.detailPlate(g,spec.armor?metal:secondary,[0,.76,.02],[.8,.13,.66],spec.armor?'metal':'leather');
  this.detailPlate(g,metal,[0,.76,.38],[.22,.19,.1],'metal');
  this.detailPlate(g,secondary,[.32,.74,.3],[.15,.16,.14],'leather');
  // Cape with Shoulder Clasps
  if(spec.cape){
   data.cape=this.mesh(g,this.geo.cone,secondary,[.84,1.12,.48],[0,.9,-.22],'cloth');
   data.cape.rotation.x=.08;data.cape.rotation.z=Math.PI;
   for(const side of[-1,1])this.mesh(g,this.geo.gem,metal,[.22,.22,.14],[side*.34,1.38,-.18],'metal');
  }
  // Head & Features
  const headColor=spec.bone?bone:spec.armor?metal:0x91745f;
  data.head=this.mesh(g,this.geo.skull,headColor,[.62,.72,.61],[0,1.67,0],spec.bone?'bone':spec.armor?'metal':'cloth');
  this.detailPlate(g,0x151a19,[0,1.65,.35],[.45,.19,.1],'metal');
  const eyeCol=id==='frost'?0x9be6f5:id==='bone'?0xb8e0c6:spec.boss?0xff4411:MONSTERS[id]?([0xff2200,0x22eedd,0xa3e635][MONSTERS[id].region||0]||0xff3311):primary;for(const x of[-.11,.11])this.mesh(g,this.geo.orb,eyeCol,[.32,.25,.2],[x,1.68,.42],'glass',true);if(MONSTERS[id]){const core=this.mesh(g,this.geo.gem,eyeCol,[.35,.45,.2],[0,1.05,.38],'glass',true);core.userData.enemyCore=true;}
  // Limbs with Pauldrons, Bracers and Greaves
  for(const side of[-1,1]){
   const arm=this.joint(g,[side*.46,1.29,0]);
   this.mesh(arm,this.geo.cylinder,spec.armor?metal:primary,[.29,.51,.3],[0,-.23,0],spec.armor?'metal':'cloth');
   this.mesh(arm,this.geo.box,0x40382e,[.24,.2,.24],[0,-.55,.08],'leather');
   data.arms.push(arm);
   // Pauldrons
   if(spec.armor){
    this.mesh(g,this.geo.skull,metal,[.55,.4,.55],[side*.5,1.38,0],'metal');
    this.mesh(g,this.geo.cone,primary,[.25,.35,.25],[side*.5,1.54,0],'metal');
   }else if(id==='thorn'){
    this.mesh(g,this.geo.cone,0x3e5229,[.35,.4,.22],[side*.48,1.36,0],'cloth');
   }
   const leg=this.joint(g,[side*.23,.61,0]);
   this.mesh(leg,this.geo.box,secondary,[.25,.37,.26],[0,-.16,0],'cloth');
   this.mesh(leg,this.geo.box,0x242826,[.29,.24,.43],[0,-.47,.1],'leather');
   if(spec.armor)this.mesh(leg,this.geo.cylinder,metal,[.26,.18,.26],[0,-.22,.12],'metal');
   data.feet.push(leg);
  }
  // Class-Specific Accoutrements
  if(id==='cinder'){
   this.mesh(g,this.geo.ring,0xff5511,[.45,.45,.45],[0,.85,0],'glass',true);
   for(const side of[-1,1])this.mesh(g,this.geo.orb,0xff8833,[.15,.15,.15],[side*.46,.72,.15],'glass',true);
  }
  if(id==='frost'){
   for(let i=0;i<3;i++){
    const a=i*2.09;
    this.mesh(g,this.geo.prism,0xa5ebf8,[.45,.75,.45],[Math.sin(a)*.65,1.55+i*.12,Math.cos(a)*.65],'glass',true);
   }
  }
  if(id==='plague'){
   for(let i=0;i<3;i++){
    const vialColor=[0x44dd66,0xffaa22,0xaa44ee][i];
    this.mesh(g,this.geo.cylinder,vialColor,[.06,.22,.06],[(i-1)*.18,1.08,.38],'glass',true);
   }
  }
  if(spec.bone){
   for(let i=0;i<3;i++)this.detailPlate(g,bone,[0,.96+i*.17,.38],[.65,.065,.12],'bone');
   this.detailPlate(g,bone,[0,1.43,.28],[.28,.1,.24],'bone');
  }
  this.addHeadgear(g,id,spec,data,primary,secondary,metal,bone);
  this.addWeapon(g,id,spec,data,primary,metal,bone);
  // Evolution Ornaments (Rank 3)
  data.evolutions=[this.joint(g),this.joint(g),this.joint(g)];data.evolutions.forEach(e=>e.visible=false);
  this.mesh(data.evolutions[0],this.geo.ring,primary,[.4,.4,.4],[0,1.9,0],'metal',true);
  this.mesh(data.evolutions[1],this.geo.gem,primary,[1.2,1.8,1.2],[0,2.2,0],'glass',true);
  for(const side of[-1,1])this.mesh(data.evolutions[2],this.geo.gem,0xd8c996,[.8,1.3,.8],[side*.7,1.25,0],'glass',true);
 }
 addHeadgear(g,id,spec,data,primary,secondary,metal,bone){
  if(spec.head==='hood'){
   const hood=this.mesh(g,this.geo.cone,primary,[.7,.48,.7],[0,2,-.04],'cloth');hood.rotation.x=-.14;
   this.mesh(g,this.geo.cone,secondary,[.77,.24,.77],[0,1.86,-.02],'cloth');
  }
  if(spec.head==='greatHelm'||spec.head==='wardenHelm'||spec.head==='boneHelm'){
   this.mesh(g,this.geo.cylinder,spec.head==='boneHelm'?bone:metal,[.68,.5,.62],[0,1.8,0],spec.head==='boneHelm'?'bone':'metal');
   this.detailPlate(g,secondary,[0,1.7,.42],[.6,.2,.1],'metal');
   for(const side of[-1,1])this.mesh(g,this.geo.cone,spec.head==='boneHelm'?bone:metal,[.13,.38,.13],[side*.34,2.09,0],spec.head==='boneHelm'?'bone':'metal');
  }
  if(spec.head==='crystalCrown')for(let i=0;i<5;i++){
   const a=i*1.26;this.mesh(g,this.geo.cone,0x9eddea,[.13,.42,.13],[Math.sin(a)*.28,2.04,Math.cos(a)*.28],'glass',true);
  }
  if(spec.head==='skullMask'){
   this.mesh(g,this.geo.skull,bone,[.57,.64,.55],[0,1.7,.08],'bone');
   this.detailPlate(g,0x262923,[0,1.65,.42],[.4,.15,.08],'leather');
  }
  if(spec.head==='windswept')for(let i=-2;i<=2;i++){
   const hair=this.mesh(g,this.geo.cone,0xb6bac7,[.13,.47,.13],[i*.14,2.03,-.05],'cloth');hair.rotation.z=i*.15;
  }
  if(spec.head==='plagueHat'){
   const hat=this.mesh(g,this.geo.cone,secondary,[.82,.55,.82],[0,2.12,0],'cloth');hat.rotation.z=.12;
   this.mesh(g,this.geo.cylinder,secondary,[1.18,.08,1.18],[0,1.9,0],'cloth');
   const beak=this.mesh(g,this.geo.cone,0x877b5e,[.2,.58,.2],[0,1.68,.55],'leather');beak.rotation.x=Math.PI/2;
   for(const x of[-.12,.12])this.mesh(g,this.geo.orb,0x3a2c1e,[.35,.35,.35],[x,1.74,.42],'metal');
  }
  if(spec.head==='bellHelm'){
   this.mesh(g,this.geo.cone,metal,[.72,.72,.72],[0,1.92,0],'metal');
   this.mesh(g,this.geo.torus,0x44382b,[.64,.25,.64],[0,1.63,0],'metal');
  }
  if(spec.head==='scarred'||spec.head==='drowned'){
   for(let i=0;i<3;i++){
    const scar=this.detailPlate(g,spec.head==='drowned'?0x78918b:0x5e332b,[(i-1)*.16,1.72,.5],[.035,.23,.03],'leather');scar.rotation.z=.35;
   }
  }
  if(spec.head==='skull')this.mesh(g,this.geo.skull,bone,[.58,.65,.56],[0,1.7,.08],'bone');
  if(spec.head==='thorns'||spec.head==='antlers')for(const side of[-1,1])for(let i=0;i<(spec.head==='antlers'?3:2);i++){
   const horn=this.mesh(g,this.geo.cone,spec.head==='antlers'?0x8e835c:0x65713f,[.1,.42+i*.08,.1],[side*(.27+i*.14),1.98+i*.2,0],spec.head==='antlers'?'bone':'wood');
   horn.rotation.z=-side*(.4+i*.18);
  }
  if(spec.head==='beak'){
   const beak=this.mesh(g,this.geo.cone,0xb5a26f,[.2,.52,.2],[0,1.69,.55],'bone');beak.rotation.x=Math.PI/2;
  }
  if(spec.head==='horns')for(const side of[-1,1]){
   const horn=this.mesh(g,this.geo.cone,metal,[.16,.55,.16],[side*.32,2.02,0],'stone');horn.rotation.z=-side*.42;
  }
  if(spec.head==='mitre'){
   this.mesh(g,this.geo.cone,primary,[.55,1,.42],[0,2.15,0],'cloth');
   this.detailPlate(g,metal,[0,2.14,.42],[.08,.65,.04],'metal');
  }
 }
 addWeapon(g,id,spec,data,primary,metal,bone){
  const w=data.weapon=this.joint(g,[.62,1.22,.22]);data.staff=w;data.socket=this.joint(w,[0,.85,.38]);
  const blade=(group,color=0xc4c9c1,length=1.4,width=.13)=>{
   this.mesh(group,this.geo.box,color,[width,length,.07],[0,.25,0],'metal');
   this.detailPlate(group,0x8b7048,[0,-.22,0],[.4,.08,.13],'metal');
   this.mesh(group,this.geo.orb,0x524331,[.35,.35,.35],[0,-.38,0],'metal');
   this.mesh(group,this.geo.box,primary,[.04,length*.7,.08],[0,.28,0],'glass',true);
  };
  if(['emberStaff','frostStaff','hexStaff','rootStaff'].includes(spec.weapon)){
   this.mesh(w,this.geo.cylinder,spec.weapon==='rootStaff'?0x4d5134:0x735b42,[.09,1.85,.09],[0,-.18,0],spec.weapon==='rootStaff'?'wood':'leather');
   const glow=spec.weapon==='frostStaff'?0x8fdff2:spec.weapon==='hexStaff'?0xbb86da:primary;
   this.mesh(w,this.geo.gem,glow,[1.25,1.7,1.25],[0,.79,0],'glass',true);
   for(const side of[-1,1])this.mesh(w,this.geo.ring,metal,[.26,.26,.26],[0,.67+side*.2,0],'metal');
   this.mesh(w,this.geo.orb,glow,[.8,.8,.8],[0,.79,0],'glass',true);
  }else if(['greatsword','rustSword','boneBlade'].includes(spec.weapon)){
   blade(w,spec.weapon==='boneBlade'?bone:spec.weapon==='rustSword'?0x806f5e:0xd0d2c8,spec.weapon==='greatsword'?1.65:1.15,spec.weapon==='greatsword'?.18:.12);
  }else if(spec.weapon==='longbow'){
   const bow=this.mesh(w,this.geo.bow,0xa68a5d,[1.05,1.5,1],[0,0,.1],'wood');bow.rotation.z=-Math.PI/2;
   this.detailPlate(w,0xd0c6a4,[0,.05,.16],[.025,.72,.025],'bone');
   this.mesh(w,this.geo.cylinder,0x8da66b,[.015,1.4,.015],[0,0,.02],'glass',true);
  }else if(spec.weapon==='lantern'){
   this.mesh(w,this.geo.box,metal,[.48,.6,.42],[0,-.08,0],'metal');
   this.mesh(w,this.geo.orb,0x9edab9,[1.5,1.8,1.5],[0,-.08,0],'glass',true);
   this.mesh(w,this.geo.torus,metal,[.45,.45,.45],[0,.32,0],'metal');
   this.mesh(w,this.geo.cylinder,metal,[.03,.62,.03],[0,-.08,.22],'metal');
   this.mesh(w,this.geo.cylinder,metal,[.03,.62,.03],[0,-.08,-.22],'metal');
  }else if(spec.weapon==='twinSabers'){
   blade(w,0xcad7ea,1.05,.1);
   const left=this.joint(g,[-.62,1.22,.22]);blade(left,0xcad7ea,1.05,.1);data.weapons.push(left);
  }else if(spec.weapon==='flasks'){
   for(let i=0;i<3;i++){
    this.mesh(w,this.geo.orb,[0x9dc454,0xc39a4e,0x708d5e][i],[1.25,1.6,1.25],[(i-1)*.26,-.12,0],'glass',true);
    this.detailPlate(w,metal,[(i-1)*.26,.06,0],[.06,.12,.06],'metal');
   }
  }else if(['bellHammer','handBell'].includes(spec.weapon)){
   this.mesh(w,this.geo.cylinder,0x6c5236,[.1,1.35,.1],[0,-.18,0],'wood');
   this.mesh(w,this.geo.cone,metal,[spec.weapon==='bellHammer'?.55:.4,spec.weapon==='bellHammer'?.7:.5,spec.weapon==='bellHammer'?.55:.4],[0,.45,0],'metal');
   this.mesh(w,this.geo.torus,0x44382b,[.48,.22,.48],[0,.18,0],'metal');
  }else if(spec.weapon==='censer'){
   this.mesh(w,this.geo.cylinder,metal,[.035,1,.035],[0,-.3,0],'metal');
   this.mesh(w,this.geo.orb,0xe3974d,[1.7,1.7,1.7],[0,-.75,0],'metal',true);
  }else if(spec.weapon==='anchor'){
   this.mesh(w,this.geo.box,metal,[.16,1.55,.12],[0,.1,0],'metal');
   this.mesh(w,this.geo.torus,metal,[.7,.7,.3],[0,.85,0],'metal');
   this.detailPlate(w,metal,[0,-.58,0],[.85,.12,.13],'metal');
  }else if(spec.weapon==='rootClub'){
   this.mesh(w,this.geo.cylinder,0x4d5134,[.22,1.35,.22],[0,0,0],'wood');
   for(let i=0;i<3;i++)this.mesh(w,this.geo.cone,0x7f774e,[.12,.35,.12],[(i-1)*.17,.5+i*.12,0],'wood');
  }
  if(spec.weapon==='claws')for(const side of[-1,1])for(let i=0;i<3;i++){
   const claw=this.mesh(g,this.geo.cone,bone,[.08,.35,.08],[side*.5+i*.05,.64,.5],'bone');claw.rotation.x=Math.PI/2;
  }
  if(spec.shield){
   const shield=this.mesh(g,this.geo.cylinder,spec.bone?bone:metal,[.88,.14,1.18],[-.65,1.03,.27],spec.bone?'bone':'metal');
   shield.rotation.x=Math.PI/2;
   this.mesh(g,this.geo.ring,primary,[.55,.55,.22],[-.65,1.03,.4],'metal');
  }
  if(spec.quiver){
   this.mesh(g,this.geo.cylinder,0x5c4431,[.22,.62,.22],[-.38,1.22,-.42],'leather');
   for(let i=0;i<4;i++)this.mesh(g,this.geo.box,0xbca77a,[.025,.65,.025],[-.53+i*.08,1.58,-.42],'wood');
  }
 }
 buildCreature(g,id,spec,data){
  const p=spec.primary,s=spec.secondary,bone=0xc8bea1;
  if(spec.kind==='spider'){
   data.body=this.mesh(g,this.geo.skull,p,[1.15,.58,1.3],[0,.48,0],'cloth');
   this.mesh(g,this.geo.skull,s,[.67,.52,.72],[0,.45,.62],'cloth');
   for(const side of[-1,1]){
    const fang=this.mesh(g,this.geo.cone,bone,[.08,.3,.08],[side*.15,.35,1.05],'bone');fang.rotation.x=Math.PI/2+side*.15;
   }
   for(const side of[-1,1])for(let i=0;i<4;i++){
    const leg=this.joint(g,[side*.54,.36,(i-1.5)*.3]);
    const limb=this.mesh(leg,this.geo.box,0x6d5a4a,[.09,.09,1.05],[side*.45,0,0],'leather');limb.rotation.y=side*(.55+i*.58);
    data.feet.push(leg);
   }
   for(const x of[-.18,-.06,.06,.18])this.mesh(g,this.geo.orb,0xe87652,[.4,.4,.4],[x,.62,.94],'glass',true);
  }
  if(spec.kind==='hound'){
   data.body=this.mesh(g,this.geo.capsule,p,[1.15,.72,1.45],[0,.66,0],'cloth');data.body.rotation.x=Math.PI/2;
   this.mesh(g,this.geo.skull,s,[.68,.62,.72],[0,.78,.78],'cloth');
   const snout=this.mesh(g,this.geo.cone,bone,[.17,.48,.17],[0,.72,1.22],'bone');snout.rotation.x=Math.PI/2;
   for(const x of[-.16,.16])this.mesh(g,this.geo.orb,0xff7034,[.35,.35,.35],[x,.92,.88],'glass',true);
   const tail=this.mesh(g,this.geo.cone,p,[.12,.55,.12],[0,.85,-.85],'cloth');tail.rotation.x=-.75;
   for(let i=0;i<4;i++)this.mesh(g,this.geo.spike,0xff5522,[.45,.45,.45],[0,1.1,-.5+i*.35],'glass',true);
   for(const x of[-.42,.42])for(const z of[-.48,.48]){
    const leg=this.joint(g,[x,.48,z]);
    this.mesh(leg,this.geo.cylinder,p,[.18,.58,.18],[0,-.27,0],'cloth');
    this.mesh(leg,this.geo.box,s,[.22,.12,.28],[0,-.55,.05],'leather');
    data.feet.push(leg);
   }
   for(const side of[-1,1]){
    const ear=this.mesh(g,this.geo.cone,s,[.17,.38,.17],[side*.28,1.15,.55],'cloth');ear.rotation.z=-side*.2;
   }
  }
  if(spec.kind==='mimic'){
   data.body=this.mesh(g,this.geo.box,p,[1.25,.68,.9],[0,.4,0],'wood');
   for(const x of[-.42,.42])this.detailPlate(g,0x444038,[x,.4,0],[.12,.7,.92],'metal');
   const lid=data.weapon=this.joint(g,[0,.78,-.38]);
   const top=this.mesh(lid,this.geo.box,s,[1.28,.3,.9],[0,.18,.35],'wood');top.rotation.x=-.42;
   for(const x of[-.42,.42])this.detailPlate(lid,0x444038,[x,.18,.35],[.12,.32,.92],'metal');
   for(let i=-3;i<=3;i++){
    const tooth=this.mesh(g,this.geo.cone,bone,[.09,.22,.09],[i*.18,.72,.48],'bone');tooth.rotation.x=Math.PI;
    this.mesh(lid,this.geo.cone,bone,[.09,.22,.09],[i*.18,.05,.75],'bone');
   }
   this.mesh(g,this.geo.orb,0xff4b2b,[.7,.7,.7],[0,.55,.35],'glass',true);
  }
  if(spec.kind==='spitter'){
   data.body=this.mesh(g,this.geo.orb,p,[5.4,4.1,4.8],[0,.52,0],'cloth');
   this.mesh(g,this.geo.skull,s,[.75,.58,.65],[0,.68,.65],'cloth');
   for(const x of[-.18,.18])this.mesh(g,this.geo.orb,0xd6c678,[.5,.5,.5],[x,.84,1.03],'glass',true);
   for(const side of[-1,1]){
    const leg=this.joint(g,[side*.62,.37,-.12]);
    const l=this.mesh(leg,this.geo.cylinder,p,[.25,.75,.25],[side*.25,-.14,0],'cloth');l.rotation.z=side*.9;
    data.feet.push(leg);
   }
  }
  if(spec.kind==='swarm'){
   data.body=this.joint(g);
   const eyeCol=MONSTERS[id]?([0xff2200,0x22eedd,0xa3e635][MONSTERS[id].region||0]||0x22eedd):0x22eedd;
   for(let i=0;i<9;i++){
    const a=i*.7;
    const leech=this.mesh(g,this.geo.torus,p,[.4,.22,.65],[Math.sin(a)*.65,.2+(i%3)*.15,Math.cos(a)*.65],'cloth');
    leech.rotation.x=Math.PI/2;data.wings.push(leech);
    this.mesh(leech,this.geo.orb,eyeCol,[.18,.18,.18],[0,0,.22],'glass',true);
   }
  }
  if(spec.kind==='wraith'){
   data.body=this.mesh(g,this.geo.cone,p,[.82,1.35,.82],[0,.78,0],'glass');data.body.rotation.z=Math.PI;
   this.mesh(g,this.geo.skull,0x9bc7c3,[.58,.65,.55],[0,1.58,.05],'glass',true);
   const eyeCol=MONSTERS[id]?([0xff2200,0x22eedd,0xa3e635][MONSTERS[id].region||0]||0x22eedd):0x22eedd;
   for(const x of[-.12,.12])this.mesh(g,this.geo.orb,eyeCol,[.25,.2,.18],[x,1.64,.32],'glass',true);
   const core=this.mesh(g,this.geo.gem,eyeCol,[.35,.45,.2],[0,1.05,.28],'glass',true);core.userData.enemyCore=true;
   for(const side of[-1,1]){
    const arm=this.joint(g,[side*.46,1.2,0]);
    this.mesh(arm,this.geo.cylinder,p,[.2,.7,.2],[side*.1,-.3,0],'glass');
    data.arms.push(arm);
   }
  }
 }
 character(id){
  const spec=modelFor(id);if(!spec)throw new Error(`Missing model definition: ${id}`);
  const g=new T.Group(),data={id,spec,seed:actorPhase(id),body:null,head:null,cape:null,weapon:null,staff:null,socket:null,marker:null,feet:[],arms:[],wings:[],weapons:[],evolutions:[],phaseParts:[],baseMaterials:new Map()};
  g.userData=data;
  if(spec.kind==='humanoid'||spec.kind==='winged')this.buildHumanoid(g,id,spec,data);else this.buildCreature(g,id,spec,data);
  if(spec.kind==='winged')for(const side of[-1,1]){
   const wing=this.mesh(g,this.geo.cone,spec.secondary,[1.18,1.7,.14],[side*.65,1.15,-.1],'stone');wing.rotation.z=side*1.15;data.wings.push(wing);
  }
  // Boss Phase Evolution Ornaments
  if(spec.boss){
   data.phaseParts=[this.joint(g),this.joint(g)];
   data.phaseParts.forEach(x=>x.visible=false);
   // Phase 2 Element Ring
   const ringGlow=id==='abbot'?0xff5511:id==='warden'?0x33e0d0:0x66ff44;
   const r=this.mesh(data.phaseParts[0],this.geo.ring,ringGlow,[.85,.85,.85],[0,1.3,0],'metal',true);r.rotation.x=Math.PI/2;
   for(const side of[-1,1]){
    const spike=this.mesh(data.phaseParts[0],this.geo.cone,spec.metal||spec.primary,[.18,.65,.18],[side*.58,1.85,0],'metal');spike.rotation.z=-side*.4;
   }
   // Phase 3 Arch Halo & Orbiting Motes
   const halo=this.mesh(data.phaseParts[1],this.geo.ring,ringGlow,[1.3,1.3,1.3],[0,1.9,-.3],'glass',true);halo.rotation.x=.2;
   for(let i=0;i<6;i++){
    const a=i*1.047;
    this.mesh(data.phaseParts[1],this.geo.gem,ringGlow,[1.1,1.5,1.1],[Math.sin(a)*.95,1.7,Math.cos(a)*.95],'glass',true);
   }
  }
  const shadow=new T.Mesh(this.geo.shadow,this.mat(0x111514,'cloth'));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.035;shadow.material.transparent=true;shadow.material.opacity=.42;
  g.add(shadow);g.scale.setScalar(spec.scale||1);return g;
 }
 resize(){
  const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h);
  this.updateFrustum(this.currentFrustum||(w<700?12:11.5));
 }
 updateFrustum(half){
  const w=innerWidth,h=innerHeight;
  this.camera.left=-half*w/h;this.camera.right=half*w/h;this.camera.top=half;this.camera.bottom=-half;
  this.camera.near=.1;this.camera.far=200;this.camera.updateProjectionMatrix();
 }
 toScreen(x,y=0,z=0){
  if(!this._vec3)this._vec3=new T.Vector3();
  this._vec3.set(x,y,z);
  this.camera.updateMatrixWorld();
  this._vec3.project(this.camera);
  const w=innerWidth,h=innerHeight;
  return{
   x:(this._vec3.x*0.5+0.5)*w,
   y:(-this._vec3.y*0.5+0.5)*h,
   visible:this._vec3.z<1&&this._vec3.x>=-1&&this._vec3.x<=1&&this._vec3.y>=-1&&this._vec3.y<=1
  };
 }
 animate(model,entity,clock,reduced,{dead=false,showcase=false,ranks=null}={}){
  const d=model.userData,spec=d.spec,moving=showcase?false:(entity.moving??(!entity.windup&&!entity.attack));
  const phase=clock*(entity.boss?7:10)+d.seed;
  const walk=reduced?0:Math.sin(phase);
  const attack=entity.attack>0?Math.sin(Math.min(1,entity.attack/.26)*Math.PI):0;
  const cast=entity.cast>0?Math.sin(Math.min(1,entity.cast/.38)*Math.PI):0;
  const windup=entity.windup>0?Math.min(1,entity.windup/1.0):0;
  const hit=entity.flash>0;
  const maxLife=entity.maxLife||0.75;
  const death=dead?1-Math.max(0,(entity.life??maxLife)/maxLife):0;
  const deathPitch=dead?Math.min(1.45,death*1.8):0;
  const deathRoll=dead?((entity.id%2?1:-1)*death*0.45):0;
  const deathY=dead?Math.max(0.015,0.08*(1-death*1.2)):0;
  const deathScale=dead?(death>0.55?Math.max(0.01,1-(death-0.55)/0.45):1):1;

  // Dynamic Movement Physics: Turning Bank and Forward Acceleration Lean
  const turnBank=moving?(-(entity.vx||0)*0.025):0;
  const forwardLean=moving?Math.min(0.18,Math.hypot(entity.vx||0,entity.vz||0)*0.02):0;
  const idleY=Math.sin(clock*2+d.seed)*.015;
  const y=showcase?.08:spec.kind==='wraith'?.55+(reduced?0:Math.sin(clock*3+d.seed)*.12):dead?deathY:moving&&!reduced?Math.abs(walk)*.08:idleY;

  model.scale.setScalar((spec.scale||1)*(showcase?(innerWidth<700?1.6:2.65):1)*deathScale);
  model.position.set(Number.isFinite(entity.x)?entity.x:0,Number.isFinite(y)?y:0,Number.isFinite(entity.z)?entity.z:0);
  model.rotation.set(
   (dead?deathPitch:death*1.25)+forwardLean,
   showcase?Math.sin(clock*.45)*.28+.25:Math.atan2(entity.dx||0,entity.dz||1),
   (hit?Math.sin(clock*50)*.11:0)+(entity.dash?.22:0)+turnBank+(dead?deathRoll:0)
  );

  // Footwork & Arm Swings with Natural Cadence
  d.feet.forEach((f,i)=>{
   f.rotation.x=dead?(-death*0.85*(i%2?1:0.6)):walk*(moving?.65:.03)*(i%2?1:-1);
   f.rotation.z=entity.dash?walk*.1:(dead?(i%2?1:-1)*death*0.3:0);
  });
  d.arms.forEach((a,i)=>{a.rotation.x=dead?(-death*1.2):walk*(moving?.48:.025)*(i%2?1:-1)-attack*(i?1.35:.85)-cast*(i?1.2:.75)+windup*.6;if(dead)a.rotation.z=(i?1:-1)*death*0.75;});
  d.weapons.forEach((w,i)=>{w.rotation.x=dead?(-death*1.4):-attack*(i?1.5:1.0)-cast*.75;if(dead)w.rotation.z=death*0.8;});

  if(d.weapon){
   const bow=spec.weapon==='longbow',blade=['greatsword','rustSword','boneBlade','twinSabers'].includes(spec.weapon);
   const throwing=spec.weapon==='flasks',staff=['emberStaff','frostStaff','hexStaff','rootStaff'].includes(spec.weapon);
   const bell=['bellHammer','handBell'].includes(spec.weapon),lantern=spec.weapon==='lantern';
   d.weapon.rotation.x=(blade?-attack*1.45:-attack*.85)+(bow?-cast*.4:cast*.25)+windup*.5+(staff?-attack*1.05:0)+(bell?-attack*1.75:0)+(lantern?-attack*.55:0);
   d.weapon.rotation.y=(throwing?cast*.8:bow?attack*.4:0)+(blade?attack*.7:0)+(staff?Math.sin(attack*Math.PI)*.45:0);
   d.weapon.rotation.z=(reduced?0:Math.sin(clock*2+d.seed)*.05)+(throwing?-attack*.95:blade?attack*.5:0)+(staff?-attack*.35:0);
  }

  // Beast & Creature Biomechanics
  if(spec.kind==='hound'&&attack>0)d.feet.forEach((f,i)=>{f.rotation.x+=(i<2?-1:1)*attack*.7;});
  if(spec.kind==='spider'&&attack>0)d.feet.forEach((f,i)=>{f.rotation.z+=(i%2?-1:1)*Math.sin(attack*Math.PI)*.55;});
  if(spec.kind==='mimic'&&d.weapon&&attack>0)d.weapon.rotation.x=-.42-attack*1.35;

  // Cape & Wing Aerodynamics
  if(d.cape)d.cape.rotation.x=moving?.28+Math.abs(walk)*.12+(entity.dash?.38:0):.08+Math.sin(clock*2+d.seed)*.02;
  d.wings.forEach((w,i)=>w.rotation.z=(i%2?-1:1)*(1.08+(reduced?0:Math.sin(clock*8+i+d.seed)*.32)));

  if(d.body){
   const stateColor=hit?0xffffff:entity.freeze>0?0x83d9e6:spec.primary;
   d.body.material=this.mat(stateColor,spec.armor?'metal':spec.kind==='wraith'?'glass':'cloth',spec.kind==='wraith');
  }

  // Evolutions & Boss Phase Visibility
  d.evolutions.forEach((e,i)=>e.visible=!!ranks&&ranks[i]>=3);
  if(d.phaseParts&&d.phaseParts.length>=2){
   d.phaseParts[0].visible=(entity.phase||1)>=2;
   d.phaseParts[1].visible=(entity.phase||1)>=3;
  }
 }
 batch(){
  const groups=new Map(),roots=[this.hero,...this.objects.values()].filter(Boolean),lodDistance=roots.length>55?5.5:11;
  for(const root of roots){
   root.updateMatrixWorld(true);
   const hx=this.hero?.position?.x||0,hz=this.hero?.position?.z||0;
   const rx=root?.position?.x||0,rz=root?.position?.z||0;
   const distance=root===this.hero?0:Math.hypot(rx-hx,rz-hz);
   const far=this.reducedQuality&&distance>lodDistance&&root.userData?.spec;
   const farMaterial=far?this.mat(root.userData.spec.boss?0x8a7559:0x62685c,'cloth'):null;
   root.traverse(o=>{
    if(!o.isMesh||!o.visible||(far&&o.userData.detail))return;
    const material=farMaterial||o.material,shadow=this.reducedQuality?false:o.castShadow;
    const key=`${o.geometry.uuid}/${material.uuid}/${shadow}`;
    const group=groups.get(key)||{geometry:o.geometry,material,shadow,matrices:[]};
    group.matrices.push(o.matrixWorld);groups.set(key,group);
   });
  }
  for(const[key,g]of groups){
   let mesh=this.batches.get(key);
   if(!mesh||mesh.instanceMatrix.count<g.matrices.length){
    if(mesh){this.scene.remove(mesh);mesh.dispose();}
    mesh=new T.InstancedMesh(g.geometry,g.material,2**Math.ceil(Math.log2(Math.max(1,g.matrices.length))));
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=g.shadow;mesh.receiveShadow=true;
    this.batches.set(key,mesh);this.scene.add(mesh);
   }
   mesh.count=g.matrices.length;g.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
   mesh.instanceMatrix.needsUpdate=true;
  }
  for(const[key,mesh]of this.batches)if(!groups.has(key))mesh.count=0;
 }
 projectile(kind,color,enemy=false){
  const group=new T.Group();let mesh;
  if(['arrow','shard','spear'].includes(kind)){
   mesh=this.mesh(group,kind==='arrow'?this.geo.box:this.geo.gem,enemy?0xdf765e:kind==='spear'?0x9be8f4:color,kind==='arrow'?[.08,.08,1.05]:kind==='spear'?[1.05,1.05,4.2]:[.8,.8,2],[0,0,0],kind==='arrow'?'wood':'glass',kind!=='arrow');
  }else if(['flask','volatile'].includes(kind)){
   mesh=this.mesh(group,this.geo.orb,kind==='volatile'?0xb7d45e:color,[1.55,1.8,1.55],[0,0,0],'glass',true);
   this.mesh(group,this.geo.torus,0x7b6e4b,[.28,.28,.28],[0,.18,0],'metal');
  }else if(kind==='wave'){
   mesh=this.mesh(group,this.geo.ring,color,[.55,.55,.55],[0,0,0],'metal',true);mesh.rotation.x=Math.PI/2;
  }else if(kind==='flame'){
   mesh=this.mesh(group,this.geo.cone,0xff7a3d,[.32,1.6,.32],[0,0,0],'glass',true);mesh.rotation.x=Math.PI/2;
   this.mesh(group,this.geo.orb,0xffc062,[1.1,1.1,1.1],[0,0,-.4],'glass',true);
  }else if(kind==='spirit'){
   mesh=this.mesh(group,this.geo.skull,0x9edab9,[.3,.35,.3],[0,0,0],'glass',true);
   for(const side of[-1,1]){
    const wing=this.mesh(group,this.geo.cone,0xb7e5ca,[.2,.45,.08],[side*.18,0,0],'glass',true);wing.rotation.z=side*1.1;
   }
  }else mesh=this.mesh(group,this.geo.orb,enemy?0xdf765e:color,[enemy?1.2:.9,enemy?1.2:.9,enemy?2.6:3.4],[0,0,0],'glass',true);
  return group;
 }
 draw(game,clock,hero='cinder',reduced=false){
  if(game?.state==='playing'&&this.lastClock){
   const frame=Math.min(.1,clock-this.lastClock);
   this.frameAverage=this.frameAverage*.97+frame*.03;
   if(++this.qualitySamples>90&&this.frameAverage>.019&&!this.reducedQuality){
    this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=false;this.reducedQuality=true;
   }
  }
  this.lastClock=clock;
  if(game){
   for(const ev of game.events)if((ev.type==='damage'&&ev.crit)||ev.type==='guardBreak'||ev.type==='perfectDodge')this.hitstop=.035;
  }
  if(this.hitstop>0){this.hitstop-=1/60;return;}

  const low=reduced||this.reducedQuality,p=game?.player||{id:'hero',x:0,z:0,dx:0,dz:1,vx:0,vz:0,moving:false};
  const biome=game?.biome||0,active=game?.hero||hero,spec=modelFor(active);
  const activeBoss=game?.enemies?.find(e=>e.boss&&e.hp>0);
  const bossActive=!!activeBoss;
  const bossPhase=activeBoss?.phase||1;

  // Dungeon Environment with Guardian Sanctum reaction
  this.dungeon.update(p,clock,biome,low,bossActive,bossPhase);

  if(this.lastHero!==active){this.hero=this.character(active);this.lastHero=active;}
  const display=game?p:{...p,x:innerWidth<700?.25:5.1};
  this.animate(this.hero,display,clock,low,{dead:game?.state==='dead',showcase:!game,ranks:game?.player?.ranks});

  // Dynamic Biome & Boss Atmospheric Shading
  if(this.lastBiome!==biome||this.lastBossActive!==bossActive){
   this.lastBiome=biome;this.lastBossActive=bossActive;
   const baseFog=[0x282422,0x1c2b2c,0x282c22][biome];
   const bossFog=[0x38120b,0x0f2425,0x1c2b12][biome];
   const fogColor=bossActive?bossFog:baseFog;
   this.dungeon.floorMaterial.color.setHex([0xaaa592,0x829e99,0x989b78][biome]);
   this.scene.fog.color.setHex(fogColor);this.scene.background.copy(this.scene.fog.color);
  }

  // Camera System: Dynamic Look-Ahead, Boss Midpoint Framing & Multi-Frequency Trauma Shake
  const targetFrustum=bossActive?(innerWidth<700?14:13.2):(innerWidth<700?12:11.5);
  this.currentFrustum=this.currentFrustum||targetFrustum;
  if(Math.abs(this.currentFrustum-targetFrustum)>0.01){
   this.currentFrustum+=(targetFrustum-this.currentFrustum)*0.06;
   this.updateFrustum(this.currentFrustum);
  }

  if(game){
   let targetX=p.x+(p.vx||0)*0.06;
   let targetZ=p.z+(p.vz||0)*0.06;
   if(activeBoss){
    targetX=p.x*0.82+activeBoss.x*0.18;
    targetZ=p.z*0.82+activeBoss.z*0.18;
   }
   this.cameraFocus.x+=(targetX-this.cameraFocus.x)*0.065;
   this.cameraFocus.y+=(targetZ-this.cameraFocus.y)*0.065;
  }else this.cameraFocus.set(-2.5,0);

  const trauma=game?.trauma||0,t=trauma*trauma;
  const shakeX=low?0:Math.sin(clock*53)*t*0.4;
  const shakeZ=low?0:Math.cos(clock*61)*t*0.4;
  const shakeRoll=0;

  const cameraX=this.cameraFocus.x,cameraZ=this.cameraFocus.y;
  this.camera.position.set(cameraX+shakeX,game?26:11.5,cameraZ+(game?19:20)+shakeZ);
  this.camera.lookAt(cameraX,game?0:1.25,cameraZ);
  this.camera.rotation.z=shakeRoll;

  this.sun.position.set(cameraX-12,28,cameraZ+10);
  this.sun.target.position.set(cameraX,0,cameraZ);
  const heroColor=spec.primary;
  this.light.color.setHex(bossActive?([0xff5522,0x22ddcc,0x66ff44][biome]):(game?heroColor:0xffc98a));
  this.light.intensity=bossActive?48:(game?32:220);
  this.light.position.set(display.x,game?3:4.5,display.z+(game?3:5));

  // Sync Entities, Corpses, Projectiles, Drops and Zones
  const seen=new Set(),sync=(id,create,update)=>{seen.add(id);let obj=this.objects.get(id);if(!obj){obj=create();this.objects.set(id,obj);}update(obj);};
  for(const e of game?.enemies||[]){
   if(Math.hypot(e.x-p.x,e.z-p.z)>36)continue;
   sync(e.id,()=>this.character(e.type),o=>this.animate(o,e,clock,low));
  }
  for(const e of game?.corpses||[])sync(e.id,()=>this.character(e.type),o=>this.animate(o,e,clock,low,{dead:true}));
  for(const b of game?.bolts||[])sync(`bolt:${b.id}`,()=>this.projectile(b.kind||'bolt',heroColor,b.enemy),o=>{
   o.position.set(b.x,b.y||.85,b.z);o.rotation.y=Math.atan2(b.vx,b.vz);o.rotation.z=(b.kind==='flask'||b.kind==='volatile')?clock*8:0;
  });
  for(const l of(game?.loot||[]))if(Math.hypot(l.x-p.x,l.z-p.z)<=36)sync(`loot:${l.id}`,()=>{
   const o=new T.Group(),kind=l.kind,color=kind==='xp'?0x4ade80:kind==='potion'?0xef4444:kind==='bosscore'?0xffd700:kind==='mote'?0xff5511:kind==='spark'?0x38bdf8:kind==='aegis'?0x34d399:kind==='toxic'?0x84cc16:kind==='crest'?0xffd700:0xf59e0b;
   if(kind==='chest'){
    this.mesh(o,this.geo.box,0x5c3d26,[.75,.45,.55],[0,0,0],'wood');
    this.mesh(o,this.geo.cylinder,0x5c3d26,[.38,.38,.75],[0,.22,0],'wood');
    this.detailPlate(o,0x2b2b30,[.22,.1,0],[.1,.55,.58],'metal');
    this.detailPlate(o,0x2b2b30,[-.22,.1,0],[.1,.55,.58],'metal');
    this.mesh(o,this.geo.gem,0xffd700,[.4,.4,.4],[0,.08,.3],'metal',true);
   }else if(kind==='bosscore'){
    this.mesh(o,this.geo.gem,0xffe277,[2.2,2.9,2.2],[0,0,0],'glass',true);
    this.mesh(o,this.geo.ring,0xffd700,[.65,.65,.65],[0,0,0],'metal',true);
    const r2=this.mesh(o,this.geo.ring,0xffaa33,[.8,.8,.8],[0,0,0],'metal',true);r2.rotation.x=Math.PI/3;
   }else if(kind==='mote'){
    this.mesh(o,this.geo.cone,0xff5511,[.5,1.3,.5],[0,0,0],'glass',true);
    this.mesh(o,this.geo.orb,0xffbe33,[.7,.7,.7],[0,.15,0],'glass',true);
   }else if(kind==='spark'){
    this.mesh(o,this.geo.gem,0x38bdf8,[.45,1.9,.45],[0,0,0],'glass',true);
    const ring=this.mesh(o,this.geo.ring,0x818cf8,[.42,.42,.42],[0,0,0],'metal',true);ring.rotation.x=Math.PI/2;
   }else if(kind==='aegis'){
    this.mesh(o,this.geo.box,0x34d399,[.75,1.05,.12],[0,0,0],'glass',true);
    this.mesh(o,this.geo.ring,0xfbbf24,[.5,.5,.5],[0,0,0],'metal',true);
   }else if(kind==='toxic'){
    this.mesh(o,this.geo.orb,0x84cc16,[.95,1.15,.95],[0,0,0],'glass',true);
    this.mesh(o,this.geo.orb,0xa3e635,[.6,.7,.6],[.18,.18,.1],'glass',true);
   }else if(kind==='crest'){
    this.mesh(o,this.geo.cylinder,0xffd700,[.85,.12,.85],[0,0,0],'metal',true);
    this.mesh(o,this.geo.gem,0x38bdf8,[.6,.9,.6],[0,.1,0],'glass',true);
   }else if(kind==='gold'){
    this.mesh(o,this.geo.box,0xfbbf24,[.56,.18,.3],[0,0,0],'gold',true);
    this.mesh(o,this.geo.box,0xfef08a,[.48,.08,.24],[0,.09,0],'gold');
    this.mesh(o,this.geo.disk,0xfbbf24,[.32,.8,.32],[.16,.14,.06],'gold',true);
    this.mesh(o,this.geo.ring,0xfde047,[.42,.42,.42],[0,0,0],'gold',true);
   }else if(kind==='potion'){
    this.mesh(o,this.geo.orb,0xef4444,[1.3,1.4,1.3],[0,0,0],'glass',true);
    this.mesh(o,this.geo.cylinder,0x8b5cf6,[.25,.35,.25],[0,.26,0],'glass',true);
    this.mesh(o,this.geo.cylinder,0x78350f,[.22,.15,.22],[0,.42,0],'wood');
   }else{
    this.mesh(o,this.geo.gem,color,[1.25,1.6,1.25],[0,0,0],'glass',true);
    this.mesh(o,this.geo.ring,0xa7f3d0,[.35,.35,.35],[0,0,0],'metal',true);
   }
   return o;
  },o=>{
   o.position.set(l.x,.28+(l.y||0)+(low?0:Math.sin(clock*3+l.id)*.05),l.z);
   o.rotation.y=clock*(l.spin||1);o.rotation.x=(l.y||0)*.8;
   const pulse=l.rarity==='legendary'?1.2+Math.sin(clock*5)*.12:l.rarity==='epic'?1.08:1;
   o.scale.setScalar(pulse);
  });
  for(const z of game?.zones||[])sync(`zone:${z.id}`,()=>{
   const colors={burn:0xdc6f3f,briar:0x829459,miasma:0x8ca44d,poison:0x75934d,web:0xb9c6b1,whirlpool:0x548fa2,curse:0x9d62ad,egg:0x8da45d,seed:0x91a65e,thorn:0x7d914d,flame:0xf16e36,collapse:0xc85f45};
   const material=new T.MeshBasicMaterial({color:colors[z.kind]||(z.enemy?0xb65b44:0x8cac64),transparent:true,opacity:z.warn>0?.2:.13,depthWrite:false,side:T.DoubleSide});
   const o=new T.Mesh(this.geo.shadow,material);o.rotation.x=-Math.PI/2;return o;
  },o=>{
   o.position.set(z.x,.055,z.z);
   const pulse=z.warn>0?Math.sin(clock*13+z.id)*.045:Math.sin(clock*4+z.id)*.018;
   o.scale.setScalar(z.radius*(1+(reduced?0:pulse)));
  });
  for(const f of game?.effects||[]){
   const life=f.maxLife||.7,t=1-f.life/life;
   sync(`effect:${f.id}`,()=>{
    if(f.kind==='warning'){
     const group=new T.Group();
     for(let i=0;i<4;i++){
      const a=i*Math.PI/2,marker=this.mesh(group,this.geo.gem,f.color,[.38,.28,.38],[Math.sin(a)*f.radius*.72,.08,Math.cos(a)*f.radius*.72],'glass',true);
      marker.rotation.y=a;
     }
     return group;
    }
    return new T.Mesh(this.geo.gem,this.mat(f.color,'glass',true));
   },o=>{
    o.position.set(f.x,f.kind==='pickup'?.45+t*1.1:.16,f.z);
    const scale=f.kind==='warning'?.85+Math.sin(clock*12+f.id)*.08:(f.kind==='impact'?1-t:Math.sin(t*Math.PI))*Math.max(.35,Math.min(2.2,f.radius));
    o.scale.setScalar(Math.max(.08,scale));o.rotation.y=clock*(f.kind==='warning'?.15:2.4);
   });
   if(!low&&f.kind!=='warning')for(let i=0;i<(f.kind==='ultimate'?10:5);i++){
    const a=i*2.399+f.id;
    sync(`spark:${f.id}:${i}`,()=>new T.Mesh(this.geo.orb,this.mat(f.color,'glass',true)),o=>{
     o.position.set(f.x+Math.sin(a)*t*f.radius,.35+Math.sin(t*Math.PI)*(i%3+1)*.3,f.z+Math.cos(a)*t*f.radius);
     o.scale.setScalar(.7*(1-t));
    });
   }
  }
  for(const[id,o]of this.objects)if(!seen.has(id)){
   this.objects.delete(id);if(o.material?.transparent)o.material.dispose();
  }
  this.batch();
  this.renderer.render(this.scene,this.camera);
 }
}
