import React, { useEffect, useState } from 'react';
import { Award, Flag, Play, RotateCcw, ShieldAlert } from 'lucide-react';
import {
  GameScreenState,
  MatchStats,
  PendingConquest,
} from '../types/game';

interface TroopTransferModalProps {
  pending: PendingConquest;
  fromName: string;
  toName: string;
  mode: 'conquest' | 'fortify';
  onConfirm: (amount: number) => void;
  onCancel?: () => void;
}

export const TroopTransferModal: React.FC<TroopTransferModalProps> = ({
  pending,
  fromName,
  toName,
  mode,
  onConfirm,
  onCancel,
}) => {
  const [amount, setAmount] = useState(pending.maxMove);

  useEffect(() => {
    setAmount(
      mode === 'conquest'
        ? Math.max(pending.minMove, Math.ceil(pending.maxMove * 0.7))
        : Math.max(pending.minMove, Math.floor(pending.maxMove / 2))
    );
  }, [pending, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(amount);
      } else if (e.key === 'Escape' && mode === 'fortify' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [amount, mode, onConfirm, onCancel]);

  const half = Math.max(
    pending.minMove,
    Math.floor((pending.minMove + pending.maxMove) / 2)
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 p-4">
      <div className="w-full max-w-md bg-[#0b1826] border border-amber-300/35 rounded-xl p-6 shadow-2xl space-y-5">
        <div>
          <p className="text-xs font-medium text-amber-300 uppercase tracking-wider">
            {mode === 'conquest' ? 'Chiếm Lĩnh Thành Công' : 'Điều Động Quân Lực'}
          </p>
          <h3 className="font-display text-xl font-bold text-[#fdf6e7] mt-1">
            {fromName} → {toName}
          </h3>
          <p className="text-sm text-slate-300 mt-1">
            Chọn số quân tiến vào {toName} (cần giữ lại ít nhất 1 quân ở {fromName}).
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Số quân điều chuyển</span>
            <span className="font-mono-num text-2xl font-bold text-amber-300">
              {amount}
            </span>
          </div>

          <input
            type="range"
            min={pending.minMove}
            max={pending.maxMove}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAmount(pending.minMove)}
              className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono-num text-slate-200 cursor-pointer"
            >
              Tối thiểu ({pending.minMove})
            </button>
            <button
              type="button"
              onClick={() => setAmount(half)}
              className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono-num text-slate-200 cursor-pointer"
            >
              Một nửa ({half})
            </button>
            <button
              type="button"
              onClick={() => setAmount(pending.maxMove)}
              className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono-num text-slate-200 cursor-pointer"
            >
              Tối đa ({pending.maxMove})
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          {mode === 'fortify' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors cursor-pointer"
            >
              Hủy
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm(amount)}
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

interface OverlayModalProps {
  screenState: GameScreenState;
  mapName: string;
  stats: MatchStats;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const GameStatusModal: React.FC<OverlayModalProps> = ({
  screenState,
  mapName,
  stats,
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  if (
    screenState !== 'PAUSED' &&
    screenState !== 'VICTORY' &&
    screenState !== 'DEFEAT'
  ) {
    return null;
  }

  const isVictory = screenState === 'VICTORY';
  const isDefeat = screenState === 'DEFEAT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-lg bg-[#0a1624] border border-amber-300/30 rounded-xl p-6 sm:p-7 shadow-2xl space-y-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isVictory
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                : isDefeat
                ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                : 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
            }`}
          >
            {isVictory ? (
              <Award className="w-6 h-6" />
            ) : isDefeat ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <Flag className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400">{mapName}</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#fdf6e7]">
              {isVictory
                ? 'Thống Nhất Bản Đồ!'
                : isDefeat
                ? 'Vương Quốc Thất Thủ'
                : 'Tạm Dừng Chiến Dịch'}
            </h2>
          </div>
        </div>

        {screenState === 'PAUSED' ? (
          <div className="space-y-3 text-sm text-slate-300 bg-[#0d1c2e] border border-slate-800 rounded-lg p-4">
            <p className="font-semibold text-amber-200">Hướng dẫn nhanh</p>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300">
              <li>
                <span className="font-medium text-white">Tiếp viện:</span> Nhấp
                vào vùng của bạn để bổ sung quân lực.
              </li>
              <li>
                <span className="font-medium text-white">Tiến công:</span> Chọn
                vùng có từ 2 quân trở lên, sau đó nhấp vùng địch giáp ranh.
              </li>
              <li>
                <span className="font-medium text-white">Điều quân:</span> Chuyển
                quân giữa các vùng thân thiện nối liền nhau trước khi kết thúc lượt.
              </li>
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              {isVictory
                ? 'Toàn bộ các vùng lãnh thổ, thương cảng và pháo đài trên bản đồ đã quy về một mối dưới lá cờ Lam Hải.'
                : 'Lãnh thổ cuối cùng của Vương Quốc Lam Hải đã bị đánh chiếm. Hãy chấn chỉnh đội hình và tái chiến.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-[#0d1c2e] border border-slate-800 rounded-lg p-3">
                <span className="text-xs text-slate-400 block">Số lượt</span>
                <span className="font-mono-num text-xl font-bold text-amber-300">
                  {stats.turns}
                </span>
              </div>
              <div className="bg-[#0d1c2e] border border-slate-800 rounded-lg p-3">
                <span className="text-xs text-slate-400 block">Vùng chiếm</span>
                <span className="font-mono-num text-xl font-bold text-sky-300">
                  {stats.territoriesCaptured}
                </span>
              </div>
              <div className="bg-[#0d1c2e] border border-slate-800 rounded-lg p-3">
                <span className="text-xs text-slate-400 block">Trận thắng</span>
                <span className="font-mono-num text-xl font-bold text-emerald-300">
                  {stats.battlesWon}
                </span>
              </div>
              <div className="bg-[#0d1c2e] border border-slate-800 rounded-lg p-3">
                <span className="text-xs text-slate-400 block">Lệnh dùng</span>
                <span className="font-mono-num text-xl font-bold text-slate-200">
                  {stats.ordersUsed}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onReturnTitle}
            className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Chọn bản đồ khác
          </button>

          <button
            type="button"
            onClick={onRestart}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              screenState === 'PAUSED'
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Chơi lại</span>
          </button>

          {screenState === 'PAUSED' && (
            <button
              type="button"
              onClick={onResume}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Tiếp tục</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
