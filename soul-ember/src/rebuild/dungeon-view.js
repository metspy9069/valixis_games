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
 update(player,time,biome,reduced){
  this.regionProps.forEach((g,i)=>g.visible=i===biome);this.cloth.color.setHex([0x62302d,0x345957,0x515737][biome]);const tones=[0xffaf62,0x99c9c3,0xb4c38a];this.arches.forEach(({arch,x,z})=>arch.visible=!(Math.abs(player.x-x)<6&&player.z<z+1&&player.z>z-8));
  this.rooms.forEach(({group,room})=>group.visible=Math.hypot(player.x-room.x,player.z-room.z)<45);
  this.flames.material.color.setHex(tones[biome]);TORCHES.forEach((t,i)=>{this.dummy.position.set(t.x,t.y,t.z);this.dummy.scale.set(1,reduced?1:1+Math.sin(time*13+i)*.2,1);this.dummy.rotation.z=reduced?0:Math.sin(time*8+i)*.08;this.dummy.updateMatrix();this.flames.setMatrixAt(i,this.dummy.matrix);});this.flames.instanceMatrix.needsUpdate=true;
  const nearest=[...TORCHES].sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));this.lights.forEach((light,i)=>{const t=nearest[i];light.position.set(t.x,t.y,t.z+1);light.color.setHex(tones[biome]);light.intensity=reduced?35:35+Math.sin(time*9+i)*4;});
  this.dust.position.set(player.x,reduced?0:(time*.12)%1,player.z);
 }
}
