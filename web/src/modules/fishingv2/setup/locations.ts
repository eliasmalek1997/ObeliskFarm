/**
 * "Where to find it" text for Setup inputs that Import stats does NOT fill, keyed by field id.
 * Only sources stated in the classic Fishing page or the research notes are used; where the exact in-game
 * menu is not known the text says so instead of guessing a path.
 */
const NC = "Exact menu not confirmed.";

export const LOCATIONS: Record<string, string> = {
  // Skill tree (classic page: "Skill Tree", paid with Obelisk skill points)
  skill: "Fishing skill tree, bought with Obelisk skill points. " + NC,
  // Cards
  fishingRodCardTier: "Misc card: Fishing Rod. " + NC,
  sushiCardTier: "Misc card: Sushi. " + NC,
  mrNibblesCardTier: "Misc card: Mr Nibbles. " + NC,
  valuePackPotencyPoly: "Store value pack (Polychrome Potency). " + NC,
  infernalMrNibblesPct: "Read the % per level off your Infernal Mr Nibbles card. " + NC,
  infernalMrNibblesLevel: "The level of your Infernal Mr Nibbles card. " + NC,
  infernalAnglerDronePct: "Read the % per level off your Infernal Angler Drone card. " + NC,
  infernalAnglerDroneLevel: "The level of your Infernal Angler Drone card. " + NC,
  // Legendary / relics
  legendaryFishFound: "Count of Tier 1 legendary fish you have caught (one per dock; needs all 4 fish Poly). Location not confirmed.",
  abyssLegendaryCaught: "Cthulhu, the Abyss legendary fish; tick it once you have caught it. Location not confirmed.",
  divineRelic5xPoints: "Divine Relic points (Relics). " + NC,
  divineChallengeCoinLevel: "Divine Challenge Coin level (Divine Challenge). " + NC,
  // Pet
  mrNibblesLevel: "Pets: Mr Nibbles level. " + NC,
  mrNibblesQuestUnlocked: "Pets: Mr Nibbles quest. " + NC,
  mrNibblesQuestRank: "Pets: Mr Nibbles quest rank (0-based). " + NC,
  mrNibblesSkin: "Pets: Mr Nibbles pet skin. " + NC,
  // Archaeology
  poseidonIdolLevel: "Archaeology: Poseidon Idol level. " + NC,
  tethysIdolLevel: "Archaeology: Tethys Idol level. " + NC,
  astraeusIdolLevel: "Archaeology: Astraeus Idol level. " + NC,
  // Store
  legendaryHaulerBundle: "Store bundle: Legendary Hauler Bundle. " + NC,
  fishersBundle: "Store bundle: Fisher's Bundle. " + NC,
  anglerBundle: "Store bundle: Angler's Bundle. " + NC,
  halfWayBundle: "Store bundle: Half Way Bundle. " + NC,
  // Construct (World 3)
  constructStatue: "World 3 Construct: Statue of Craftmanship. Only the highest tier you own counts. " + NC,
  // Stargazing
  cetusLevel: "Stargazing: Cetus level. " + NC,
  superStarsLevel: 'Stargazing: the "Fish Income Multiplier" upgrade in the Super Star upgrade shop (+1.25% per level).',
  blackHoleBonus: "Stargazing: Black Hole bonus. " + NC,
  // World 3
  droneBasePowerWorld3Upgrade: 'World 3 "Diverse Upgrades": Fishing Drone Power. ' + NC,
  fishingDroneBasePowerWorld3: "World 3 Workshop: Fishing Drone Power. " + NC,
  workshopSushiTicksWorld3: 'World 3 Workshop: Sushi Fishing Ticks ("Diverse Upgrades" in the classic page). ' + NC,
};

/** Fish upgrades, enhancements and fish card tiers come from Import stats. */
export const IMPORTED_NOTE = "from import";
