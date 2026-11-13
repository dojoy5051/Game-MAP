import {
  Difficulty,
  FactionId,
  MapScenario,
  TerritoryState,
} from '../types/game';
import {
  calculateReinforcements,
  resolveCombatRound,
} from './gameLogic';

export type AiActionStep =
  | {
      type: 'reinforce';
      faction: FactionId;
      territoryId: string;
      amount: number;
    }
  | {
      type: 'attack';
      faction: FactionId;
      fromId: string;
      toId: string;
      attackerLoss: number;
      defenderLoss: number;
      captured: boolean;
      moveTroops: number;
    }
  | {
      type: 'fortify';
      faction: FactionId;
      fromId: string;
      toId: string;
      amount: number;
    };

export function planAiTurn(
  faction: FactionId,
  scenario: MapScenario,
  initialStates: Record<string, TerritoryState>,
  difficulty: Difficulty
): AiActionStep[] {
  const steps: AiActionStep[] = [];
  // Clone state for lookahead simulation
  const sim: Record<string, TerritoryState> = {};
  for (const [id, st] of Object.entries(initialStates)) {
    sim[id] = { ...st };
  }

  const defMap = new Map(scenario.territories.map((t) => [t.id, t]));
  const owned = scenario.territories.filter((t) => sim[t.id]?.owner === faction);
  if (owned.length === 0) return steps;

  // 1. Reinforcements
  const { total } = calculateReinforcements(faction, scenario, sim);
  const extraHardBonus = difficulty === 'hard' ? 1 : 0;
  let pool = total + extraHardBonus;

  // Score owned territories for reinforcement need (frontline + valuable terrain)
  const borderOwned = owned.filter((t) =>
    t.neighbors.some((n) => sim[n]?.owner !== faction)
  );
  const candidates = borderOwned.length > 0 ? borderOwned : owned;

  const scoredCandidates = candidates
    .map((t) => {
      const enemyNeighbors = t.neighbors.filter((n) => sim[n]?.owner !== faction);
      const maxEnemy = Math.max(
        0,
        ...enemyNeighbors.map((n) => sim[n]?.troops ?? 0)
      );
      const minEnemy = Math.min(
        99,
        ...enemyNeighbors.map((n) => sim[n]?.troops ?? 99)
      );
      let score = 0;
      if (t.terrain === 'capital') score += 4;
      if (t.terrain === 'fortress') score += 2;
      if (maxEnemy > sim[t.id].troops) score += 3;
      if (sim[t.id].troops + pool > minEnemy + 1) score += 3;
      score += Math.random() * 1.5;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scoredCandidates.length > 0 && pool > 0) {
    // Split between top 1-2 frontline territories
    const primary = scoredCandidates[0].t;
    const secondary = scoredCandidates[1]?.t;
    if (secondary && pool >= 4) {
      const firstAmt = Math.ceil(pool * 0.65);
      const secondAmt = pool - firstAmt;
      sim[primary.id].troops += firstAmt;
      steps.push({
        type: 'reinforce',
        faction,
        territoryId: primary.id,
        amount: firstAmt,
      });
      sim[secondary.id].troops += secondAmt;
      steps.push({
        type: 'reinforce',
        faction,
        territoryId: secondary.id,
        amount: secondAmt,
      });
    } else {
      sim[primary.id].troops += pool;
      steps.push({
        type: 'reinforce',
        faction,
        territoryId: primary.id,
        amount: pool,
      });
    }
  }

  // 2. Attacks
  const maxAttacks = difficulty === 'easy' ? 2 : difficulty === 'normal' ? 4 : 6;
  const requiredEdge = difficulty === 'easy' ? 2 : difficulty === 'normal' ? 1 : 0;

  for (let round = 0; round < maxAttacks; round++) {
    let bestAttack: {
      fromId: string;
      toId: string;
      score: number;
    } | null = null;

    for (const t of scenario.territories) {
      const st = sim[t.id];
      if (st.owner !== faction || st.troops < 3) continue;

      for (const nId of t.neighbors) {
        const targetState = sim[nId];
        const targetDef = defMap.get(nId);
        if (!targetState || !targetDef || targetState.owner === faction) continue;

        const defensePenalty =
          targetDef.terrain === 'fortress' || targetDef.terrain === 'capital'
            ? 1
            : 0;
        const effectiveDiff =
          st.troops - (targetState.troops + defensePenalty);

        if (effectiveDiff >= requiredEdge) {
          let score = effectiveDiff * 2;
          if (targetState.owner === 'player') score += 1.5;
          if (targetDef.terrain === 'capital') score += 4;
          if (targetDef.terrain === 'port') score += 2;
          if (targetState.owner === 'neutral') score += 1;
          score += Math.random();

          if (!bestAttack || score > bestAttack.score) {
            bestAttack = { fromId: t.id, toId: nId, score };
          }
        }
      }
    }

    if (!bestAttack) break;

    const fromState = sim[bestAttack.fromId];
    const toState = sim[bestAttack.toId];
    const toDef = defMap.get(bestAttack.toId)!;

    // Execute up to 2 clash waves if needed or 1 decisive wave
    const outcome = resolveCombatRound(
      fromState.troops,
      toState.troops,
      toDef,
      toState.fortifiedTurn,
      faction,
      difficulty
    );

    fromState.troops = Math.max(1, fromState.troops - outcome.attackerLoss);
    toState.troops = Math.max(0, toState.troops - outcome.defenderLoss);

    let moveTroops = 0;
    if (outcome.captured) {
      const available = fromState.troops - 1;
      const fromDef = defMap.get(bestAttack.fromId)!;
      const fromStillHasEnemies = fromDef.neighbors.some(
        (n) => sim[n]?.owner !== faction && n !== bestAttack.toId
      );
      moveTroops = fromStillHasEnemies
        ? Math.max(1, Math.ceil(available * 0.6))
        : Math.max(1, available);
      fromState.troops -= moveTroops;
      toState.owner = faction;
      toState.troops = moveTroops;
      toState.fortifiedTurn = false;
    }

    steps.push({
      type: 'attack',
      faction,
      fromId: bestAttack.fromId,
      toId: bestAttack.toId,
      attackerLoss: outcome.attackerLoss,
      defenderLoss: outcome.defenderLoss,
      captured: outcome.captured,
      moveTroops,
    });
  }

  // 3. Fortify interior troops to frontline
  const interiorWithTroops = scenario.territories.filter((t) => {
    const st = sim[t.id];
    if (st.owner !== faction || st.troops <= 2) return false;
    return t.neighbors.every((n) => sim[n]?.owner === faction);
  });

  if (interiorWithTroops.length > 0) {
    const source = interiorWithTroops.sort(
      (a, b) => sim[b.id].troops - sim[a.id].troops
    )[0];
    const borderTargets = source.neighbors.filter((n) => {
      const nd = defMap.get(n);
      return (
        sim[n]?.owner === faction &&
        nd?.neighbors.some((nn) => sim[nn]?.owner !== faction)
      );
    });
    const destId =
      borderTargets[0] ??
      source.neighbors.find((n) => sim[n]?.owner === faction);

    if (destId) {
      const amount = sim[source.id].troops - 1;
      if (amount > 0) {
        sim[source.id].troops -= amount;
        sim[destId].troops += amount;
        steps.push({
          type: 'fortify',
          faction,
          fromId: source.id,
          toId: destId,
          amount,
        });
      }
    }
  }

  return steps;
}
