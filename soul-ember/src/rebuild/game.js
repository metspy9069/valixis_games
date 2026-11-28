import {ROOMS,PILLARS,collide,solid,clearLine,Navigation} from './dungeon.js';
import {HEROES,MONSTERS,REGIONS,BOSSES,upgradeOffers} from './roster.js';
import {HERO_MODELS} from './model-catalog.js';
import {ACTIVE_SKILLS,RELICS,RITES,ASCENSIONS,CHAMPION_AFFIXES,AFFIX_KEYS} from './content.js';
import {attacksFor,telegraphFor} from './combat-content.js';

export const BIOMES=REGIONS,OBSTACLES=PILLARS;
export function random(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const approach=(value,target,step)=>value<target?Math.min(target,value+step):Math.max(target,value-step);
const segmentDistance=(p,a,b)=>{const vx=b.x-a.x,vz=b.z-a.z,wx=p.x-a.x,wz=p.z-a.z,len=vx*vx+vz*vz,t=len?clamp((wx*vx+wz*vz)/len,0,1):0;return Math.hypot(p.x-(a.x+vx*t),p.z-(a.z+vz*t));};

export class Game{
 constructor({hero='cinder',seed=Date.now(),ranked=false,modifier='balanced',meta={}}={}){
  if(!HEROES[hero])throw new Error('Unknown hero');const h=HEROES[hero],armory=ranked?{}:meta.armory||{},mastery=ranked?0:(meta.mastery?.[hero]||0),maxHp=h.hp+(armory.vitality||0)*10,speed=h.speed*(1+(armory.footwork||0)*.04);
  Object.assign(this,{hero,rng:random(seed),ranked,modifier,state:'playing',time:0,kills:0,gold:0,earned:0,spent:0,elites:0,biome:0,cycle:0,ascension:0,endless:false,ascensionModifier:null,id:0,spawnTimer:1,bossSpawned:false,bossKills:0,regionStart:0,streak:0,maxStreak:0,trauma:0,navClock:0,merchantOffers:[],merchantRerolled:false,merchantBought:false,emberFlash:0,comboScore:0,comboRank:'D',comboDecay:0,threat:1,trialTimer:0,lastX:0,lastZ:0});
  this.director={tier:0,pressure:0,clock:5,lastKills:0,lastHp:maxHp,grace:8};
  this.enemies=[];this.bolts=[];this.loot=[];this.effects=[];this.zones=[];this.corpses=[];this.events=[];this.choices=[];this.damageLog={weapon:0,skill:0,status:0,signature:0,defense:0};this.levelTimes=[];this.navigation=new Navigation();
  this.player={id:'hero',x:0,z:0,y:0,vx:0,vz:0,hp:maxHp,maxHp,speed,damage:1,damageMult:mastery>=1?1.04:1,attackRate:0.95,comboStep:0,comboTimer:0,ignition:0,tempest:0,magnet:4+(armory.magnetism||0)*.6,stamina:100,staminaRate:23*(1+(armory.footwork||0)*.06),ult:mastery>=3?10:0,level:1,xp:0,need:h.initialXp,fire:0,cooldown:h.cooldown*.82,invuln:0,dash:0,dashCost:34,dx:0,dz:1,attack:0,cast:0,moving:false,ranks:[0,0,0],shared:{},skills:[0,0],skillRate:1+(armory.focus||0)*.05+(mastery>=2?.05:0),signatureRate:1,relics:{},rites:{},shield:0,counter:0,ward:0,trail:0,mastery,revives:0,goldChance:.55+(armory.fortune||0)*.08,critBonus:0,bountyRush:0};
  this.roomEvents={};this.visitedRooms=new Set([4]);this.currentRoom=4;
  this.initRoomEvents();
  this.bountyClaimed=0;this.currentBounty=null;this.initBounty();
 }
 emit(type,data={}){this.events.push({type,...data});}
 effect(x,z,color=0xd9b97c,radius=1,kind='burst',life=.45,meta={}){this.effects.push({id:++this.id,x,z,color,radius,kind,life,maxLife:life,...meta});}
 roomFor(x,z){
  for(let i=0;i<ROOMS.length;i++){
   const r=ROOMS[i];if(Math.abs(x-r.x)<=12.2&&Math.abs(z-r.z)<=12.2)return i;
  }
  let best=4,minDist=Infinity;
  for(let i=0;i<ROOMS.length;i++){
   const d=Math.hypot(x-ROOMS[i].x,z-ROOMS[i].z);if(d<minDist){minDist=d;best=i;}
  }
  return best;
 }
 initRoomEvents(customEvents=null){
  if(customEvents){this.roomEvents=customEvents;return;}
  this.roomEvents={};
  const outer=[0,1,2,3,5,6,7,8];
  for(let i=outer.length-1;i>0;i--){
   const j=Math.floor(this.rng()*(i+1));
   [outer[i],outer[j]]=[outer[j],outer[i]];
  }
  const altarRoom=outer[0],vaultRoom=outer[1],campfireRoom=outer[2];
  this.roomEvents[altarRoom]={
   room:altarRoom,type:'altar',x:ROOMS[altarRoom].x,z:ROOMS[altarRoom].z,active:true,used:false,
   pacts:[
    {id:'fury',name:'Blood of Fury',desc:'Sacrifice 30% Max HP to gain +35% Critical Chance.'},
    {id:'gold',name:'Flesh for Cinders',desc:'Sacrifice 30 HP to gain +60 Run Gold.'}
   ]
  };
  this.roomEvents[vaultRoom]={
   room:vaultRoom,type:'vault',x:ROOMS[vaultRoom].x,z:ROOMS[vaultRoom].z,state:'locked',timer:25.0,maxTimer:25.0,spawnedSwarm:false
  };
  this.roomEvents[campfireRoom]={
   room:campfireRoom,type:'campfire',x:ROOMS[campfireRoom].x,z:ROOMS[campfireRoom].z,active:true,used:false,
   blessings:[
    {id:'mend',name:'Mend Wounds',desc:'Rest and recover +35 Vitality.'},
    {id:'temper',name:'Temper Weapon',desc:'Temper weapon at embers for +10% Damage.'}
   ]
  };
 }
  initBounty(){
  const regional=Object.values(MONSTERS).filter(e=>!e.boss&&e.region===this.biome);
  if(!regional.length)return;
  const target=regional[Math.floor(this.rng()*regional.length)];
  const affixes=['molten','vortex','frostbound','shielded','avenger'];
  const affix=this.rng()<0.45?affixes[Math.floor(this.rng()*affixes.length)]:null;
  this.currentBounty={
   targetType:target.id,
   targetName:target.name,
   targetAffix:affix,
   countNeeded:1,
   countCurrent:0,
   rewardGold:50,
   rewardBuff:'bountyRush',
   claimed:false
  };
  this.emit('bountyAssigned',{...this.currentBounty});
 }
 updateRoomEvents(dt){
  for(const k in this.roomEvents){
   const ev=this.roomEvents[k];
   if(ev.type==='vault'){
    if(ev.state==='locked'){
     if(dist(this.player,ev)<=3.8&&this.currentRoom===ev.room){
      ev.state='active';ev.timer=25.0;
      this.emit('trialStart',{room:ev.room,duration:25.0});
      this.effect(ev.x,ev.z,0xeab308,4.0,'pulse',0.8);
      if(!ev.spawnedSwarm){
       ev.spawnedSwarm=true;
       const pool=Object.entries(MONSTERS).filter(([id, m]) => !m.boss && m.region === this.biome).map(([id]) => id);
       const activePool=pool.length ? pool : ['thrall', 'hound'];
       for(let i=0;i<2;i++){
        const a=i*Math.PI+(this.rng()-.5),t=activePool[Math.floor(this.rng()*activePool.length)];
        this.spawn(t,{x:ev.x+Math.sin(a)*4.5,z:ev.z+Math.cos(a)*4.5},{elite:true});
       }
       for(let i=0;i<4;i++){
        const a=(i*Math.PI/2)+.4,t=activePool[Math.floor(this.rng()*activePool.length)];
        this.spawn(t,{x:ev.x+Math.sin(a)*5.5,z:ev.z+Math.cos(a)*5.5},{elite:false});
       }
      }
     }
    }else if(ev.state==='active'){
     ev.timer=Math.max(0,ev.timer-dt);
     this.trialTimer=ev.timer;
     if(ev.timer<=0){
      ev.state='cleared';this.trialTimer=0;
      this.emit('trialComplete',{room:ev.room});
      this.effect(ev.x,ev.z,0xffd700,5.0,'ultimate',1.0);
      this.drop('chest',ev.x,ev.z,0,'epic');
      this.drop('gold',ev.x-.8,ev.z,35,'rare');
      this.drop('gold',ev.x+.8,ev.z,35,'rare');
      this.drop('crest',ev.x,ev.z+.8,250,'epic');
     }
    }
   }
  }
 }
 acceptPact(choice='fury',roomId=null){
  const p=this.player;
  const altar=roomId!==null?this.roomEvents[roomId]:(this.roomEvents[this.currentRoom]?.type==='altar'?this.roomEvents[this.currentRoom]:Object.values(this.roomEvents).find(e=>e.type==='altar'));
  if(!altar||altar.type!=='altar'||!altar.active||altar.used)return false;
  if(choice==='fury'){
   const sacrifice=Math.max(5,Math.round(p.maxHp*0.30));
   p.maxHp=Math.max(10,p.maxHp-sacrifice);
   p.hp=Math.max(1,Math.min(p.hp,p.maxHp));
   p.critBonus=(p.critBonus||0)+0.35;
   p.damageMult=(p.damageMult||1)*1.15;
   altar.active=false;altar.used=true;altar.chosen='fury';
   this.effect(altar.x,altar.z,0xdc2626,3.5,'pulse',.6);
   this.emit('altarPact',{room:altar.room,choice:'fury',cost:sacrifice,hp:p.hp,maxHp:p.maxHp,critBonus:p.critBonus});
   return true;
  }else if(choice==='gold'){
   const sacrifice=30;
   p.hp=Math.max(1,p.hp-sacrifice);
   this.gold+=60;this.earned+=60;
   altar.active=false;altar.used=true;altar.chosen='gold';
   this.effect(altar.x,altar.z,0xfacc15,3.5,'burst',.5);
   this.emit('altarPact',{room:altar.room,choice:'gold',cost:sacrifice,hp:p.hp,gold:this.gold});
   return true;
  }
  return false;
 }
 restCampfire(choice='mend',roomId=null){
  const p=this.player;
  const campfire=roomId!==null?this.roomEvents[roomId]:(this.roomEvents[this.currentRoom]?.type==='campfire'?this.roomEvents[this.currentRoom]:Object.values(this.roomEvents).find(e=>e.type==='campfire'));
  if(!campfire||campfire.type!=='campfire'||!campfire.active||campfire.used)return false;
  if(choice==='mend'){
   const healed=Math.min(35,p.maxHp-p.hp);
   p.hp=Math.min(p.maxHp,p.hp+35);
   campfire.active=false;campfire.used=true;campfire.chosen='mend';
   this.effect(campfire.x,campfire.z,0x22c55e,3.5,'burst',.6);
   this.emit('campfireRest',{room:campfire.room,choice:'mend',healed,hp:p.hp});
   return true;
  }else if(choice==='temper'){
   p.damageMult=(p.damageMult||1)*1.10;
   campfire.active=false;campfire.used=true;campfire.chosen='temper';
   this.effect(campfire.x,campfire.z,0xf59e0b,3.5,'pulse',.6);
   this.emit('campfireRest',{room:campfire.room,choice:'temper',damageMult:p.damageMult});
   return true;
  }
  return false;
 }
  updateComboRank(){const s=this.comboScore;this.comboRank=s>=1800?'SSS':s>=1200?'S':s>=750?'A':s>=400?'B':s>=150?'C':'D';}
  comboMultiplier(){return this.comboRank==='SSS'?2.2:this.comboRank==='S'?1.8:this.comboRank==='A'?1.5:this.comboRank==='B'?1.25:1;}
  spawn(type,position,options={}){const def=MONSTERS[type];if(!def)throw new Error('Unknown monster');let x=0,z=0;for(let i=0;i<100;i++){const a=this.rng()*Math.PI*2,r=13+this.rng()*8;x=this.player.x+Math.sin(a)*r;z=this.player.z+Math.cos(a)*r;if(!solid(x,z,def.boss?1.1:.5)){const crId=Object.values(this.roomEvents||{}).find(e=>e.type==='campfire')?.room;if(crId!==undefined&&!def.boss){const cr=ROOMS[crId];if(Math.abs(x-cr.x)<12&&Math.abs(z-cr.z)<12)continue;}break;}}if(solid(x,z,1.1)){x=0;z=0;}if(position){x=position.x;z=position.z;}
  const mutator=ASCENSIONS[this.ascensionModifier]||{},defaultElite=!def.boss&&(this.time>20)&&this.rng()<Math.min(.42,.06+(this.time/70)*.18+this.director.tier*.035+(mutator.elite||0)),elite=options?.elite!==undefined?options.elite:defaultElite,cycleScale=1+this.cycle*.28,timeScale=1+(this.time/140)*0.85,hp=def.hp*(elite?2.4:1)*(1+this.biome*.35)*timeScale*cycleScale*(mutator.hp||1),spd=def.speed*1.25*(1+this.director.tier*.04)*Math.min(1.55,1+(this.time/180)*0.35);
  const affix=elite?(options?.affix||AFFIX_KEYS[Math.floor(this.rng()*AFFIX_KEYS.length)]):null;
   const isBounty=options?.bountyTarget!==undefined?!!options.bountyTarget:(!!elite&&!!this.currentBounty&&!this.currentBounty.claimed&&type===this.currentBounty.targetType&&(!this.currentBounty.targetAffix||affix===this.currentBounty.targetAffix));
  const e={id:++this.id,type,x,z,vx:0,vz:0,hp,maxHp:hp,speed:spd,xp:def.xp*(1+this.cycle*.12),elite,affix,bountyTarget:isBounty,affixTimer:0,affixStacks:0,barrierAngle:0,trailTimer:0,growth:0,teleportCooldown:0,burrowed:type==='shifter',unburrowTimer:0,boss:def.boss,behavior:def.behavior,radius:def.boss?1.1:['golem','hulk'].includes(type)?0.65:.48,age:0,cool:1.0+this.rng()*.5,windup:0,recover:0,attack:0,attackId:null,attackIndex:0,flash:0,freeze:0,poison:0,phase:1,lastPhase:1,dx:0,dz:1};collide(e,e.radius);this.enemies.push(e);return e;
 }
 damage(e,amount,source='weapon'){if(e.hp<=0)return 0;const p=this.player;
  if(e.type==='shifter'&&e.burrowed){
   e.burrowed=false;
   this.effect(e.x,e.z,0x84cc16,2.8,'burst',.45);
   this.emit('shifterUnburrow',{id:e.id,x:e.x,z:e.z,triggeredByDamage:true});
  }
 if(e.type==='golem'&&source==='weapon'){
  const attackAngle=Math.atan2(p.x-e.x,p.z-e.z);let diff=Math.abs(attackAngle-(e.dz!==undefined?Math.atan2(e.dx,e.dz):0));
  while(diff>Math.PI)diff=Math.abs(diff-Math.PI*2);
  if(diff<Math.PI*0.42){
   this.effect(e.x+Math.sin(attackAngle)*.6,e.z+Math.cos(attackAngle)*.6,0xff5511,1.2,'impact',.25);
   this.emit('golemDeflect',{x:e.x,z:e.z});
   amount*=.08;
  }
 }
 if(e.type==='hulk'){
  if(source==='finisher'||source==='signature'||source==='skill'||source==='defense'){
   amount*=1.5;
   e.growth=0;
   e.freeze=1.2;
   this.effect(e.x,e.z,0x22eedd,2.4,'impact',.4);
   this.emit('hulkRupture',{x:e.x,z:e.z});
  }else{
   amount*=.55;
   e.growth=Math.min(8,(e.growth||0)+1);
   this.effect(e.x,e.z,0x79a6a3,1.2,'pulse',.25);
   this.emit('hulkAbsorb',{x:e.x,z:e.z,growth:e.growth});
  }
 }
 if(e.elite&&e.affix==='shielded'){
  const attackAngle=Math.atan2(p.x-e.x,p.z-e.z);let diff=Math.abs(attackAngle-(e.barrierAngle||0));
  while(diff>Math.PI)diff=Math.abs(diff-Math.PI*2);
  if(diff<Math.PI/3){
   this.effect(e.x+Math.sin(e.barrierAngle)*.7,e.z+Math.cos(e.barrierAngle)*.7,0xfacc15,1.2,'shield',.25);
   this.emit('shieldDeflect',{x:e.x,z:e.z});
   amount*=.12;
  }
 }
 const isCrit=(source==='finisher')||(p.critBonus&&this.rng()<p.critBonus);let dmgAmt=amount;if(isCrit&&source!=='finisher')dmgAmt*=1.4;
 const reduction=e.guarding>0 ? .35 : e.behavior==='guard' ? .72 : 1,hunter=p.relics.hunterSigil&&(e.elite||e.boss)?1.25:1,actual=Math.min(e.hp,dmgAmt*reduction*p.damageMult*hunter);e.hp-=actual;this.damageLog[source]=(this.damageLog[source]||0)+actual;this.comboScore+=actual;this.comboDecay=3.5;this.updateComboRank();if(e.guarding>0&&(source==='finisher'||source==='skill'||source==='signature'||source==='defense')){e.guarding=0;e.freeze=1.2;this.trauma=Math.min(1.2,(this.trauma||0)+.22);this.emit('guardBreak',{x:e.x,z:e.z});}if(source==='finisher'||source==='signature'){this.trauma=Math.min(1.2,(this.trauma||0)+(source==='signature'?.32:.18));}const isHeavy=source==='finisher'||source==='signature'||source==='defense';const impulse=isHeavy?(source==='signature'?2.4:source==='finisher'?1.2:0.7)/(e.boss?6.0:e.elite?2.8:1):0;if(impulse>0){const kx=e.x-p.x,kz=e.z-p.z,kd=Math.hypot(kx,kz)||1;e.vx=(e.vx||0)+(kx/kd)*impulse;e.vz=(e.vz||0)+(kz/kd)*impulse;const kSpd=Math.hypot(e.vx,e.vz);if(kSpd>2.5){e.vx=(e.vx/kSpd)*2.5;e.vz=(e.vz/kSpd)*2.5;}}if(amount>3)e.flash=.14;if(amount>8)this.effect(e.x,e.z,0xd6c8a4,.55,'impact',.3);if(e.hp<=0)this.effects=this.effects.filter(f=>!(f.kind==='warning'&&f.ownerId===e.id));this.emit('damage',{amount:actual,x:e.x,z:e.z,source,crit:actual>=20||source==='finisher'||isCrit});return actual;}
 hurt(amount){const p=this.player;if(p.invuln>0||this.state!=='playing')return false;let remaining=amount*(1-p.ranks[2]*.08);if(p.shield>0){const blocked=Math.min(p.shield,remaining);p.shield-=blocked;remaining-=blocked;this.effect(p.x,p.z,0x9fcbd0,1.4,'shield',.35);}if(remaining>0)p.hp=Math.max(0,p.hp-remaining);p.invuln=.32;this.trauma=Math.min(1.2,(this.trauma||0)+(remaining>p.maxHp*.2?.45:.25));this.director.grace=Math.max(this.director.grace,remaining>p.maxHp*.2?3.5:2);this.emit('hurt',{amount:remaining,x:p.x,z:p.z});if(p.counter>0){const target=this.smartTarget(5);if(target){this.damage(target,80,'defense');this.effect(target.x,target.z,0xc8c2a9,1.8,'slash');}p.counter=0;}if(p.ward>0){const target=this.smartTarget(10);if(target)this.shoot(Math.atan2(target.x-p.x,target.z-p.z),42,20,2,false,p,{kind:'spirit',source:'defense'});}if(!p.hp){if(p.relics.graveThread&&p.revives<1){p.revives++;p.hp=Math.max(1,p.maxHp*.35);p.invuln=2;this.effect(p.x,p.z,0xd5c99d,4,'revive',1);this.emit('revive');}else{this.state='dead';this.emit('end',{victory:false});}}return true;}
 nearest(origin,range=Infinity,exclude=new Set()){return this.enemies.filter(e=>e.hp>0&&!exclude.has(e.id)&&dist(e,origin)<range&&clearLine(origin,e)).sort((a,b)=>dist(a,origin)-dist(b,origin))[0];}
 smartTarget(range=16,exclude=new Set()){const p=this.player;return this.enemies.filter(e=>e.hp>0&&!e.burrowed&&!exclude.has(e.id)&&dist(e,p)<range&&clearLine(p,e)).sort((a,b)=>{const score=e=>(e.boss?1000:0)+(e.windup>0?450:0)+(e.elite?180:0)-dist(e,p)*8+(1-e.hp/e.maxHp)*12;return score(b)-score(a);})[0];}
 aimVector(aim){let x=Number(aim?.x)||0,z=Number(aim?.z)||0,n=Math.hypot(x,z);if(!n){const target=this.smartTarget(16);if(target){x=target.x-this.player.x;z=target.z-this.player.z;n=Math.hypot(x,z);}}if(!n){x=this.player.dx;z=this.player.dz;n=Math.hypot(x,z)||1;}return{x:x/n,z:z/n,angle:Math.atan2(x,z)};}
 dash(x=0,z=0){const p=this.player;if(this.state!=='playing'||p.stamina<p.dashCost||p.dash>0)return false;let n=Math.hypot(x,z);if(!n){x=p.dx;z=p.dz;n=Math.hypot(x,z)||1;}const dx=x/n,dz=z/n;p.dx=dx;p.dz=dz;p.vx=dx*p.speed*3.2;p.vz=dz*p.speed*3.2;p.stamina-=p.dashCost;p.dash=.24;p.invuln=.28;this.emit('dash');let perfect=false;for(const e of this.enemies)if(e.hp>0&&e.windup>0&&e.windup<.28&&dist(e,p)<3.8){perfect=true;break;}if(perfect){this.emberFlash=.75;p.stamina=Math.min(100,p.stamina+p.dashCost);p.comboStep=2;this.emit('perfectDodge',{x:p.x,z:p.z});this.effect(p.x,p.z,0xffe277,4.5,'pulse',.6);}this.effect(p.x,p.z,0xcac3a3,1.6,'dash',.3);if(p.ranks[2]===3){this.effect(p.x,p.z,0xcac3a3,4,'pulse');for(const e of this.enemies)if(dist(e,p)<4&&clearLine(p,e)){this.damage(e,45,'defense');e.freeze=1;}}return true;}
 shoot(angle,damage,speed=26,pierce=1,enemy=false,origin=this.player,options={}){const side=!enemy&&origin===this.player?(HERO_MODELS[this.hero]?.shotSide||0):0,kind=options.kind||(enemy?'enemy':HEROES[this.hero].pattern);this.bolts.push({id:++this.id,x:origin.x+Math.sin(angle)*.55+Math.cos(angle)*side,z:origin.z+Math.cos(angle)*.55-Math.sin(angle)*side,y:.9,vx:Math.sin(angle)*speed,vz:Math.cos(angle)*speed,damage,enemy,pierce:pierce+(!enemy&&this.player.relics.piercingNail?1:0),hits:new Set(),life:options.life||1.8,kind,source:options.source||'weapon',explode:options.explode||0});this.effect(origin.x,origin.z,enemy?0xd87562:parseInt(HEROES[this.hero].color.slice(1),16),.8,'muzzle',.18);}
 attack(target,mult=1,echo=false){const p=this.player,h=HEROES[this.hero];const step=p.comboStep||0;p.comboStep=(step+1)%3;p.comboTimer=1.4;const comboMult=step===2?1.8:step===1?1.25:1,source=step===2?'finisher':'weapon',power=h.damage*(1+p.ranks[0]*.22)*mult*comboMult,a=Math.atan2(target.x-p.x,target.z-p.z),count=1+p.ranks[1];p.attack=.28;p.dx=Math.sin(a);p.dz=Math.cos(a);this.emit('shoot',{kind:h.pattern,step});
  if(h.pattern==='cleave'||h.pattern==='wave'){const range=h.pattern==='cleave'?3.4:p.ranks[1]===3?8:5.5;this.effect(p.x,p.z,parseInt(h.color.slice(1),16),range,h.pattern==='cleave'?'slash':'wave');for(const e of this.enemies){if(dist(p,e)<range&&clearLine(p,e)){const angle=Math.atan2(e.x-p.x,e.z-p.z);if(h.pattern==='wave'||p.ranks[1]===3||Math.cos(angle-a)>.15-p.ranks[1]*.2){this.damage(e,power*(1+p.ranks[1]*.18),source);e.freeze=p.ranks[0]===3?1:.3;if(p.ranks[0]===3){e.x+=Math.sin(angle)*.2;e.z+=Math.cos(angle)*.2;collide(e,e.radius);}}}}}
  else if(h.pattern==='chain')this.chain(target,power,2+p.ranks[1]+(p.ranks[0]===3?2:0),source);
  else for(let i=0;i<count;i++)this.shoot(a+(i-(count-1)/2)*.16,power,h.pattern==='flask'?21:28,h.pattern==='arrow'?2+(p.ranks[0]===3?2:0):1,false,p,{source,explode:h.pattern==='flask'?1.5:0});
  if(p.ignition>0)this.effect(target.x,target.z,0xff7034,2.2,'explosion',.35);
  if(!echo&&p.relics.echoBell&&this.rng()<.2)this.attack(target,.55,true);
 }
 chain(first,power,count,source='skill'){let from=this.player;const hit=new Set();for(let i=0;i<count;i++){const next=i===0&&first?.hp>0?first:this.nearest(from,i?6:12,hit);if(!next)break;hit.add(next.id);this.damage(next,power*(i?.72:1),source);this.effect(next.x,next.z,0xaeb9dc,1.4,'lightning',.32);from=next;}}
 coneDamage(angle,range,spread,damage,source='skill',push=0){const p=this.player;for(const e of this.enemies){if(e.hp<=0||dist(p,e)>range||!clearLine(p,e))continue;const ea=Math.atan2(e.x-p.x,e.z-p.z);if(Math.cos(ea-angle)<Math.cos(spread))continue;this.damage(e,damage,source);if(push){e.x+=Math.sin(ea)*push;e.z+=Math.cos(ea)*push;collide(e,e.radius);}}}
 useSkill(slot){const p=this.player,skill=ACTIVE_SKILLS[this.hero]?.[slot];if(!skill||this.state!=='playing'||p.skills[slot]>0)return false;const a=this.aimVector(),h=HEROES[this.hero],power=h.damage;p.skills[slot]=skill.cooldown/p.skillRate;p.cast=.42;p.attack=.32;p.dx=a.x;p.dz=a.z;this.emit('skill',{slot,name:skill.name,kind:skill.kind});
  if(this.hero==='cinder'&&slot===0)this.shoot(a.angle,power*1.6,36,4,false,p,{kind:'flame',source:'skill'});
  if(this.hero==='cinder'&&slot===1){p.dx=a.x;p.dz=a.z;p.vx=a.x*p.speed*3.4;p.vz=a.z*p.speed*3.4;p.dash=.3;p.invuln=.34;p.trail=1.1;}
  if(this.hero==='grave'&&slot===0){this.coneDamage(a.angle,4.8,1.12,power*1.8,'skill',.7);this.effect(p.x,p.z,0xbab5a0,4.8,'slash',.5);}
  if(this.hero==='grave'&&slot===1){p.shield+=45;p.counter=4;this.effect(p.x,p.z,0xc5c0a8,2.2,'shield',.7);}
  if(this.hero==='thorn'&&slot===0)for(let i=-3;i<=3;i++)this.shoot(a.angle+i*.13,power*1.05,32,3,false,p,{kind:'arrow',source:'skill'});
  if(this.hero==='thorn'&&slot===1)this.zones.push({id:++this.id,x:p.x+a.x*5,z:p.z+a.z*5,life:6,warn:.35,radius:2.7,enemy:false,kind:'briar'});
  if(this.hero==='frost'&&slot===0)this.shoot(a.angle,power*2,31,6,false,p,{kind:'spear',source:'skill',explode:2.4});
  if(this.hero==='frost'&&slot===1){this.effect(p.x,p.z,0x8fd9eb,5,'frost',.75);for(const e of this.enemies)if(dist(e,p)<5&&clearLine(p,e)){this.damage(e,power*1.2,'skill');e.freeze=4;}}
  if(this.hero==='bone'&&slot===0)for(let i=-1;i<=1;i++)this.shoot(a.angle+i*.28,power*1.25,19,2,false,p,{kind:'spirit',source:'skill',life:3});
  if(this.hero==='bone'&&slot===1){p.shield+=35;p.ward=8;this.effect(p.x,p.z,0x9edab9,2.4,'ward',.8);}
  if(this.hero==='storm'&&slot===0){const end={x:p.x+a.x*5,z:p.z+a.z*5};for(const e of this.enemies)if(segmentDistance(e,p,end)<1.25)this.damage(e,power*1.7,'skill');p.x=end.x;p.z=end.z;collide(p,.45);p.invuln=.35;this.effect(p.x,p.z,0xaeb9dc,3,'crosscut',.45);}
  if(this.hero==='storm'&&slot===1)this.chain(this.nearest(p,12),power*1.35,8,'skill');
  if(this.hero==='plague'&&slot===0)this.shoot(a.angle,power*1.7,18,1,false,p,{kind:'volatile',source:'skill',explode:3.2});
  if(this.hero==='plague'&&slot===1)this.zones.push({id:++this.id,x:p.x,z:p.z,life:7,warn:0,radius:2.6,enemy:false,kind:'miasma',follow:true});
  if(this.hero==='bell'&&slot===0){this.coneDamage(a.angle,7,1,power*1.55,'skill',1.2);this.effect(p.x,p.z,0xd4b36f,7,'wave',.7);}
  if(this.hero==='bell'&&slot===1){p.hp=Math.min(p.maxHp,p.hp+18);p.shield+=25;this.effect(p.x,p.z,0xd9c58d,5,'sanctuary',.9);for(const e of this.enemies)if(dist(e,p)<5){const ea=Math.atan2(e.x-p.x,e.z-p.z);e.x+=Math.sin(ea)*1.8;e.z+=Math.cos(ea)*1.8;collide(e,e.radius);}}
  return true;
 }
 ultimate(){const p=this.player;if(this.state!=='playing'||p.ult<100)return false;const a=this.aimVector();p.ult=0;p.attack=.5;p.cast=.65;p.dx=a.x;p.dz=a.z;this.effect(p.x,p.z,parseInt(HEROES[this.hero].color.slice(1),16),10,'ultimate',1);this.emit('ultimate');for(const e of this.enemies){if(dist(e,p)>12||!clearLine(p,e))continue;this.damage(e,150*(1+p.ranks[0]*.22),'signature');if(this.hero==='frost')e.freeze=5;if(this.hero==='plague'||this.hero==='cinder')e.poison=6;if(this.hero==='bell'){e.x+=(e.x-p.x)*.25;e.z+=(e.z-p.z)*.25;collide(e,e.radius);}}if(this.hero==='grave'||this.hero==='bone')p.hp=Math.min(p.maxHp,p.hp+25);if(this.hero==='grave'){p.invuln=2.5;p.shield+=40;}if(this.hero==='thorn')for(let i=0;i<24;i++)this.shoot(i*Math.PI/12,55,30,3,false,p,{kind:'arrow',source:'signature'});if(this.hero==='bone')for(let i=0;i<12;i++)this.shoot(i*Math.PI/6,75,18,2,false,p,{kind:'spirit',source:'signature'});if(this.hero==='cinder'||this.hero==='plague')for(const e of this.enemies.filter(e=>dist(e,p)<10&&clearLine(p,e)).slice(0,8))this.zones.push({id:++this.id,x:e.x,z:e.z,life:5,warn:0,radius:this.hero==='cinder'?2:3,enemy:false,kind:this.hero==='cinder'?'burn':'miasma'});if(this.hero==='storm'||this.hero==='thorn')p.invuln=2;return true;}
 upgrade(id){if(this.state!=='upgrade'||!this.choices.some(c=>c.id===id))return false;const p=this.player,c=this.choices.find(c=>c.id===id);if(c.branch!==undefined)p.ranks[c.branch]++;else{p.shared[id]=(p.shared[id]||0)+1;if(id==='vitality'){p.maxHp+=15;p.hp=Math.min(p.maxHp,p.hp+15);}if(id==='stride')p.speed*=1.05;if(id==='emberMight')p.damageMult*=1.08;if(id==='emberTempo')p.attackRate*=.94;if(id==='emberGuard'){p.maxHp+=10;p.hp=Math.min(p.maxHp,p.hp+10);}if(id==='emberReach'){p.magnet+=.4;p.speed*=1.01;}if(id==='emberRecovery'){p.skillRate*=1.04;p.signatureRate*=1.04;}}this.choices=[];this.state='playing';return true;}
 drop(kind,x,z,value,rarity='common'){const isSpecialty=['mote','spark','aegis','toxic'].includes(kind),common=kind==='xp'||kind==='gold',nearby=(common&&this.loot.find(l=>l.kind===kind&&Math.hypot(l.x-x,l.z-z)<1.5))||(isSpecialty&&this.loot.find(l=>l.kind===kind&&Math.hypot(l.x-x,l.z-z)<3.0)),pressureMerge=common&&this.loot.length>=120&&this.loot.find(l=>l.kind===kind),merge=nearby||pressureMerge;if(merge){merge.value+=value;merge.rarity=merge.value>12?'rare':merge.rarity;return merge;}const angle=this.rng()*Math.PI*2,speed=.8+this.rng()*1.4,l={id:++this.id,kind,x,z,y:.25,value,rarity,age:0,vx:Math.sin(angle)*speed,vz:Math.cos(angle)*speed,vy:3+this.rng()*2,spin:this.rng()*6,magnet:false};this.loot.push(l);return l;}
 merchantPool(exclude=new Set()){const relics=Object.keys(RELICS).filter(id=>!this.player.relics[id]&&!exclude.has(id)),rites=this.endless||relics.length<3?Object.keys(RITES).filter(id=>!exclude.has(id)):[];return [...relics,...rites];}
 merchantCost(id){const item=RELICS[id]||RITES[id];return item?item.cost+(RITES[id]?(this.player.rites[id]||0)*8:0):Infinity;}
 prepareMerchant(){const ids=this.merchantPool();for(let i=ids.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}this.merchantOffers=ids.slice(0,3);this.merchantRerolled=false;this.merchantBought=false;this.state='merchant';this.emit('merchant');}
 rerollMerchant(){if(this.state!=='merchant'||this.merchantRerolled||this.gold<5)return false;this.gold-=5;this.spent+=5;this.merchantRerolled=true;const ids=this.merchantPool(new Set(this.merchantOffers));for(let i=ids.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}this.merchantOffers=ids.slice(0,3);return true;}
 buyMerchant(id){const relic=RELICS[id]||RITES[id],cost=this.merchantCost(id);if(this.state!=='merchant'||this.merchantBought||!this.merchantOffers.includes(id)||!relic||this.gold<cost)return false;this.gold-=cost;this.spent+=cost;this.merchantBought=true;this.applyRelic(id);this.state='playing';this.emit('relic',{id,name:relic.name});return true;}
 skipMerchant(){if(this.state!=='merchant')return false;this.state='playing';return true;}
 applyRelic(id){const p=this.player;if(RITES[id]){p.rites[id]=(p.rites[id]||0)+1;if(id==='warfire')p.damageMult*=1.06;if(id==='warding'){p.maxHp+=12;p.hp=Math.min(p.maxHp,p.hp+12);}if(id==='celerity'){p.skillRate*=1.05;p.attackRate*=.97;}if(id==='harvest'){p.goldChance+=.05;p.magnet+=.25;}return;}p.relics[id]=true;if(id==='soulMagnet')p.magnet+=2;if(id==='bloodVessel'){p.maxHp+=20;p.hp=Math.min(p.maxHp,p.hp+20);}if(id==='pilgrimBoots'){p.speed*=1.1;p.dashCost=Math.max(20,p.dashCost-6);}if(id==='glassFang'){p.damageMult*=1.18;p.maxHp=Math.max(1,p.maxHp-10);p.hp=Math.min(p.hp,p.maxHp);}if(id==='gildedTooth')p.goldChance+=.15;}
 claimVictory(){if(this.state!=='convergence')return false;this.state='victory';this.emit('end',{victory:true});return true;}
 continueEndless(){if(this.state!=='convergence'||this.ranked)return false;const keys=Object.keys(ASCENSIONS),p=this.player;this.endless=true;this.cycle++;this.ascension=this.cycle;this.biome=0;this.regionStart=this.time;this.bossSpawned=false;this.ascensionModifier=keys[(this.cycle-1)%keys.length];this.enemies=[];this.bolts=[];this.zones=[];p.revives=0;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.25);this.emit('ascension',{level:this.ascension,modifier:this.ascensionModifier,name:ASCENSIONS[this.ascensionModifier].name});this.prepareMerchant();return true;}
 updateDirector(dt){const d=this.director,p=this.player;d.grace=Math.max(0,d.grace-dt);d.clock-=dt;if(d.clock>0)return;const kills=this.kills-d.lastKills,hpLoss=Math.max(0,d.lastHp-p.hp),health=p.hp/p.maxHp,density=this.enemies.filter(e=>!e.boss).length;let target=kills>=9?4:kills>=6?3:kills>=3?2:1;if(health<.35||hpLoss>p.maxHp*.22)target=Math.max(0,target-2);else if(health<.6||p.stamina<20)target=Math.max(0,target-1);if(density>100)target=Math.min(target,2);if(d.grace>0)target=Math.min(target,1);d.pressure=d.pressure*.55+target*.45;d.tier=clamp(Math.round(d.pressure),0,4);d.lastKills=this.kills;d.lastHp=p.hp;d.clock=5;}
 chooseAttack(e){const list=attacksFor(e);if(!list.length)return null;const distance=dist(e,this.player),valid=list.filter(a=>distance<=a.range);const pool=valid.length?valid:list;e.attackIndex=(e.attackIndex||0)%pool.length;const selected=pool[e.attackIndex];e.attackIndex=(e.attackIndex+1)%pool.length;return selected;}
 beginEnemyAttack(e,attack){const p=this.player,tel=telegraphFor(attack),selfAnchor=tel.anchor==='self';e.attackId=attack.id;e.windup=attack.windup;e.aim=Math.atan2(p.x-e.x,p.z-e.z);e.aimX=p.x;e.aimZ=p.z;e.dx=Math.sin(e.aim);e.dz=Math.cos(e.aim);this.emit('enemyCue',{enemy:e.type,attack:attack.id,boss:e.boss,ex:e.x,ez:e.z});this.effect(selfAnchor?e.x:e.aimX,selfAnchor?e.z:e.aimZ,e.boss?0xd99058:0xe0583c,tel.radius,'warning',attack.windup,{ownerId:e.id,shape:tel.shape,angle:e.aim,spread:tel.spread||Math.PI/4,targetX:e.aimX,targetZ:e.aimZ,width:tel.width||.85});}
 enemyZone(x,z,radius=2,life=3,warn=.55,kind='danger'){this.zones.push({id:++this.id,x,z,life,warn,radius,enemy:true,kind});}
 radial(e,count,damage=16,speed=9,offset=0){for(let i=0;i<count;i++)this.shoot(offset+i*Math.PI*2/count,damage,speed,1,true,e,{kind:'enemy'});}
 enemyMelee(e,range,damage,kind='enemy'){this.effect(e.x,e.z,0xb8694b,range,kind,.35);if(dist(e,this.player)<range&&clearLine(e,this.player))this.hurt((e.elite?damage*1.35:damage)*(this.threat||1));}
 enemyAttack(e){const p=this.player,id=e.attackId||this.chooseAttack(e)?.id,a=e.aim??Math.atan2(p.x-e.x,p.z-e.z),x=e.aimX??p.x,z=e.aimZ??p.z;e.attack=.38;e.attackId=null;
  if(id==='thrall-combo'){this.enemyMelee(e,2.2,16,'slash');e.recover=.42;}
  else if(id==='shield-bash'){this.enemyMelee(e,2.6,24,'shield');e.recover=.68;}
  else if(id==='shield-rush'||id==='hound-charge'||id==='mimic-ambush'||id==='thorn-leap'||id==='stalker-flank'||id==='warden-charge'){e.charge=id==='warden-charge'?1.05:.62;e.chargeAngle=a;e.chargeDamage=id==='warden-charge'?38:id==='hound-charge'?28:22;e.recover=.55;}
  else if(id==='censer-lob'){this.enemyZone(x,z,2.2,4,.65,'burn');}
  else if(id==='bell-ring'){this.radial(e,12,17,7.5,e.age);this.enemyMelee(e,3.2,17,'wave');}
  else if(id==='gargoyle-dive'){e.x=x-Math.sin(a)*1.1;e.z=z-Math.cos(a)*1.1;collide(e,e.radius);this.enemyMelee(e,2.5,30,'impact');e.recover=.85;}
  else if(id==='golem-slam'){
   this.enemyMelee(e,4.5,34,'impact');
   this.radial(e,8,18,6.5,e.age);
   this.enemyZone(e.x,e.z,4.2,2.5,0.1,'collapse');
   this.trauma=Math.min(1.2,(this.trauma||0)+.28);
   e.recover=.85;
  }
  else if(id==='priest-heal'){
   const allies=this.enemies.filter(other=>other.id!==e.id&&!other.boss&&other.hp>0&&dist(e,other)<8.0&&other.hp<other.maxHp);
   if(allies.length>0){
    allies.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));
    const target=allies[0];
    const healAmt=Math.min(target.maxHp-target.hp,45);
    target.hp+=healAmt;
    this.effect(target.x,target.z,0xffd700,2.2,'pulse',.5);
    this.effect(e.x,e.z,0xffbe33,1.6,'burst',.4);
    this.emit('priestHeal',{healer:e.id,target:target.id,amount:healAmt});
   }else{
    this.effect(e.x,e.z,0xffd700,3.5,'pulse',.45);
   }
   e.recover=.65;
  }
  else if(id==='priest-wisp'){
   this.shoot(a-.16,16,9.5,1,true,e,{kind:'flame'});
   this.shoot(a+.16,16,9.5,1,true,e,{kind:'flame'});
   this.enemyZone(x,z,1.8,3,.4,'burn');
   e.recover=.55;
  }
  else if(id==='husk-grab'){this.enemyMelee(e,2.2,26,'grab');e.recover=.8;}
  else if(id==='husk-sweep'){this.enemyMelee(e,3.7,22,'slash');e.recover=.62;}
  else if(id==='archer-lead'){this.shoot(a,19,13,1,true,e,{kind:'arrow'});}
  else if(id==='archer-volley'){for(let i=-2;i<=2;i++)this.shoot(a+i*.13,15,12,1,true,e,{kind:'arrow'});}
  else if(id==='leech-drain'){if(dist(e,p)<3.3){this.hurt(16);e.hp=Math.min(e.maxHp,e.hp+22);}this.effect(e.x,e.z,0x7e5147,3,'drain',.6);}
  else if(id==='spitter-shot'){this.shoot(a,18,11,1,true,e,{kind:'spit'});}
  else if(id==='spitter-pool'){this.enemyZone(x,z,2.5,4,.55,'poison');}
  else if(id==='wraith-phase'){e.x=x-Math.sin(a)*5;e.z=z-Math.cos(a)*5;collide(e,e.radius);for(let i=-1;i<=1;i++)this.shoot(a+i*.2,18,11,1,true,e,{kind:'spirit'});this.effect(e.x,e.z,0x789aa4,2,'phase',.7);}
  else if(id==='siren-scream'){
   this.effect(e.x,e.z,0x22eedd,7.5,'wave',.6);
   if(dist(e,p)<7.5&&clearLine(e,p)){
    this.hurt(18*(this.threat||1));
    if(!p.screamImmune||p.screamImmune<=0){
     p.disorient=1.2;
     p.chill=Math.max(p.chill||0,2.0);
     p.screamImmune=4.0;
     this.emit('sirenScreamHit',{disorient:1.2});
    }
   }
   e.recover=.75;
  }
  else if(id==='siren-bolt'){
   this.shoot(a-.12,17,12,1,true,e,{kind:'tide'});
   this.shoot(a+.12,17,12,1,true,e,{kind:'tide'});
   e.recover=.55;
  }
  else if(id==='hulk-slam'){
   const growthMult=1+(e.growth||0)*0.1;
   this.enemyMelee(e,4.2,Math.round(28*growthMult),'impact');
   this.enemyZone(e.x,e.z,3.8,3.2,.25,'whirlpool');
   this.trauma=Math.min(1.2,(this.trauma||0)+.22*growthMult);
   e.recover=.8;
  }
  else if(id==='root-slam'){this.enemyMelee(e,4,30,'impact');}
  else if(id==='root-line'){for(let i=-1;i<=1;i++)this.shoot(a+i*.14,22,9,1,true,e,{kind:'root'});}
  else if(id==='brood-eggs'){for(let i=0;i<2+e.phase;i++)this.enemyZone(x+Math.sin(i*3)*2,z+Math.cos(i*3)*2,1.25,4,1.4,'egg');if(this.enemies.length<75)this.spawn('thornling',{x:e.x+1,z:e.z});}
  else if(id==='brood-web'){this.enemyZone(x,z,3.4,3,.45,'web');}
  else if(id==='hex-beams'){this.radial(e,6,22,8.5,e.age*.5);}
  else if(id==='hex-mark'){this.enemyZone(x,z,2.1,3,.8,'curse');}
  else if(id==='sentinel-counter'){e.guarding=1.4;this.enemyMelee(e,2.5,22,'shield');}
  else if(id==='sentinel-sweep'){this.enemyMelee(e,4.7,28,'slash');}
  else if(id==='shifter-lunge'){e.charge=.58;e.chargeAngle=a;e.chargeDamage=22;e.recover=.45;}
  else if(id==='shifter-burst'){this.enemyMelee(e,3.6,26,'impact');for(let i=-1;i<=1;i++)this.shoot(a+i*.22,18,9,1,true,e,{kind:'root'});e.recover=.75;}
  else if(id==='weaver-web'){
   this.zones.push({id:++this.id,x:e.x+Math.sin(a)*1.8,z:e.z+Math.cos(a)*1.8,life:12,maxLife:12,warn:.35,radius:2.4,enemy:true,kind:'tripwire'});
   const tripwires=this.zones.filter(z=>z.kind==='tripwire'&&z.life>0);
   if(tripwires.length>6){tripwires.sort((a,b)=>a.life-b.life);tripwires[0].life=0;this.zones=this.zones.filter(z=>z.life>0);}
   this.effect(e.x,e.z,0x365314,2.5,'pulse',.35);
   e.recover=.75;
  }
  else if(id==='weaver-spore'){this.shoot(a,16,10,1,true,e,{kind:'spore',explode:2.6});e.recover=.6;}
  else if(id==='abbot-rings'){this.radial(e,10+e.phase*4,24,7.5,e.phase*.17);}
  else if(id==='abbot-censers'){for(let i=0;i<2+e.phase;i++)this.enemyZone(x+Math.sin(i*2.4)*2.4,z+Math.cos(i*2.4)*2.4,1.7,3.6,.65,'burn');}
  else if(id==='abbot-flame-wall'){for(let i=-3;i<=3;i++)this.enemyZone(p.x+Math.cos(a)*i*1.7,p.z-Math.sin(a)*i*1.7,1.05,3,.85,'flame');}
  else if(id==='abbot-summon'){for(let i=0;i<Math.min(3,e.phase);i++)if(this.enemies.length<72)this.spawn('censer',{x:e.x+(i-1)*1.4,z:e.z+2});}
  else if(id==='warden-sweep'){this.enemyMelee(e,5.2,27,'anchor');}
  else if(id==='warden-tides'){for(let i=-2;i<=2;i++)this.shoot(a+i*.2,19,9,1,true,e,{kind:'tide'});}
  else if(id==='warden-chain'){this.shoot(a,22,15,1,true,e,{kind:'chain'});if(dist(e,p)<8){p.x-=Math.sin(a)*1.8;p.z-=Math.cos(a)*1.8;collide(p,.45);}}
  else if(id==='warden-whirlpool'){this.enemyZone(x,z,3.6,4,.9,'whirlpool');}
  else if(id==='regent-root-lines'){for(let i=-2;i<=2;i++)this.shoot(a+i*.18,20,8,1,true,e,{kind:'root'});}
  else if(id==='regent-seeds'){for(let i=0;i<3+e.phase;i++)this.enemyZone(x+Math.sin(i*2)*3,z+Math.cos(i*2)*3,1.4,4,1.2,'seed');}
  else if(id==='regent-maze'){for(let i=0;i<8;i++){const angle=i*Math.PI/4;this.enemyZone(p.x+Math.sin(angle)*5,p.z+Math.cos(angle)*5,1.5,4,1,'thorn');}}
  else if(id==='regent-brood'){for(let i=0;i<e.phase;i++)if(this.enemies.length<72)this.spawn(i%2?'stalker':'thornling',{x:e.x+i-1,z:e.z+2});}
  else if(id==='regent-collapse'){for(let i=0;i<6;i++){const angle=i*Math.PI/3;this.enemyZone(p.x+Math.sin(angle)*(2+i%2*3),p.z+Math.cos(angle)*(2+i%2*3),1.8,3,.75,'collapse');}}
  else this.enemyMelee(e,2,15);
 }
 computeSeparation(){
  const list=this.enemies,n=list.length,sx=new Float64Array(n),sz=new Float64Array(n);
  for(let i=0;i<n;i++){
   const e=list[i];if(e.hp<=0)continue;
   for(let j=i+1;j<n;j++){
    const o=list[j];if(o.hp<=0)continue;
    const minD=e.radius+o.radius+.2,dx=e.x-o.x,dz=e.z-o.z;
    if(Math.abs(dx)>=minD||Math.abs(dz)>=minD)continue;
    const d=Math.hypot(dx,dz);
    if(d<minD){
     const ang=((e.id%8)*Math.PI)/4,nx=d<1e-4?Math.sin(ang):dx/d,nz=d<1e-4?Math.cos(ang):dz/d;
     const force=((minD-d)/minD)*24,wE=o.boss?1.5:e.boss?.25:1,wO=e.boss?1.5:o.boss?.25:1;
     sx[i]+=nx*force*wE;sz[i]+=nz*force*wE;sx[j]-=nx*force*wO;sz[j]-=nz*force*wO;
    }
   }
  }
  return{sx,sz};
 }
 moveEnemySafe(e,dx,dz){
  const px=e.x,pz=e.z;
  e.x+=dx;e.z+=dz;collide(e,e.radius);
  if(!clearLine({x:px,z:pz},e,.08)){
   e.x=px+dx;e.z=pz;collide(e,e.radius);
   if(!clearLine({x:px,z:pz},e,.08)){
    e.x=px;e.z=pz+dz;collide(e,e.radius);
    if(!clearLine({x:px,z:pz},e,.08)){e.x=px;e.z=pz;collide(e,e.radius);}
   }
  }
 }
 update(dt,input={x:0,z:0}){if(this.state!=='playing')return;dt=Math.min(dt,.05)*(this.timeScale||1.0);this.time+=dt;if(!this.visitedRooms)this.visitedRooms=new Set([4]);const p=this.player,h=HEROES[this.hero];const prevX=this.lastX!==undefined?this.lastX:p.x,prevZ=this.lastZ!==undefined?this.lastZ:p.z;for(let step=0;step<=1;step+=0.25){const sx=prevX+(p.x-prevX)*step,sz=prevZ+(p.z-prevZ)*step;this.visitedRooms.add(this.roomFor(sx,sz));}this.lastX=p.x;this.lastZ=p.z;const newRoom=this.roomFor(p.x,p.z);if(newRoom!==this.currentRoom){const oldRoom=this.currentRoom;this.currentRoom=newRoom;this.emit('roomEnter',{from:oldRoom,to:newRoom,name:ROOMS[newRoom]?.name});}this.updateRoomEvents(dt);this.trauma=Math.min(1.2,Math.max(0,this.trauma-dt*1.5));this.navClock-=dt;if(this.navClock<=0){this.navigation.update(p);this.navClock=.2;}
  this.emberFlash=Math.max(0,(this.emberFlash||0)-dt);this.comboDecay=(this.comboDecay||0)-dt;if(this.comboDecay<=0&&this.comboScore>0){this.comboScore=Math.max(0,this.comboScore-dt*220);this.updateComboRank();}
  this.threat=1+(this.time/105)*0.55+this.cycle*0.35;this.updateDirector(dt);
  p.chill=Math.max(0,(p.chill||0)-dt);const chillSlow=p.chill>0?.65:1.0;
  p.disorient=Math.max(0,(p.disorient||0)-dt);p.screamImmune=Math.max(0,(p.screamImmune||0)-dt);const disorientSlow=p.disorient>0?.6:1.0;p.bountyRush=Math.max(0,(p.bountyRush||0)-dt);const rushSpeed=p.bountyRush>0?1.25:1.0;
  for(const k of ['invuln','dash','attack','cast','counter','ward','trail'])p[k]=Math.max(0,p[k]-dt);p.skills=p.skills.map(v=>Math.max(0,v-dt));p.ignition=Math.max(0,(p.ignition||0)-dt);p.tempest=Math.max(0,(p.tempest||0)-dt);p.stamina=Math.min(100,p.stamina+(p.staminaRate||23)*(1+(p.shared.stride||0)*.08)*(p.chill>0?.55:1.0)*dt);p.ult=Math.min(100,p.ult+dt*(1+p.ranks[2]*.12)*p.signatureRate);
  const n=Math.max(1,Math.hypot(input.x,input.z)),ix=input.x/n,iz=input.z/n;p.moving=!!(ix||iz);const pSpeed=p.speed*(p.tempest>0?1.35:1)*rushSpeed*chillSlow*disorientSlow;if(p.dash){p.vx=p.dx*pSpeed*3.2;p.vz=p.dz*pSpeed*3.2;}else{const targetX=ix*pSpeed,targetZ=iz*pSpeed,rate=p.moving?55:75;p.vx=approach(p.vx,targetX,rate*dt);p.vz=approach(p.vz,targetZ,rate*dt);if(p.moving&&!p.attack&&!p.cast){p.dx=ix;p.dz=iz;}}p.x+=p.vx*dt;p.z+=p.vz*dt;collide(p,.45);if(p.disorient>0){p.vx*=.94;p.vz*=.94;}if(p.trail>0&&Math.floor(this.time*10)!==Math.floor((this.time-dt)*10))this.zones.push({id:++this.id,x:p.x,z:p.z,life:2.2,warn:0,radius:1.25,enemy:false,kind:'burn'});
  const mutator=ASCENSIONS[this.ascensionModifier]||{};this.spawnTimer-=dt;if(this.spawnTimer<=0&&this.enemies.length<160){this.spawnTimer=Math.max(.16,.68-(this.time-this.regionStart)/190)*(this.modifier==='swarm'?.75:1)*(1-this.director.tier*.07)*(mutator.spawn||1)*Math.max(.65,1-this.cycle*.028);const regional=Object.values(MONSTERS).filter(e=>!e.boss&&e.region===this.biome),mixed=this.endless&&this.cycle>=2?Object.values(MONSTERS).filter(e=>!e.boss):regional,types=this.endless&&this.rng()<Math.min(.5,this.cycle*.08)?mixed:regional,unlocked=Math.min(types.length,2+Math.floor((this.time-this.regionStart)/14)+Math.floor(this.director.tier/2)+this.cycle);const packSize=Math.min(7,Math.max(2,Math.floor(2.0+Math.floor((this.time-this.regionStart)/22)+this.director.tier*.5)));for(let k=0;k<packSize;k++){if(this.enemies.length>=160)break;this.spawn(types[Math.floor(this.rng()*unlocked)].id);}}
  if(!this.bossSpawned&&this.time-this.regionStart>=155){this.bossSpawned=true;this.spawn(BOSSES[this.biome]);this.emit('boss',{name:MONSTERS[BOSSES[this.biome]].name});}
  const activeBoss=this.enemies.find(e=>e.boss&&e.hp>0);
  if(activeBoss&&activeBoss.phase>=2){
   if(activeBoss.type==='abbot'){
    if(this.ventTimer===undefined)this.ventTimer=3.0;
    this.ventTimer-=dt;
    if(this.ventTimer<=0){
     this.ventTimer=activeBoss.phase===3?2.5:3.4;
     const ventTiles=[[-2.4,-2.4],[2.4,-2.4],[-2.4,2.4],[2.4,2.4]];
     const v1=Math.floor(this.rng()*4),v2=(v1+1+Math.floor(this.rng()*3))%4;
     for(const vi of [v1,v2]){const [vx,vz]=ventTiles[vi];this.enemyZone(vx,vz,1.35,2.2,.75,'flame');}
    }
   }else if(activeBoss.type==='warden'){
    const dragDist=Math.hypot(p.x,p.z);
    if(dragDist>0.8&&dragDist<14){
     const pull=(activeBoss.phase===3?1.35:0.75)*dt;
     p.vx-=(p.x/dragDist)*pull*1.5;p.vz-=(p.z/dragDist)*pull*1.5;
     p.vx+=(-p.z/dragDist)*pull*1.0;p.vz+=(p.x/dragDist)*pull*1.0;
    }
   }else if(activeBoss.type==='regent'){
    const barrierR=activeBoss.phase===3?9.8:10.8,pDist=Math.hypot(p.x,p.z);
    if(pDist>barrierR){
     const pen=pDist-barrierR;
     p.x-=(p.x/pDist)*pen;p.z-=(p.z/pDist)*pen;
     p.vx*=.5;p.vz*=.5;
     this.hurt(12*dt*(this.threat||1));
     if(this.rng()<.2)this.effect(p.x,p.z,0x55aa22,1.2,'impact',.2);
    }
   }
  }
  p.fire-=dt;const rushRate=p.bountyRush>0?.72:1.0;const range=h.pattern==='cleave'?3.8:h.pattern==='wave'?(p.ranks[1]===3?8:6.0):15,target=this.smartTarget(range);if(target&&p.fire<=0){this.attack(target);p.fire=h.cooldown*(p.relics.quickwick?.85:1)*p.attackRate*rushRate;}
  let activeTelegraphs=this.enemies.filter(e=>e.windup>0).length;
  const sep=this.computeSeparation();
  for(let idx=0;idx<this.enemies.length;idx++){const e=this.enemies[idx];if(e.hp<=0)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.attack=Math.max(0,e.attack-dt);e.freeze=Math.max(0,e.freeze-dt);e.guarding=Math.max(0,(e.guarding||0)-dt);e.recover=Math.max(0,(e.recover||0)-dt);if(e.poison>0){e.poison-=dt;this.damage(e,(this.hero==='plague'?18:9)*(1+p.ranks[0]*.22)*dt,'status');}if(e.vx||e.vz){this.moveEnemySafe(e,e.vx*dt,e.vz*dt);e.vx=approach(e.vx,0,dt*32);e.vz=approach(e.vz,0,dt*32);}const d=dist(e,p),los=clearLine(e,p,.25);let a=los?Math.atan2(p.x-e.x,p.z-e.z):this.navigation.direction(e,p),slow=this.emberFlash>0?.38:1;
   e.teleportCooldown=Math.max(0,(e.teleportCooldown||0)-dt);if(e.type==='siren'&&e.hp>0&&e.windup<=0&&e.teleportCooldown<=0&&d<=3.4){let tp=false;for(let att=0;att<8;att++){const td=5.0+this.rng()*3.0,ta=Math.atan2(e.x-p.x,e.z-p.z)+(this.rng()-.5)*1.2,tx=e.x+Math.sin(ta)*td,tz=e.z+Math.cos(ta)*td;if(!solid(tx,tz,e.radius)&&clearLine({x:e.x,z:e.z},{x:tx,z:tz},.2)){this.effect(e.x,e.z,0x22eedd,2.2,'burst',.35);e.x=tx;e.z=tz;e.teleportCooldown=3.5;this.effect(e.x,e.z,0x22eedd,2.5,'burst',.4);this.emit('sirenTeleport',{id:e.id,x:e.x,z:e.z});tp=true;break;}}if(!tp)e.teleportCooldown=1.0;}
   if(e.type==='shifter'&&e.burrowed){e.unburrowTimer=(e.unburrowTimer||0)+dt;if(d<=3.2||e.unburrowTimer>=15.0){e.burrowed=false;this.effect(e.x,e.z,0x84cc16,2.8,'burst',.45);this.emit('shifterUnburrow',{id:e.id,x:e.x,z:e.z,triggeredByProximity:d<=3.2});if(d<=2.4){this.hurt(18*(this.threat||1));this.effect(p.x,p.z,0x55aa22,1.4,'impact',.25);}e.attackId='shifter-lunge';e.windup=.35;e.aim=Math.atan2(p.x-e.x,p.z-e.z);e.dx=Math.sin(e.aim);e.dz=Math.cos(e.aim);}}
  if(e.elite&&e.affix){
   if(e.affix==='molten'){
    e.trailTimer=(e.trailTimer||0)+dt;
    if(e.trailTimer>=.42&&(Math.hypot(e.vx||0,e.vz||0)>.04||d>1.5)){
     e.trailTimer=0;
     this.zones.push({id:++this.id,x:e.x,z:e.z,life:2.2,warn:0,radius:.9,enemy:true,kind:'flame'});
    }
   }else if(e.affix==='vortex'){
    e.affixTimer=(e.affixTimer||0)+dt;
    if(e.affixTimer>=3.5){
     e.affixTimer=0;
     this.effect(e.x,e.z,0xa855f7,8.5,'pulse',.5);
     this.emit('vortexPulse',{x:e.x,z:e.z,radius:8.5});
     const vdx=e.x-p.x,vdz=e.z-p.z,vdist=Math.hypot(vdx,vdz);
     if(vdist<=8.5&&vdist>.5&&p.dash<=0&&p.invuln<=0){
      const pullForce=Math.min(4.8,11.0/Math.max(1.0,vdist));
      p.vx+=(vdx/vdist)*pullForce;p.vz+=(vdz/vdist)*pullForce;
     }
    }
   }else if(e.affix==='frostbound'){
    e.affixTimer=(e.affixTimer||0)+dt;
    if(e.affixTimer>=3.2&&!e._frostWarn){
     e._frostWarn=true;
     this.effects.push({id:++this.id,ownerId:e.id,x:e.x,z:e.z,radius:4.2,life:.8,maxLife:.8,color:0x38bdf8,kind:'warning',attackId:'frost-nova'});
    }
    if(e.affixTimer>=4.0){
     e.affixTimer=0;e._frostWarn=false;
     this.effect(e.x,e.z,0x38bdf8,4.2,'nova',.45);
     this.emit('frostNova',{x:e.x,z:e.z,radius:4.2});
     const fdist=Math.hypot(e.x-p.x,e.z-p.z);
     if(fdist<=4.2&&p.dash<=0&&p.invuln<=0){
      this.hurt(18*(1+this.biome*.2)*(this.threat||1));
      p.chill=2.5;
     }
    }
   }else if(e.affix==='shielded'){
    e.barrierAngle=((e.barrierAngle||0)+dt*1.8)%(Math.PI*2);
   }
  }
  let speed=(e.burrowed?0:e.speed)*(1+this.director.tier*.035)*(e.freeze>0?.25:1)*(1+this.cycle*.025)*(mutator.speed||1)*slow*(e.affix==='avenger'?(1+(e.affixStacks||0)*.25):1);e.dx=Math.sin(a);e.dz=Math.cos(a);const nextPhase=e.boss?(e.hp/e.maxHp<.3?3:e.hp/e.maxHp<.65?2:1):1;if(e.boss&&nextPhase!==e.phase){e.phase=nextPhase;e.lastPhase=nextPhase;e.windup=0;e.cool=1.4;e.attackId=null;this.zones=this.zones.filter(z=>!z.enemy);this.bolts=this.bolts.filter(b=>!b.enemy);this.effects=this.effects.filter(f=>f.kind!=='warning');for(const other of this.enemies)if(!other.boss){other.windup=0;other.attackId=null;other.cool=Math.max(other.cool,1.4);}this.emit('bossPhase',{name:MONSTERS[e.type].name,phase:e.phase});this.effect(e.x,e.z,0xd9a35f,6,'phase',1.2);}else e.phase=nextPhase;e.cool-=dt;if(e.windup>0){e.windup-=dt;speed=0;if(e.windup<=0){const used=attacksFor(e).find(item=>item.id===e.attackId);this.enemyAttack(e);e.cool=(used?.cooldown||2.5)*(1-this.director.tier*.045)*(mutator.recovery||1)*Math.max(.72,1-this.cycle*.02)*(e.affix==='avenger'?(1/(1+(e.affixStacks||0)*.35)):1);}}else if(e.recover<=0&&e.cool<=0&&los&&(activeTelegraphs<Math.min(22,10+Math.floor(this.time/24))||e.boss)){const selected=this.chooseAttack(e);if(selected&&d<selected.range){this.beginEnemyAttack(e,selected);activeTelegraphs++;}}const selected=e.attackId&&attacksFor(e).find(item=>item.id===e.attackId),posture=selected||attacksFor(e)[0];if(los&&!e.boss&&e.windup<=0&&e.charge<=0&&d>1.15&&d<9.5){const slotAngle=(e.id%8)*(Math.PI/4),curAngle=Math.atan2(e.x-p.x,e.z-p.z);let diff=slotAngle-curAngle;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;const targetAngle=curAngle+clamp(diff,-Math.PI*.42,Math.PI*.42),surroundR=Math.max(posture?.stop?posture.stop*.85:.72,clamp(d*.55,.72,2.8)),tx=p.x+Math.sin(targetAngle)*surroundR,tz=p.z+Math.cos(targetAngle)*surroundR;if(!solid(tx,tz,e.radius*.8)&&clearLine(e,{x:tx,z:tz},.25))a=Math.atan2(tx-e.x,tz-e.z);}if(posture?.stop&&d<posture.stop&&los){if(e.attackId||e.windup>0)speed=0;else{speed*=.35;a+=Math.sin(e.age*2.5+e.id)*.8;}}if(d<e.radius+.38&&p.invuln<=0){const contactDmg=(e.boss?25:e.elite?(16*(1+(e.affixStacks||0)*.25)):9)*(this.threat||1);this.hurt(contactDmg);p.invuln=.28;this.effect(p.x,p.z,0xb8694b,.75,'impact',.2);}if(e.recover>0)speed*=.25;if(e.behavior==='swarm')a+=Math.sin(e.age*4+e.id)*.5;if(e.charge>0){e.charge-=dt;a=e.chargeAngle;speed*=e.boss?5:4.3;if(d<1.15){this.hurt((e.chargeDamage||20)*(this.threat||1));e.charge=0;}}let sepX=sep.sx[idx],sepZ=sep.sz[idx];if(e.charge>0){sepX*=.2;sepZ*=.2;}const sepMag=Math.hypot(sepX,sepZ);if(sepMag>7.5){const sc=7.5/sepMag;sepX*=sc;sepZ*=sc;}this.moveEnemySafe(e,(Math.sin(a)*speed+sepX)*dt,(Math.cos(a)*speed+sepZ)*dt);}
  for(const b of this.bolts){b.life-=dt;const previous={x:b.x,z:b.z};b.x+=b.vx*dt;b.z+=b.vz*dt;if(solid(b.x,b.z,.1)||!clearLine(previous,b,.08)){b.life=0;continue;}if(b.enemy){if(dist(b,p)<.6){this.hurt(b.damage*(this.threat||1));b.life=0;}}else{if(['spirit'].includes(b.kind)||p.ranks[1]===3){const nearest=this.nearest(b,4);if(nearest){const a=Math.atan2(nearest.x-b.x,nearest.z-b.z);b.vx=Math.sin(a)*20;b.vz=Math.cos(a)*20;}}for(const e of this.enemies)if(e.hp>0&&!b.hits.has(e.id)&&dist(e,b)<e.radius+.3){b.hits.add(e.id);this.damage(e,b.damage,b.source);if(this.hero==='cinder'||this.hero==='plague'||b.kind==='flame')e.poison=3;if(this.hero==='frost'||b.kind==='spear'||p.relics.frostSalt)e.freeze=Math.max(e.freeze,b.kind==='spear'?2.5:1.2);if(b.kind==='flask'||b.kind==='volatile'||b.kind==='spore')this.zones.push({id:++this.id,x:e.x,z:e.z,life:3,warn:0,radius:b.explode||2+p.ranks[1]*.3,enemy:b.kind==='spore',kind:b.kind==='volatile'?'miasma':'poison'});if(b.explode){this.effect(e.x,e.z,parseInt(h.color.slice(1),16),b.explode,'explosion',.55);for(const other of this.enemies)if(other!==e&&dist(other,e)<b.explode)this.damage(other,b.damage*.55,b.source);}if(p.ranks[0]===3){this.effect(e.x,e.z,parseInt(h.color.slice(1),16),2,'burst');for(const other of this.enemies)if(other!==e&&dist(other,e)<2&&clearLine(e,other))this.damage(other,b.damage*.35);}if(--b.pierce<=0){b.life=0;break;}}}}
  this.bolts=this.bolts.filter(b=>b.life>0);
  for(const zone of this.zones){zone.life-=dt;zone.warn-=dt;if(zone.follow){zone.x=p.x;zone.z=p.z;}if(zone.warn>0)continue;if(zone.enemy){if(dist(zone,p)<zone.radius){this.hurt((['collapse','whirlpool','flame'].includes(zone.kind)?19:zone.kind==='tripwire'?12:14)*(this.threat||1));if(['web','whirlpool'].includes(zone.kind)){p.vx*=.72;p.vz*=.72;}if(zone.kind==='tripwire'){p.vx*=.5;p.vz*=.5;p.chill=Math.max(p.chill||0,1.8);this.emit('tripwireTrigger',{id:zone.id});}}}else for(const e of this.enemies)if(dist(e,zone)<zone.radius&&clearLine(zone,e)){const rate=zone.kind==='burn'?18:zone.kind==='briar'?8:zone.kind==='miasma'?20:15;this.damage(e,rate*(1+p.ranks[0]*.22)*dt,'status');if(zone.kind==='briar')e.freeze=Math.max(e.freeze,.3);}}this.zones=this.zones.filter(z=>z.life>0);
  const deadEnemies=this.enemies.filter(e=>e.hp<=0);if(deadEnemies.length){
   const deadIds=new Set(deadEnemies.map(e=>e.id));
   this.effects=this.effects.filter(f=>!(f.kind==='warning'&&deadIds.has(f.ownerId)));
   const deadMinions=deadEnemies.filter(m=>!m.boss&&!m.elite);
   if(deadMinions.length){
    for(const minion of deadMinions){
     for(const champion of this.enemies){
      if(champion.hp>0&&champion.elite&&champion.affix==='avenger'&&dist(champion,minion)<=8.5){
       champion.affixStacks=Math.min(3,(champion.affixStacks||0)+1);
       this.effect(champion.x,champion.z,0xef4444,2.0+champion.affixStacks*.6,'pulse',.4);
       this.emit('avengerEnrage',{id:champion.id,stacks:champion.affixStacks});
      }
     }
    }
   }
  }
  let advance=false;for(const e of deadEnemies){this.kills++;this.streak++;this.maxStreak=Math.max(this.streak,this.maxStreak);if(e.elite)this.elites++;
   if(e.bountyTarget&&this.currentBounty&&!this.currentBounty.claimed){
    this.currentBounty.countCurrent++;
    if(this.currentBounty.countCurrent>=this.currentBounty.countNeeded){
     this.currentBounty.claimed=true;
     this.bountyClaimed++;
     this.gold+=this.currentBounty.rewardGold;
     this.earned+=this.currentBounty.rewardGold;
     p.bountyRush=14.0;
     this.effect(e.x,e.z,0xffd700,4.0,'ultimate',1.0);
     this.emit('bountyComplete',{
      targetType:this.currentBounty.targetType,
      targetName:this.currentBounty.targetName,
      targetAffix:this.currentBounty.targetAffix,
      gold:this.currentBounty.rewardGold,
      buff:this.currentBounty.rewardBuff,
      bountyClaimed:this.bountyClaimed
     });
     this.initBounty();
    }
   }
   p.ult=Math.min(100,p.ult+.5);const mult=this.comboMultiplier();this.drop('xp',e.x,e.z,e.xp*(e.elite?2.0:1.0)*h.soulYield*mult,e.elite?'rare':'common');if(e.elite)this.drop('crest',e.x,e.z,250,'epic');else if(this.rng()<.09){if(['censer','abbot','thrall','priest'].includes(e.type))this.drop('mote',e.x,e.z,15,'rare');else if(['hound','wraith','stalker','siren'].includes(e.type))this.drop('spark',e.x,e.z,15,'rare');else if(['shield','sentinel','golem','hulk'].includes(e.type))this.drop('aegis',e.x,e.z,15,'rare');else if(['spitter','brood','leech','shifter','weaver'].includes(e.type))this.drop('toxic',e.x,e.z,15,'rare');}if(this.rng()<p.goldChance){const baseGold=['golem','hulk','sentinel'].includes(e.type)?(e.elite?35:8):(e.elite?20:(2+(this.rng()<.4?1:0)));const goldVal=Math.max(2,Math.round(baseGold*(mutator.reward||1)));this.drop('gold',e.x+.3,e.z,goldVal,e.elite?'rare':'common');}if(this.rng()<.02)this.drop('potion',e.x,e.z,18,'rare');if(e.elite)this.drop('chest',e.x,e.z,0,'epic');if(p.relics.emberOil)this.zones.push({id:++this.id,x:e.x,z:e.z,life:2.5,warn:0,radius:1.5,enemy:false,kind:'burn'});const kx=e.x-p.x,kz=e.z-p.z,kd=Math.hypot(kx,kz)||1,impulse=e.boss?1.2:e.elite?2.2:3.0;this.corpses.push({...e,vx:(kx/kd)*impulse,vz:(kz/kd)*impulse,life:.75,maxLife:.75});const burstCol=['censer','abbot','thrall','hound','priest','golem'].includes(e.type)?0xff5511:['husk','warden','leech','wraith','siren','hulk'].includes(e.type)?0x22eedd:['brood','root','regent','thornling','spitter','shifter','weaver'].includes(e.type)?0x84cc16:0xd4af37;this.effect(e.x,e.z,burstCol,e.boss?3.8:e.elite?2.2:1.2,'impact',.4);this.emit('kill',{type:e.type,elite:e.elite,boss:e.boss,x:e.x,z:e.z});if(e.boss){this.bossKills++;const bounty=Math.round((45+this.cycle*15)*(mutator.reward||1));this.gold+=bounty;this.earned+=bounty;this.drop('bosscore',e.x,e.z,0,'legendary');this.drop('gold',e.x-.6,e.z,15,'rare');this.drop('gold',e.x+.6,e.z,15,'rare');this.drop('potion',e.x+.8,e.z,30,'epic');if(this.biome===2){if(this.ranked){this.state='victory';this.emit('end',{victory:true});}else{this.state='convergence';this.emit('convergence',{cycle:this.cycle});}}else advance=true;}}
  this.enemies=this.enemies.filter(e=>e.hp>0);if(advance){this.biome++;this.regionStart=this.time;this.bossSpawned=false;this.enemies=[];this.bolts=[];this.zones=[];p.revives=0;this.visitedRooms=new Set([4]);this.currentRoom=4;this.initRoomEvents();this.initBounty();this.emit('region',{name:REGIONS[this.biome].name});this.prepareMerchant();}
  for(const l of this.loot){l.age+=dt;if(l.y>0||l.vy>0){l.vy-=12*dt;l.y+=l.vy*dt;l.x+=l.vx*dt;l.z+=l.vz*dt;l.vx*=Math.pow(.08,dt);l.vz*=Math.pow(.08,dt);if(l.y<=0){l.y=0;if(Math.abs(l.vy)>1){l.vy=-l.vy*.32;}else l.vy=0;}}let d=dist(l,p);if(l.age>.28&&l.y<.15&&d<p.magnet)l.magnet=true;if(l.magnet&&clearLine(l,p)){const step=Math.min(d,dt*(9+l.age*1.5));l.x+=(p.x-l.x)/Math.max(.01,d)*step;l.z+=(p.z-l.z)/Math.max(.01,d)*step;l.y=approach(l.y,.55,dt*3);}if(dist(l,p)<.65){l.taken=true;if(l.kind==='xp')p.xp+=l.value;else if(l.kind==='potion')p.hp=Math.min(p.maxHp,p.hp+l.value);else if(l.kind==='mote'){p.xp+=l.value;p.ignition=5;this.effect(p.x,p.z,0xff7034,2.2,'burst',.4);this.emit('motePickup',{kind:'mote'});}else if(l.kind==='spark'){p.xp+=l.value;p.stamina=100;p.tempest=4;this.effect(p.x,p.z,0x6ae2ff,2.2,'pulse',.4);this.emit('motePickup',{kind:'spark'});}else if(l.kind==='aegis'){p.xp+=l.value;p.shield+=25;for(const o of this.loot)o.magnet=true;this.effect(p.x,p.z,0x80ffb0,4,'shield',.5);this.emit('motePickup',{kind:'aegis'});}else if(l.kind==='toxic'){p.xp+=l.value;this.zones.push({id:++this.id,x:p.x,z:p.z,life:3,warn:0,radius:3.5,enemy:false,kind:'miasma'});this.emit('motePickup',{kind:'toxic'});}else if(l.kind==='crest'){p.xp+=l.value;p.skills=[0,0];p.hp=Math.min(p.maxHp,p.hp+30);this.effect(p.x,p.z,0xffd700,5,'ultimate',.7);this.emit('motePickup',{kind:'crest'});}else if(l.kind==='chest'){const value=16+Math.floor(this.rng()*10);this.gold+=value;this.earned+=value;if(this.rng()<.25)p.hp=Math.min(p.maxHp,p.hp+25);this.emit('chest',{value});}else if(l.kind==='gold'){this.gold+=l.value;this.earned+=l.value;}this.effect(l.x,l.z,l.kind==='gold'?0xe0b65b:l.kind==='potion'?0xdc6b62:0xa9dbc8,1.5,'pickup',.35);this.emit('pickup',{kind:l.kind,value:l.value});}}
  this.loot=this.loot.filter(l=>!l.taken);if(p.level===1&&this.time>=50)p.xp=Math.max(p.xp,p.need);if(p.xp>=p.need&&this.state==='playing'){this.choices=upgradeOffers(this);if(this.choices.length){p.xp-=p.need;p.level++;p.need=p.level<=13?Math.round(75+Math.pow(p.level-1,1.35)*32):Math.min(1100,420+(p.level-13)*26);this.levelTimes.push(this.time);this.state='upgrade';this.emit('level');}}
  for(const e of [...this.effects,...this.corpses])e.life-=dt;this.effects=this.effects.filter(e=>e.life>0);this.corpses=this.corpses.filter(e=>e.life>0);
 }
 score(){return Math.floor(this.time)*35+this.kills*22+this.earned*14+this.cycle*7500+(this.state==='victory'?5000:0);}
}
