import { useState } from "react";
import { Trash2, Crown, Star, UserRound, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const roleConfig = {
  capitano: { label: "CAP", icon: Crown, multiplier: 1.5, color: "text-primary bg-primary/10" },
  titolare: { label: "TIT", icon: Star, multiplier: 1, color: "text-foreground bg-secondary" },
  sesto_uomo: { label: "6°", icon: UserRound, multiplier: 1, color: "text-blue-600 bg-blue-50" },
  panchinaro: { label: "PAN", icon: Armchair, multiplier: 0.5, color: "text-muted-foreground bg-muted" },
};

export default function LineupEntryRow({ entry, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [rawScore, setRawScore] = useState(String(entry.raw_score || 0));
  const config = roleConfig[entry.lineup_role] || roleConfig.titolare;
  const Icon = config.icon;

  function saveScore() {
    const score = parseFloat(rawScore) || 0;
    const finalScore = Math.round(score * config.multiplier * 100) / 100;
    
    // Aggiungiamo is_manual_score: true per dire a Python "Questo l'ho inserito io a mano!"
    onUpdate({ raw_score: score, final_score: finalScore, is_manual_score: true }); 
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Role badge */}
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            {entry.player_role}
          </span>
          <span className="font-semibold text-sm truncate">
            {entry.player_name}
          </span>
          {entry.player_nba_team && (
            <span className="text-xs text-muted-foreground">
              {entry.player_nba_team}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {config.label} · ×{config.multiplier}
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              className="w-20 h-8 text-sm text-right"
              value={rawScore}
              onChange={(e) => setRawScore(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveScore()}
              onBlur={saveScore}
              autoFocus
              type="number"
              step="0.01"
            />
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-right hover:bg-secondary rounded-lg px-2 py-1 transition-colors"
          >
            <p className="text-sm font-bold">{(entry.final_score || 0).toFixed(2)}</p>
            {entry.lineup_role !== "titolare" && (
              <p className="text-[10px] text-muted-foreground">
                ({(entry.raw_score || 0).toFixed(2)} × {config.multiplier})
              </p>
            )}
          </button>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
        onClick={onRemove}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}