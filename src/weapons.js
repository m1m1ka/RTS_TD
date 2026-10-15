// Equipment is independent of the unit's skin/type. Both teams use this table.
export const weaponSpecs = {
  musket: { kind: "bullet", speed: 18, width: .94, mount: .37, muzzle: .79, kick: .13, splash: 0 },
  crossbow: { kind: "arrow", speed: 12, width: .77, mount: .39, muzzle: .69, kick: .06, splash: 0 },
  bow: {
    kind: "arrow",
    speed: 10,
    width: 0.76,
    mount: 0.43,
    muzzle: 0.7,
    kick: 0.075,
    splash: 0,
  },
  staff: {
    kind: "orb",
    speed: 7,
    width: 0.94,
    mount: 0.47,
    muzzle: 0.79,
    kick: 0.04,
    splash: 0.55,
  },
  coffeeCannon: {
    kind: "coffee",
    speed: 10,
    width: 0.85,
    mount: 0.43,
    muzzle: 0.75,
    kick: 0.14,
    splash: 0,
  },
};
export const getWeaponSpec = (unit) => weaponSpecs[unit?.weapon] || null;
