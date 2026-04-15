import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import MatchCard from "../components/MatchCard";

export default function SeriesDetail() {
  const { seriesId } = useParams();
  const [series, setSeries] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [seriesId]);

  async function load() {
    const [seriesList, matchesList] = await Promise.all([
      base44.entities.Series.filter({ id: seriesId }),
      base44.entities.Match.filter({ series_id: seriesId }),
    ]);
    setSeries(seriesList[0]);
    setMatches(matchesList.sort((a, b) => a.game_number - b.game_number));
    setLoading(false);
  }

  async function addMatch() {
    const nextGame = matches.length + 1;
    if (nextGame > 5) return;
    await base44.entities.Match.create({
      series_id: seriesId,
      game_number: nextGame,
      team_home_id: series.team_home_id,
      team_away_id: series.team_away_id,
      team_home_name: series.team_home_name,
      team_away_name: series.team_away_name,
      status: "da_giocare",
      score_home: 0,
      score_away: 0,
    });
    load();
  }

  async function deleteMatch(matchId) {
    // Delete lineup entries first
    const entries = await base44.entities.LineupEntry.filter({ match_id: matchId });
    for (const entry of entries) {
      await base44.entities.LineupEntry.delete(entry.id);
    }
    await base44.entities.Match.delete(matchId);
    load();
  }

  async function deleteSeries() {
    // Delete all matches and their lineup entries
    for (const match of matches) {
      const entries = await base44.entities.LineupEntry.filter({ match_id: match.id });
      for (const entry of entries) {
        await base44.entities.LineupEntry.delete(entry.id);
      }
      await base44.entities.Match.delete(match.id);
    }
    await base44.entities.Series.delete(seriesId);
    window.location.href = "/serie";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!series) {
    return <p className="text-center text-muted-foreground">Serie non trovata</p>;
  }

  const canAddMatch = matches.length < 5 && series.status !== "completata";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          to="/serie"
          className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-1">
            {series.round}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wider">
            {series.team_home_name}{" "}
            <span className="text-muted-foreground text-lg">vs</span>{" "}
            {series.team_away_name}
          </h1>
        </div>
      </div>

      {/* Score summary */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="font-display text-lg font-bold uppercase tracking-wide">
              {series.team_home_name}
            </p>
            <p className="font-display text-5xl font-bold text-primary mt-2">
              {series.wins_home || 0}
            </p>
          </div>
          <div className="text-3xl text-muted-foreground font-display">—</div>
          <div className="text-center">
            <p className="font-display text-lg font-bold uppercase tracking-wide">
              {series.team_away_name}
            </p>
            <p className="font-display text-5xl font-bold text-primary mt-2">
              {series.wins_away || 0}
            </p>
          </div>
        </div>
        {series.status === "completata" && (
          <p className="text-center text-sm text-primary font-semibold mt-4 uppercase tracking-wider">
            Serie Completata
          </p>
        )}
      </div>

      {/* Matches */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider">
          Partite
        </h2>
        <div className="flex gap-2">
          {canAddMatch && (
            <Button onClick={addMatch} className="gap-2" size="sm">
              <Plus className="w-4 h-4" />
              Gara {matches.length + 1}
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Elimina Serie
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Elimina serie</AlertDialogTitle>
                <AlertDialogDescription>
                  Questo eliminerà la serie e tutte le partite e formazioni associate.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={deleteSeries}>
                  Elimina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-4">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onDelete={() => deleteMatch(match.id)}
            onUpdate={load}
          />
        ))}

        {matches.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nessuna partita ancora aggiunta
          </div>
        )}
      </div>
    </div>
  );
}