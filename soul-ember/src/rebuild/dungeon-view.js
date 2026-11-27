import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ROOMS,WALLS,FLOORS,PILLARS,TORCHES} from './dungeon.js';

function stoneTexture(){
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#252924';ctx.fillRect(0,0,1024,1024);let seed=912;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 for(let row=0;row<8;row++)for(let col=0;col<8;col++){
  const x=col*128,y=row*128,v=88+rand()*24;ctx.fillStyle=`rgb(${v+6},${v+5},${v})`;ctx.beginPath();ctx.moveTo(x+4,y+5);ctx.lineTo(x+120,y+3);ctx.lineTo(x+125,y+12);ctx.lineTo(x+123,y+119);ctx.lineTo(x+113,y+125);ctx.lineTo(x+5,y+122);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#d0c5a426';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+5,y+120);ctx.lineTo(x+5,y+5);ctx.lineTo(x+119,y+5);ctx.stroke();
  for(let j=0;j<160;j++){ctx.fillStyle=rand()>.5?'#0000000c':'#ded6bd0a';ctx.fillRect(x+rand()*120,y+rand()*120,1+rand()*9,1+rand()*4);}
  if(rand()>.35){ctx.strokeStyle='#242b2788';ctx.lineWidth=1+rand();ctx.beginPath();ctx.moveTo(x+40,y+3);ctx.lineTo(x+51,y+32);ctx.lineTo(x+44,y+48);ctx.lineTo(x+65,y+74);ctx.lineTo(x+58,y+123);ctx.stroke();}
  if(rand()>.6){ctx.fillStyle='#343d3030';for(let j=0;j<30;j++){ctx.beginPath();ctx.ellipse(x+rand()*120,y+120-rand()*8,rand()*8,rand()*3,0,0,7);ctx.fill();}}
 }
 // Worn processional cuts avoid circular targeting-like marks under actors.
 ctx.strokeStyle='#b6a7792b';ctx.lineWidth=3;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(430+i*24,430);ctx.lineTo(448+i*21,448);ctx.lineTo(430+i*24,466);ctx.stroke();ctx.beginPath();ctx.moveTo(594-i*24,558);ctx.lineTo(576-i*21,576);ctx.lineTo(594-i*24,594);ctx.stroke();}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(2,2);tex.anisotropy=4;return tex;
}
export class DungeonView{
 constructor(scene){
  this.root=new T.Group();scene.add(this.root);this.rooms=[];this.arches=[];this.texture=stoneTexture();
  this.stone=[0x565c58,0x62665f,0x484e4c,0x727368,0x353d3c].map(color=>new T.MeshStandardMaterial({color,roughness:.98}));
  this.iron=new T.MeshStandardMaterial({color:0x242c2e,roughness:.64,metalness:.65});this.brass=new T.MeshStandardMaterial({color:0x8b7147,roughness:.65,metalness:.45});
  this.cloth=new T.MeshStandardMaterial({color:0x62302d,roughness:1,side:T.DoubleSide});
  this.floorMaterial=new T.MeshStandardMaterial({color:0xaaa596,map:this.texture,roughness:1});
  const box=new T.BoxGeometry(1,1,1),mat=new T.Matrix4(),obj=new T.Object3D();
  ROOMS.forEach((room,index)=>{
   const group=new T.Group();this.root.add(group);this.rooms.push({group,room});const buckets=new Map();
   const add=(material,x,y,z,w,h,d,rot=0)=>{obj.position.set(x,y,z);obj.scale.set(w,h,d);obj.rotation.set(0,0,rot);obj.updateMatrix();const geo=box.clone().applyMatrix4(obj.matrix);if(!buckets.has(material))buckets.set(material,[]);buckets.get(material).push(geo);};
   const owns=p=>ROOMS.reduce((best,r,i)=>Math.hypot(p.x-r.x,p.z-r.z)<Math.hypot(p.x-ROOMS[best].x,p.z-ROOMS[best].z)?i:best,0)===index;
   for(const w of WALLS.filter(owns)){
    const horizontal=w.w>w.d,length=horizontal?w.w:w.d,rows=Math.ceil(w.h/.58),count=Math.ceil(length/1.75);
    add(this.stone[4],w.x,w.h/2,w.z,w.w,w.h,w.d);
    for(let row=0;row<rows;row++)for(let col=0;col<count;col++){
     const offset=-length/2+(col+.5)*length/count;const h=Math.min(.54,w.h-row*.58);if(h<=0)continue;
     add(this.stone[(row*3+col+index)%4],w.x+(horizontal?offset:0),row*.58+h/2,w.z+(horizontal?0:offset),horizontal?length/count-.055:w.w+.06,h,horizontal?w.d+.06:length/count-.055);
    }
    add(this.stone[2],w.x,.13,w.z,w.w+.18,.26,w.d+.18);add(this.stone[3],w.x,w.h+.08,w.z,w.w+.18,.18,w.d+.18);
   }
   for(const p of PILLARS.filter(owns)){
    add(this.stone[2],p.x,.18,p.z,1.8,.36,1.8);add(this.stone[0],p.x,1.7,p.z,1.15,3.2,1.15);
    for(const y of [.5,1.5,2.5,3.2])add(this.stone[3],p.x,y,p.z,1.35,.15,1.35);
    add(this.stone[2],p.x,3.5,p.z,1.75,.35,1.75);
   }
   // A pointed arch frames the north entrance. Foreground walls stay cut away.
   if(room.z>-28){const arch=new T.Group();group.add(arch);this.arches.push({arch,x:room.x,z:room.z-12});for(const side of [-1,1]){for(const [x,y,w,h,rot]of[[side*3.65,1.8,.65,3.6,0],[side*1.85,4.55,.65,4.8,side*.85]]){const m=new T.Mesh(new T.BoxGeometry(w,h,1.2),this.stone[1]);m.position.set(room.x+x,y,room.z-12);m.rotation.z=rot;arch.add(m);}}}
   for(const side of [-1,1]){
    // Raised stone coffins and worn wall banners sit clear of the combat lanes.
    add(this.stone[2],room.x+side*10.7,.45,room.z+6,1.2,.9,2.5);add(this.stone[3],room.x+side*10.7,.95,room.z+6,1.4,.18,2.7);add(this.brass,room.x+side*10.7,1.06,room.z+6,.12,.04,1.35);
    add(this.iron,room.x+side*7,2.7,room.z-11.3,1.8,.08,.1);
    const banner=new T.Mesh(new T.PlaneGeometry(1.5,2),this.cloth);banner.position.set(room.x+side*7,1.65,room.z-11.25);group.add(banner);
    add(this.brass,room.x+side*7,1.7,room.z-11.2,.06,1.1,.02);add(this.brass,room.x+side*7,1.9,room.z-11.2,.55,.06,.02);
   }
   for(const [material,geometries]of buckets){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const mesh=new T.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  });box.dispose();
  // Center Cathedral: Grand Guardian Dais and Boss Arena Braziers
  this.bossArena=new T.Group();this.root.add(this.bossArena);
  const dais=new T.Mesh(new T.CylinderGeometry(5.2,5.6,.26,16),this.stone[1]);dais.position.set(0,.05,0);dais.receiveShadow=true;this.bossArena.add(dais);
  this.altarRuneMat=new T.MeshStandardMaterial({color:0xff6622,emissive:0xff4411,emissiveIntensity:0.35,roughness:.3,metalness:.7});
  const ring=new T.Mesh(new T.TorusGeometry(3.6,.07,8,32),this.altarRuneMat);ring.rotation.x=Math.PI/2;ring.position.y=.19;this.bossArena.add(ring);this.altarRing=ring;
  const sigil=new T.Mesh(new T.CircleGeometry(2.1,8),this.altarRuneMat);sigil.rotation.x=-Math.PI/2;sigil.position.y=.195;this.bossArena.add(sigil);this.altarSigil=sigil;
  this.braziers=[];
  for(const [bx,bz] of [[-5.2,-5.2],[5.2,-5.2],[-5.2,5.2],[5.2,5.2]]){
   const bGroup=new T.Group();bGroup.position.set(bx,0,bz);this.bossArena.add(bGroup);
   const ped=new T.Mesh(new T.BoxGeometry(.9,.9,.9),this.stone[0]);ped.position.y=.45;ped.castShadow=true;bGroup.add(ped);
   const bowl=new T.Mesh(new T.CylinderGeometry(.55,.32,.45,8),this.iron);bowl.position.y=1.05;bowl.castShadow=true;bGroup.add(bowl);
   const flameMat=new T.MeshBasicMaterial({color:0xff7722});
   const flame=new T.Mesh(new T.ConeGeometry(.28,1.1,6),flameMat);flame.position.y=1.65;bGroup.add(flame);
   this.braziers.push({group:bGroup,flame,mat:flameMat});
  }
  // Abbot Flame Vents: 4 inner dais grates that periodically erupt in Phase 2/3
  this.flameVents=[];
  for(const [vx,vz] of [[-2.4,-2.4],[2.4,-2.4],[-2.4,2.4],[2.4,2.4]]){
   const vGroup=new T.Group();vGroup.position.set(vx,0.19,vz);this.bossArena.add(vGroup);
   const grate=new T.Mesh(new T.CylinderGeometry(.42,.48,.06,8),this.iron);grate.position.y=.03;vGroup.add(grate);
   const ventMat=new T.MeshBasicMaterial({color:0xff7722,transparent:true,opacity:.88});
   const ventFlame=new T.Mesh(new T.ConeGeometry(.24,1.3,6),ventMat);ventFlame.position.y=.68;ventFlame.visible=false;vGroup.add(ventFlame);
   this.flameVents.push({group:vGroup,flame:ventFlame,mat:ventMat,x:vx,z:vz});
  }
  // Drowned Warden Flooded Shallow Water & Whirlpool Currents (Biome 1)
  this.wardenWaterMat=new T.MeshStandardMaterial({color:0x2e6b75,roughness:.18,metalness:.45,transparent:true,opacity:.28,depthWrite:false});
  this.wardenWater=new T.Mesh(new T.CircleGeometry(15.5,48),this.wardenWaterMat);
  this.wardenWater.rotation.x=-Math.PI/2;this.wardenWater.position.set(0,.026,0);this.bossArena.add(this.wardenWater);
  this.whirlpoolRings=[];
  for(let i=0;i<3;i++){
   const wMat=new T.MeshBasicMaterial({color:0x7be2ed,transparent:true,opacity:.35,depthWrite:false});
   const ring=new T.Mesh(new T.RingGeometry(2.0+i*2.2,2.3+i*2.2,32),wMat);
   ring.rotation.x=-Math.PI/2;ring.position.set(0,.032+i*.002,0);ring.visible=false;this.bossArena.add(ring);
   this.whirlpoolRings.push({ring,mat:wMat,radius:2.0+i*2.2});
  }
  // Thornbound Regent Perimeter Briar Barrier (Biome 2)
  this.regentRoots=[];
  const rootWoodMat=new T.MeshStandardMaterial({color:0x3d3022,roughness:.9});
  const rootThornMat=new T.MeshStandardMaterial({color:0x5a7a28,roughness:.6});
  for(let i=0;i<24;i++){
   const angle=(i/24)*Math.PI*2,r=11.2,rx=Math.sin(angle)*r,rz=Math.cos(angle)*r;
   const rGroup=new T.Group();rGroup.position.set(rx,-1.8,rz);rGroup.rotation.y=angle+Math.PI/2;this.bossArena.add(rGroup);
   const trunk=new T.Mesh(new T.CylinderGeometry(.22,.38,1.8,6),rootWoodMat);trunk.position.y=.9;trunk.rotation.z=Math.sin(i*1.5)*.25;rGroup.add(trunk);
   const thorn=new T.Mesh(new T.ConeGeometry(.14,.65,5),rootThornMat);thorn.position.set(-.2,1.4,0);thorn.rotation.z=1.1;rGroup.add(thorn);
   const thorn2=new T.Mesh(new T.ConeGeometry(.12,.55,5),rootThornMat);thorn2.position.set(.18,.9,0);thorn2.rotation.z=-1.2;rGroup.add(thorn2);
   this.regentRoots.push({group:rGroup,angle,rx,rz});
  }
  for(const f of FLOORS){const mesh=new T.Mesh(new T.BoxGeometry(f.w,.5,f.d),this.floorMaterial);mesh.position.set(f.x,-.26,f.z);mesh.receiveShadow=true;this.root.add(mesh);}
  this.regionProps=[];
  for(let region=0;region<3;region++){
   const group=new T.Group();this.root.add(group);this.regionProps.push(group);
   const deco=new T.InstancedMesh(region===2?new T.CylinderGeometry(.06,.13,1,5):new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:[0x9a8b6e,0x5b7168,0x554c34][region],roughness:1}),216);group.add(deco);const d=new T.Object3D();
   for(let i=0;i<216;i++){const room=ROOMS[Math.floor(i/24)],a=i*2.399,r=6+(i%5)*.9;d.position.set(room.x+Math.sin(a)*r,region===2?.12:.06,room.z+Math.cos(a)*r);d.rotation.set(region===2?1.3:0,a,region===2?.5:0);d.scale.set(region===2?1:.08+(i%3)*.08,region===2?1+(i%4)*.3:.08,region===2?1:.25+(i%4)*.15);d.updateMatrix();deco.setMatrixAt(i,d.matrix);}
   if(region===1)for(const room of ROOMS){const water=new T.Mesh(new T.CircleGeometry(4.5,40),new T.MeshStandardMaterial({color:0x4d7470,roughness:.22,metalness:.4,transparent:true,opacity:.32,depthWrite:false}));water.rotation.x=-Math.PI/2;water.scale.y=.6;water.position.set(room.x+4,.018,room.z-4);group.add(water);}
  }
  this.flames=new T.InstancedMesh(new T.ConeGeometry(.18,.65,5),new T.MeshBasicMaterial({color:0xffb65a}),TORCHES.length);this.flames.frustumCulled=false;this.root.add(this.flames);this.dummy=new T.Object3D();
  for(const t of TORCHES){const sconce=new T.Mesh(new T.CylinderGeometry(.28,.12,.18,6),this.iron);sconce.position.set(t.x,t.y-.3,t.z);this.root.add(sconce);}
  this.lights=Array.from({length:4},()=>{const light=new T.PointLight(0xffa657,35,13,2);scene.add(light);return light;});
  const points=new Float32Array(180*3);for(let i=0;i<180;i++){points[i*3]=Math.sin(i*2.39)*20;points[i*3+1]=(i%20)*.15;points[i*3+2]=Math.cos(i*2.39)*20;}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(points,3));this.dust=new T.Points(geometry,new T.PointsMaterial({color:0xe3b878,size:.035,transparent:true,opacity:.45,depthWrite:false}));scene.add(this.dust);
 }
 update(player,time,biome,reduced,bossActive=false,bossPhase=1){
  this.regionProps.forEach((g,i)=>g.visible=i===biome);this.cloth.color.setHex([0x62302d,0x345957,0x515737][biome]);
  const abbotTones=[0xff4411,0x2288ff,0xaa22ff];
  const tones=[0xffaf62,0x99c9c3,0xb4c38a];
  const bossTones=[abbotTones[Math.min(2,Math.max(0,bossPhase-1))],bossPhase>=3?0x0feeee:0x22eedd,bossPhase>=3?0x77ff33:0x55ff44];
  const activeColor=bossActive?bossTones[biome]:tones[biome];
  this.arches.forEach(({arch,x,z})=>arch.visible=!(Math.abs(player.x-x)<6&&player.z<z+1&&player.z>z-8));
  this.rooms.forEach(({group,room})=>group.visible=Math.hypot(player.x-room.x,player.z-room.z)<45);
  this.flames.material.color.setHex(activeColor);
  TORCHES.forEach((t,i)=>{this.dummy.position.set(t.x,t.y,t.z);this.dummy.scale.set(1,reduced?1:1+Math.sin(time*(bossActive?18:13)+i)*(bossActive?.35:.2),1);this.dummy.rotation.z=reduced?0:Math.sin(time*8+i)*.08;this.dummy.updateMatrix();this.flames.setMatrixAt(i,this.dummy.matrix);});
  this.flames.instanceMatrix.needsUpdate=true;
  const nearest=[...TORCHES].sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  this.lights.forEach((light,i)=>{const t=nearest[i];light.position.set(t.x,t.y,t.z+1);light.color.setHex(activeColor);light.intensity=reduced?35:(bossActive?50:35)+Math.sin(time*9+i)*4;});
  // Guardian Altar & Braziers reaction during Boss encounter
  if(this.altarRuneMat){
   this.altarRuneMat.color.setHex(activeColor);
   this.altarRuneMat.emissive.setHex(activeColor);
   this.altarRuneMat.emissiveIntensity=bossActive?(1.8+Math.sin(time*6)*0.9+bossPhase*0.4):0.35;
  }
  if(this.braziers)this.braziers.forEach((b,i)=>{
   b.mat.color.setHex(activeColor);
   const flareMult=bossActive?(1+(bossPhase-1)*0.35):1;
   b.flame.scale.set((bossActive?1.4:1)*flareMult,(bossActive?(1.6+Math.sin(time*12+i)*.4):1)*flareMult,(bossActive?1.4:1)*flareMult);
  });
  // Abbot Inner Sanctuary Periodic Flame Vents
  if(this.flameVents){
   const ventsActive=bossActive&&biome===0&&bossPhase>=2;
   this.flameVents.forEach((v,i)=>{
    v.flame.visible=ventsActive;
    if(ventsActive){
     v.mat.color.setHex(activeColor);
     const ventBurst=Math.max(0.12,Math.sin(time*6+i*1.57));
     v.flame.scale.set(1.15,(0.7+ventBurst*1.25)*(bossPhase===3?1.55:1.0),1.15);
    }
   });
  }
  // Drowned Warden Flooded Shallow Water & Whirlpool Ripples
  if(this.wardenWater){
   this.wardenWater.visible=biome===1;
   if(biome===1){
    const baseOpacity=bossActive?(0.45+(bossPhase-1)*0.18):0.25;
    this.wardenWaterMat.opacity=baseOpacity;
    this.wardenWater.position.y=0.024+(bossActive?Math.sin(time*(5+bossPhase*2))*0.008:0);
   }
  }
  if(this.whirlpoolRings){
   const ringsActive=bossActive&&biome===1&&bossPhase>=2;
   this.whirlpoolRings.forEach((w,i)=>{
    w.ring.visible=ringsActive;
    if(ringsActive){
     w.ring.rotation.z=time*(1.6+i*0.7+bossPhase*0.5);
     const rScale=1.0+Math.sin(time*3+i)*0.08;
     w.ring.scale.set(rScale,rScale,1);
     w.mat.opacity=0.28+(bossPhase===3?0.25:0.1)+Math.sin(time*4+i)*0.08;
    }
   });
  }
  // Thornbound Regent Inward Briar Root Barrier
  if(this.regentRoots){
   const rootsVisible=biome===2;
   this.regentRoots.forEach((r,i)=>{
    r.group.visible=rootsVisible;
    if(rootsVisible){
     let targetY=-1.8,scaleY=0.01;
     if(bossActive){
      if(bossPhase===1){targetY=-0.3;scaleY=0.45;}
      else if(bossPhase===2){targetY=0.4+Math.sin(time*2.5+i)*0.06;scaleY=1.05;}
      else{targetY=0.95+Math.sin(time*3.2+i)*0.08;scaleY=1.6;}
     }
     r.group.position.y+=(targetY-r.group.position.y)*(reduced?1.0:0.18);
     r.group.scale.y+=(scaleY-r.group.scale.y)*(reduced?1.0:0.18);
    }
   });
  }
  this.dust.material.color.setHex(bossActive?activeColor:0xe3b878);
  this.dust.position.set(player.x,reduced?0:(time*(bossActive?.35:.12))%1,player.z);
 }
}
