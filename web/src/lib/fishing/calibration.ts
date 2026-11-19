import { loadJson, saveJson } from "../storage";

/**
 * "Use my game's numbers": factors (game / here) for bonuses the app does not model.
 * Applied once, in the model engine, so the snapshot and every ranking pass pick it up.
 */
export type FishingCalibration = {
  enabled: boolean;
  rodPowerMult: number;
  incomeMult: number;
  droneMultMult?: number;
};

export const FISHING_CALIBRATION_KEY = "obeliskfarm:web:fishing_calibration.json";

function okFactor(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** The stored calibration, or null when missing / off / invalid. */
export function readFishingCalibration(): FishingCalibration | null {
  const c = loadJson<Partial<FishingCalibration>>(FISHING_CALIBRATION_KEY);
  if (!c || !c.enabled) return null;
  return {
    enabled: true,
    rodPowerMult: okFactor(c.rodPowerMult) ? c.rodPowerMult : 1,
    incomeMult: okFactor(c.incomeMult) ? c.incomeMult : 1,
    droneMultMult: okFactor(c.droneMultMult) ? c.droneMultMult : 1,
  };
}

export function writeFishingCalibration(c: FishingCalibration): void {
  saveJson(FISHING_CALIBRATION_KEY, c);
}
