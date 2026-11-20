const attack=(id,range,windup,cooldown,stop=0)=>({id,range,windup,cooldown,stop});

export const ENEMY_ATTACKS={
 thrall:[attack('thrall-combo',2.1,.48,1.65)],
 shield:[attack('shield-bash',2.4,.62,2.2),attack('shield-rush',7,.85,3.4)],
 censer:[attack('censer-lob',11,.8,2.65,7)],
 ringer:[attack('bell-ring',5.2,.95,3.1,3.5)],
 hound:[attack('hound-charge',9,.62,2.55)],
 gargoyle:[attack('gargoyle-dive',10,1.05,3.5,8)],
 husk:[attack('husk-grab',2.2,.72,2.25),attack('husk-sweep',3.6,.88,3)],
 archer:[attack('archer-lead',12,.65,2.15,8),attack('archer-volley',12,.95,3.2,9)],
 leech:[attack('leech-drain',3.2,.45,2.25)],
 mimic:[attack('mimic-ambush',7,.72,3.1,6)],
 spitter:[attack('spitter-shot',11,.58,1.9,7),attack('spitter-pool',11,.9,3.15,8)],
 wraith:[attack('wraith-phase',10,.75,2.8,7)],
 thornling:[attack('thorn-leap',6,.48,1.8)],
 root:[attack('root-slam',4,.9,2.8),attack('root-line',10,1.05,3.5,6)],
 stalker:[attack('stalker-flank',8,.55,2.3)],
 brood:[attack('brood-eggs',10,1.05,4.1,7),attack('brood-web',6,.72,2.8,5)],
 hex:[attack('hex-beams',10,1.05,3.3,7),attack('hex-mark',12,.8,2.5,8)],
 sentinel:[attack('sentinel-counter',3,.62,2.15),attack('sentinel-sweep',4.6,.9,3.15)],
};

export const BOSS_ATTACKS={
 abbot:{
  1:[attack('abbot-rings',13,1.15,3.5,9),attack('abbot-censers',13,1,3.3,9)],
  2:[attack('abbot-flame-wall',13,1.25,3.25,9),attack('abbot-rings',13,1,2.9,9),attack('abbot-summon',13,1.2,4.4,9)],
  3:[attack('abbot-flame-wall',13,1.05,2.65,9),attack('abbot-censers',13,.82,2.45,9),attack('abbot-rings',13,.9,2.4,9)],
 },
 warden:{
  1:[attack('warden-sweep',5,1,3.2),attack('warden-tides',13,1.15,3.6,9)],
  2:[attack('warden-chain',12,1.05,3.3,8),attack('warden-whirlpool',13,1.1,3.5,9),attack('warden-sweep',5,.85,2.8)],
  3:[attack('warden-charge',13,.9,2.35),attack('warden-tides',13,.9,2.5,9),attack('warden-chain',12,.82,2.55,8)],
 },
 regent:{
  1:[attack('regent-root-lines',13,1.1,3.4,8),attack('regent-seeds',13,1.15,3.7,9)],
  2:[attack('regent-maze',13,1.3,4,9),attack('regent-brood',13,1.15,4.1,9),attack('regent-root-lines',13,.95,3,8)],
  3:[attack('regent-collapse',13,1.1,2.8,9),attack('regent-maze',13,1,3,9),attack('regent-brood',13,.9,3.2,9)],
 },
};

export function attacksFor(enemy){
 if(enemy.boss)return BOSS_ATTACKS[enemy.type]?.[enemy.phase]||[];
 return ENEMY_ATTACKS[enemy.type]||[];
}
