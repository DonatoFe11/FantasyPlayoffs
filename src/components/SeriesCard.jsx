import { Link } from "react-router-dom";
import { ChevronRight, Trophy } from "lucide-react";

export default function SeriesCard({ series }) {
  if (!series) return null;
  const homeWins = series.wins_home || 0;
  const awayWins = series.wins_away || 0;
  const isComplete = series.status === "completata";
  const homeWon = isComplete && homeWins > awayWins;
  const awayWon = isComplete && awayWins > homeWins;

  return (
    <Link
      to={`/serie/${series.id}`}
      className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            {series.round}
          </span>
          {isComplete && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              Completata
            </span>
          )}
        </div>

        <div className="space-y-3">
          {/* Home team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {homeWon && <Trophy className="w-4 h-4 text-primary" />}
              <span className={`font-display text-lg font-bold uppercase tracking-wide ${homeWon ? "text-primary" : "text-foreground"}`}>
                {series.team_home_name}
              </span>
            </div>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                    i < homeWins
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i < homeWins ? "W" : ""}
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Away team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {awayWon && <Trophy className="w-4 h-4 text-primary" />}
              <span className={`font-display text-lg font-bold uppercase tracking-wide ${awayWon ? "text-primary" : "text-foreground"}`}>
                {series.team_away_name}
              </span>
            </div>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                    i < awayWins
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i < awayWins ? "W" : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-secondary/50 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          {homeWins} - {awayWins}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}