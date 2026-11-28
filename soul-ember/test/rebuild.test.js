import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/rebuild/game.js';
import {HEROES,MONSTERS,BOSSES,upgradeOffers,branchEffect} from '../src/rebuild/roster.js';
import {readProgress,saveProgress,buyArmory,buyMastery,KEY,LEGACY_KEY} from '../src/rebuild/progress.js';
import {solid,clearLine,collide,Navigation} from '../src/rebuild/dungeon.js';
import {HERO_MODELS,MONSTER_MODELS,modelFor,actorPhase} from '../src/rebuild/model-catalog.js';
import {ACTIVE_SKILLS,RELICS,RITES,ASCENSIONS,CHAMPION_AFFIXES,AFFIX_KEYS} from '../src/rebuild/content.js';
import {ENEMY_ATTACKS,BOSS_ATTACKS,attacksFor,TELEGRAPHS,telegraphFor} from '../src/rebuild/combat-content.js';
const tick=(g,n=1)=>{for(let i=0;i<n;i++)g.update(1/60);};
test('complete roster contains eight heroes, twenty-two monsters and three guardians',()=>{assert.equal(Object.keys(HEROES).length,8);assert.equal(Object.values(MONSTERS).filter(e=>!e.boss).length,22);assert.equal(BOSSES.length,3);assert.equal(new Set(Object.values(HEROES).map(h=>h.pattern)).size,8);});
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
test('all twenty-two enemies own distinct readable attack profiles',()=>{assert.equal(Object.keys(ENEMY_ATTACKS).length,22);assert.equal(new Set(Object.values(ENEMY_ATTACKS).map(list=>list[0].id)).size,22);for(const id of Object.keys(ENEMY_ATTACKS)){const g=new Game({seed:1});g.spawnTimer=999;const e=g.spawn(id,{x:0,z:3}),profile=attacksFor(e)[0];assert(!solid(e.x,e.z,e.radius));assert(profile.windup>=.45,id);assert(profile.cooldown>=1.6,id);g.beginEnemyAttack(e,profile);assert.equal(e.attackId,profile.id);assert(g.events.some(event=>event.type==='enemyCue'));const before=g.bolts.length+g.zones.length+g.effects.length+g.enemies.length;g.enemyAttack(e);const after=g.bolts.length+g.zones.length+g.effects.length+g.enemies.length;assert(after>=before||e.charge>0||e.guarding>0,id);}});
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

test('all 20 enemy and 3 boss attacks emit accurate shape-matched telegraph warnings',()=>{
  for(const [type,list] of Object.entries(ENEMY_ATTACKS)){
    for(const atk of list){
      const spec=TELEGRAPHS[atk.id];
      assert(spec,`Missing TELEGRAPHS entry for ${atk.id}`);
      const g=new Game({seed:42});
      g.spawnTimer=999;
      const e=g.spawn(type,{x:0,z:3});
      g.beginEnemyAttack(e,atk);
      const warn=g.effects.find(f=>f.kind==='warning'&&f.ownerId===e.id);
      assert(warn,`Missing warning effect for ${atk.id}`);
      assert.equal(warn.radius,spec.radius,`${atk.id} radius mismatch`);
      assert(['ring','cone','charge','dive'].includes(warn.shape),`${atk.id} invalid shape ${warn.shape}`);
      assert.equal(warn.life,atk.windup);
    }
  }
  for(const [bossType,phases] of Object.entries(BOSS_ATTACKS)){
    for(const phaseList of Object.values(phases)){
      for(const atk of phaseList){
        const spec=TELEGRAPHS[atk.id];
        assert(spec,`Missing boss TELEGRAPHS entry for ${bossType}:${atk.id}`);
        assert.equal(telegraphFor(atk).radius,spec.radius);
      }
    }
  }
});

test('orphaned warning decals are immediately purged when enemy dies during windup',()=>{
  const g=new Game({seed:12});
  g.spawnTimer=999;
  const e1=g.spawn('root',{x:0,z:3});
  const e2=g.spawn('hound',{x:3,z:0});
  g.beginEnemyAttack(e1,ENEMY_ATTACKS.root[0]);
  g.beginEnemyAttack(e2,ENEMY_ATTACKS.hound[0]);
  assert.equal(g.effects.filter(f=>f.kind==='warning').length,2);
  // Slay e1 directly via damage
  g.damage(e1,99999,'finisher');
  assert(!g.effects.some(f=>f.kind==='warning'&&f.ownerId===e1.id),'Slain enemy warning purged via damage()');
  assert(g.effects.some(f=>f.kind==='warning'&&f.ownerId===e2.id),'Surviving enemy warning kept');
  // Slay e2 by HP depletion before update loop
  e2.hp=0;
  g.update(1/60);
  assert(!g.effects.some(f=>f.kind==='warning'&&f.ownerId===e2.id),'Slain enemy warning purged via update()');
});

test('30 enemies fan out with soft-separation and encirclement arcs without clipping walls or stacking',()=>{
  const g=new Game({seed:77});
  g.spawnTimer=999;
  g.player.invuln=999;
  g.player.fire=999;
  // Spawn 30 enemies all initially stacked tightly on the east side
  for(let i=0;i<30;i++){
    const e=g.spawn('thrall',{x:5.5+(i%3)*0.1,z:-0.2+(Math.floor(i/10))*0.1});
    e.cool=99; // focus purely on locomotion & flocking
  }
  tick(g,240); // 4 seconds of active swarming
  assert.equal(g.enemies.length,30);
  // 1. Check no enemy overlapped onto the exact same center (pair distances kept separate)
  let overlappingPairs=0;
  for(let i=0;i<g.enemies.length;i++){
    const a=g.enemies[i];
    assert(!solid(a.x,a.z,a.radius*.85),`Enemy ${i} clipped inside solid geometry at (${a.x},${a.z})`);
    for(let j=i+1;j<g.enemies.length;j++){
      const b=g.enemies[j];
      if(Math.hypot(a.x-b.x,a.z-b.z)<0.65)overlappingPairs++;
    }
  }
  assert.equal(overlappingPairs,0,'Zero overlapping stacked pairs allowed after separation settles');
  // 2. Check dynamic surrounding encirclement across octants around player (0,0)
  const octants=new Set(g.enemies.map(e=>((Math.round(Math.atan2(e.x,e.z)/(Math.PI/4))%8)+8)%8));
  assert(octants.size>=6,`Expected enemies to encircle across >=6 octants, got ${octants.size}`);
});

test('dense pack flocking separation cannot force enemies through thin walls or chamber doorways',()=>{
  const g=new Game({seed:88});
  g.spawnTimer=999;
  g.player.invuln=999;
  g.player.fire=999;
  g.player.x=10.8;
  g.player.z=6.2;
  // Pack 20 enemies directly against the thin x=12 East wall
  for(let i=0;i<20;i++){
    const e=g.spawn('shield',{x:10.2-(i%4)*0.35,z:5.0+Math.floor(i/4)*0.4});
    e.cool=99;
  }
  tick(g,180);
  for(const e of g.enemies){
    assert(e.x<12.0,`Enemy tunneled through East wall! x=${e.x}`);
    assert(!solid(e.x,e.z,e.radius*.85),'Enemy trapped inside wall geometry');
  }
});

test('boss phase shift immediately purges all enemy hazard zones, enemy bolts, and active warning telegraphs',()=>{
  const g=new Game({seed:42});
  g.spawnTimer=999;
  const boss=g.spawn('abbot',{x:0,z:4});
  // Populate arena with enemy hazard zones (censer burns, flames, webs, seeds) and enemy bolts
  g.enemyZone(-2,2,2.5,5,0,'flame');
  g.enemyZone(2,-2,3.0,5,0,'whirlpool');
  g.enemyZone(0,0,2.0,5,0,'web');
  g.player.fire=999;
  // Hero zone should not be purged
  g.zones.push({id:++g.id,x:0,z:1,life:5,warn:0,radius:2,enemy:false,kind:'burn'});
  g.shoot(0,10,10,1,true,boss,{kind:'enemy'});
  g.shoot(0,10,10,1,false,g.player,{kind:'spirit'});
  g.effect(0,0,0xe0583c,2,'warning',1,{shape:'ring'});
  assert.equal(g.zones.filter(z=>z.enemy).length,3);
  assert.equal(g.bolts.filter(b=>b.enemy).length,1);
  assert.equal(g.effects.filter(f=>f.kind==='warning').length,1);

  // Trigger phase 2 transition
  boss.hp=boss.maxHp*0.55;
  tick(g);
  assert.equal(boss.phase,2);
  assert.equal(g.zones.filter(z=>z.enemy).length,0,'All enemy hazard zones must be purged on phase transition');
  assert.equal(g.zones.filter(z=>!z.enemy).length,1,'Player ground zones must remain intact');
  assert.equal(g.bolts.filter(b=>b.enemy).length,0,'All enemy bolts must be purged on phase transition');
  assert.equal(g.bolts.filter(b=>!b.enemy).length,1,'Player projectiles must remain intact');
  assert.equal(g.effects.filter(f=>f.kind==='warning').length,0,'All warning telegraphs must be purged');
  assert(g.events.some(e=>e.type==='bossPhase'&&e.phase===2));
});

test('Abbot of Ash phase 2/3 activates periodic inner sanctuary flame vents',()=>{
  const g=new Game({seed:101});
  g.biome=0;
  g.spawnTimer=999;
  const boss=g.spawn('abbot',{x:0,z:4});
  boss.hp=boss.maxHp*0.5; // Phase 2
  tick(g);
  assert.equal(boss.phase,2);
  g.ventTimer=0; // trigger vent
  tick(g);
  const ventZones=g.zones.filter(z=>z.enemy&&z.kind==='flame');
  assert.equal(ventZones.length,2,'Abbot phase 2 must spawn 2 dais flame vents');
  assert(ventZones.every(z=>Math.abs(Math.abs(z.x)-2.4)<0.01&&Math.abs(Math.abs(z.z)-2.4)<0.01));
});

test('Drowned Warden phase 2/3 applies ambient whirlpool current drag in flooded cathedral',()=>{
  const g=new Game({seed:102});
  g.biome=1;
  g.spawnTimer=999;
  const boss=g.spawn('warden',{x:0,z:5});
  boss.hp=boss.maxHp*0.5; // Phase 2
  tick(g);
  assert.equal(boss.phase,2);
  g.player.x=3.5;
  g.player.z=3.5;
  g.player.vx=0;
  g.player.vz=0;
  tick(g);
  // Current must apply gentle inward pull (-x, -z) and rotational spin
  assert(g.player.vx!==0||g.player.vz!==0,'Whirlpool currents must apply physical velocity drag to player');
  assert(g.player.vx<0,'Player pulled inward along x toward center');
  assert(g.player.vz<0,'Player pulled inward along z toward center');
});

test('Thornbound Regent phase 2/3 constricts perimeter combat arena with briar root barrier',()=>{
  const g=new Game({seed:103});
  g.biome=2;
  g.spawnTimer=999;
  const boss=g.spawn('regent',{x:0,z:3});
  boss.hp=boss.maxHp*0.25; // Phase 3
  tick(g);
  assert.equal(boss.phase,3);
  // Try placing player beyond the Phase 3 barrier radius (r > 9.8m)
  g.player.x=11.0;
  g.player.z=0;
  g.player.vx=5.0;
  const prevHp=g.player.hp;
  tick(g);
  assert(g.player.x<=9.85,`Player constricted by briar barrier! x=${g.player.x}`);
  assert(g.player.hp<prevHp,'Stepping against briar root barrier inflicts perimeter thorn damage');
});

test('dynamic resolution scaling (DRS) steps down on sluggish frames and recovers on fast frames',async()=>{
  const {Scene}=await import('../src/rebuild/scene.js');
  const mockScene={
    renderer:{pixelRatio:1.5,setPixelRatio(v){this.pixelRatio=v;}},
    mobile:false,
    maxDpr:1.5,
    minDpr:1.0,
    currentDpr:1.5,
    slowFrameStreak:0,
    fastFrameStreak:0,
    stepDpr:Scene.prototype.stepDpr,
    getDpr:Scene.prototype.getDpr,
    updateDrs:Scene.prototype.updateDrs
  };

  // 1. Initial DPR starts at maxDpr (1.5)
  assert.equal(mockScene.getDpr(),1.5);

  // 2. Sluggish frame (20ms > 18.5ms threshold) for 2 frames should NOT step down yet
  mockScene.updateDrs(0.020);
  assert.equal(mockScene.slowFrameStreak,1);
  assert.equal(mockScene.getDpr(),1.5);
  mockScene.updateDrs(0.020);
  assert.equal(mockScene.slowFrameStreak,2);
  assert.equal(mockScene.getDpr(),1.5);

  // 3. 3rd consecutive sluggish frame triggers step down (-0.15) to 1.35
  mockScene.updateDrs(0.020);
  assert.equal(mockScene.slowFrameStreak,0);
  assert.equal(mockScene.getDpr(),1.35);
  assert.equal(mockScene.renderer.pixelRatio,1.35);

  // 4. Continue sluggish frames down to minDpr (1.0)
  for(let i=0;i<3;i++)mockScene.updateDrs(0.022);
  assert.equal(mockScene.getDpr(),1.20);
  for(let i=0;i<3;i++)mockScene.updateDrs(0.022);
  assert.equal(mockScene.getDpr(),1.05);
  for(let i=0;i<3;i++)mockScene.updateDrs(0.022);
  assert.equal(mockScene.getDpr(),1.00);

  // 5. Sluggish frames cannot breach minDpr floor
  for(let i=0;i<6;i++)mockScene.updateDrs(0.025);
  assert.equal(mockScene.getDpr(),1.00,'DRS must strictly clamp at minDpr floor');

  // 6. Fast frames (12ms < 14.5ms) for 59 frames should NOT step up yet
  for(let i=0;i<59;i++)mockScene.updateDrs(0.012);
  assert.equal(mockScene.fastFrameStreak,59);
  assert.equal(mockScene.getDpr(),1.00);

  // 7. 60th consecutive fast frame steps resolution back up (+0.10) to 1.10
  mockScene.updateDrs(0.012);
  assert.equal(mockScene.fastFrameStreak,0);
  assert.equal(mockScene.getDpr(),1.10);
  assert.equal(mockScene.renderer.pixelRatio,1.10);

  // 8. Normal frame (16.6ms) resets recovery streak
  for(let i=0;i<30;i++)mockScene.updateDrs(0.012);
  assert.equal(mockScene.fastFrameStreak,30);
  mockScene.updateDrs(0.0166);
  assert.equal(mockScene.fastFrameStreak,0);
  assert.equal(mockScene.slowFrameStreak,0);

  // 9. Mobile floor supports 0.85 minDpr
  const mobileScene={
    renderer:{pixelRatio:1.25,setPixelRatio(v){this.pixelRatio=v;}},
    mobile:true,
    maxDpr:1.25,
    minDpr:0.85,
    currentDpr:1.25,
    slowFrameStreak:0,
    fastFrameStreak:0,
    stepDpr:Scene.prototype.stepDpr,
    getDpr:Scene.prototype.getDpr,
    updateDrs:Scene.prototype.updateDrs
  };
  for(let i=0;i<12;i++)mobileScene.updateDrs(0.025);
  assert.equal(mobileScene.getDpr(),0.85,'Mobile DRS must clamp smoothly at 0.85');
});

test('virtual touch joystick handles deadzones, throw curve, recentering, and multi-touch isolation',async()=>{
  const {Input}=await import('../src/rebuild/input.js');

  // 1. Pure zero displacement
  const zero=Input.processStickVector(0,0,48,0.15);
  assert.equal(zero.magnitude,0);
  assert.equal(zero.x,0);
  assert.equal(zero.z,0);

  // 2. Inner deadzone threshold (<= 7.2px on 48px radius)
  const deadInner=Input.processStickVector(3,4,48,0.15); // hypot = 5px <= 7.2px
  assert.equal(deadInner.magnitude,0);
  assert.equal(deadInner.x,0);
  assert.equal(deadInner.z,0);

  // 3. Active throw with normalized quadratic curve
  const mid=Input.processStickVector(0,24,48,0.15); // 24px throw along Z
  assert(mid.magnitude>0&&mid.magnitude<1.0);
  assert.equal(mid.x,0);
  assert(mid.z>0);

  // 4. Maximum throw clamping at 48px
  const full=Input.processStickVector(48,0,48,0.15);
  assert.equal(full.magnitude,1.0);
  assert.equal(full.x,1.0);
  assert.equal(full.z,0);
  assert.equal(full.clampedDist,48);

  // 5. Over-throw clamping (96px displacement)
  const over=Input.processStickVector(-80,60,48,0.15); // hypot = 100px
  assert.equal(over.magnitude,1.0);
  assert.equal(over.clampedDist,48);
  assert(Math.abs(Math.hypot(over.x,over.z)-1.0)<0.001);

  // 6. Recenter origin & multi-touch lifecycle isolation
  const origWindow=globalThis.window,origDoc=globalThis.document;
  const winEvents=new Map(),docEvents=new Map();
  const mockPad={
    style:{left:'',top:'',bottom:'',transform:''},
    classList:{
      classes:new Set(),
      add(c){this.classes.add(c);},
      remove(c){this.classes.delete(c);},
      contains(c){return this.classes.has(c);}
    },
    firstElementChild:{style:{transform:''}},
    contains:()=>false,
    setPointerCapture:()=>{},
    addEventListener:()=>{}
  };

  globalThis.window={
    innerWidth:390,
    innerHeight:844,
    addEventListener:(type,fn)=>winEvents.set(type,fn),
    removeEventListener:()=>{}
  };
  globalThis.document={
    querySelector:(sel)=>sel==='#stick'?mockPad:null,
    querySelectorAll:()=>[],
    addEventListener:(type,fn)=>docEvents.set(type,fn)
  };

  const actionLog=[];
  const input=new Input((act,val)=>actionLog.push({act,val}));
  const onPointerDown=winEvents.get('pointerdown');
  const onPointerMove=winEvents.get('pointermove');
  const onPointerUp=winEvents.get('pointerup');

  // Simulate left-thumb touch at (100, 600) in mobile viewport
  onPointerDown({
    pointerId:1,
    clientX:100,
    clientY:600,
    target:{closest:()=>null}
  });

  assert.equal(input.stickPointerId,1);
  assert.deepEqual(input.stickOrigin,{x:100,y:600});
  assert.equal(mockPad.style.left,'100px');
  assert.equal(mockPad.style.top,'600px');
  assert(mockPad.classList.contains('active'));

  // Move thumb 36px upwards (forward locomotion)
  onPointerMove({
    pointerId:1,
    clientX:100,
    clientY:564
  });
  assert(input.touch.z<0,'Moving thumb upward yields negative Z forward motion');
  assert.equal(input.touch.x,0);

  // Multi-touch isolation: finger 2 taps combat action button (e.g. dash or skill) on right side (clientX = 320)
  onPointerDown({
    pointerId:2,
    clientX:320,
    clientY:650,
    target:{closest:(sel)=>sel.includes('button')?{}:null}
  });
  // Active joystick pointer MUST remain finger 1!
  assert.equal(input.stickPointerId,1);
  assert(input.touch.z<0,'Active joystick vector is preserved during right-hand multi-touch tap');

  // Finger 2 releases: joystick remains uninterrupted
  onPointerUp({pointerId:2});
  assert.equal(input.stickPointerId,1);
  assert(input.touch.z<0);

  // Finger 1 releases: joystick resets cleanly
  onPointerUp({pointerId:1});
  assert.equal(input.stickPointerId,null);
  assert.deepEqual(input.touch,{x:0,z:0});
  assert(!mockPad.classList.contains('active'));
  assert.equal(mockPad.style.left,'');

  // Restore globals
  globalThis.window=origWindow;
  globalThis.document=origDoc;
});

test('champion affixes registry defines all 5 affixes with distinct color identifiers',()=>{
  assert.equal(AFFIX_KEYS.length,5);
  for(const key of ['molten','vortex','frostbound','shielded','avenger']){
    const affix=CHAMPION_AFFIXES[key];
    assert(affix,`Affix ${key} must exist`);
    assert.equal(affix.id,key);
    assert(affix.name&&affix.name.length>0);
    assert(Number.isFinite(affix.color));
    assert(affix.desc&&affix.desc.length>0);
  }
});

test('molten elite champion drops burning flame zones along its movement path',()=>{
  const g=new Game({seed:201});
  g.spawnTimer=999;
  const elite=g.spawn('thrall',{x:0,z:5},{elite:true,affix:'molten'});
  assert.equal(elite.affix,'molten');
  assert.equal(elite.elite,true);
  elite.vx=1.5;
  elite.vz=0;
  tick(g,30); // 0.5s movement
  const flameZones=g.zones.filter(z=>z.enemy&&z.kind==='flame');
  assert(flameZones.length>=1,'Molten elite must deposit burning flame zones while moving');
});

test('vortex elite champion pulls player with gravity pulses and respects dash invulnerability',()=>{
  const g=new Game({seed:202});
  g.spawnTimer=999;
  const elite=g.spawn('thrall',{x:0,z:4},{elite:true,affix:'vortex'});
  assert.equal(elite.affix,'vortex');
  g.player.x=0;g.player.z=0;
  g.player.vx=0;g.player.vz=0;

  // Advance to vortex pulse trigger (3.5s = 210 ticks)
  elite.affixTimer=3.48;
  tick(g,2);
  assert(g.player.vz>0,'Player must be pulled inward along +Z toward vortex champion');
  assert(g.events.some(e=>e.type==='vortexPulse'));

  // When player is dashing (invulnerable), vortex pull MUST be ignored
  elite.x=4;elite.z=0;
  g.player.x=0;g.player.z=0;
  g.player.dx=0;g.player.dz=1;
  g.player.vx=0;g.player.vz=0;
  g.player.dash=0.25;
  g.player.invuln=0.25;
  elite.affixTimer=3.48;
  tick(g,2);
  assert.equal(g.player.vx,0,'Dash invulnerability prevents vortex gravity pull X');
});

test('frostbound elite champion casts telegraphed nova that damages and chills player unless dodging',()=>{
  const g=new Game({seed:203});
  g.spawnTimer=999;
  const elite=g.spawn('thrall',{x:0,z:2.5},{elite:true,affix:'frostbound'});
  g.player.x=0;g.player.z=0;

  // Advance to warning telegraph (3.2s)
  elite.affixTimer=3.18;
  tick(g,2);
  assert(g.effects.some(f=>f.kind==='warning'&&f.attackId==='frost-nova'),'Frostbound must emit warning telegraph before burst');

  // Advance to burst (4.0s)
  elite.affixTimer=3.98;
  const prevHp=g.player.hp;
  tick(g,2);
  assert(g.player.hp<prevHp,'Frostbound nova damages unshielded player within 4.2m');
  assert(g.player.chill>0,'Frostbound nova inflicts chill status on player');
  assert(g.events.some(e=>e.type==='frostNova'));

  // Test player dodging evades damage and chill
  g.player.chill=0;
  const hpBeforeDodge=g.player.hp;
  g.player.dash=0.25;
  g.player.invuln=0.25;
  elite.affixTimer=3.98;
  tick(g,2);
  assert.equal(g.player.hp,hpBeforeDodge,'Player in active dash evades frost nova damage');
  assert.equal(g.player.chill,0,'Player in active dash evades frost nova chill');
});

test('shielded elite champion deflects frontal attacks with rotating barrier but takes full flanked damage',()=>{
  const g=new Game({seed:204});
  g.spawnTimer=999;
  // Place shielded champion at (0, 4) with barrierAngle = 0 (facing +Z toward positive axis)
  const elite=g.spawn('shield',{x:0,z:4},{elite:true,affix:'shielded'});
  elite.hp=elite.maxHp=1000;
  elite.barrierAngle=0; // barrier faces +Z (from (0,4) towards (0,>4))

  // 1. Frontal strike: Player is at (0, 8), looking down towards champion at (0, 4) -> incoming angle from +Z
  g.player.x=0;
  g.player.z=8;
  const frontalDmg=g.damage(elite,100,'weapon');
  assert(frontalDmg<20,`Frontal strike must be heavily deflected! actual=${frontalDmg}`);
  assert(g.events.some(e=>e.type==='shieldDeflect'),'Frontal strike must trigger shieldDeflect event');

  // 2. Flanked strike from behind: Player is at (0, 0), attacking from -Z opposite barrier angle
  g.player.x=0;
  g.player.z=0;
  const flankedDmg=g.damage(elite,100,'weapon');
  assert(flankedDmg>50,`Flanked attack from behind barrier must deal full damage! actual=${flankedDmg}`);
});

test('avenger elite champion enrages on nearby minion deaths gaining stacking speed, damage, and CDR',()=>{
  const g=new Game({seed:205});
  g.spawnTimer=999;
  const avenger=g.spawn('thrall',{x:0,z:0},{elite:true,affix:'avenger'});
  assert.equal(avenger.affixStacks,0);
  const baseSpeed=avenger.speed;

  // Spawn nearby minion within 8m and kill it
  const minion1=g.spawn('thrall',{x:2,z:2});
  minion1.hp=0;
  tick(g);
  assert.equal(avenger.affixStacks,1,'Avenger gains 1 stack on nearby minion death');
  assert(g.events.some(e=>e.type==='avengerEnrage'&&e.stacks===1));

  // Spawn and kill two more minions to hit cap (3 stacks)
  const minion2=g.spawn('thrall',{x:-2,z:1});
  const minion3=g.spawn('thrall',{x:1,z:-2});
  minion2.hp=0;minion3.hp=0;
  tick(g);
  assert.equal(avenger.affixStacks,3,'Avenger caps at 3 stacks');

  // Spawn distant minion beyond 8.5m and kill it
  const distantMinion=g.spawn('thrall',{x:15,z:15});
  distantMinion.hp=0;
  tick(g);
  assert.equal(avenger.affixStacks,3,'Distant minion death does not exceed stack cap or trigger outside radius');
});

test('obsidian golem deflects frontal auto-attacks and executes earthquake ground pound',()=>{
  const g=new Game({seed:301});
  g.spawnTimer=999;
  const golem=g.spawn('golem',{x:0,z:3});
  assert.equal(golem.type,'golem');
  assert.equal(golem.hp,380);
  assert.equal(golem.radius,0.65);

  // Golem is at (0, 3) facing -Z (toward player at 0, 0)
  golem.dx=0;golem.dz=-1;g.player.x=0;g.player.z=0;
  // Frontal weapon auto-attack is deflected
  const frontalDmg=g.damage(golem,100,'weapon');
  assert(frontalDmg<15,`Frontal auto-attack must be heavily deflected, got ${frontalDmg}`);
  assert(g.events.some(e=>e.type==='golemDeflect'));

  // Attack from rear: player moves to (0, 6) behind golem
  g.player.x=0;g.player.z=6;
  const rearDmg=g.damage(golem,100,'weapon');
  assert(rearDmg>50,`Rear attack from behind golem deals full unmitigated damage, got ${rearDmg}`);

  // Skill/finisher attacks bypass frontal deflection
  g.player.x=0;g.player.z=0;
  const skillDmg=g.damage(golem,100,'skill');
  assert(skillDmg>50,`Skill attacks bypass frontal armor, got ${skillDmg}`);

  // Execute earthquake ground pound (golem-slam)
  const attack=attacksFor(golem)[0];
  assert.equal(attack.id,'golem-slam');
  g.beginEnemyAttack(golem,attack);
  assert.equal(golem.attackId,'golem-slam');
  g.enemyAttack(golem);
  assert(g.trauma>0,'Golem slam injects screen trauma');
  assert(g.zones.some(z=>z.kind==='collapse'),'Golem slam creates ground collapse zone');
  assert(g.bolts.some(b=>b.enemy),'Golem slam emits radial seismic bolts');
});

test('pyre priest heals nearby wounded allies with golden channel and lobs homing flame wisps',()=>{
  const g=new Game({seed:302});
  g.spawnTimer=999;
  const priest=g.spawn('priest',{x:0,z:0});
  assert.equal(priest.type,'priest');
  assert.equal(priest.hp,110);

  // Spawn wounded ally
  const wounded=g.spawn('thrall',{x:2,z:1});
  wounded.hp=10;wounded.maxHp=42;
  priest.attackId='priest-heal';
  g.enemyAttack(priest);
  assert(wounded.hp>10,'Priest heal restores HP to lowest ally');
  assert(g.events.some(e=>e.type==='priestHeal'&&e.target===wounded.id));

  // Priest lobs homing fire wisps
  priest.attackId='priest-wisp';
  g.player.x=0;g.player.z=5;
  g.enemyAttack(priest);
  assert(g.bolts.some(b=>b.kind==='flame'),'Priest shoots flame wisp projectiles');
  assert(g.zones.some(z=>z.kind==='burn'),'Priest creates burn zone');
});

test('ashen cathedral biome spawns obsidian golem and pyre priest in regional pool',()=>{
  assert.equal(MONSTERS.golem.region,0);
  assert.equal(MONSTERS.priest.region,0);
  const regional=Object.values(MONSTERS).filter(e=>!e.boss&&e.region===0);
  assert.equal(regional.length,8);
  assert(regional.some(e=>e.id==='golem'));
  assert(regional.some(e=>e.id==='priest'));
});

test('abyssal siren escapes player proximity via water burst teleport and respects 3.5s cooldown',()=>{
  const g=new Game({seed:401});
  g.spawnTimer=999;
  const siren=g.spawn('siren',{x:0,z:2});
  assert.equal(siren.type,'siren');
  assert.equal(siren.hp,135);
  g.player.x=0;g.player.z=0;
  // Siren is at z=2, dist=2 <= 3.4m -> triggers teleport escape
  tick(g,1);
  assert(siren.teleportCooldown>0,'Teleport cooldown engaged');
  assert(g.events.some(e=>e.type==='sirenTeleport'&&e.id===siren.id),'Siren teleport event emitted');
  assert(!solid(siren.x,siren.z,siren.radius),'Siren teleport destination is inside valid non-solid boundaries');
  const initialDist=Math.hypot(siren.x-g.player.x,siren.z-g.player.z);
  assert(initialDist>=3.5,'Siren safely escaped player proximity');
});

test('siren scream applies disorient, chill, and 4.0s immunity grace to prevent stun lock',()=>{
  const g=new Game({seed:402});
  g.spawnTimer=999;
  const siren=g.spawn('siren',{x:0,z:3});
  g.player.x=0;g.player.z=0;
  siren.attackId='siren-scream';
  g.enemyAttack(siren);
  assert.equal(g.player.disorient,1.2,'Player disoriented by sonic wave');
  assert(g.player.chill>=2.0,'Player chilled by aquatic sonic wave');
  assert.equal(g.player.screamImmune,4.0,'4-second scream immunity grace applied');
  assert(g.events.some(e=>e.type==='sirenScreamHit'));

  // Immediate second scream hit is absorbed by immunity grace
  g.player.disorient=0;
  g.enemyAttack(siren);
  assert.equal(g.player.disorient,0,'Scream immunity grace prevents consecutive stun-lock');
});

test('barnacle hulk absorbs light attacks to gain growth stacks, while finisher ruptures and staggers',()=>{
  const g=new Game({seed:403});
  g.spawnTimer=999;
  const hulk=g.spawn('hulk',{x:0,z:3});
  assert.equal(hulk.type,'hulk');
  assert.equal(hulk.hp,420);
  assert.equal(hulk.radius,0.65);

  // Light weapon attack absorbs 45% damage (takes 55%) and adds growth stack
  g.damage(hulk,20,'weapon');
  assert.equal(hulk.hp,409,'Absorbed 45% damage from normal hit');
  assert.equal(hulk.growth,1,'Growth stack increased');

  // Max stack clamp at 8
  for(let i=0;i<10;i++)g.damage(hulk,10,'weapon');
  assert.equal(hulk.growth,8,'Growth stack clamped at 8');

  // Heavy finisher ruptures growth, dealing 1.5x empowered damage and staggering
  const hpBefore=hulk.hp;
  g.damage(hulk,40,'finisher');
  assert.equal(hulk.hp,hpBefore-60,'Finisher dealt 1.5x rupture damage');
  assert.equal(hulk.growth,0,'Barnacle growth shattered back to 0');
  assert.equal(hulk.freeze,1.2,'Hulk staggered and frozen for 1.2s');
});

test('drowned catacombs biome spawns abyssal siren and barnacle hulk in regional pool',()=>{
  assert.equal(MONSTERS.siren.region,1);
  assert.equal(MONSTERS.hulk.region,1);
  const regional=Object.values(MONSTERS).filter(e=>!e.boss&&e.region===1);
  assert.equal(regional.length,8);
  assert(regional.some(e=>e.id==='siren'));
  assert(regional.some(e=>e.id==='hulk'));
});







