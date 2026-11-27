import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/rebuild/game.js';
import {HEROES,MONSTERS,BOSSES,upgradeOffers,branchEffect} from '../src/rebuild/roster.js';
import {readProgress,saveProgress,buyArmory,buyMastery,KEY,LEGACY_KEY} from '../src/rebuild/progress.js';
import {solid,clearLine,collide,Navigation} from '../src/rebuild/dungeon.js';
import {HERO_MODELS,MONSTER_MODELS,modelFor,actorPhase} from '../src/rebuild/model-catalog.js';
import {ACTIVE_SKILLS,RELICS,RITES,ASCENSIONS} from '../src/rebuild/content.js';
import {ENEMY_ATTACKS,BOSS_ATTACKS,attacksFor} from '../src/rebuild/combat-content.js';
const tick=(g,n=1)=>{for(let i=0;i<n;i++)g.update(1/60);};
test('complete roster contains eight heroes, eighteen monsters and three guardians',()=>{assert.equal(Object.keys(HEROES).length,8);assert.equal(Object.values(MONSTERS).filter(e=>!e.boss).length,18);assert.equal(BOSSES.length,3);assert.equal(new Set(Object.values(HEROES).map(h=>h.pattern)).size,8);});
test('every roster entry owns a real 3D model specification',()=>{assert.deepEqual(Object.keys(HERO_MODELS).sort(),Object.keys(HEROES).sort());assert.deepEqual(Object.keys(MONSTER_MODELS).sort(),Object.keys(MONSTERS).sort());for(const id of [...Object.keys(HEROES),...Object.keys(MONSTERS)]){const model=modelFor(id);assert(model,id);assert(['humanoid','winged','hound','swarm','mimic','spitter','wraith','spider'].includes(model.kind),id);assert(Number.isFinite(model.primary),id);assert(Number.isFinite(model.secondary),id);assert(model.scale>0,id);}});
test('string actor ids produce finite deterministic animation phases',()=>{assert(Number.isFinite(actorPhase('hero')));assert.equal(actorPhase('hero'),actorPhase('hero'));assert.notEqual(actorPhase('hero'),actorPhase('enemy'));});
test('hero projectiles leave from their weapon side instead of the body center',()=>{for(const hero of Object.keys(HEROES)){const g=new Game({hero});g.shoot(0,1);const bolt=g.bolts[0],side=HERO_MODELS[hero].shotSide||0;assert.equal(bolt.x,side,hero);assert.equal(bolt.z,.55,hero);}});
test('same seed and input produce identical encounters',()=>{const a=new Game({seed:91}),b=new Game({seed:91});tick(a,600);tick(b,600);assert.deepEqual(a.enemies,b.enemies);assert.deepEqual(a.loot,b.loot);});
test('pause and upgrade freeze simulation',()=>{for(const state of ['paused','upgrade']){const g=new Game();g.state=state;tick(g,60);assert.equal(g.time,0);}});
test('every hero branch has three applicable ranks and disappears at cap',()=>{for(const hero of Object.keys(HEROES)){const g=new Game({hero});for(let branch=0;branch<3;branch++){for(let rank=0;rank<3;rank++){g.state='upgrade';g.choices=[{id:`branch-${branch}`,branch}];assert(g.upgrade(`branch-${branch}`));assert.equal(g.player.ranks[branch],rank+1);assert(branchEffect(hero,branch,rank+1).length>10);}for(let i=0;i<10;i++)assert(!upgradeOffers(g).some(c=>c.branch===branch));}assert(!g.upgrade('branch-0'));}});
test('rank power affects actual damage and patterns affect actual attacks',()=>{for(const hero of Object.keys(HEROES)){const g=new Game({hero,seed:1});g.spawnTimer=999;const e=g.spawn('thrall',{x:0,z:2});e.hp=e.maxHp=10000;g.attack(e);const first=g.bolts.length+g.damageLog.weapon;g.bolts=[];g.damageLog.weapon=0;g.player.ranks=[3,3,0];g.attack(e);assert(g.bolts.length+g.damageLog.weapon>first,hero);}});
test('no passive level damage; only an offered upgrade can mutate ranks',()=>{const g=new Game();g.player.xp=g.player.need;tick(g);assert.equal(g.state,'upgrade');assert.equal(g.player.damage,1);assert.equal(g.player.level,2);assert(!g.upgrade('not-offered'));assert(g.upgrade(g.choices[0].id));});
test('the first meaningful build choice cannot be delayed beyond 50 seconds',()=>{for(const hero of Object.keys(HEROES)){const g=new Game({hero});g.spawnTimer=999;tick(g,50*60+1);assert.equal(g.state,'upgrade',hero);assert(g.levelTimes[0]>=49&&g.levelTimes[0]<=51,hero);}});
test('dodge costs stamina, respects pause, and defensive evolution pulses',()=>{const g=new Game();g.player.ranks[2]=3;const e=g.spawn('thrall',{x:0,z:2});assert(g.dash(1,0));assert.equal(g.player.stamina,66);assert(e.hp<e.maxHp);assert(!g.dash());g.state='paused';g.player.dash=0;assert(!g.dash());});
test('stationary dodge follows facing instead of smart-targeting danger',()=>{const g=new Game();g.spawnTimer=999;g.spawn('thrall',{x:-3,z:0});g.player.dx=1;g.player.dz=0;assert(g.dash());assert(g.player.vx>0);assert.equal(g.player.vz,0);});
test('all eighteen enemies own distinct readable attack profiles',()=>{assert.equal(Object.keys(ENEMY_ATTACKS).length,18);assert.equal(new Set(Object.values(ENEMY_ATTACKS).map(list=>list[0].id)).size,18);for(const id of Object.keys(ENEMY_ATTACKS)){const g=new Game({seed:1});g.spawnTimer=999;const e=g.spawn(id,{x:0,z:3}),profile=attacksFor(e)[0];assert(!solid(e.x,e.z,e.radius));assert(profile.windup>=.45,id);assert(profile.cooldown>=1.6,id);g.beginEnemyAttack(e,profile);assert.equal(e.attackId,profile.id);assert(g.events.some(event=>event.type==='enemyCue'));const before=g.bolts.length+g.zones.length+g.effects.length+g.enemies.length;g.enemyAttack(e);const after=g.bolts.length+g.zones.length+g.effects.length+g.enemies.length;assert(after>=before||e.charge>0||e.guarding>0,id);}});
test('each guardian has a different multi-pattern three-phase script',()=>{for(const id of BOSSES){const phases=BOSS_ATTACKS[id];assert.deepEqual(Object.keys(phases),['1','2','3']);assert(phases[1].length>=2);assert(phases[2].length>=3);assert(phases[3].length>=3);assert(new Set(Object.values(phases).flat().map(a=>a.id)).size>=4,id);}});
test('ranked guardians advance through merchants and finish after the third guardian',()=>{const g=new Game({ranked:true});g.player.level=2;for(let i=0;i<3;i++){g.time=g.regionStart+155;g.spawnTimer=999;tick(g);const e=g.enemies.find(e=>e.boss);assert.equal(e.type,BOSSES[i]);e.hp=e.maxHp*.2;tick(g);assert.equal(e.phase,3);e.hp=0;tick(g);assert.equal(g.bossKills,i+1);assert.equal(g.biome,Math.min(i+1,2));if(i<2){assert.equal(g.state,'merchant');assert.equal(g.merchantOffers.length,3);assert(g.skipMerchant());}}assert.equal(g.state,'victory');});
test('solo victory offers an endless ascension with rotating modifiers',()=>{const g=new Game({seed:10});g.biome=2;g.bossSpawned=true;const boss=g.spawn('regent',{x:0,z:2});boss.hp=0;tick(g);assert.equal(g.state,'convergence');assert(g.events.some(e=>e.type==='convergence'));assert(g.continueEndless());assert.equal(g.cycle,1);assert.equal(g.ascension,1);assert.equal(g.biome,0);assert(ASCENSIONS[g.ascensionModifier]);assert.equal(g.state,'merchant');assert(g.skipMerchant());const scaled=g.spawn('thrall',{x:0,z:3});assert(scaled.maxHp>MONSTERS.thrall.hp);});
test('a completed solo expedition can be claimed instead of continued',()=>{const g=new Game();g.state='convergence';assert(g.claimVictory());assert.equal(g.state,'victory');assert(g.events.some(e=>e.type==='end'&&e.victory));});
test('soul drops merge, bounce, magnetize, and keep health and currency distinct',()=>{const g=new Game();g.spawnTimer=999;g.drop('xp',0,0,3);g.drop('xp',.5,0,7);g.drop('potion',0,0,18);g.drop('gold',0,0,2);assert.equal(g.loot.length,3);assert.equal(g.loot[0].value,10);g.player.hp=50;tick(g,240);assert.equal(g.player.hp,68);assert.equal(g.gold,2);assert.equal(g.earned,2);assert.equal(g.player.xp,10);});
test('long fights compact common drops without losing their value',()=>{const g=new Game();g.spawnTimer=999;for(let i=0;i<400;i++)g.drop(i%2?'gold':'xp',i*2,0,1);assert(g.loot.length<=161);assert.equal(g.loot.filter(l=>l.kind==='xp').reduce((sum,l)=>sum+l.value,0),200);assert.equal(g.loot.filter(l=>l.kind==='gold').reduce((sum,l)=>sum+l.value,0),200);});
test('version four progression migrates v3, adds chronicle defaults, and preserves unrelated saves',()=>{const legacy={version:3,gold:999,runs:4,selected:'frost'},data=new Map([[LEGACY_KEY,JSON.stringify(legacy)],['soul_ember_fullscreen_v1',JSON.stringify({gold:9999,upgrades:{might:5}})]]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};const p=readProgress(storage);assert.equal(p.version,4);assert.equal(p.gold,999);assert.equal(p.selected,'frost');assert.equal(p.victories,0);assert.equal(p.bestAscension,0);assert.equal(p.armory.vitality,0);assert.deepEqual(p.audio,{master:.75,music:.55,sfx:.8,ambience:.5});saveProgress(p,storage);assert(data.has(KEY));assert.equal(JSON.parse(data.get('soul_ember_fullscreen_v1')).gold,9999);});
test('wall blocks targeting and moving bodies, doorway remains open',()=>{assert(!clearLine({x:8,z:6},{x:16,z:6}));assert(clearLine({x:0,z:8},{x:0,z:16}));const p={x:12,z:8};collide(p,.45);assert(!solid(p.x,p.z,.44));});
test('all signatures require a full charge and produce damage',()=>{for(const hero of Object.keys(HEROES)){const g=new Game({hero});assert(!g.ultimate());g.player.ult=100;g.spawn('root',{x:2,z:0});assert(g.ultimate());assert.equal(g.player.ult,0);assert(g.damageLog.signature>0);}});
test('all heroes expose two smart-target active skills with cooldowns',()=>{for(const hero of Object.keys(HEROES)){assert.equal(ACTIVE_SKILLS[hero].length,2);for(let slot=0;slot<2;slot++){const g=new Game({hero,seed:7});g.spawnTimer=999;const e=g.spawn('root',{x:0,z:4});e.hp=e.maxHp=100000;assert(g.useSkill(slot),`${hero} slot ${slot}`);assert(g.player.skills[slot]>0);assert(!g.useSkill(slot));tick(g,30);assert(Number.isFinite(g.player.x));assert(Number.isFinite(g.player.z));}}});
test('smart targeting prioritizes bosses, then dangerous windups and elites',()=>{const g=new Game();g.spawnTimer=999;const normal=g.spawn('thrall',{x:0,z:2}),elite=g.spawn('shield',{x:0,z:4}),boss=g.spawn('abbot',{x:0,z:8});elite.elite=true;normal.windup=1;assert.equal(g.smartTarget(16),boss);boss.hp=0;assert.equal(g.smartTarget(16),normal);normal.windup=0;assert.equal(g.smartTarget(16),elite);});
test('adaptive director raises pressure for dominance and grants distress grace',()=>{const g=new Game();g.spawnTimer=999;g.director.grace=0;g.kills=10;g.updateDirector(5);const first=g.director.tier;g.kills=20;g.updateDirector(5);assert(g.director.tier>first);const high=g.director.tier;g.player.hp=g.player.maxHp*.2;g.director.grace=8;g.updateDirector(5);assert(g.director.tier<high);});
test('movement accelerates responsively and decelerates without drift',()=>{const g=new Game();g.spawnTimer=999;g.update(1/60,{x:1,z:0});assert(g.player.vx>0&&g.player.vx<g.player.speed);tick(g,30);assert(g.player.vx<.01);});
test('armory and mastery purchases are capped and ignored by ranked runs',()=>{const p=readProgress({getItem:()=>null,setItem:()=>{}});p.gold=5000;assert(buyArmory(p,'vitality'));assert.equal(p.armory.vitality,1);assert(buyMastery(p,'cinder'));const normal=new Game({meta:p}),ranked=new Game({meta:p,ranked:true});assert(normal.player.maxHp>ranked.player.maxHp);assert(normal.player.damageMult>ranked.player.damageMult);});
test('merchant offers are deterministic and support relics plus repeatable endless rites',()=>{const a=new Game({seed:44}),b=new Game({seed:44});a.gold=b.gold=100;a.prepareMerchant();b.prepareMerchant();assert.deepEqual(a.merchantOffers,b.merchantOffers);const id=a.merchantOffers[0],cost=a.merchantCost(id);assert(RELICS[id]||RITES[id]);assert(a.buyMerchant(id));assert.equal(a.gold,100-cost);assert.equal(a.spent,cost);assert(a.player.relics[id]||a.player.rites[id]);assert.equal(a.state,'playing');assert(!a.buyMerchant(id));for(const relic of Object.keys(RELICS))a.player.relics[relic]=true;a.gold=1000;a.prepareMerchant();const rite=a.merchantOffers[0],firstCost=a.merchantCost(rite);assert(RITES[rite]);assert(a.buyMerchant(rite));a.prepareMerchant();assert(a.merchantCost(rite)>=firstCost+8);});
test('late-game echo blessings continue progression after core branches cap',()=>{const g=new Game();g.player.level=20;g.player.ranks=[3,3,3];g.player.shared.vitality=2;g.player.shared.stride=2;const offers=upgradeOffers(g);assert.equal(offers.length,3);assert(offers.every(o=>o.id.startsWith('ember')));const before=g.player.damageMult,might={id:'emberMight'};g.state='upgrade';g.choices=[might];assert(g.upgrade(might.id));assert(g.player.damageMult>before);});
test('score rewards earned gold even when a merchant spends it',()=>{const g=new Game();g.earned=50;g.gold=5;const score=g.score();g.gold=0;assert.equal(g.score(),score);});
test('3-hit combo advances step on attack and finisher deals empowered damage',()=>{const g=new Game({hero:'grave',seed:1});g.spawnTimer=999;const e=g.spawn('thrall',{x:0,z:2});e.hp=e.maxHp=10000;assert.equal(g.player.comboStep,0);g.attack(e);assert.equal(g.player.comboStep,1);g.attack(e);assert.equal(g.player.comboStep,2);g.attack(e);assert.equal(g.player.comboStep,0);assert(g.events.some(ev=>ev.type==='shoot'&&ev.step===2));});
test('perfect dodge triggers ember flash and primes finisher when dodging active windup',()=>{const g=new Game();g.spawnTimer=999;const e=g.spawn('thrall',{x:0,z:2});e.windup=0.15;assert(g.dash(0,1));assert(g.emberFlash>0);assert.equal(g.player.comboStep,2);assert(g.events.some(ev=>ev.type==='perfectDodge'));});
test('unique archetype drops grant buffs on pickup',()=>{const g=new Game();g.spawnTimer=999;g.drop('spark',0,0,15);g.drop('mote',.1,0,15);tick(g,240);assert(g.player.tempest>0);assert(g.player.ignition>0);});
test('guarding enemies take reduced damage until broken by finisher',()=>{const g=new Game({hero:'cinder'});g.spawnTimer=999;const e=g.spawn('shield',{x:0,z:3});e.hp=e.maxHp=500;e.guarding=2;const guardedDmg=g.damage(e,100,'weapon');assert(guardedDmg<60);assert(e.guarding>0);g.damage(e,50,'finisher');assert.equal(e.guarding,0);assert(e.freeze>0);assert(g.events.some(ev=>ev.type==='guardBreak'));});
test('combo meter advances rank with damage and multiplies xp',()=>{const g=new Game();assert.equal(g.comboRank,'D');assert.equal(g.comboMultiplier(),1);g.comboScore=1300;g.updateComboRank();assert.equal(g.comboRank,'S');assert.equal(g.comboMultiplier(),1.8);g.comboScore=2000;g.updateComboRank();assert.equal(g.comboRank,'SSS');assert.equal(g.comboMultiplier(),2.2);});

test('gamepad input handles deadzones, dpad fallback, right stick aim, and edge-triggered buttons',async()=>{
  const origWindow=globalThis.window,origDoc=globalThis.document;
  const navDesc=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const events=new Map();
  globalThis.window={
    addEventListener:(type,fn)=>events.set(type,fn),
    removeEventListener:()=>{}
  };
  globalThis.document={
    addEventListener:(type,fn)=>events.set(type,fn),
    querySelector:()=>null,
    querySelectorAll:()=>[]
  };
  let mockGamepads=[null];
  Object.defineProperty(globalThis,'navigator',{
    value:{ getGamepads:()=>mockGamepads },
    configurable:true,
    writable:true
  });

  const {Input}=await import('../src/rebuild/input.js');
  const actions=[];
  const input=new Input((act,val)=>actions.push({act,val}));

  // 1. Initial state without gamepad
  assert.equal(input.isGamepad,false);
  assert.deepEqual(input.vector(),{x:0,z:0});

  // 2. Analog stick within deadzone (<0.18) should yield 0
  mockGamepads=[{
    connected:true,
    axes:[0.10,0.10,0,0],
    buttons:Array(16).fill({pressed:false})
  }];
  let v=input.vector();
  assert.equal(v.x,0);
  assert.equal(v.z,0);

  // 3. Analog stick exceeding deadzone (>0.18) should produce scaled movement
  mockGamepads=[{
    connected:true,
    axes:[0.8,0.0,0,0],
    buttons:Array(16).fill({pressed:false})
  }];
  v=input.vector();
  assert(v.x>0.7);
  assert.equal(input.isGamepad,true);

  // 4. Right stick aim vector calculation (>0.22)
  mockGamepads=[{
    connected:true,
    axes:[0,0,0.6,-0.8],
    buttons:Array(16).fill({pressed:false})
  }];
  input.updateGamepad();
  assert(input.aimVector!==null);
  assert(Math.abs(input.aimVector.x-0.6)<0.01);
  assert(Math.abs(input.aimVector.z-(-0.8))<0.01);

  // 5. Edge-triggered button detection: Button 0 (A/Dodge)
  mockGamepads=[{
    connected:true,
    axes:[0,0,0,0],
    buttons:Array(16).fill(0).map((_,i)=>({pressed:i===0}))
  }];
  input.updateGamepad();
  assert(actions.some(a=>a.act==='dash'));
  assert(actions.some(a=>a.act==='choice'&&a.val===0));

  // 6. Holding the button next frame should NOT fire again
  const countBefore=actions.length;
  input.updateGamepad();
  assert.equal(actions.length,countBefore);

  // Clean up globals
  globalThis.window=origWindow;
  globalThis.document=origDoc;
  if(navDesc)Object.defineProperty(globalThis,'navigator',navDesc);
});

test('trauma strictly clamps to 1.2 on heavy damage accumulation and decays at 1.5x rate',()=>{
  const g=new Game();
  g.player.maxHp=10000;
  g.player.hp=10000;
  assert.equal(g.trauma,0);
  // Inflict multiple massive hits (>20% maxHp) without dying
  for(let i=0;i<4;i++){
    g.player.invuln=0;
    g.hurt(2200);
  }
  assert.equal(g.state,'playing');
  assert.equal(g.trauma,1.2,'trauma must strictly clamp to 1.2');
  const initial=g.trauma;
  g.update(0.04);
  assert(g.trauma<initial,'trauma must decay during update');
  assert(Math.abs(g.trauma-(initial-0.04*1.5))<0.01,'trauma decays at dt * 1.5');
  g.spawnTimer=999;
  g.enemies=[];
  for(let i=0;i<60;i++)g.update(0.04);
  assert.equal(g.trauma,0,'trauma clamped to zero, cannot be negative');
});

test('finisher strikes and guard breaks generate micro-hitstop triggers and trauma injection',()=>{
  const g=new Game({hero:'cinder'});
  g.spawnTimer=999;
  const e=g.spawn('shield',{x:0,z:2});
  e.hp=e.maxHp=500;
  e.guarding=2;
  const traumaBefore=g.trauma;
  g.damage(e,50,'finisher');
  assert.equal(e.guarding,0);
  assert(g.events.some(ev=>ev.type==='guardBreak'&&ev.x!==undefined));
  assert(g.events.some(ev=>ev.type==='damage'&&ev.crit&&ev.source==='finisher'));
  assert(g.trauma>traumaBefore,'finisher and guard break inject visceral trauma');
  assert(g.trauma<=1.2,'trauma remains capped under 1.2');
});

test('hurt events contain position coordinates for directional feedback',()=>{
  const g=new Game();
  g.player.x=5.5;
  g.player.z=8.2;
  g.hurt(12);
  const hurtEv=g.events.find(ev=>ev.type==='hurt');
  assert(hurtEv);
  assert.equal(hurtEv.x,5.5);
  assert.equal(hurtEv.z,8.2);
  assert.equal(hurtEv.amount,12);
});




