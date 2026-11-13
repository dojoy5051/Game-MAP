import React from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { MAP_SCENARIOS } from '../data/maps';
import { Difficulty, MapId } from '../types/game';

interface TitleScreenProps {
  selectedMapId: MapId;
  selectedDifficulty: Difficulty;
  muted: boolean;
  onSelectMap: (id: MapId) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onToggleMute: () => void;
  onStartGame: () => void;
}

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Dễ', hint: 'Đối thủ thận trọng' },
  { id: 'normal', label: 'Trung bình', hint: 'Cân bằng chiến thuật' },
  { id: 'hard', label: 'Khó', hint: 'Đối thủ quyết liệt' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedMapId,
  selectedDifficulty,
  muted,
  onSelectMap,
  onSelectDifficulty,
  onToggleMute,
  onStartGame,
}) => {
  const activeScenario =
    MAP_SCENARIOS.find((m) => m.id === selectedMapId) ?? MAP_SCENARIOS[0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06101b] text-[#f3ead8] flex flex-col justify-between">
      {/* Key-Art Cartographic Backdrop */}
      <div className="absolute inset-0 z-0">
        <img
          src="/src/assets/images/atlas_map_backdrop_1794536095691.jpg"
          alt="Bản đồ hàng hải cổ điển"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-55"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, rgba(6,16,27,0.96) 0%, rgba(6,16,27,0.84) 48%, rgba(6,16,27,0.65) 100%)',
          }}
        />
      </div>

      {/* Top Subtle Mute Control */}
      <div className="relative z-10 flex items-center justify-end px-6 pt-5">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d1d2e]/85 border border-amber-200/20 text-sm text-slate-200 hover:text-amber-300 hover:border-amber-300/40 transition-colors cursor-pointer"
        >
          {muted ? (
            <VolumeX className="w-4 h-4 text-slate-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-amber-300" />
          )}
          <span className="whitespace-nowrap shrink-0">
            {muted ? 'Đang tắt tiếng' : 'Âm thanh bật'}
          </span>
        </button>
      </div>

      {/* Center Hero & Setup */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-6 sm:px-10 py-4 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left: Bespoke Title Lockup + Primary CTA */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-4">
            <svg
              width="58"
              height="58"
              viewBox="0 0 64 64"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="#0b1a2b"
                stroke="#d4af37"
                strokeWidth="1.8"
              />
              <circle
                cx="32"
                cy="32"
                r="22"
                fill="none"
                stroke="#d4af37"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <path d="M 32 8 L 36 27 L 32 23 L 28 27 Z" fill="#fbbf24" />
              <path d="M 32 56 L 36 37 L 32 41 L 28 37 Z" fill="#64748b" />
              <path d="M 8 32 L 27 28 L 23 32 L 27 36 Z" fill="#64748b" />
              <path d="M 56 32 L 37 28 L 41 32 L 37 36 Z" fill="#64748b" />
              <circle cx="32" cy="32" r="4" fill="#fbbf24" />
            </svg>
            <div>
              <p className="text-xs tracking-widest uppercase text-amber-300/85 font-medium">
                Chiến Thuật Bản Đồ Theo Lượt
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#fdf6e7] text-balance leading-tight mt-0.5">
                Atlas Chiến Lược
              </h1>
            </div>
          </div>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
            Chỉ huy Vương Quốc Lam Hải mở rộng bờ cõi trên bản đồ cổ đại. Chiếm
            giữ thương cảng, trấn thủ pháo đài và thống nhất toàn bộ các vùng
            lãnh thổ trước hai đế chế đối địch.
          </p>

          {/* Difficulty Selector */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400">
              Mức độ thử thách
            </span>
            <div className="inline-flex items-center gap-1 p-1 bg-[#0b1929]/90 border border-slate-700/70 rounded-lg">
              {DIFFICULTIES.map((d) => {
                const active = selectedDifficulty === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectDifficulty(d.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">
              {DIFFICULTIES.find((d) => d.id === selectedDifficulty)?.hint}
            </p>
          </div>

          {/* Primary CTA */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onStartGame}
              className="inline-flex items-center gap-3 px-8 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-semibold text-base shadow-lg shadow-amber-950/40 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>Bắt đầu</span>
            </button>
          </div>
        </div>

        {/* Right: Scenario Selector Panel */}
        <div className="lg:col-span-6 bg-[#0a1624]/88 border border-amber-200/20 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-baseline justify-between border-b border-slate-800 pb-3">
            <h2 className="font-display text-lg font-semibold text-amber-200">
              Chọn Bản Đồ Chiến Trường
            </h2>
            <span className="text-xs text-slate-400 font-mono-num">
              3 Chiến Dịch
            </span>
          </div>

          <div className="space-y-2.5">
            {MAP_SCENARIOS.map((map) => {
              const isSelected = map.id === selectedMapId;
              return (
                <button
                  key={map.id}
                  type="button"
                  onClick={() => onSelectMap(map.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#12273e] border-amber-400/70'
                      : 'bg-[#0d1c2d]/70 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-display text-base font-semibold text-[#fdf6e7]">
                      {map.name}
                    </span>
                    <span className="text-xs text-amber-300/90 whitespace-nowrap shrink-0">
                      {map.subtitle}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                    {map.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Bản đồ đang chọn: {activeScenario.name}</span>
            <span className="font-mono-num">
              {activeScenario.territories.length} Lãnh thổ
            </span>
          </div>
        </div>
      </main>

      {/* Single Flat Control Hint Line */}
      <footer className="relative z-10 px-6 pb-5 text-center">
        <p className="text-xs sm:text-sm text-slate-400">
          Nhấp chọn lãnh thổ · Kéo để di chuyển bản đồ · Enter / Space Bắt đầu hoặc Qua bước · Esc Tạm dừng
        </p>
      </footer>
    </div>
  );
};
