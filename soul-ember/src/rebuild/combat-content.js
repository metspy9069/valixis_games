const attack=(id,range,windup,cooldown,stop=0)=>({id,range,windup,cooldown,stop});

export const ENEMY_ATTACKS={
 thrall:[attack('thrall-combo',2.1,.48,1.65)],
 shield:[attack('shield-bash',2.4,.62,2.2),attack('shield-rush',7,.85,3.4)],
 censer:[attack('censer-lob',11,.75,2.4,3.2)],
 ringer:[attack('bell-ring',5.2,.9,2.8,2.2)],
 hound:[attack('hound-charge',9,.58,2.3)],
 gargoyle:[attack('gargoyle-dive',10,.95,3.1,2.5)],
 husk:[attack('husk-grab',2.2,.68,2.1),attack('husk-sweep',3.6,.82,2.8)],
 archer:[attack('archer-lead',12,.62,2.0,3.5),attack('archer-volley',12,.9,3.0,4.0)],
 leech:[attack('leech-drain',3.2,.45,2.1)],
 mimic:[attack('mimic-ambush',7,.68,2.8)],
 spitter:[attack('spitter-shot',11,.55,1.8,3.2),attack('spitter-pool',11,.85,3.0,3.6)],
 wraith:[attack('wraith-phase',10,.7,2.6,2.0)],
 thornling:[attack('thorn-leap',6,.48,1.8)],
 root:[attack('root-slam',4,.85,2.6),attack('root-line',10,1.0,3.2,3.0)],
 stalker:[attack('stalker-flank',8,.52,2.1)],
 brood:[attack('brood-eggs',10,1.0,3.8,3.2),attack('brood-web',6,.7,2.6,2.5)],
 hex:[attack('hex-beams',10,1.0,3.1,3.2),attack('hex-mark',12,.78,2.4,3.5)],
 sentinel:[attack('sentinel-counter',3,.6,2.0),attack('sentinel-sweep',4.6,.85,3.0)],
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
