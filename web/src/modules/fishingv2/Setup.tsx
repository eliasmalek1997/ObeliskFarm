import { useState } from "react";
import type { FishingSectionProps } from "./types";
import type { FishCardTier, FishingState } from "../../lib/fishing/state";
import {
  AQUARIUM,
  DOCKS,
  ENHANCEMENTS_T1,
  ENHANCEMENTS_T2,
  FISHING_SKILL_TREE,
  FISHING_UPGRADES_T1,
  FISHING_UPGRADES_T2,
  LEGENDARY_FISH,
  enhanceIconUrl,
  fishIconUrl,
  upgradeIconUrl,
  type EnhanceDef,
  type UpgradeDef,
} from "../../lib/fishing";
import { Group, StepperRow, ToggleRow, ChoiceRow } from "./setup/Rows";
import "./setup.css";

type Tab = "upgrades" | "enhance" | "cards" | "skills" | "buffs";
const TABS: { id: Tab; label: string }[] = [
  { id: "upgrades", label: "Upgrades" },
  { id: "enhance", label: "Enhancements" },
  { id: "cards", label: "Cards" },
  { id: "skills", label: "Skills & pets" },
  { id: "buffs", label: "Buffs & extras" },
];

const TIER_OPTIONS: { value: FishCardTier; label: string }[] = [
  { value: 0, label: "None" },
  { value: 1, label: "Card" },
  { value: 2, label: "Gilded" },
  { value: 3, label: "Poly" },
];

const UPGRADE_HINTS: Record<string, string> = {
  fishing_rod: "Raises Fishing Rod power (the rod only works on one dock).",
  fishing_drone: "Each level adds one more fishing drone you can place on docks.",
  upgrade_boat: "Unlocks the next Tier 1 dock and more upgrades.",
  upgrade_t2_boat: "Unlocks the next Tier 2 dock and more upgrades.",
};

export function Setup(props: FishingSectionProps) {
  const { state, setState, snapshot } = props;
  const [tab, setTab] = useState<Tab>("upgrades");
  const patch = (p: Partial<FishingState>) => setState((s) => ({ ...s, ...p }));
  const boat = snapshot.stats.boatLevel;
  const t2Boat = snapshot.stats.t2BoatLevel;

  const setUpgrade = (id: UpgradeDef["id"], v: number) =>
    setState((s) => ({ ...s, upgradeLevels: { ...s.upgradeLevels, [id]: v } }));
  const setEnhance = (id: EnhanceDef["id"], v: number) =>
    setState((s) => ({ ...s, enhanceLevels: { ...s.enhanceLevels, [id]: v } }));

  const lockNote = (d: UpgradeDef | EnhanceDef): string | undefined => {
    if (d.t2BoatLevelRequired != null) return t2Boat >= d.t2BoatLevelRequired ? undefined : `needs T2 boat ${d.t2BoatLevelRequired}`;
    return boat >= d.boatLevelRequired ? undefined : `needs boat ${d.boatLevelRequired}`;
  };

  const upgradeRows = (defs: UpgradeDef[]) =>
    defs.map((d) => (
      <StepperRow
        key={d.id}
        label={d.perk}
        icon={upgradeIconUrl(d.iconFile)}
        hint={`${UPGRADE_HINTS[d.id] ?? "Bought with fish."} Each level: ${d.increasePerLevel}.`}
        value={state.upgradeLevels[d.id] ?? 0}
        max={d.maxLevel}
        onChange={(v) => setUpgrade(d.id, v)}
        note={lockNote(d)}
      />
    ));
  const enhanceRows = (defs: EnhanceDef[]) =>
    defs.map((d) => (
      <StepperRow
        key={d.id}
        label={d.perk}
        icon={enhanceIconUrl(d.iconFile)}
        hint={`Bought with gems. Each level: ${d.increasePerLevel}.`}
        value={state.enhanceLevels[d.id] ?? 0}
        max={d.maxLevel}
        onChange={(v) => setEnhance(d.id, v)}
        note={lockNote(d)}
      />
    ));

  const setFishTier = (id: string, t: FishCardTier) =>
    setState((s) => ({ ...s, fishCardTier: { ...s.fishCardTier, [id]: t } }));
  const setAllFishTier = (t: FishCardTier) =>
    setState((s) => {
      const next: Record<string, FishCardTier> = {};
      for (const set of AQUARIUM) for (const f of set.fish) next[f.id] = t;
      return { ...s, fishCardTier: next };
    });

  return (
    <section className="fv2Section" aria-label="Your setup">
      <h2 className="fv2SectionTitle">Your setup</h2>
      <p className="fv2Muted fv2SetupTip">Tip: use Import stats in the menu to fill most of this automatically.</p>
      <div className="fv2SetupTabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="fv2SetupTab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "upgrades" && (
        <div className="fv2Card">
          <Group title="Tier 1 upgrades" blurb="Bought with fish. Enter the level you have.">
            {upgradeRows(FISHING_UPGRADES_T1)}
          </Group>
          <Group title="Tier 2 upgrades">{upgradeRows(FISHING_UPGRADES_T2)}</Group>
        </div>
      )}

      {tab === "enhance" && (
        <div className="fv2Card">
          <Group title="Tier 1 enhancements" blurb="Bought with gems.">
            {enhanceRows(ENHANCEMENTS_T1)}
          </Group>
          <Group title="Tier 2 enhancements">{enhanceRows(ENHANCEMENTS_T2)}</Group>
        </div>
      )}

      {tab === "cards" && (
        <div className="fv2Card">
          <Group title="Misc cards">
            <ChoiceRow
              label="Fishing Rod card"
              hint="Rod power x1.02 / x1.05 / x1.10 for Card / Gilded / Poly."
              value={state.fishingRodCardTier}
              options={TIER_OPTIONS}
              onChange={(v) => patch({ fishingRodCardTier: v })}
            />
            <ChoiceRow
              label="Sushi card"
              hint="Extra ticks per Sushi: +5 / +10 / +20 for Card / Gilded / Poly."
              value={state.sushiCardTier}
              options={TIER_OPTIONS}
              onChange={(v) => patch({ sushiCardTier: v })}
            />
            <ChoiceRow
              label="Mr Nibbles card"
              hint="Tiny Notice chance +1% / +2% / +4% for Card / Gilded / Poly."
              value={state.mrNibblesCardTier}
              options={TIER_OPTIONS}
              onChange={(v) => patch({ mrNibblesCardTier: v })}
            />
            <ToggleRow
              label="Value Pack: Potency (Poly)"
              hint="Store value pack that makes Poly fish cards 15% stronger."
              value={state.valuePackPotencyPoly}
              onChange={(v) => patch({ valuePackPotencyPoly: v })}
            />
          </Group>
          <Group title="Infernal cards" blurb="Enter the percent per level shown on the card, and its level.">
            <StepperRow
              label="Infernal Mr Nibbles: % per level"
              hint="Flat 5x tick chance per level, as shown on the card."
              value={state.infernalMrNibblesPct}
              step={0.1}
              decimals
              onChange={(v) => patch({ infernalMrNibblesPct: v })}
            />
            <StepperRow label="Infernal Mr Nibbles: level" value={state.infernalMrNibblesLevel} onChange={(v) => patch({ infernalMrNibblesLevel: v })} />
            <StepperRow
              label="Infernal Angler Drone: % per level"
              hint="Tier 2 Dock Power per level, as shown on the card."
              value={state.infernalAnglerDronePct}
              step={0.1}
              decimals
              onChange={(v) => patch({ infernalAnglerDronePct: v })}
            />
            <StepperRow label="Infernal Angler Drone: level" value={state.infernalAnglerDroneLevel} onChange={(v) => patch({ infernalAnglerDroneLevel: v })} />
          </Group>
          <Group title="Fish cards" blurb="Card x1.5, Gilded x2, Poly x4 fish income (plus skill and upgrade bonuses).">
            <div className="fv2SetupBulk">
              <span className="fv2Muted">Set all:</span>
              {TIER_OPTIONS.map((o) => (
                <button key={o.value} type="button" className="fv2SetupBtn" onClick={() => setAllFishTier(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
            {AQUARIUM.map((set) => {
              const dock = DOCKS.find((d) => d.id === set.dockId);
              return (
                <div key={set.dockId}>
                  <h5 className="fv2SetupGroupTitle fv2Muted">{dock?.name ?? set.dockId}</h5>
                  <div className="fv2SetupFishGrid">
                    {set.fish.map((f) => (
                      <ChoiceRow
                        key={f.id}
                        label={f.name}
                        icon={fishIconUrl(f.iconFile)}
                        value={(state.fishCardTier[f.id] ?? 0) as FishCardTier}
                        options={TIER_OPTIONS}
                        onChange={(v) => setFishTier(f.id, v)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </Group>
        </div>
      )}

      {tab === "skills" && (
        <div className="fv2Card">
          <Group title="Skill tree" blurb="Skill levels bought with Obelisk skill points.">
            {FISHING_SKILL_TREE.map((sk) => (
              <StepperRow
                key={sk.id}
                label={sk.name}
                icon={upgradeIconUrl(sk.iconFile)}
                hint={`${sk.effectLines.join("; ")}. Needs Obelisk level ${sk.obeliskLevel}.`}
                value={state.skillTreeLevels[sk.id] ?? 0}
                max={sk.costs.length}
                onChange={(v) => setState((s) => ({ ...s, skillTreeLevels: { ...s.skillTreeLevels, [sk.id]: v } }))}
              />
            ))}
          </Group>
          <Group title="Legendary fish">
            <StepperRow
              label="Legendary fish found"
              hint="How many of the 6 Tier 1 legendary fish you have caught. Boosts the Completionist Gatekeeper skill."
              value={state.legendaryFishFound}
              max={LEGENDARY_FISH.length}
              onChange={(v) => patch({ legendaryFishFound: v })}
            />
            <ToggleRow
              label="Cthulhu (Abyss legendary) caught"
              hint="Reduces the Abyss dock ticks needed by 9, so it fills faster."
              value={state.abyssLegendaryCaught}
              onChange={(v) => patch({ abyssLegendaryCaught: v })}
            />
            <StepperRow
              label="Divine Relic points"
              hint="Each point gives +2% chance of a 5x dock tick."
              value={state.divineRelic5xPoints}
              onChange={(v) => patch({ divineRelic5xPoints: v })}
            />
            <StepperRow
              label="Divine Challenge Coin level"
              hint="Each level gives Shiny Fish Multiplier +10%."
              value={state.divineChallengeCoinLevel}
              onChange={(v) => patch({ divineChallengeCoinLevel: v })}
            />
          </Group>
          <Group title="Mr Nibbles (pet)">
            <StepperRow
              label="Mr Nibbles level"
              hint="+0.03x shiny multiplier and +1% triple tick chance per level."
              value={state.mrNibblesLevel}
              onChange={(v) => patch({ mrNibblesLevel: v })}
            />
            <ToggleRow
              label="Mr Nibbles quest unlocked"
              hint="Rank 0 gives +5% Tier 2 Dock Power."
              value={state.mrNibblesQuestUnlocked}
              onChange={(v) => patch({ mrNibblesQuestUnlocked: v })}
            />
            {state.mrNibblesQuestUnlocked && (
              <StepperRow
                label="Mr Nibbles quest rank"
                hint="0-based rank. Tier 2 Dock Power = 1 + 5% x (rank + 1)."
                value={state.mrNibblesQuestRank}
                onChange={(v) => patch({ mrNibblesQuestRank: v })}
              />
            )}
            <ToggleRow
              label="Mr Nibbles pet skin"
              hint="+2% Shiny Fish chance."
              value={state.mrNibblesSkin}
              onChange={(v) => patch({ mrNibblesSkin: v })}
            />
          </Group>
          <Group title="Archaeology idols">
            <StepperRow
              label="Poseidon idol level"
              hint="+0.25 base drone power per level."
              value={state.poseidonIdolLevel}
              onChange={(v) => patch({ poseidonIdolLevel: v })}
            />
            <StepperRow
              label="Tethys idol level"
              hint="Per level: Tier 2 dock power, drone multiplier and super shiny multiplier each +0.05%."
              value={state.tethysIdolLevel}
              onChange={(v) => patch({ tethysIdolLevel: v })}
            />
            <StepperRow
              label="Astraeus idol level"
              hint="+0.03% double tick chance per level."
              value={state.astraeusIdolLevel}
              onChange={(v) => patch({ astraeusIdolLevel: v })}
            />
          </Group>
        </div>
      )}

      {tab === "buffs" && (
        <div className="fv2Card">
          <Group title="Store bundles">
            <ToggleRow
              label="Legendary Hauler Bundle"
              hint="+3% 5x tick chance, fish income x1.10, Tier 2 dock power x1.10."
              value={state.legendaryHaulerBundle}
              onChange={(v) => patch({ legendaryHaulerBundle: v })}
            />
            <ToggleRow label="Fisher's Bundle" hint="+10% triple tick chance." value={state.fishersBundle} onChange={(v) => patch({ fishersBundle: v })} />
            <ToggleRow label="Angler's Bundle" hint="+6% Tiny Notice chance." value={state.anglerBundle} onChange={(v) => patch({ anglerBundle: v })} />
            <ToggleRow label="Half Way Bundle" hint="Fishing Rod power x1.10." value={state.halfWayBundle} onChange={(v) => patch({ halfWayBundle: v })} />
          </Group>
          <Group title="Construct">
            <ChoiceRow
              label="Statue Craftmanship"
              hint="Only one applies: Gilded gives fish income x1.25, Platinized x1.40."
              value={state.constructStatue}
              options={[
                { value: "none", label: "None" },
                { value: "gilded", label: "Gilded" },
                { value: "platinized", label: "Platinized" },
              ]}
              onChange={(v) => patch({ constructStatue: v })}
            />
          </Group>
          <Group title="Stargazing">
            <StepperRow label="Cetus level" hint="+2% fish income per level." value={state.cetusLevel} onChange={(v) => patch({ cetusLevel: v })} />
            <StepperRow
              label="Super Stars level"
              hint="Fish income multiplier, +1.25% per level."
              value={state.superStarsLevel}
              onChange={(v) => patch({ superStarsLevel: v })}
            />
            <ToggleRow
              label="Black Hole bonus"
              hint="Tier 2 dock power +25%."
              value={state.blackHoleBonus}
              onChange={(v) => patch({ blackHoleBonus: v })}
            />
          </Group>
          <Group title="World 3">
            <StepperRow
              label="Drone power upgrade (World 3)"
              hint="+0.1 base drone power per level."
              value={state.droneBasePowerWorld3Upgrade}
              onChange={(v) => patch({ droneBasePowerWorld3Upgrade: v })}
            />
            <StepperRow
              label="Workshop: drone power (World 3)"
              hint="+0.02x drone power multiplier per level."
              value={state.fishingDroneBasePowerWorld3}
              onChange={(v) => patch({ fishingDroneBasePowerWorld3: v })}
            />
            <StepperRow
              label="Workshop: sushi ticks (World 3)"
              hint="+1 extra sushi tick per hour per level."
              value={state.workshopSushiTicksWorld3}
              onChange={(v) => patch({ workshopSushiTicksWorld3: v })}
            />
          </Group>
        </div>
      )}
    </section>
  );
}
