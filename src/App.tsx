import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameMap } from './components/GameMap';
import { GameStatusModal, TroopTransferModal } from './components/GameModals';
import { HudOverlay } from './components/HudOverlay';
import { TitleScreen } from './components/TitleScreen';
import { FACTIONS, MAP_SCENARIOS } from './data/maps';
import {
  ActiveBattleArrow,
  Difficulty,
  FactionId,
  FloatingPopup,
  GameScreenState,
  MapId,
  MapScenario,
  MatchStats,
  PendingConquest,
  TerritoryState,
  TurnPhase,
} from './types/game';
import { AiActionStep, planAiTurn } from './utils/ai';
import {
  areConnectedFriendly,
  calculateReinforcements,
  calculateSupplyGain,
  getConnectedFriendlyTargets,
  resolveCombatRound,
} from './utils/gameLogic';
import { soundEngine } from './utils/sound';

function buildInitialTerritories(
  scenario: MapScenario
): Record<string, TerritoryState> {
  const map: Record<string, TerritoryState> = {};
  for (const t of scenario.territories) {
    map[t.id] = {
      id: t.id,
      owner: t.initialOwner,
      troops: t.initialTroops,
      fortifiedTurn: false,
    };
  }
  return map;
}

const INITIAL_STATS: MatchStats = {
  turns: 1,
  battlesWon: 0,
  battlesLost: 0,
  territoriesCaptured: 0,
  ordersUsed: 0,
};

export default function App() {
  const [screen, setScreen] = useState<GameScreenState>('TITLE_MENU');
  const [selectedMapId, setSelectedMapId] = useState<MapId>('archipelago');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [muted, setMuted] = useState(false);

  const scenario = useMemo(
    () =>
      MAP_SCENARIOS.find((m) => m.id === selectedMapId) ?? MAP_SCENARIOS[0],
    [selectedMapId]
  );

  const [territories, setTerritories] = useState<Record<string, TerritoryState>>(
    () => buildInitialTerritories(scenario)
  );
  const [turn, setTurn] = useState(1);
  const [phase, setPhase] = useState<TurnPhase>('REINFORCE');
  const [activeAiFaction, setActiveAiFaction] = useState<FactionId | null>(null);
  const [reinforcementsLeft, setReinforcementsLeft] = useState(0);
  const [deployBatch, setDeployBatch] = useState<1 | 5>(1);
  const [supply, setSupply] = useState(3);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<
    'recruit' | 'bombard' | 'fortify_order' | null
  >(null);
  const [statusMessage, setStatusMessage] = useState(
    'Nhấp vào vùng lãnh thổ của bạn để đặt quân tiếp viện.'
  );

  const [pendingTransfer, setPendingTransfer] = useState<{
    pending: PendingConquest;
    mode: 'conquest' | 'fortify';
  } | null>(null);
  const [hasFortifiedThisTurn, setHasFortifiedThisTurn] = useState(false);
  const [stats, setStats] = useState<MatchStats>(INITIAL_STATS);

  // Ephemeral visual FX state
  const [battleArrows, setBattleArrows] = useState<ActiveBattleArrow[]>([]);
  const [popups, setPopups] = useState<FloatingPopup[]>([]);
  const [hitFlashIds, setHitFlashIds] = useState<Set<string>>(new Set());

  const timersRef = useRef<number[]>([]);
  const territoriesRef = useRef(territories);
  territoriesRef.current = territories;

  const clearAllTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const spawnPopup = useCallback(
    (
      territoryId: string,
      text: string,
      tone: FloatingPopup['tone'] = 'neutral'
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setPopups((prev) => [...prev, { id, territoryId, text, tone }]);
      scheduleTimer(() => {
        setPopups((prev) => prev.filter((p) => p.id !== id));
      }, 1050);
    },
    [scheduleTimer]
  );

  const spawnArrow = useCallback(
    (
      fromId: string,
      toId: string,
      kind: ActiveBattleArrow['kind'],
      color: string
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setBattleArrows((prev) => [...prev, { id, fromId, toId, kind, color }]);
      scheduleTimer(() => {
        setBattleArrows((prev) => prev.filter((a) => a.id !== id));
      }, 720);
    },
    [scheduleTimer]
  );

  const triggerHitFlash = useCallback(
    (territoryId: string) => {
      setHitFlashIds((prev) => {
        const next = new Set(prev);
        next.add(territoryId);
        return next;
      });
      scheduleTimer(() => {
        setHitFlashIds((prev) => {
          const next = new Set(prev);
          next.delete(territoryId);
          return next;
        });
      }, 360);
    },
    [scheduleTimer]
  );

  const checkEndGame = useCallback(
    (nextTerritories: Record<string, TerritoryState>): boolean => {
      const owners = Object.values(nextTerritories).map((t) => t.owner);
      const playerCount = owners.filter((o) => o === 'player').length;
      if (playerCount === scenario.territories.length) {
        soundEngine.playVictory();
        setScreen('VICTORY');
        return true;
      }
      if (playerCount === 0) {
        soundEngine.playDefeat();
        setScreen('DEFEAT');
        return true;
      }
      return false;
    },
    [scenario.territories.length]
  );

  const startNewGame = useCallback(() => {
    clearAllTimers();
    const initial = buildInitialTerritories(scenario);
    const reinf = calculateReinforcements('player', scenario, initial);
    setTerritories(initial);
    setTurn(1);
    setPhase('REINFORCE');
    setActiveAiFaction(null);
    setReinforcementsLeft(reinf.total);
    setDeployBatch(1);
    setSupply(3);
    setSelectedId(null);
    setActiveOrder(null);
    setPendingTransfer(null);
    setHasFortifiedThisTurn(false);
    setBattleArrows([]);
    setPopups([]);
    setHitFlashIds(new Set());
    setStats({ ...INITIAL_STATS });
    setStatusMessage(
      `Lượt 1: Bạn nhận ${reinf.total} quân tiếp viện. Nhấp vào vùng của bạn để đặt quân.`
    );
    setScreen('PLAYING');
    soundEngine.playSelect();
  }, [clearAllTimers, scenario]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Compute valid targets for current selection / active order
  const validTargets = useMemo(() => {
    const targets = new Set<string>();
    const defMap = new Map(scenario.territories.map((t) => [t.id, t]));

    if (activeOrder === 'recruit' || activeOrder === 'fortify_order') {
      for (const t of scenario.territories) {
        if (territories[t.id]?.owner === 'player') {
          targets.add(t.id);
        }
      }
      return targets;
    }

    if (activeOrder === 'bombard') {
      for (const t of scenario.territories) {
        if (territories[t.id]?.owner === 'player') {
          for (const nId of t.neighbors) {
            if (
              territories[nId]?.owner !== 'player' &&
              (territories[nId]?.troops ?? 0) > 0
            ) {
              targets.add(nId);
            }
          }
        }
      }
      return targets;
    }

    if (phase === 'ATTACK' && selectedId) {
      const srcDef = defMap.get(selectedId);
      const srcState = territories[selectedId];
      if (srcDef && srcState?.owner === 'player' && srcState.troops >= 2) {
        for (const nId of srcDef.neighbors) {
          if (territories[nId]?.owner !== 'player') {
            targets.add(nId);
          }
        }
      }
    }

    if (phase === 'FORTIFY' && selectedId && !hasFortifiedThisTurn) {
      const srcState = territories[selectedId];
      if (srcState?.owner === 'player' && srcState.troops >= 2) {
        return getConnectedFriendlyTargets(
          selectedId,
          'player',
          scenario,
          territories
        );
      }
    }

    return targets;
  }, [
    activeOrder,
    hasFortifiedThisTurn,
    phase,
    scenario,
    selectedId,
    territories,
  ]);

  const startPlayerTurn = useCallback(
    (nextTurnNumber: number, currentTerritories: Record<string, TerritoryState>) => {
      // Clear player's previous fortifiedTurn flags at start of player turn
      const cleaned: Record<string, TerritoryState> = {};
      for (const [k, v] of Object.entries(currentTerritories)) {
        cleaned[k] = v.owner === 'player' ? { ...v, fortifiedTurn: false } : { ...v };
      }

      const reinf = calculateReinforcements('player', scenario, cleaned);
      const supplyGain = calculateSupplyGain('player', scenario, cleaned);

      setTerritories(cleaned);
      setTurn(nextTurnNumber);
      setStats((s) => ({ ...s, turns: nextTurnNumber }));
      setPhase('REINFORCE');
      setActiveAiFaction(null);
      setReinforcementsLeft(reinf.total);
      setSupply((s) => Math.min(12, s + supplyGain));
      setHasFortifiedThisTurn(false);
      setSelectedId(null);
      setActiveOrder(null);
      setStatusMessage(
        `Lượt ${nextTurnNumber}: Nhận ${reinf.total} quân tiếp viện & +${supplyGain} Tiếp tế.`
      );
      soundEngine.playSelect();
    },
    [scenario]
  );

  // Execute sequential AI turns with crisp step animation
  const runAiSequence = useCallback(
    (startingTerritories: Record<string, TerritoryState>, nextTurnNum: number) => {
      setPhase('AI_TURN');
      setSelectedId(null);
      setActiveOrder(null);

      const aiFactions = scenario.factions.filter((f) => f !== 'player');
      let working: Record<string, TerritoryState> = {};
      for (const [k, v] of Object.entries(startingTerritories)) {
        working[k] = { ...v };
      }

      // Build flattened timeline of AI actions
      const timeline: AiActionStep[] = [];
      for (const aiFaction of aiFactions) {
        const ownsAny = Object.values(working).some(
          (t) => t.owner === aiFaction
        );
        if (!ownsAny) continue;

        // Clear that AI's fortifiedTurn flag
        for (const t of Object.values(working)) {
          if (t.owner === aiFaction) t.fortifiedTurn = false;
        }

        const aiSteps = planAiTurn(aiFaction, scenario, working, difficulty);
        for (const step of aiSteps) {
          timeline.push(step);
          // Apply to working snapshot so next AI faction plans accurately
          if (step.type === 'reinforce') {
            working[step.territoryId].troops += step.amount;
          } else if (step.type === 'attack') {
            working[step.fromId].troops = Math.max(
              1,
              working[step.fromId].troops - step.attackerLoss
            );
            working[step.toId].troops = Math.max(
              0,
              working[step.toId].troops - step.defenderLoss
            );
            if (step.captured) {
              working[step.fromId].troops -= step.moveTroops;
              working[step.toId].owner = step.faction;
              working[step.toId].troops = step.moveTroops;
              working[step.toId].fortifiedTurn = false;
            }
          } else if (step.type === 'fortify') {
            working[step.fromId].troops -= step.amount;
            working[step.toId].troops += step.amount;
          }
        }
      }

      if (timeline.length === 0) {
        scheduleTimer(() => {
          startPlayerTurn(nextTurnNum, startingTerritories);
        }, 450);
        return;
      }

      const defMap = new Map(scenario.territories.map((t) => [t.id, t]));
      let stepIndex = 0;

      const executeNextStep = () => {
        if (stepIndex >= timeline.length) {
          scheduleTimer(() => {
            if (!checkEndGame(territoriesRef.current)) {
              startPlayerTurn(nextTurnNum, territoriesRef.current);
            }
          }, 420);
          return;
        }

        const step = timeline[stepIndex];
        stepIndex += 1;
        setActiveAiFaction(step.faction);
        const fInfo = FACTIONS[step.faction];

        if (step.type === 'reinforce') {
          const tName = defMap.get(step.territoryId)?.name ?? '';
          setTerritories((prev) => ({
            ...prev,
            [step.territoryId]: {
              ...prev[step.territoryId],
              troops: prev[step.territoryId].troops + step.amount,
            },
          }));
          spawnPopup(step.territoryId, `+${step.amount}`, 'positive');
          setStatusMessage(`${fInfo.shortName} tăng viện ${tName} (+${step.amount}).`);
          soundEngine.playDeploy();
        } else if (step.type === 'attack') {
          const fromName = defMap.get(step.fromId)?.name ?? '';
          const toName = defMap.get(step.toId)?.name ?? '';

          setTerritories((prev) => {
            const next = { ...prev };
            const from = { ...next[step.fromId] };
            const to = { ...next[step.toId] };
            from.troops = Math.max(1, from.troops - step.attackerLoss);
            to.troops = Math.max(0, to.troops - step.defenderLoss);
            if (step.captured) {
              from.troops = Math.max(1, from.troops - step.moveTroops);
              to.owner = step.faction;
              to.troops = step.moveTroops;
              to.fortifiedTurn = false;
            }
            next[step.fromId] = from;
            next[step.toId] = to;
            return next;
          });

          spawnArrow(step.fromId, step.toId, 'attack', fInfo.accentHex);
          triggerHitFlash(step.toId);
          if (step.defenderLoss > 0) {
            spawnPopup(
              step.toId,
              step.captured ? 'Thất thủ!' : `-${step.defenderLoss}`,
              step.captured ? 'negative' : 'negative'
            );
          }
          if (step.attackerLoss > 0) {
            spawnPopup(step.fromId, `-${step.attackerLoss}`, 'negative');
          }
          setStatusMessage(
            step.captured
              ? `${fInfo.shortName} đánh chiếm ${toName} từ ${fromName}!`
              : `${fInfo.shortName} tấn công ${toName} từ ${fromName}.`
          );
          if (step.captured) {
            soundEngine.playCapture();
          } else {
            soundEngine.playBattle();
          }
        } else if (step.type === 'fortify') {
          const fromName = defMap.get(step.fromId)?.name ?? '';
          const toName = defMap.get(step.toId)?.name ?? '';
          setTerritories((prev) => ({
            ...prev,
            [step.fromId]: {
              ...prev[step.fromId],
              troops: Math.max(1, prev[step.fromId].troops - step.amount),
            },
            [step.toId]: {
              ...prev[step.toId],
              troops: prev[step.toId].troops + step.amount,
            },
          }));
          spawnArrow(step.fromId, step.toId, 'move', fInfo.accentHex);
          spawnPopup(step.toId, `+${step.amount}`, 'neutral');
          setStatusMessage(`${fInfo.shortName} điều quân ${fromName} → ${toName}.`);
        }

        // Check early defeat if player lost all territories
        scheduleTimer(() => {
          const latest = territoriesRef.current;
          const playerHasAny = Object.values(latest).some(
            (t) => t.owner === 'player'
          );
          if (!playerHasAny) {
            soundEngine.playDefeat();
            setScreen('DEFEAT');
            return;
          }
          executeNextStep();
        }, 560);
      };

      scheduleTimer(executeNextStep, 450);
    },
    [
      checkEndGame,
      difficulty,
      scenario,
      scheduleTimer,
      spawnArrow,
      spawnPopup,
      startPlayerTurn,
      triggerHitFlash,
    ]
  );

  const handleAdvancePhase = useCallback(() => {
    if (screen !== 'PLAYING' || phase === 'AI_TURN' || pendingTransfer) return;
    setActiveOrder(null);
    setSelectedId(null);

    if (phase === 'REINFORCE') {
      setPhase('ATTACK');
      setStatusMessage(
        'Giai đoạn Tiến công: Chọn vùng có ≥2 quân, sau đó chọn vùng địch giáp ranh.'
      );
      soundEngine.playSelect();
    } else if (phase === 'ATTACK') {
      setPhase('FORTIFY');
      setStatusMessage(
        'Giai đoạn Điều quân: Chọn 2 vùng thân thiện liên thông để chuyển quân, hoặc Kết thúc lượt.'
      );
      soundEngine.playSelect();
    } else if (phase === 'FORTIFY') {
      soundEngine.playTurnEnd();
      runAiSequence(territoriesRef.current, turn + 1);
    }
  }, [pendingTransfer, phase, runAiSequence, screen, turn]);

  const handleSelectTerritory = useCallback(
    (id: string) => {
      if (screen !== 'PLAYING' || phase === 'AI_TURN' || pendingTransfer) return;

      const clickedState = territories[id];
      const clickedDef = scenario.territories.find((t) => t.id === id);
      if (!clickedState || !clickedDef) return;

      // 1. Active Tactical Order resolution
      if (activeOrder === 'recruit') {
        if (clickedState.owner === 'player' && supply >= 3) {
          setTerritories((prev) => ({
            ...prev,
            [id]: { ...prev[id], troops: prev[id].troops + 3 },
          }));
          setSupply((s) => s - 3);
          setStats((st) => ({ ...st, ordersUsed: st.ordersUsed + 1 }));
          setActiveOrder(null);
          setSelectedId(id);
          spawnPopup(id, '+3 Chiêu mộ', 'positive');
          setStatusMessage(`Đã chiêu mộ +3 quân tại ${clickedDef.name}.`);
          soundEngine.playOrder();
        } else {
          setStatusMessage('Chỉ có thể chiêu mộ trên vùng lãnh thổ của bạn.');
        }
        return;
      }

      if (activeOrder === 'fortify_order') {
        if (clickedState.owner === 'player' && supply >= 2) {
          setTerritories((prev) => ({
            ...prev,
            [id]: { ...prev[id], fortifiedTurn: true },
          }));
          setSupply((s) => s - 2);
          setStats((st) => ({ ...st, ordersUsed: st.ordersUsed + 1 }));
          setActiveOrder(null);
          setSelectedId(id);
          spawnPopup(id, '+1 Phòng thủ', 'positive');
          setStatusMessage(
            `${clickedDef.name} đã dựng công sự (+1 phòng thủ đến hết lượt đối thủ).`
          );
          soundEngine.playOrder();
        } else {
          setStatusMessage('Chọn một vùng lãnh thổ của bạn để gia cố.');
        }
        return;
      }

      if (activeOrder === 'bombard') {
        if (validTargets.has(id) && supply >= 4) {
          const damage = Math.min(2, Math.max(0, clickedState.troops - 1));
          const actualDmg = clickedState.troops > 1 ? damage : 0;
          if (actualDmg === 0) {
            setStatusMessage(
              `${clickedDef.name} chỉ còn 1 quân — hãy tấn công trực tiếp để chiếm!`
            );
            return;
          }
          setTerritories((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              troops: Math.max(1, prev[id].troops - actualDmg),
            },
          }));
          setSupply((s) => s - 4);
          setStats((st) => ({ ...st, ordersUsed: st.ordersUsed + 1 }));
          setActiveOrder(null);
          triggerHitFlash(id);
          spawnPopup(id, `-${actualDmg} Pháo kích`, 'negative');
          setStatusMessage(
            `Pháo kích làm tiêu hao ${actualDmg} quân tại ${clickedDef.name}.`
          );
          soundEngine.playBattle();
        } else {
          setStatusMessage(
            'Chọn vùng địch giáp ranh với lãnh thổ của bạn để pháo kích.'
          );
        }
        return;
      }

      // 2. REINFORCE phase
      if (phase === 'REINFORCE') {
        setSelectedId(id);
        if (clickedState.owner === 'player' && reinforcementsLeft > 0) {
          const addAmt = Math.min(deployBatch, reinforcementsLeft);
          const nextLeft = reinforcementsLeft - addAmt;
          setTerritories((prev) => ({
            ...prev,
            [id]: { ...prev[id], troops: prev[id].troops + addAmt },
          }));
          setReinforcementsLeft(nextLeft);
          spawnPopup(id, `+${addAmt}`, 'positive');
          soundEngine.playDeploy();

          if (nextLeft === 0) {
            setPhase('ATTACK');
            setStatusMessage(
              'Đã đặt hết quân tiếp viện! Chọn vùng có ≥2 quân để Tiến công.'
            );
          } else {
            setStatusMessage(
              `Đã tăng +${addAmt} quân cho ${clickedDef.name}. Còn ${nextLeft} quân chờ đặt.`
            );
          }
        } else if (clickedState.owner !== 'player') {
          setStatusMessage(
            `Đang ở bước Tiếp viện — hãy nhấp vào vùng màu xanh Lam của bạn.`
          );
        }
        return;
      }

      // 3. ATTACK phase
      if (phase === 'ATTACK') {
        if (
          selectedId &&
          selectedId !== id &&
          validTargets.has(id) &&
          territories[selectedId]?.owner === 'player'
        ) {
          const fromDef = scenario.territories.find((t) => t.id === selectedId)!;
          const fromState = territories[selectedId];
          const outcome = resolveCombatRound(
            fromState.troops,
            clickedState.troops,
            clickedDef,
            clickedState.fortifiedTurn,
            'player',
            difficulty
          );

          const nextFromTroops = Math.max(
            1,
            fromState.troops - outcome.attackerLoss
          );
          const nextToTroops = Math.max(
            0,
            clickedState.troops - outcome.defenderLoss
          );

          spawnArrow(selectedId, id, 'attack', '#fb7185');
          triggerHitFlash(id);
          if (outcome.attackerLoss > 0) {
            spawnPopup(selectedId, `-${outcome.attackerLoss}`, 'negative');
          }
          if (outcome.defenderLoss > 0) {
            spawnPopup(
              id,
              outcome.captured ? 'Chiếm lĩnh!' : `-${outcome.defenderLoss}`,
              outcome.captured ? 'capture' : 'positive'
            );
          } else if (outcome.attackerLoss > 0) {
            spawnPopup(id, 'Chặn đứng', 'neutral');
          }

          if (outcome.captured) {
            soundEngine.playCapture();
            const updated: Record<string, TerritoryState> = {
              ...territories,
              [selectedId]: { ...fromState, troops: nextFromTroops },
              [id]: {
                ...clickedState,
                owner: 'player',
                troops: 1,
                fortifiedTurn: false,
              },
            };
            // Reserve 1 troop automatically moved into conquered territory
            const remainingMovable = nextFromTroops - 1;
            if (remainingMovable <= 1) {
              if (remainingMovable === 1) {
                // Player has 2 troops left at source -> move 1, keep 1
                updated[selectedId].troops = 1;
                updated[id].troops = 1;
              }
              setTerritories(updated);
              setSelectedId(id);
              setStats((s) => ({
                ...s,
                battlesWon: s.battlesWon + 1,
                territoriesCaptured: s.territoriesCaptured + 1,
              }));
              setStatusMessage(`Đã chiếm lĩnh ${clickedDef.name}!`);
              checkEndGame(updated);
            } else {
              // Temporarily set 1 troop in conquered and open transfer modal
              updated[selectedId].troops = nextFromTroops - 1;
              updated[id].troops = 1;
              setTerritories(updated);
              setStats((s) => ({
                ...s,
                battlesWon: s.battlesWon + 1,
                territoriesCaptured: s.territoriesCaptured + 1,
              }));
              if (!checkEndGame(updated)) {
                setPendingTransfer({
                  mode: 'conquest',
                  pending: {
                    fromId: selectedId,
                    toId: id,
                    minMove: 1,
                    maxMove: nextFromTroops - 1,
                  },
                });
                setStatusMessage(
                  `Chiếm lĩnh ${clickedDef.name} từ ${fromDef.name}!`
                );
              }
            }
          } else {
            soundEngine.playBattle();
            setTerritories((prev) => ({
              ...prev,
              [selectedId]: { ...prev[selectedId], troops: nextFromTroops },
              [id]: { ...prev[id], troops: nextToTroops },
            }));
            setStats((s) => ({
              ...s,
              battlesWon:
                outcome.defenderLoss >= outcome.attackerLoss
                  ? s.battlesWon + 1
                  : s.battlesWon,
              battlesLost:
                outcome.attackerLoss > outcome.defenderLoss
                  ? s.battlesLost + 1
                  : s.battlesLost,
            }));
            setStatusMessage(
              `Giao tranh tại ${clickedDef.name}: Địch -${outcome.defenderLoss}, Bạn -${outcome.attackerLoss}.`
            );
          }
          return;
        }

        // Select friendly territory as attack origin
        if (clickedState.owner === 'player') {
          setSelectedId(id);
          soundEngine.playSelect();
          if (clickedState.troops < 2) {
            setStatusMessage(
              `${clickedDef.name} chỉ có 1 quân — cần ít nhất 2 quân để xuất kích.`
            );
          } else {
            setStatusMessage(
              `Đã chọn ${clickedDef.name}. Nhấp vào vùng địch có vòng sáng để tiến công.`
            );
          }
        } else {
          setSelectedId(id);
          setStatusMessage(
            `${clickedDef.name} thuộc ${FACTIONS[clickedState.owner].name}. Chọn vùng của bạn để tấn công.`
          );
        }
        return;
      }

      // 4. FORTIFY phase
      if (phase === 'FORTIFY') {
        if (hasFortifiedThisTurn) {
          setSelectedId(id);
          setStatusMessage(
            'Bạn đã điều quân trong lượt này. Hãy nhấn Kết thúc lượt.'
          );
          return;
        }

        if (
          selectedId &&
          selectedId !== id &&
          validTargets.has(id) &&
          areConnectedFriendly(selectedId, id, 'player', scenario, territories)
        ) {
          const srcState = territories[selectedId];
          if (srcState.troops >= 2) {
            setPendingTransfer({
              mode: 'fortify',
              pending: {
                fromId: selectedId,
                toId: id,
                minMove: 1,
                maxMove: srcState.troops - 1,
              },
            });
          }
          return;
        }

        if (clickedState.owner === 'player') {
          setSelectedId(id);
          soundEngine.playSelect();
          setStatusMessage(
            clickedState.troops >= 2
              ? `Chọn một vùng thân thiện liên thông với ${clickedDef.name} để chuyển quân.`
              : `${clickedDef.name} chỉ có 1 quân không thể điều chuyển thêm.`
          );
        } else {
          setSelectedId(id);
        }
      }
    },
    [
      activeOrder,
      checkEndGame,
      deployBatch,
      difficulty,
      hasFortifiedThisTurn,
      pendingTransfer,
      phase,
      reinforcementsLeft,
      scenario,
      screen,
      spawnArrow,
      spawnPopup,
      supply,
      territories,
      triggerHitFlash,
      validTargets,
    ]
  );

  const handleConfirmTransfer = useCallback(
    (amount: number) => {
      if (!pendingTransfer) return;
      const { pending, mode } = pendingTransfer;

      if (mode === 'conquest') {
        // Note: 1 troop was already placed in target upon conquest; amount is total desired in target
        const extraToMove = Math.max(0, amount - 1);
        setTerritories((prev) => {
          const from = prev[pending.fromId];
          const to = prev[pending.toId];
          return {
            ...prev,
            [pending.fromId]: {
              ...from,
              troops: Math.max(1, from.troops - extraToMove),
            },
            [pending.toId]: {
              ...to,
              troops: to.troops + extraToMove,
            },
          };
        });
        setSelectedId(pending.toId);
        setPendingTransfer(null);
        soundEngine.playDeploy();
      } else {
        setTerritories((prev) => {
          const from = prev[pending.fromId];
          const to = prev[pending.toId];
          return {
            ...prev,
            [pending.fromId]: {
              ...from,
              troops: Math.max(1, from.troops - amount),
            },
            [pending.toId]: {
              ...to,
              troops: to.troops + amount,
            },
          };
        });
        spawnArrow(pending.fromId, pending.toId, 'move', '#38bdf8');
        spawnPopup(pending.toId, `+${amount}`, 'positive');
        setHasFortifiedThisTurn(true);
        setSelectedId(pending.toId);
        setPendingTransfer(null);
        setStatusMessage('Đã hoàn tất điều động quân lực. Nhấn Kết thúc lượt!');
        soundEngine.playDeploy();
      }
    },
    [pendingTransfer, spawnArrow, spawnPopup]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }

      if (screen === 'TITLE_MENU') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (screen === 'PAUSED') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setScreen('PLAYING');
        }
        return;
      }

      if (screen === 'PLAYING' && !pendingTransfer) {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (activeOrder) {
            setActiveOrder(null);
          } else if (selectedId) {
            setSelectedId(null);
          } else {
            setScreen('PAUSED');
          }
        } else if (e.key === ' ' || e.key === 'Enter') {
          if (phase !== 'AI_TURN') {
            e.preventDefault();
            handleAdvancePhase();
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeOrder,
    handleAdvancePhase,
    pendingTransfer,
    phase,
    screen,
    selectedId,
    startNewGame,
    toggleMute,
  ]);

  if (screen === 'TITLE_MENU') {
    return (
      <TitleScreen
        selectedMapId={selectedMapId}
        selectedDifficulty={difficulty}
        muted={muted}
        onSelectMap={setSelectedMapId}
        onSelectDifficulty={setDifficulty}
        onToggleMute={toggleMute}
        onStartGame={startNewGame}
      />
    );
  }

  const fromName = pendingTransfer
    ? scenario.territories.find((t) => t.id === pendingTransfer.pending.fromId)
        ?.name ?? ''
    : '';
  const toName = pendingTransfer
    ? scenario.territories.find((t) => t.id === pendingTransfer.pending.toId)
        ?.name ?? ''
    : '';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07131f]">
      <GameMap
        scenario={scenario}
        territories={territories}
        selectedId={selectedId}
        hoveredId={hoveredId}
        phase={phase}
        reinforcementsLeft={reinforcementsLeft}
        activeOrder={activeOrder}
        validTargets={validTargets}
        battleArrows={battleArrows}
        popups={popups}
        hitFlashIds={hitFlashIds}
        onSelectTerritory={handleSelectTerritory}
        onHoverTerritory={setHoveredId}
      />

      <HudOverlay
        scenario={scenario}
        territories={territories}
        turn={turn}
        phase={phase}
        activeAiFaction={activeAiFaction}
        reinforcementsLeft={reinforcementsLeft}
        deployBatch={deployBatch}
        supply={supply}
        selectedId={selectedId}
        activeOrder={activeOrder}
        statusMessage={statusMessage}
        muted={muted}
        onToggleBatch={() => setDeployBatch((b) => (b === 1 ? 5 : 1))}
        onSelectOrder={(order) => {
          setActiveOrder(order);
          if (order === 'recruit') {
            setStatusMessage('Nhấp vào một vùng của bạn để chiêu mộ +3 quân.');
          } else if (order === 'bombard') {
            setStatusMessage(
              'Nhấp vào một vùng địch giáp ranh (có >1 quân) để pháo kích.'
            );
          } else if (order === 'fortify_order') {
            setStatusMessage(
              'Nhấp vào một vùng của bạn để gia cố +1 phòng thủ.'
            );
          }
        }}
        onAdvancePhase={handleAdvancePhase}
        onToggleMute={toggleMute}
        onPause={() => setScreen('PAUSED')}
      />

      {pendingTransfer && (
        <TroopTransferModal
          pending={pendingTransfer.pending}
          fromName={fromName}
          toName={toName}
          mode={pendingTransfer.mode}
          onConfirm={handleConfirmTransfer}
          onCancel={
            pendingTransfer.mode === 'fortify'
              ? () => setPendingTransfer(null)
              : undefined
          }
        />
      )}

      <GameStatusModal
        screenState={screen}
        mapName={scenario.name}
        stats={stats}
        onResume={() => setScreen('PLAYING')}
        onRestart={startNewGame}
        onReturnTitle={() => {
          clearAllTimers();
          setScreen('TITLE_MENU');
        }}
      />
    </div>
  );
}
