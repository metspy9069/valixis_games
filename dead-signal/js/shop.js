// Supply depot catalogue.
//
// Pure data, no DOM: game.js owns the wallet and applies the effects, this file
// only describes what can be bought, what it costs and how far it goes. Costs
// climb with each level so the last tier of anything is a real decision.

export const SHOP_SECTIONS = ['SUPPLIES', 'ARMORY', 'WEAPON UPGRADES', 'BODY'];

export const SHOP_ITEMS = [
  {
    id: 'ammo', section: 'SUPPLIES', name: 'AMMO CRATE',
    desc: 'Top every reserve back to full.', baseCost: 80, repeat: true,
  },
  {
    id: 'medkit', section: 'SUPPLIES', name: 'FIELD DRESSING',
    desc: 'Restore 100 health immediately.', baseCost: 60, repeat: true,
  },
  {
    id: 'armor', section: 'SUPPLIES', name: 'PLATE CARRIER',
    desc: 'Restore 60 armour.', baseCost: 85, repeat: true,
  },
  {
    id: 'grenade', section: 'SUPPLIES', name: 'FRAG GRENADE',
    desc: 'One grenade. Carries up to six.', baseCost: 70, repeat: true,
  },
  {
    id: 'rifle', section: 'ARMORY', name: 'LONGSHOT 7',
    desc: 'Scoped marksman rifle. Unlocks slot 4.', baseCost: 240, once: true, weaponIndex: 3,
  },
  {
    id: 'ripper', section: 'ARMORY', name: 'RIPPER LMG',
    desc: '75-round heavy machine gun. Unlocks slot 5.', baseCost: 560, once: true, weaponIndex: 4,
  },
  {
    id: 'damage', section: 'WEAPON UPGRADES', name: 'MATCH-GRADE BARREL',
    desc: '+12% damage on every weapon.', baseCost: 190, max: 5,
  },
  {
    id: 'mag', section: 'WEAPON UPGRADES', name: 'EXTENDED MAGAZINES',
    desc: '+4 rounds per magazine (+1 shotgun shell).', baseCost: 165, max: 4,
  },
  {
    id: 'reload', section: 'WEAPON UPGRADES', name: 'QUICK HANDS',
    desc: '-10% reload time.', baseCost: 175, max: 4,
  },
  {
    id: 'stability', section: 'WEAPON UPGRADES', name: 'RECOIL CONTROL',
    desc: '-12% recoil and bullet spread.', baseCost: 155, max: 3,
  },
  {
    id: 'health', section: 'BODY', name: 'COMBAT STIMULANTS',
    desc: '+20 maximum health.', baseCost: 210, max: 4,
  },
  {
    id: 'armorcap', section: 'BODY', name: 'REINFORCED PLATES',
    desc: '+25 maximum armour.', baseCost: 195, max: 3,
  },
  {
    id: 'stamina', section: 'BODY', name: 'CONDITIONING',
    desc: '+15% stamina pool and recovery.', baseCost: 145, max: 3,
  },
];

/** Cost of the next level of an item. */
export function itemCost(item, level = 0) {
  if (item.repeat || item.once) return item.baseCost;
  return Math.round(item.baseCost * (1 + level * 0.6));
}

export function itemMaxed(item, level = 0) {
  if (item.repeat || item.once) return false;
  return level >= item.max;
}
