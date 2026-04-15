import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import SeriesCard from "../components/SeriesCard";

export default function SeriesList() {
  const [series, setSeries] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSeries, setNewSeries] = useState({
    round: "Quarti di Finale",
    team_home_id: "",
    team_away_id: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [s, t] = await Promise.all([
      base44.entities.Series.list(),
      base44.entities.Team.list(),
    ]);
    setSeries(s);
    setTeams(t);
    setLoading(false);
  }

  async function createSeries() {
    if (!newSeries.team_home_id || !newSeries.team_away_id) return;
    const home = teams.find((t) => t.id === newSeries.team_home_id);
    const away = teams.find((t) => t.id === newSeries.team_away_id);
    await base44.entities.Series.create({
      round: newSeries.round,
      team_home_id: newSeries.team_home_id,
      team_away_id: newSeries.team_away_id,
      team_home_name: home.name,
      team_away_name: away.name,
      wins_home: 0,
      wins_away: 0,
      status: "in_corso",
    });
    setDialogOpen(false);
    setNewSeries({ round: "Quarti di Finale", team_home_id: "", team_away_id: "" });
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const rounds = ["Quarti di Finale", "Semifinale", "Finale"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
            Serie Playoff
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci le serie dei playoff
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuova Serie
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crea Serie</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Select
                value={newSeries.round}
                onValueChange={(v) => setNewSeries({ ...newSeries, round: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Turno" />
                </SelectTrigger>
                <SelectContent>
                  {rounds.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={newSeries.team_home_id}
                onValueChange={(v) =>
                  setNewSeries({ ...newSeries, team_home_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Squadra Casa" />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((t) => t.id !== newSeries.team_away_id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                value={newSeries.team_away_id}
                onValueChange={(v) =>
                  setNewSeries({ ...newSeries, team_away_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Squadra Trasferta" />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((t) => t.id !== newSeries.team_home_id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Button onClick={createSeries} className="w-full">
                Crea Serie
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rounds.map((round) => {
        const roundSeries = series.filter((s) => s.round === round);
        if (roundSeries.length === 0) return null;
        return (
          <div key={round} className="space-y-4">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider">
              {round}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roundSeries.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          </div>
        );
      })}

      {series.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <Swords className="w-16 h-16 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-lg">
            Nessuna serie creata
          </p>
        </div>
      )}
    </div>
  );
}