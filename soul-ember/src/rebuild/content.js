export const ACTIVE_SKILLS={
 cinder:[{id:'flame-lance',name:'Flame Lance',cooldown:6,kind:'flame',desc:'Piercing 160% damage beam.'},{id:'cinderstep',name:'Cinderstep',cooldown:9,kind:'dash',desc:'Invulnerable dash with a burning trail.'}],
 grave:[{id:'reaping-arc',name:'Reaping Arc',cooldown:5,kind:'cleave',desc:'Wide 180% graveblade cleave.'},{id:'iron-oath',name:'Iron Oath',cooldown:12,kind:'guard',desc:'Raise a shield and punish attackers.'}],
 thorn:[{id:'fan-thorns',name:'Fan of Thorns',cooldown:5,kind:'volley',desc:'Fire seven piercing arrows.'},{id:'briar-trap',name:'Briar Trap',cooldown:10,kind:'trap',desc:'Root enemies inside a thorn field.'}],
 frost:[{id:'crystal-spear',name:'Crystal Spear',cooldown:6,kind:'spear',desc:'A piercing shard that shatters on impact.'},{id:'winter-ring',name:'Winter Ring',cooldown:12,kind:'nova',desc:'Freeze nearby enemies in a crystal burst.'}],
 bone:[{id:'soul-command',name:'Soul Command',cooldown:7,kind:'spirits',desc:'Release three seeking spirits.'},{id:'ossuary-ward',name:'Ossuary Ward',cooldown:12,kind:'ward',desc:'Gain a shield that retaliates with spirits.'}],
 storm:[{id:'crosscut',name:'Crosscut',cooldown:5,kind:'crosscut',desc:'Dash through enemies with crossed blades.'},{id:'chain-tempest',name:'Chain Tempest',cooldown:11,kind:'chain',desc:'Lightning repeatedly leaps through a crowd.'}],
 plague:[{id:'volatile-flask',name:'Volatile Flask',cooldown:6,kind:'volatile',desc:'Throw an explosive plague flask.'},{id:'miasma-trail',name:'Miasma Trail',cooldown:12,kind:'miasma',desc:'Carry a poisonous field while moving.'}],
 bell:[{id:'resonant-strike',name:'Resonant Strike',cooldown:6,kind:'wave',desc:'Directional wave that staggers enemies.'},{id:'sanctuary-chime',name:'Sanctuary Chime',cooldown:14,kind:'sanctuary',desc:'Heal, shield, and repel nearby enemies.'}],
};

export const ARMORY={
 vitality:{name:'Tempered Vessel',desc:'+3 maximum vitality per rank.',max:5},
 footwork:{name:'Pilgrim Footwork',desc:'+1.5% movement and +2% stamina recovery per rank.',max:5},
 magnetism:{name:'Soul Lodestone',desc:'+0.3 pickup radius per rank.',max:5},
 focus:{name:'Runic Focus',desc:'+2% active-skill recovery per rank.',max:5},
 fortune:{name:'Gilded Ember',desc:'+4% gold-drop chance per rank.',max:5},
};
export const ARMORY_COSTS=[75,150,300,500,800];
export const MASTERY_COSTS=[250,500,900];

export const RELICS={
 quickwick:{name:'Quickwick',cost:25,desc:'Auto attacks recover 15% faster.'},
 piercingNail:{name:'Piercing Nail',cost:25,desc:'Projectiles pierce one additional enemy.'},
 echoBell:{name:'Echo Bell',cost:35,desc:'20% chance to echo an attack at 55% power.'},
 soulMagnet:{name:'Soul Magnet',cost:15,desc:'+2 soul pickup radius.'},
 bloodVessel:{name:'Blood Vessel',cost:20,desc:'+20 maximum vitality and restore 20.'},
 pilgrimBoots:{name:'Pilgrim Boots',cost:20,desc:'+10% speed and dodges cost 6 less stamina.'},
 glassFang:{name:'Glass Fang',cost:30,desc:'+18% damage, but -10 maximum vitality.'},
 gildedTooth:{name:'Gilded Tooth',cost:25,desc:'+15% gold-drop chance.'},
 graveThread:{name:'Grave Thread',cost:40,desc:'Prevent one fatal blow in each region.'},
 emberOil:{name:'Ember Oil',cost:35,desc:'Slain enemies leave a brief burning pool.'},
 frostSalt:{name:'Frost Salt',cost:35,desc:'Weapon hits briefly slow enemies.'},
 hunterSigil:{name:"Hunter's Sigil",cost:30,desc:'+25% damage against elites and guardians.'},
};

export function blankArmory(){return Object.fromEntries(Object.keys(ARMORY).map(id=>[id,0]));}
export function blankMastery(heroIds=[]){return Object.fromEntries(heroIds.map(id=>[id,0]));}
