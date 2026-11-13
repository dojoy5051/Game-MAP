export type GameScreenState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'VICTORY'
  | 'DEFEAT';

export type TurnPhase = 'REINFORCE' | 'ATTACK' | 'FORTIFY' | 'AI_TURN';

export type FactionId = 'player' | 'crimson' | 'amber' | 'neutral';

export type TerrainType = 'capital' | 'fortress' | 'port' | 'plains';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type MapId = 'archipelago' | 'continent' | 'three_kingdoms';

export interface FactionInfo {
  id: FactionId;
  name: string;
  shortName: string;
  fill: string;
  fillHover: string;
  stroke: string;
  badgeBg: string;
  badgeText: string;
  accentHex: string;
  isHuman: boolean;
}

export interface RegionDefinition {
  id: string;
  name: string;
  bonus: number;
  tint: string;
  labelX: number;
  labelY: number;
}

export interface TerritoryDefinition {
  id: string;
  name: string;
  regionId: string;
  terrain: TerrainType;
  path: string;
  cx: number;
  cy: number;
  neighbors: string[];
  seaLinks?: string[];
  initialOwner: FactionId;
  initialTroops: number;
}

export interface MapScenario {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  regions: RegionDefinition[];
  territories: TerritoryDefinition[];
  factions: FactionId[];
}

export interface TerritoryState {
  id: string;
  owner: FactionId;
  troops: number;
  fortifiedTurn: boolean;
}

export interface ActiveBattleArrow {
  id: string;
  fromId: string;
  toId: string;
  kind: 'attack' | 'move' | 'bombard';
  color: string;
}

export interface FloatingPopup {
  id: string;
  territoryId: string;
  text: string;
  tone: 'positive' | 'negative' | 'capture' | 'neutral';
}

export interface PendingConquest {
  fromId: string;
  toId: string;
  minMove: number;
  maxMove: number;
}

export interface MatchStats {
  turns: number;
  battlesWon: number;
  battlesLost: number;
  territoriesCaptured: number;
  ordersUsed: number;
}
