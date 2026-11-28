export const HERO_MODELS={
 cinder:{kind:'humanoid',primary:0xa94f35,secondary:0x3a2422,metal:0x8b6945,head:'hood',weapon:'emberStaff',cape:true,scale:1.04,shotSide:.38},
 grave:{kind:'humanoid',primary:0x5b6060,secondary:0x292d2d,metal:0xa7a68e,head:'greatHelm',weapon:'greatsword',cape:true,armor:true,scale:1.12,shotSide:0},
 thorn:{kind:'humanoid',primary:0x53653f,secondary:0x272f26,metal:0x8a744c,head:'hood',weapon:'longbow',cape:true,quiver:true,scale:1,shotSide:.22},
 frost:{kind:'humanoid',primary:0x7796a2,secondary:0x313d46,metal:0xb8cbd0,head:'crystalCrown',weapon:'frostStaff',cape:true,scale:1.02,shotSide:.36},
 bone:{kind:'humanoid',primary:0x746d58,secondary:0x302e29,metal:0xaaa184,head:'skullMask',weapon:'lantern',cape:true,bone:true,scale:1.04,shotSide:.34},
 storm:{kind:'humanoid',primary:0x59617e,secondary:0x252936,metal:0xb4bad0,head:'windswept',weapon:'twinSabers',cape:false,scale:.98,shotSide:0},
 plague:{kind:'humanoid',primary:0x62683d,secondary:0x292c23,metal:0x91885b,head:'plagueHat',weapon:'flasks',cape:true,scale:1.03,shotSide:.4},
 bell:{kind:'humanoid',primary:0x6f6046,secondary:0x302b24,metal:0xb19258,head:'bellHelm',weapon:'bellHammer',cape:true,armor:true,scale:1.12,shotSide:0},
};

export const MONSTER_MODELS={
 thrall:{kind:'humanoid',primary:0x72503f,secondary:0x302724,head:'scarred',weapon:'claws',scale:.96},
 shield:{kind:'humanoid',primary:0xaaa38e,secondary:0x383732,head:'skull',weapon:'rustSword',shield:true,bone:true,armor:true,scale:1.08},
 censer:{kind:'humanoid',primary:0x76543f,secondary:0x332723,head:'hood',weapon:'censer',cape:true,scale:1.02},
 ringer:{kind:'humanoid',primary:0x735f42,secondary:0x302a23,head:'bellHelm',weapon:'handBell',armor:true,scale:1.08},
 hound:{kind:'hound',primary:0x542a24,secondary:0x251b19,scale:.92},
 gargoyle:{kind:'winged',primary:0x66716d,secondary:0x303735,head:'horns',scale:1.16,armor:true},
 golem:{kind:'humanoid',primary:0x222226,secondary:0x18181b,head:'horns',weapon:'golemFists',armor:true,bone:true,scale:1.48},
 priest:{kind:'humanoid',primary:0x9e3822,secondary:0xd4af37,head:'mitre',weapon:'censer',cape:true,scale:1.06},
 husk:{kind:'humanoid',primary:0x4f6864,secondary:0x243534,head:'drowned',weapon:'claws',cape:true,scale:1.02},
 archer:{kind:'humanoid',primary:0xb0a78d,secondary:0x34332e,head:'skull',weapon:'longbow',quiver:true,bone:true,scale:1},
 leech:{kind:'swarm',primary:0x4e2526,secondary:0x1f1718,scale:.9},
 mimic:{kind:'mimic',primary:0x6e5037,secondary:0x34261c,scale:1.05},
 spitter:{kind:'spitter',primary:0x5d7045,secondary:0x283322,scale:1.04},
 wraith:{kind:'wraith',primary:0x648c8e,secondary:0x243c3e,scale:1.04},
 thornling:{kind:'humanoid',primary:0x697046,secondary:0x2f3425,head:'thorns',weapon:'claws',scale:.83},
 root:{kind:'humanoid',primary:0x5a6042,secondary:0x2c3023,head:'antlers',weapon:'rootClub',armor:true,scale:1.38},
 stalker:{kind:'winged',primary:0x5e584e,secondary:0x282521,head:'beak',scale:1.03},
 brood:{kind:'spider',primary:0x594237,secondary:0x251c19,scale:1.18},
 hex:{kind:'humanoid',primary:0x624e70,secondary:0x282330,head:'hood',weapon:'hexStaff',cape:true,scale:1.03},
 sentinel:{kind:'humanoid',primary:0xb6ad94,secondary:0x3b3932,head:'boneHelm',weapon:'boneBlade',shield:true,bone:true,armor:true,scale:1.28},
 abbot:{kind:'humanoid',primary:0x9b4e34,secondary:0x38221d,head:'mitre',weapon:'emberStaff',cape:true,armor:true,boss:true,scale:1.68},
 warden:{kind:'humanoid',primary:0x46696a,secondary:0x233637,head:'wardenHelm',weapon:'anchor',cape:true,armor:true,boss:true,scale:1.78},
 regent:{kind:'humanoid',primary:0x667044,secondary:0x2d3422,head:'antlers',weapon:'rootStaff',cape:true,armor:true,boss:true,scale:1.82},
};

export const modelFor=id=>HERO_MODELS[id]||MONSTER_MODELS[id];
export const actorPhase=id=>typeof id==='number'&&Number.isFinite(id)?id:[...String(id??'actor')].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,17)*.013;
