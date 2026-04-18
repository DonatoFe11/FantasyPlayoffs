import { Star, Plus, X } from "lucide-react";
import { getPlayerLastName } from "@/lib/utils";

// Order: G (bottom) → A (middle) → C (top/near basket)
const FORMATION_POSITIONS = {
  "2-2-1": {
    G: [{ l: 25, t: 78 }, { l: 75, t: 78 }],
    A: [{ l: 25, t: 48 }, { l: 75, t: 48 }],
    C: [{ l: 50, t: 14 }],
  },
  "3-1-1": {
    G: [{ l: 18, t: 78 }, { l: 50, t: 78 }, { l: 82, t: 78 }],
    A: [{ l: 50, t: 48 }],
    C: [{ l: 50, t: 14 }],
  },
  "1-3-1": {
    G: [{ l: 50, t: 78 }],
    A: [{ l: 18, t: 48 }, { l: 50, t: 48 }, { l: 82, t: 48 }],
    C: [{ l: 50, t: 14 }],
  },
  "2-1-2": {
    G: [{ l: 25, t: 78 }, { l: 75, t: 78 }],
    A: [{ l: 50, t: 48 }],
    C: [{ l: 28, t: 14 }, { l: 72, t: 14 }],
  },
  "1-2-2": {
    G: [{ l: 50, t: 78 }],
    A: [{ l: 28, t: 48 }, { l: 72, t: 48 }],
    C: [{ l: 28, t: 14 }, { l: 72, t: 14 }],
  },
};

const ROLE_COLORS = {
  C: { bg: "bg-blue-500", border: "border-blue-300", text: "text-blue-100" },
  A: { bg: "bg-green-600", border: "border-green-300", text: "text-green-100" },
  G: { bg: "bg-orange-500", border: "border-orange-300", text: "text-orange-100" },
};

function FilledSlot({ entry, onRemove }) {
  const isCaptain = entry.lineup_role === "capitano";
  const colors = ROLE_COLORS[entry.player_role] || { bg: "bg-gray-500", border: "border-gray-300", text: "text-gray-100" };
  const lastName = getPlayerLastName(entry.player_name);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {/* Remove button - top right, always visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
          className="absolute -top-2 -right-2 z-10 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md transition-colors"
        >
          <X className="w-3 h-3 text-white" />
        </button>

        {/* Captain badge */}
        {isCaptain && (
          <div className="absolute -top-2 -left-2 z-10 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
            <Star className="w-2.5 h-2.5 text-yellow-900 fill-yellow-900" />
          </div>
        )}

        {/* Avatar */}
        <div className={`w-12 h-12 rounded-full ${colors.bg} border-2 ${isCaptain ? "border-yellow-400" : colors.border} flex items-center justify-center shadow-lg`}>
          <span className="text-white font-bold text-sm">{entry.player_role}</span>
        </div>
      </div>

      {/* Name + score */}
      <div className="bg-black/70 backdrop-blur-sm rounded-md px-2 py-0.5 text-center min-w-[56px]">
        <p className="text-[9px] text-white/90 font-semibold uppercase leading-tight truncate max-w-[60px]">{lastName}</p>
        <p className="text-[10px] font-bold text-white leading-tight">{(entry.final_score || 0).toFixed(2)}</p>
      </div>
    </div>
  );
}

function EmptySlot({ role, onClick }) {
  const colors = ROLE_COLORS[role] || { bg: "bg-gray-500", border: "border-gray-400" };
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group"
    >
      <div className={`w-12 h-12 rounded-full border-2 border-dashed ${colors.border} flex items-center justify-center transition-all group-hover:bg-white/10`}>
        <span className="text-white/60 font-bold text-sm group-hover:hidden">{role}</span>
        <Plus className="w-4 h-4 text-white/80 hidden group-hover:block" />
      </div>
      <div className="bg-black/40 rounded-md px-2 py-0.5 text-center">
        <p className="text-[9px] text-white/40 uppercase">Vuoto</p>
      </div>
    </button>
  );
}

export default function CourtView({ entries, formation, onRemove, onSlotClick }) {
  const positions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS["2-2-1"];

  // Build slots: for each role/position, match a player
  const usedIds = new Set();
  const slots = [];

  ["C", "A", "G"].forEach((role) => {
    // Captain counts as any role
    const rolePlayers = entries.filter(
      (e) => e.player_role === role && !usedIds.has(e.id)
    );
    // prioritize captain
    rolePlayers.sort((a) => (a.lineup_role === "capitano" ? -1 : 1));

    (positions[role] || []).forEach((pos, i) => {
      const player = rolePlayers[i] || null;
      if (player) usedIds.add(player.id);
      slots.push({ pos, role, player });
    });
  });

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden select-none"
      style={{
        paddingBottom: "95%",
        background: "linear-gradient(180deg, #b5732a 0%, #c8853c 25%, #d49040 60%, #b8762e 100%)",
      }}
    >
      {/* Court lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
        viewBox="0 0 300 285"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
      >
        <rect x="80" y="0" width="140" height="115" />
        <circle cx="150" cy="115" r="45" />
        <path d="M 20 0 L 20 135 Q 150 250 280 135 L 280 0" />
        <circle cx="150" cy="22" r="10" />
        <line x1="150" y1="0" x2="150" y2="32" />
      </svg>

      {/* Player slots */}
      {slots.map(({ pos, role, player }, i) => (
        <div
          key={i}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pos.l}%`, top: `${pos.t}%` }}
        >
          {player ? (
            <FilledSlot entry={player} onRemove={onRemove} />
          ) : (
            <EmptySlot role={role} onClick={() => onSlotClick(role, "titolare")} />
          )}
        </div>
      ))}
    </div>
  );
}