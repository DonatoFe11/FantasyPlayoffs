import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Trophy, Swords, Users, ChevronRight, Loader2 } from "lucide-react";
import SeriesCard from "../components/SeriesCard";

export default function Dashboard() {
  const [series, setSeries] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [s, t] = await Promise.all([
        base44.entities.Series.list(),
        base44.entities.Team.list(),
      ]);
      setSeries(s);
      setTeams(t);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const rounds = ["Quarti di Finale", "Semifinale", "Finale"];
  const groupedSeries = rounds.map((round) => ({
    round,
    series: series.filter((s) => s.round === round),
  }));

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-wider text-foreground">
          Playoff
        </h1>
        <p className="text-muted-foreground text-lg">
          {teams.length} squadre · {series.length} serie
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/squadre"
          className="group bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{teams.length}</p>
              <p className="text-sm text-muted-foreground">Squadre</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>

        <Link
          to="/serie"
          className="group bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Swords className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{series.filter(s => s.status === "in_corso").length}</p>
              <p className="text-sm text-muted-foreground">Serie in corso</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>

        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold font-display">
              {series.filter(s => s.status === "completata").length}
            </p>
            <p className="text-sm text-muted-foreground">Serie completate</p>
          </div>
        </div>
      </div>

      {/* Series by round */}
      {groupedSeries.map(({ round, series: roundSeries }) => (
        roundSeries.length > 0 && (
          <div key={round} className="space-y-4">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
              {round}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roundSeries.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          </div>
        )
      ))}

      {series.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <Swords className="w-16 h-16 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-lg">
            Nessuna serie ancora creata
          </p>
          <Link
            to="/serie"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Crea la prima serie
          </Link>
        </div>
      )}
    </div>
  );
}