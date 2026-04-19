import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client"; // NUOVO: Serve per leggere da Supabase

const statusLabels = {
  da_giocare: "Da giocare",
  in_corso: "In corso",
  completata: "Completata",
};

const statusColors = {
  da_giocare: "bg-secondary text-muted-foreground",
  in_corso: "bg-primary/10 text-primary",
  completata: "bg-green-100 text-green-700",
};

export default function MatchCard({ match, onDelete }) {
  // NUOVI STATI PER I PUNTEGGI LIVE
  const [liveHomeScore, setLiveHomeScore] = useState(match.score_home || 0);
  const [liveAwayScore, setLiveAwayScore] = useState(match.score_away || 0);

  useEffect(() => {
    // Se la partita è completata, mostriamo direttamente il punteggio salvato nel db
    if (match.status === "completata") {
      setLiveHomeScore(match.score_home || 0);
      setLiveAwayScore(match.score_away || 0);
      return;
    }

    // Altrimenti, scarichiamo i voti dei giocatori in tempo reale e facciamo la somma!
    async function fetchLiveScores() {
      try {
        const entries = await base44.entities.LineupEntry.filter({ match_id: match.id }, null, 100);
        
        const homeScore = entries
          .filter((e) => e.team_id === match.team_home_id)
          .reduce((sum, e) => sum + (e.final_score || 0), 0);
          
        const awayScore = entries
          .filter((e) => e.team_id === match.team_away_id)
          .reduce((sum, e) => sum + (e.final_score || 0), 0);

        setLiveHomeScore(homeScore);
        setLiveAwayScore(awayScore);
      } catch (error) {
        console.error("Errore nel calcolo live della partita", error);
      }
    }

    fetchLiveScores();
  }, [match]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Gara {match.game_number}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                statusColors[match.status]
              }`}
            >
              {statusLabels[match.status]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-display font-bold uppercase tracking-wide">
              {match.team_home_name}
            </p>
          </div>
          <div className="flex items-center gap-4 px-6">
            <span className="font-display text-2xl font-bold">
              {liveHomeScore.toFixed(2)}
            </span>
            <span className="text-muted-foreground">-</span>
            <span className="font-display text-2xl font-bold">
              {liveAwayScore.toFixed(2)}
            </span>
          </div>
          <div className="flex-1 text-right">
            <p className="font-display font-bold uppercase tracking-wide">
              {match.team_away_name}
            </p>
          </div>
        </div>
      </div>

      {(match.lineup_home_last_updated || match.lineup_away_last_updated) && (
        <div className="px-5 py-2 space-y-1 border-t border-border">
          {match.lineup_home_last_updated && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="font-medium">{match.team_home_name}:</span>
              {new Date(match.lineup_home_last_updated).toLocaleString("it-IT", {
                timeZone: "Europe/Rome",
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
          )}
          {match.lineup_away_last_updated && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="font-medium">{match.team_away_name}:</span>
              {new Date(match.lineup_away_last_updated).toLocaleString("it-IT", {
                timeZone: "Europe/Rome",
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
          )}
        </div>
      )}
      <Link
        to={`/partita/${match.id}`}
        className="flex items-center justify-center gap-2 px-5 py-3 bg-secondary/50 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        Gestisci Formazioni & Punteggi
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}