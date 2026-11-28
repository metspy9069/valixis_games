export const VERSION = 4;
const heroRows = [
 ['cinder','Cinder Witch','#cb704b','Ember staff','Scorching bolts ignite enemies.','Pyre Crown','bolt',30,.62,100,7.2,['Kindling','Forked Flame','Ash Mantle']],
 ['grave','Grave Knight','#aaa68d','Graveblade','Heavy sweeping strikes stagger nearby foes.','Last Oath','cleave',62,.85,145,6.5,['Gravestone','Execution','Iron Oath']],
 ['thorn','Thorn Ranger','#8da66b','Thornbow','Fast arrows pierce a line of enemies.','Wild Hunt','arrow',25,.42,90,7.7,['Barbed Arrow','Briar Volley','Fleetwood']],
 ['frost','Frost Oracle','#94bcc7','Frost prism','Crystal shards slow advancing enemies.','Winter Veil','shard',27,.57,95,7.1,['Permafrost','Shatterglass','Ice Ward']],
 ['bone','Bone Shepherd','#c4bc98','Soul lantern','Orbiting spirits seek nearby enemies.','Pale Procession','spirit',25,.65,105,7,['Soul Tether','Restless Choir','Grave Shelter']],
 ['storm','Storm Duelist','#a0a4c8','Twin sabers','Lightning jumps between close enemies.','Thunderstep','chain',31,.55,95,7.8,['Live Wire','Forked Sky','Static Guard']],
 ['plague','Plague Alchemist','#a6ad61','Plague flask','Flasks leave damaging pools and harvest extra souls.','Black Harvest','flask',32,.7,115,7.2,['Virulence','Glass Garden','Antidote']],
 ['bell','Bellkeeper','#c8ad72','Vesper bell','Resonant waves push back approaching enemies.','Final Toll','wave',39,.85,125,6.8,['Resonance','Echo Chamber','Sanctuary']],
];
export const HEROES=Object.fromEntries(heroRows.map(([id,name,color,weapon,trait,ultName,pattern,damage,cooldown,hp,speed,branches],index)=>[id,{id,name,color,weapon,trait,ultName,pattern,damage,cooldown,hp,speed,branches,unlockRuns:index,initialXp:[75,90,75,80,85,90,85,90][index],soulYield:id==='plague'?1.25:1}]));
export const REGIONS=[{name:'Ashen Cathedral',color:0xc78c5f,ground:0x282422},{name:'Drowned Catacombs',color:0x79a6a3,ground:0x1c2b2c},{name:'Thornbound Ossuary',color:0x9faa75,ground:0x282c22}];
const rows=[
 ['thrall','Ash Thrall','chase',42,2.7,2,0],['shield','Shieldbearer','guard',105,1.85,4,0],['censer','Censer Acolyte','ranged',65,2.25,4,0],['ringer','Bell Ringer','pulse',90,2.2,5,0],['hound','Ember Hound','charge',48,4.45,3,0],['gargoyle','Gargoyle','ambush',140,2.55,6,0],['golem','Obsidian Golem','guard',380,1.55,9,0],['priest','Pyre Priest','summon',110,2.3,6,0],
 ['husk','Drowned Husk','chase',78,2.5,3,1],['archer','Bone Archer','ranged',62,2.7,4,1],['leech','Leech Swarm','swarm',30,4.7,2,1],['mimic','Coffin Mimic','ambush',135,4.05,6,1],['spitter','Mire Spitter','pool',90,2.2,5,1],['wraith','Lantern Wraith','ranged',70,3.3,5,1],['siren','Abyssal Siren','ranged',135,2.6,6,1],['hulk','Barnacle Hulk','chase',420,1.7,8,1],
 ['thornling','Thornling','swarm',62,4.15,3,2],['root','Root Brute','pulse',210,1.95,7,2],['stalker','Carrion Stalker','charge',95,4.4,5,2],['brood','Brood Mother','summon',165,1.95,7,2],['hex','Hex Weaver','pool',105,2.55,6,2],['sentinel','Ossuary Sentinel','guard',240,2.15,8,2],
 ['abbot','Cinder Abbot','boss',2200,1.8,40,0],['warden','Drowned Warden','boss',3400,1.7,55,1],['regent','Thorn Regent','boss',4800,1.6,70,2]
];
export const MONSTERS=Object.fromEntries(rows.map(([id,name,behavior,hp,speed,xp,region])=>[id,{id,name,behavior,hp,speed,xp,region,boss:behavior==='boss'}]));
export const BOSSES=['abbot','warden','regent'];
export const ANIMATION_MANIFEST={version:5,source:'Articulated procedural 3D actors with batched geometry and weapon-specific equipment',collisionRadius:.45,states:{idle:{duration:1.6},run:{duration:.48},attack:{duration:.28},cast:{duration:.42},dodge:{duration:.24},hit:{duration:.18},death:{duration:.65}},directions:['north','south','east','west']};
export function branchEffect(hero,branch,rank){
 const h=HEROES[hero];
 if(branch===0)return `${Math.round((1+rank*.22)*100)}% weapon damage${rank===3?' · '+h.weapon+' evolution: empowered impacts':''}`;
 if(branch===1)return `${1+rank} attack ${h.pattern==='cleave'?'arcs':'strands'}${rank===3?' · converging spread evolution':''}`;
 return `${Math.round(rank*8)}% damage reduction · ${Math.round(rank*12)}% faster signature charge${rank===3?' · dodge releases a protective pulse':''}`;
}
export function upgradeOffers(game){
 const h=HEROES[game.hero], p=game.player;
 const choices=h.branches.map((name,branch)=>{const rank=p.ranks[branch];return {id:`branch-${branch}`,branch,name,rank,max:3,desc:`${branchEffect(h.id,branch,rank)} → ${branchEffect(h.id,branch,rank+1)}`,connection:branch===0?'Power → empowered impact':branch===1?'Pattern → converging spread':'Defense → protective dodge'};}).filter(c=>c.rank<3);
 for(const [id,name,desc] of [['vitality','Mended Vessel','+15 maximum health; restore 15 health'],['stride','Sure Footing','+5% movement speed; +8% stamina recovery']]){const rank=p.shared[id]||0;if(rank<2)choices.push({id,name,desc,rank,max:2,connection:'Shared survival blessing'});}
 const echoes=[
  ['emberMight','Ember Temper','+8% damage','Endless echo · damage',20],
  ['emberTempo','Ashen Rhythm','+6% weapon speed','Endless echo · weapon cadence',20],
  ['emberGuard','Vessel Memory','+10 maximum vitality and restore 10','Endless echo · survival',20],
  ['emberReach','Soul Current','+0.4 pickup reach and +1% movement speed','Endless echo · mobility',20],
  ['emberRecovery','Runic Memory','+4% skill and signature recovery','Endless echo · abilities',20],
 ];
 if(!choices.length||p.level>=12)for(const [id,name,desc,connection,max] of echoes){const rank=p.shared[id]||0;if(rank<max)choices.push({id,name,desc,rank,max,connection});}
 for(let i=choices.length-1;i>0;i--){const j=Math.floor(game.rng()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
 return choices.slice(0,3);
}
