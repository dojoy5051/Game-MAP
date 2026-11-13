import React, { useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { FACTIONS } from '../data/maps';
import {
  ActiveBattleArrow,
  FloatingPopup,
  MapScenario,
  TerritoryDefinition,
  TerritoryState,
  TurnPhase,
} from '../types/game';

interface GameMapProps {
  scenario: MapScenario;
  territories: Record<string, TerritoryState>;
  selectedId: string | null;
  hoveredId: string | null;
  phase: TurnPhase;
  reinforcementsLeft: number;
  activeOrder: 'recruit' | 'bombard' | 'fortify_order' | null;
  validTargets: Set<string>;
  battleArrows: ActiveBattleArrow[];
  popups: FloatingPopup[];
  hitFlashIds: Set<string>;
  onSelectTerritory: (id: string) => void;
  onHoverTerritory: (id: string | null) => void;
}

function getCurvedPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bend = 24
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function TerrainGlyph({
  terrain,
  x,
  y,
}: {
  terrain: TerritoryDefinition['terrain'];
  x: number;
  y: number;
}) {
  if (terrain === 'plains') return null;

  return (
    <g transform={`translate(${x}, ${y})`} className="pointer-events-none">
      <circle
        r={10}
        fill="#0b1522"
        fillOpacity={0.85}
        stroke="#e2c275"
        strokeWidth={1.1}
      />
      {terrain === 'capital' && (
        <path
          d="M -5 3 L -6 -3 L -2 0 L 0 -5 L 2 0 L 6 -3 L 5 3 Z"
          fill="#fbbf24"
          stroke="#fef3c7"
          strokeWidth={0.6}
        />
      )}
      {terrain === 'fortress' && (
        <path
          d="M -4.5 -4 L 4.5 -4 L 4.5 1 C 4.5 4 0 6 0 6 C 0 6 -4.5 4 -4.5 1 Z"
          fill="#cbd5e1"
          stroke="#f8fafc"
          strokeWidth={0.7}
        />
      )}
      {terrain === 'port' && (
        <g stroke="#7dd3fc" strokeWidth={1.3} fill="none" strokeLinecap="round">
          <line x1="0" y1="-4.5" x2="0" y2="4.5" />
          <line x1="-3" y1="-2" x2="3" y2="-2" />
          <path d="M -4 1.5 C -4 4.5 4 4.5 4 1.5" />
        </g>
      )}
    </g>
  );
}

export const GameMap: React.FC<GameMapProps> = ({
  scenario,
  territories,
  selectedId,
  hoveredId,
  phase,
  reinforcementsLeft,
  activeOrder,
  validTargets,
  battleArrows,
  popups,
  hitFlashIds,
  onSelectTerritory,
  onHoverTerritory,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  const defMap = useMemo(
    () => new Map(scenario.territories.map((t) => [t.id, t])),
    [scenario]
  );

  // Deduplicated connections for rendering sea lanes & land bridges
  const connections = useMemo(() => {
    const seen = new Set<string>();
    const list: { from: TerritoryDefinition; to: TerritoryDefinition; isSea: boolean }[] = [];

    for (const t of scenario.territories) {
      for (const nId of t.neighbors) {
        const key = [t.id, nId].sort().join('--');
        if (seen.has(key)) continue;
        seen.add(key);
        const target = defMap.get(nId);
        if (!target) continue;
        const isSea = Boolean(t.seaLinks?.includes(nId));
        list.push({ from: t, to: target, isSea });
      }
    }
    return list;
  }, [scenario, defMap]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 6) {
      dragRef.current.moved = true;
      setIsDragging(true);
      setPan({
        x: Math.max(-360, Math.min(360, dragRef.current.panX + dx)),
        y: Math.max(-240, Math.min(240, dragRef.current.panY + dy)),
      });
    }
  };

  const handlePointerUp = () => {
    setTimeout(() => {
      dragRef.current = null;
      setIsDragging(false);
    }, 0);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    setZoom((prev) => Math.max(0.75, Math.min(1.85, Number((prev + delta).toFixed(2)))));
  };

  const handleTerritoryClick = (id: string) => {
    if (dragRef.current?.moved) return;
    onSelectTerritory(id);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const isTargetSelectionActive =
    validTargets.size > 0 &&
    (phase === 'ATTACK' || phase === 'FORTIFY' || activeOrder !== null);

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#07131f] ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Subtle Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, transparent 55%, rgba(4, 10, 18, 0.72) 100%)',
        }}
      />

      {/* Interactive Pan/Zoom Container */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-150 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg
          viewBox="0 0 1200 720"
          className="w-full h-full max-w-[1440px] max-h-full select-none"
          aria-label={`Bản đồ chiến thuật ${scenario.name}`}
        >
          <defs>
            <radialGradient id="oceanGrad" cx="50%" cy="46%" r="65%">
              <stop offset="0%" stopColor="#122c46" />
              <stop offset="65%" stopColor="#0b1d30" />
              <stop offset="100%" stopColor="#06111d" />
            </radialGradient>

            <filter id="landShadow" x="-10%" y="-10%" width="125%" height="125%">
              <feDropShadow
                dx="0"
                dy="5"
                stdDeviation="5"
                floodColor="#020810"
                floodOpacity="0.65"
              />
            </filter>

            <filter id="selectedGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="7"
                floodColor="#fbbf24"
                floodOpacity="0.85"
              />
            </filter>

            <marker
              id="arrowAttack"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#fb7185" />
            </marker>

            <marker
              id="arrowMove"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#38bdf8" />
            </marker>

            <marker
              id="arrowBombard"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#fbbf24" />
            </marker>
          </defs>

          {/* Ocean Surface */}
          <rect x="0" y="0" width="1200" height="720" fill="url(#oceanGrad)" />

          {/* Cartographic Lat/Long Grid & Rhumb Lines */}
          <g stroke="rgba(148, 163, 184, 0.08)" strokeWidth="1">
            {[160, 320, 480, 640, 800, 960, 1120].map((x) => (
              <line key={`vx-${x}`} x1={x} y1={0} x2={x} y2={720} />
            ))}
            {[120, 240, 360, 480, 600].map((y) => (
              <line key={`hy-${y}`} x1={0} y1={y} x2={1200} y2={y} />
            ))}
            {/* Rhumb lines radiating from Compass Rose */}
            <line x1="102" y1="622" x2="1200" y2="120" strokeDasharray="3 7" />
            <line x1="102" y1="622" x2="720" y2="0" strokeDasharray="3 7" />
            <line x1="102" y1="622" x2="1200" y2="470" strokeDasharray="3 7" />
          </g>

          {/* Subtle Decorative Compass Rose (Bottom Left Ocean) */}
          <g transform="translate(102, 622)" opacity="0.34" className="pointer-events-none">
            <circle r="44" fill="none" stroke="#d4af37" strokeWidth="1" />
            <circle r="36" fill="none" stroke="#d4af37" strokeWidth="0.6" strokeDasharray="2 3" />
            <path d="M 0 -48 L 7 -9 L 0 -14 L -7 -9 Z" fill="#e2c275" />
            <path d="M 0 48 L 7 9 L 0 14 L -7 9 Z" fill="#94a3b8" />
            <path d="M -48 0 L -9 -7 L -14 0 L -9 7 Z" fill="#94a3b8" />
            <path d="M 48 0 L 9 -7 L 14 0 L 9 7 Z" fill="#94a3b8" />
            <circle r="4" fill="#d4af37" />
            <text
              x="0"
              y="-53"
              textAnchor="middle"
              fill="#e2c275"
              fontSize="11"
              className="font-display"
            >
              B
            </text>
          </g>

          {/* Region Subtle Labels */}
          <g className="pointer-events-none">
            {scenario.regions.map((region) => (
              <g key={region.id} transform={`translate(${region.labelX}, ${region.labelY})`}>
                <text
                  textAnchor="middle"
                  fill="rgba(226, 194, 117, 0.52)"
                  fontSize="13"
                  letterSpacing="2"
                  className="font-display uppercase"
                >
                  {region.name} (+{region.bonus})
                </text>
              </g>
            ))}
          </g>

          {/* Connections (Sea Lanes & Land Passes) */}
          <g className="pointer-events-none">
            {connections.map(({ from, to, isSea }) => {
              const isHighlighted =
                selectedId === from.id ||
                selectedId === to.id ||
                hoveredId === from.id ||
                hoveredId === to.id;

              if (isSea) {
                return (
                  <path
                    key={`conn-${from.id}-${to.id}`}
                    d={getCurvedPath(from.cx, from.cy, to.cx, to.cy, 28)}
                    fill="none"
                    stroke={isHighlighted ? '#38bdf8' : 'rgba(125, 211, 252, 0.35)'}
                    strokeWidth={isHighlighted ? 2.4 : 1.5}
                    strokeDasharray="6 6"
                    className={isHighlighted ? 'animate-dash-flow' : ''}
                  />
                );
              }

              return (
                <line
                  key={`conn-${from.id}-${to.id}`}
                  x1={from.cx}
                  y1={from.cy}
                  x2={to.cx}
                  y2={to.cy}
                  stroke={isHighlighted ? '#fde68a' : 'rgba(226, 232, 240, 0.24)'}
                  strokeWidth={isHighlighted ? 2.4 : 1.3}
                  strokeDasharray="3 4"
                />
              );
            })}
          </g>

          {/* Territories */}
          <g>
            {scenario.territories.map((t) => {
              const state = territories[t.id];
              const owner = state?.owner ?? 'neutral';
              const faction = FACTIONS[owner];
              const isSelected = selectedId === t.id;
              const isHovered = hoveredId === t.id;
              const isValidTarget = validTargets.has(t.id);
              const isReinforceEligible =
                phase === 'REINFORCE' &&
                reinforcementsLeft > 0 &&
                owner === 'player' &&
                !activeOrder;
              const isFlashing = hitFlashIds.has(t.id);

              const dimOther =
                isTargetSelectionActive && !isValidTarget && !isSelected;

              return (
                <g
                  key={t.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTerritoryClick(t.id);
                  }}
                  onMouseEnter={() => onHoverTerritory(t.id)}
                  onMouseLeave={() => onHoverTerritory(null)}
                  className="cursor-pointer transition-opacity duration-150"
                  style={{ opacity: dimOther ? 0.62 : 1 }}
                >
                  {/* Territory Polygon */}
                  <path
                    d={t.path}
                    fill={
                      isHovered || isSelected || isValidTarget
                        ? faction.fillHover
                        : faction.fill
                    }
                    stroke={
                      isSelected
                        ? '#fbbf24'
                        : isValidTarget
                        ? '#f43f5e'
                        : isReinforceEligible
                        ? '#7dd3fc'
                        : faction.stroke
                    }
                    strokeWidth={
                      isSelected ? 3.5 : isValidTarget ? 3 : isHovered ? 2.6 : 1.7
                    }
                    strokeLinejoin="round"
                    filter={isSelected ? 'url(#selectedGlow)' : 'url(#landShadow)'}
                  />

                  {/* Subtle Inner Coastline Rim */}
                  <path
                    d={t.path}
                    fill="none"
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="0.9"
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  />

                  {/* Hit Flash Overlay */}
                  {isFlashing && (
                    <path
                      d={t.path}
                      fill="#ffffff"
                      className="pointer-events-none animate-hit-flash"
                    />
                  )}

                  {/* Valid Target Pulsing Crosshair Ring */}
                  {isValidTarget && (
                    <g
                      transform={`translate(${t.cx}, ${t.cy})`}
                      className="pointer-events-none animate-pulse-ring"
                    >
                      <circle
                        r={26}
                        fill="none"
                        stroke={
                          activeOrder === 'bombard'
                            ? '#fbbf24'
                            : phase === 'FORTIFY'
                            ? '#38bdf8'
                            : '#fb7185'
                        }
                        strokeWidth={2.2}
                        strokeDasharray="5 4"
                      />
                    </g>
                  )}

                  {/* Reinforce Ready Ring */}
                  {isReinforceEligible && isHovered && (
                    <circle
                      cx={t.cx}
                      cy={t.cy}
                      r={24}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      className="pointer-events-none"
                    />
                  )}

                  {/* Terrain Icon Badge */}
                  <TerrainGlyph terrain={t.terrain} x={t.cx + 18} y={t.cy - 18} />

                  {/* Fortified Shield Indicator */}
                  {state?.fortifiedTurn && (
                    <g
                      transform={`translate(${t.cx - 19}, ${t.cy - 17})`}
                      className="pointer-events-none"
                    >
                      <circle r={8} fill="#0f172a" stroke="#fbbf24" strokeWidth={1.2} />
                      <path
                        d="M -3 -3 L 3 -3 L 3 1 C 3 3 0 4.5 0 4.5 C 0 4.5 -3 3 -3 1 Z"
                        fill="#fbbf24"
                      />
                    </g>
                  )}

                  {/* Troop Count Badge */}
                  <g
                    transform={`translate(${t.cx}, ${t.cy - 4})`}
                    className="pointer-events-none"
                  >
                    <circle
                      r={16}
                      fill={faction.badgeBg}
                      stroke="#08131f"
                      strokeWidth={2.4}
                    />
                    <text
                      y={5}
                      textAnchor="middle"
                      fill={faction.badgeText}
                      fontSize="14"
                      fontWeight="700"
                      className="font-mono-num"
                    >
                      {state?.troops ?? 0}
                    </text>
                  </g>

                  {/* Territory Name Label */}
                  <text
                    x={t.cx}
                    y={t.cy + 27}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="12"
                    fontWeight="600"
                    stroke="#06101c"
                    strokeWidth="3.5"
                    paintOrder="stroke"
                    className="pointer-events-none"
                  >
                    {t.name}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Animated Battle & Movement Arrows */}
          <g className="pointer-events-none">
            {battleArrows.map((arrow) => {
              const from = defMap.get(arrow.fromId);
              const to = defMap.get(arrow.toId);
              if (!from || !to) return null;
              const marker =
                arrow.kind === 'attack'
                  ? 'url(#arrowAttack)'
                  : arrow.kind === 'bombard'
                  ? 'url(#arrowBombard)'
                  : 'url(#arrowMove)';
              return (
                <path
                  key={arrow.id}
                  d={getCurvedPath(from.cx, from.cy - 4, to.cx, to.cy - 4, 22)}
                  fill="none"
                  stroke={arrow.color}
                  strokeWidth={3.5}
                  strokeDasharray="7 5"
                  markerEnd={marker}
                  className="animate-dash-flow"
                />
              );
            })}
          </g>

          {/* Floating Combat / Reinforce Popups */}
          <g className="pointer-events-none">
            {popups.map((p) => {
              const def = defMap.get(p.territoryId);
              if (!def) return null;
              const color =
                p.tone === 'positive'
                  ? '#34d399'
                  : p.tone === 'negative'
                  ? '#fb7185'
                  : p.tone === 'capture'
                  ? '#fbbf24'
                  : '#e2e8f0';
              return (
                <g
                  key={p.id}
                  transform={`translate(${def.cx}, ${def.cy - 34})`}
                >
                  <g className="animate-float-pop">
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      fill={color}
                      fontSize="15"
                      fontWeight="700"
                      stroke="#050c15"
                      strokeWidth="4"
                      paintOrder="stroke"
                    >
                      {p.text}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Map Zoom Controls (Bottom Right, compact & unobtrusive) */}
      <div className="absolute right-4 bottom-24 sm:bottom-5 z-20 flex items-center gap-1.5 bg-[#0b1826]/90 border border-amber-200/15 rounded-lg p-1 shadow-lg">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(1.85, Number((z + 0.15).toFixed(2))))}
          aria-label="Phóng to bản đồ"
          className="w-9 h-9 flex items-center justify-center rounded-md text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
          aria-label="Thu nhỏ bản đồ"
          className="w-9 h-9 flex items-center justify-center rounded-md text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Đặt lại góc nhìn"
          className="w-9 h-9 flex items-center justify-center rounded-md text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
