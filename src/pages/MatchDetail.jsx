import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save, CheckCircle, Users, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TeamLineup from "../components/TeamLineup";
import MatchLive from "../components/MatchLive";

export default function MatchDetail() {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("live"); // "live" | "lineup"

  useEffect(() => { load(); }, [matchId]);

  async function load() {
    const matches = await base44.entities.Match.filter({ id: matchId });
    const m = matches[0];
    setMatch(m);
    if (m) {
      const seriesList = await base44.entities.Series.filter({ id: m.series_id });
      setSeries(seriesList[0]);
    }
    setLoading(false);
  }

  const recalcScores = useCallback(async () => {
    setSaving(true);
    const entries = await base44.entities.LineupEntry.filter({ match_id: matchId }, null, 100);
    const homeScore = entries.filter((e) => e.team_id === match.team_home_id).reduce((sum, e) => sum + (e.final_score || 0), 0);
    const awayScore = entries.filter((e) => e.team_id === match.team_away_id).reduce((sum, e) => sum + (e.final_score || 0), 0);
    await base44.entities.Match.update(matchId, {
      score_home: Math.round(homeScore * 100) / 100,
      score_away: Math.round(awayScore * 100) / 100,
      status: "in_corso",
    });
    await load();
    setSaving(false);
  }, [matchId, match]);

  const finalizeMatch = useCallback(async () => {
    setSaving(true);
    const entries = await base44.entities.LineupEntry.filter({ match_id: matchId }, null, 100);
    const homeScore = entries.filter((e) => e.team_id === match.team_home_id).reduce((sum, e) => sum + (e.final_score || 0), 0);
    const awayScore = entries.filter((e) => e.team_id === match.team_away_id).reduce((sum, e) => sum + (e.final_score || 0), 0);
    const winnerId = homeScore >= awayScore ? match.team_home_id : match.team_away_id;

    await base44.entities.Match.update(matchId, {
      score_home: Math.round(homeScore * 100) / 100,
      score_away: Math.round(awayScore * 100) / 100,
      status: "completata",
      winner_id: winnerId,
    });

    const allMatches = await base44.entities.Match.filter({ series_id: match.series_id });
    const updatedMatches = allMatches.map((m) =>
      m.id === matchId ? { ...m, status: "completata", winner_id: winnerId } : m
    );
    const completed = updatedMatches.filter((m) => m.status === "completata");
    const winsHome = completed.filter((m) => m.winner_id === match.team_home_id).length;
    const winsAway = completed.filter((m) => m.winner_id === match.team_away_id).length;
    const seriesUpdate = { wins_home: winsHome, wins_away: winsAway };
    if (winsHome >= 3 || winsAway >= 3) seriesUpdate.status = "completata";
    await base44.entities.Series.update(match.series_id, seriesUpdate);

    await load();
    setSaving(false);
  }, [matchId, match]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) return <p className="text-center text-muted-foreground">Partita non trovata</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={`/serie/${match.series_id}`}
          className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-1">
            {series?.round} · Gara {match.game_number}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wider">
            {match.team_home_name} <span className="text-muted-foreground text-lg">vs</span> {match.team_away_name}
          </h1>
        </div>
      </div>

      {/* View toggle + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex bg-secondary rounded-lg p-1 gap-1">
          <button
            onClick={() => setView("live")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${view === "live" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <BarChart2 className="w-4 h-4" />
            Live
          </button>
          <button
            onClick={() => setView("lineup")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${view === "lineup" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="w-4 h-4" />
            Schiera Formazione
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={recalcScores} variant="outline" size="sm" className="gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Ricalcola
          </Button>
          {match.status !== "completata" && (
            <Button onClick={finalizeMatch} size="sm" className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Chiudi
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {view === "live" ? (
        <MatchLive match={match} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TeamLineup matchId={matchId} teamId={match.team_home_id} teamName={match.team_home_name} lineupField="lineup_home_last_updated" />
          <TeamLineup matchId={matchId} teamId={match.team_away_id} teamName={match.team_away_name} lineupField="lineup_away_last_updated" />
        </div>
      )}
    </div>
  );
}