import {
  Difficulty,
  FactionId,
  MapScenario,
  TerritoryDefinition,
  TerritoryState,
} from '../types/game';

export function calculateReinforcements(
  faction: FactionId,
  scenario: MapScenario,
  states: Record<string, TerritoryState>
): { total: number; base: number; capitals: number; regionBonuses: number } {
  const owned = scenario.territories.filter(
    (t) => states[t.id]?.owner === faction
  );
  if (owned.length === 0) {
    return { total: 0, base: 0, capitals: 0, regionBonuses: 0 };
  }

  const base = Math.max(3, Math.floor(owned.length / 2));
  const capitals =
    owned.filter((t) => t.terrain === 'capital').length * 2;

  let regionBonuses = 0;
  for (const region of scenario.regions) {
    const regionTerritories = scenario.territories.filter(
      (t) => t.regionId === region.id
    );
    if (
      regionTerritories.length > 0 &&
      regionTerritories.every((t) => states[t.id]?.owner === faction)
    ) {
      regionBonuses += region.bonus;
    }
  }

  return {
    total: base + capitals + regionBonuses,
    base,
    capitals,
    regionBonuses,
  };
}

export function calculateSupplyGain(
  faction: FactionId,
  scenario: MapScenario,
  states: Record<string, TerritoryState>
): number {
  const ownedPorts = scenario.territories.filter(
    (t) => states[t.id]?.owner === faction && t.terrain === 'port'
  ).length;
  return 1 + ownedPorts;
}

export function areConnectedFriendly(
  fromId: string,
  toId: string,
  faction: FactionId,
  scenario: MapScenario,
  states: Record<string, TerritoryState>
): boolean {
  if (fromId === toId) return false;
  if (
    states[fromId]?.owner !== faction ||
    states[toId]?.owner !== faction
  ) {
    return false;
  }

  const defMap = new Map<string, TerritoryDefinition>(
    scenario.territories.map((t) => [t.id, t])
  );
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) return true;
    const def = defMap.get(current);
    if (!def) continue;
    for (const neighbor of def.neighbors) {
      if (!visited.has(neighbor) && states[neighbor]?.owner === faction) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
}

export function getConnectedFriendlyTargets(
  fromId: string,
  faction: FactionId,
  scenario: MapScenario,
  states: Record<string, TerritoryState>
): Set<string> {
  const result = new Set<string>();
  if (states[fromId]?.owner !== faction) return result;
  const defMap = new Map<string, TerritoryDefinition>(
    scenario.territories.map((t) => [t.id, t])
  );
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current !== fromId) {
      result.add(current);
    }
    const def = defMap.get(current);
    if (!def) continue;
    for (const neighbor of def.neighbors) {
      if (!visited.has(neighbor) && states[neighbor]?.owner === faction) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return result;
}

export interface CombatOutcome {
  attackerLoss: number;
  defenderLoss: number;
  captured: boolean;
}

export function resolveCombatRound(
  attackerTroops: number,
  defenderTroops: number,
  defenderDef: TerritoryDefinition,
  defenderFortified: boolean,
  attackerFaction: FactionId,
  difficulty: Difficulty
): CombatOutcome {
  const atkDiceCount = Math.min(3, Math.max(1, attackerTroops - 1));
  const defDiceCount = Math.min(2, Math.max(1, defenderTroops));

  const rollDie = (bias = 0) =>
    Math.min(6, Math.max(1, Math.floor(Math.random() * 6) + 1 + bias));

  // Subtle difficulty calibration on AI offense/defense
  let atkBias = 0;
  let defBias = 0;
  if (attackerFaction !== 'player' && difficulty === 'hard') {
    atkBias = 0;
  } else if (attackerFaction !== 'player' && difficulty === 'easy') {
    atkBias = -1;
  }

  if (
    defenderDef.terrain === 'fortress' ||
    defenderDef.terrain === 'capital'
  ) {
    defBias += 1;
  }
  if (defenderFortified) {
    defBias += 1;
  }

  const atkRolls = Array.from({ length: atkDiceCount }, () =>
    rollDie(atkBias)
  ).sort((a, b) => b - a);
  const defRolls = Array.from({ length: defDiceCount }, () =>
    rollDie(defBias > 0 && Math.random() < 0.6 ? 1 : 0)
  ).sort((a, b) => b - a);

  const comparisons = Math.min(atkRolls.length, defRolls.length);
  let attackerLoss = 0;
  let defenderLoss = 0;

  for (let i = 0; i < comparisons; i++) {
    if (atkRolls[i] > defRolls[i]) {
      defenderLoss += 1;
    } else {
      attackerLoss += 1;
    }
  }

  const captured = defenderTroops - defenderLoss <= 0;
  return { attackerLoss, defenderLoss, captured };
}
