// A deliberately laid-out nine-chamber crypt. The renderer and simulation share
// these dimensions, so every visible wall also blocks movement and projectiles.
export const ROOMS=[];
export const WALLS=[];
export const FLOORS=[];
export const TORCHES=[];
export const PILLARS=[];
const names=['Reliquary','Hall of Ash','Ossuary','West Cloister','Ember Cathedral','East Cloister','Forgotten Vault','Processional Hall','The Sepulchre'];
for(let row=-1;row<=1;row++)for(let col=-1;col<=1;col++){
 const x=col*28,z=row*28;
 ROOMS.push({x,z,name:names[(row+1)*3+col+1]});FLOORS.push({x,z,w:24,d:24});
 for(const side of [-1,1]){
  const horizontalDoor=row+side>=-1&&row+side<=1;
  const verticalDoor=col+side>=-1&&col+side<=1;
  const add=(wx,wz,w,d,h)=>WALLS.push({x:wx,z:wz,w,d,h});
  if(horizontalDoor)for(const offset of [-7.75,7.75])add(x+offset,z+side*12,8.5,.9,side===1?1.1:3.6);
  else add(x,z+side*12,24.9,.9,side===1?1.1:3.6);
  if(verticalDoor)for(const offset of [-7.75,7.75])add(x+side*12,z+offset,.9,8.5,2.6);
  else add(x+side*12,z,.9,24.9,2.6);
 }
 for(const px of [-8,8])for(const pz of [-8,8])PILLARS.push({x:x+px,z:z+pz,radius:.75,height:3.4});
 for(const tx of [-7,7])TORCHES.push({x:x+tx,z:z-11.35,y:2.1});
 if(col<1){FLOORS.push({x:x+14,z,w:4,d:7});for(const side of [-1,1])WALLS.push({x:x+14,z:z+side*3.5,w:4,d:.9,h:2.6});}
 if(row<1){FLOORS.push({x,z:z+14,w:7,d:4});for(const side of [-1,1])WALLS.push({x:x+side*3.5,z:z+14,w:.9,d:4,h:2.6});}
}
export function solid(x,z,radius=0){
 if(!FLOORS.some(f=>Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2))return true;
 if(WALLS.some(w=>Math.abs(x-w.x)<w.w/2+radius&&Math.abs(z-w.z)<w.d/2+radius))return true;
 return PILLARS.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+radius);
}
export function collide(body,radius){
 body.x=Math.max(-39.2+radius,Math.min(39.2-radius,body.x));body.z=Math.max(-39.2+radius,Math.min(39.2-radius,body.z));
 for(const w of WALLS){const dx=body.x-w.x,dz=body.z-w.z,px=w.w/2+radius-Math.abs(dx),pz=w.d/2+radius-Math.abs(dz);if(px>0&&pz>0){if(px<pz){body.x+=(dx>=0?1:-1)*px;if(body.vx)body.vx=0;}else{body.z+=(dz>=0?1:-1)*pz;if(body.vz)body.vz=0;}}}
 for(const o of PILLARS){const dx=body.x-o.x,dz=body.z-o.z,d=Math.hypot(dx,dz),min=o.radius+radius;if(d<min){body.x=o.x+(d?dx/d:1)*min;body.z=o.z+(d?dz/d:0)*min;if(body.vx)body.vx*=.2;if(body.vz)body.vz*=.2;}}
 if(!FLOORS.some(f=>Math.abs(body.x-f.x)<=f.w/2&&Math.abs(body.z-f.z)<=f.d/2)){
  const candidates=FLOORS.map(f=>({x:Math.max(f.x-f.w/2+radius+.6,Math.min(f.x+f.w/2-radius-.6,body.x)),z:Math.max(f.z-f.d/2+radius+.6,Math.min(f.z+f.d/2-radius-.6,body.z))})).filter(p=>!solid(p.x,p.z,radius-.01)).sort((a,b)=>Math.hypot(a.x-body.x,a.z-body.z)-Math.hypot(b.x-body.x,b.z-body.z));
  if(candidates.length){body.x=candidates[0].x;body.z=candidates[0].z;if(body.vx)body.vx=0;if(body.vz)body.vz=0;}
 }
}
export function clearLine(a,b,radius=.1){
 const dx=b.x-a.x,dz=b.z-a.z;
 for(const w of WALLS){const loX=w.x-w.w/2-radius,hiX=w.x+w.w/2+radius,loZ=w.z-w.d/2-radius,hiZ=w.z+w.d/2+radius;
  if(Math.max(a.x,b.x)<loX||Math.min(a.x,b.x)>hiX||Math.max(a.z,b.z)<loZ||Math.min(a.z,b.z)>hiZ)continue;
  let t0=0,t1=1;for(const [v,d,lo,hi]of [[a.x,dx,loX,hiX],[a.z,dz,loZ,hiZ]]){if(Math.abs(d)<1e-8){if(v<lo||v>hi){t0=2;break;}}else{const u=(lo-v)/d,vv=(hi-v)/d;t0=Math.max(t0,Math.min(u,vv));t1=Math.min(t1,Math.max(u,vv));}}if(t0<=t1)return false;
 }
 const len=dx*dx+dz*dz;for(const p of PILLARS){const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0;if(Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z)<p.radius+radius)return false;}return true;
}
const SIZE=41;
const cells=Array.from({length:SIZE*SIZE},(_,i)=>({x:(i%SIZE)*2-40,z:Math.floor(i/SIZE)*2-40}));
const open=cells.map(p=>!solid(p.x,p.z,.8));
function nearest(p){let best=-1,distance=Infinity;const cx=Math.round((p.x+40)/2),cz=Math.round((p.z+40)/2);for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const x=cx+dx,z=cz+dz,i=z*SIZE+x;if(x<0||z<0||x>=SIZE||z>=SIZE||!open[i])continue;const d=Math.hypot(p.x-cells[i].x,p.z-cells[i].z);if(d<distance){distance=d;best=i;}}return best;}
export class Navigation{
 constructor(){this.target=-1;this.distance=new Int32Array(cells.length).fill(-1);}
 update(player){const target=nearest(player);if(target===this.target)return;this.target=target;this.distance.fill(-1);if(target<0)return;const queue=[target];this.distance[target]=0;for(let q=0;q<queue.length;q++){const i=queue[q];for(const n of [i-SIZE,i+SIZE,i-1,i+1]){if(n<0||n>=cells.length||Math.abs(cells[n].x-cells[i].x)>2||!open[n]||this.distance[n]>=0)continue;this.distance[n]=this.distance[i]+1;queue.push(n);}}}
 direction(enemy,player){const i=nearest(enemy);if(i<0)return Math.atan2(player.x-enemy.x,player.z-enemy.z);let next=i;for(const n of [i-SIZE,i+SIZE,i-1,i+1])if(this.distance[n]>=0&&this.distance[n]<this.distance[next]&&Math.abs(cells[n].x-cells[i].x)<=2)next=n;const p=next===this.target?player:cells[next];return Math.atan2(p.x-enemy.x,p.z-enemy.z);}
}
