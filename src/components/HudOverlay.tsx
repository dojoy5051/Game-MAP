import React, { useState } from 'react';
import {
  Anchor,
  BookOpen,
  Crown,
  Crosshair,
  Pause,
  Plus,
  Shield,
  Swords,
  Volume2,
  VolumeX,
  ArrowRight,
  X,
} from 'lucide-react';
import { FACTIONS, getTerrainLabel } from '../data/maps';
import {
  FactionId,
  MapScenario,
  TerritoryState,
  TurnPhase,
} from '../types/game';

interface HudOverlayProps {
  scenario: MapScenario;
  territories: Record<string, TerritoryState>;
  turn: number;
  phase: TurnPhase;
  activeAiFaction: FactionId | null;
  reinforcementsLeft: number;
  deployBatch: 1 | 5;
  supply: number;
  selectedId: string | null;
  activeOrder: 'recruit' | 'bombard' | 'fortify_order' | null;
  statusMessage: string;
  muted: boolean;
  onToggleBatch: () => void;
  onSelectOrder: (order: 'recruit' | 'bombard' | 'fortify_order' | null) => void;
  onAdvancePhase: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  scenario,
  territories,
  turn,
  phase,
  activeAiFaction,
  reinforcementsLeft,
  deployBatch,
  supply,
  selectedId,
  activeOrder,
  statusMessage,
  muted,
  onToggleBatch,
  onSelectOrder,
  onAdvancePhase,
  onToggleMute,
  onPause,
}) => {
  const [showLegend, setShowLegend] = useState(false);

  const selectedDef = scenario.territories.find((t) => t.id === selectedId);
  const selectedState = selectedId ? territories[selectedId] : undefined;
  const selectedRegion = selectedDef
    ? scenario.regions.find((r) => r.id === selectedDef.regionId)
    : undefined;

  // Faction territory counts
  const counts: Record<FactionId, number> = {
    player: 0,
    crimson: 0,
    amber: 0,
    neutral: 0,
  };
  for (const t of scenario.territories) {
    const owner = territories[t.id]?.owner ?? 'neutral';
    counts[owner] += 1;
  }
  const totalTerritories = scenario.territories.length;

  const isPlayerTurn = phase !== 'AI_TURN';

  const nextButtonLabel =
    phase === 'REINFORCE'
      ? 'Sang Tiến công'
      : phase === 'ATTACK'
      ? 'Sang Điều quân'
      : phase === 'FORTIFY'
      ? 'Kết thúc lượt'
      : 'Đang hành quân...';

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
      {/* Top Bar Clusters */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Top-Left: Turn, Phase & Territory Share */}
        <div className="pointer-events-auto bg-[#0a1624]/92 border border-amber-200/20 rounded-xl px-4 py-2.5 shadow-lg max-w-full">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="font-display text-sm font-bold text-amber-300 whitespace-nowrap">
                Lượt {turn}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-xs sm:text-sm font-medium text-slate-100 whitespace-nowrap">
                {isPlayerTurn
                  ? 'Lượt của bạn'
                  : `Lượt ${
                      activeAiFaction ? FACTIONS[activeAiFaction].shortName : 'Đối thủ'
                    }`}
              </span>
            </div>

            {/* Phase Stepper */}
            <div className="flex items-center gap-1 text-xs">
              {(
                [
                  { id: 'REINFORCE', label: '1. Tiếp viện' },
                  { id: 'ATTACK', label: '2. Tiến công' },
                  { id: 'FORTIFY', label: '3. Điều quân' },
                ] as { id: TurnPhase; label: string }[]
              ).map((step, i) => {
                const active = phase === step.id;
                return (
                  <React.Fragment key={step.id}>
                    {i > 0 && (
                      <span className="text-slate-600 px-0.5" aria-hidden="true">
                        /
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded whitespace-nowrap ${
                        active
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Faction Territory Share Bar */}
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex min-w-[160px]">
              {(['player', 'crimson', 'amber', 'neutral'] as FactionId[]).map(
                (fid) => {
                  const pct = (counts[fid] / totalTerritories) * 100;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={fid}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: FACTIONS[fid].badgeBg,
                      }}
                      className="h-full transition-all duration-300"
                    />
                  );
                }
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono-num text-slate-300 whitespace-nowrap">
              <span className="text-sky-300">Bạn {counts.player}</span>
              <span className="text-slate-600">·</span>
              <span className="text-rose-300">Đỏ {counts.crimson}</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300">Vàng {counts.amber}</span>
            </div>
          </div>
        </div>

        {/* Top-Right: Resources & Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="bg-[#0a1624]/92 border border-amber-200/20 rounded-xl px-3.5 py-2 flex items-center gap-4 text-xs sm:text-sm shadow-lg">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-400">Quân chờ:</span>
              <span className="font-mono-num font-bold text-sky-300 text-base">
                {reinforcementsLeft}
              </span>
            </div>
            <span className="text-slate-700" aria-hidden="true">
              |
            </span>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-400">Tiếp tế:</span>
              <span className="font-mono-num font-bold text-amber-300 text-base">
                {supply}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            aria-label="Chú giải bản đồ"
            className={`h-10 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              showLegend
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-[#0a1624]/92 border-amber-200/20 text-slate-200 hover:text-amber-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Chú giải</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="w-10 h-10 rounded-xl bg-[#0a1624]/92 border border-amber-200/20 flex items-center justify-center text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-300" />
            )}
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Tạm dừng"
            className="h-10 px-3 rounded-xl bg-[#0a1624]/92 border border-amber-200/20 flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Pause className="w-4 h-4" />
            <span className="hidden sm:inline">Tạm dừng</span>
          </button>
        </div>
      </div>

      {/* Collapsible Legend Popover */}
      {showLegend && (
        <div className="pointer-events-auto self-end mt-2 w-80 bg-[#0a1624]/96 border border-amber-200/25 rounded-xl p-4 shadow-2xl space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-display text-sm font-semibold text-amber-200">
              Chú Giải Địa Hình & Lệnh
            </span>
            <button
              type="button"
              onClick={() => setShowLegend(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
              aria-label="Đóng chú giải"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-slate-300">
            <div className="flex items-center gap-2.5">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Thủ Đô: +2 quân tiếp viện mỗi lượt & +1 phòng thủ</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-slate-300 shrink-0" />
              <span>Pháo Đài: +1 lợi thế xúc xắc khi phòng thủ</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Anchor className="w-4 h-4 text-sky-300 shrink-0" />
              <span>Thương Cảng: +1 điểm Tiếp tế mỗi lượt</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 text-slate-400 leading-relaxed">
            Chiếm trọn 1 vùng lãnh thổ để nhận thưởng quân hàng lượt. Đường đứt nét xanh là tuyến hải hành vượt biển.
          </div>
        </div>
      )}

      {/* Bottom Compact Command Dock */}
      <div className="flex justify-center">
        <div className="pointer-events-auto bg-[#0a1624]/94 border border-amber-200/20 rounded-xl px-4 py-2.5 shadow-xl flex flex-wrap items-center justify-between gap-3 sm:gap-5 max-w-4xl w-full">
          {/* Selected Territory / Guidance */}
          <div className="min-w-[200px] flex-1">
            {selectedDef && selectedState ? (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span className="font-display text-sm font-semibold text-[#fdf6e7]">
                  {selectedDef.name}
                </span>
                <span className="text-xs text-slate-400">
                  {selectedRegion?.name}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: FACTIONS[selectedState.owner].accentHex }}
                >
                  {FACTIONS[selectedState.owner].shortName} ({selectedState.troops} quân)
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs text-amber-200/80">
                  {getTerrainLabel(selectedDef.terrain)}
                </span>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-slate-300">{statusMessage}</p>
            )}
            {selectedDef && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {statusMessage}
              </p>
            )}
          </div>

          {/* Phase Tools & Tactical Orders */}
          <div className="flex flex-wrap items-center gap-2">
            {isPlayerTurn && phase === 'REINFORCE' && reinforcementsLeft > 0 && (
              <button
                type="button"
                onClick={onToggleBatch}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono-num font-semibold text-sky-300 transition-colors cursor-pointer whitespace-nowrap"
                title="Đổi số quân đặt mỗi lần nhấp"
              >
                Đặt +{deployBatch}
              </button>
            )}

            {isPlayerTurn && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={supply < 3 && activeOrder !== 'recruit'}
                  onClick={() =>
                    onSelectOrder(activeOrder === 'recruit' ? null : 'recruit')
                  }
                  className={`px-2.5 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeOrder === 'recruit'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                      : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-emerald-400/60'
                  }`}
                  title="Tăng ngay +3 quân cho 1 vùng của bạn (Tốn 3 Tiếp tế)"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Chiêu mộ</span>
                  <span className="font-mono-num opacity-80">(3)</span>
                </button>

                <button
                  type="button"
                  disabled={supply < 4 && activeOrder !== 'bombard'}
                  onClick={() =>
                    onSelectOrder(activeOrder === 'bombard' ? null : 'bombard')
                  }
                  className={`px-2.5 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeOrder === 'bombard'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-amber-400/60'
                  }`}
                  title="Pháo kích -2 quân một vùng giáp ranh của địch (Tốn 4 Tiếp tế)"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Pháo kích</span>
                  <span className="font-mono-num opacity-80">(4)</span>
                </button>

                <button
                  type="button"
                  disabled={supply < 2 && activeOrder !== 'fortify_order'}
                  onClick={() =>
                    onSelectOrder(
                      activeOrder === 'fortify_order' ? null : 'fortify_order'
                    )
                  }
                  className={`px-2.5 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeOrder === 'fortify_order'
                      ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                      : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-sky-400/60'
                  }`}
                  title="Gia cố +1 phòng thủ lượt này cho 1 vùng của bạn (Tốn 2 Tiếp tế)"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Vững thành</span>
                  <span className="font-mono-num opacity-80">(2)</span>
                </button>
              </div>
            )}

            {/* Primary Advance Phase CTA */}
            <button
              type="button"
              disabled={!isPlayerTurn}
              onClick={onAdvancePhase}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {phase === 'ATTACK' ? (
                <Swords className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>{nextButtonLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
