import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Users, Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [t, p] = await Promise.all([
      base44.entities.Team.list(),
      base44.entities.Player.list("-created_date", 500),
    ]);
    setTeams(t);
    setPlayers(p);
    setLoading(false);
  }

  async function addTeam() {
    if (!teamName.trim()) return;
    await base44.entities.Team.create({ name: teamName.trim() });
    setTeamName("");
    setDialogOpen(false);
    load();
  }

  async function deleteTeam(id) {
    await base44.entities.Team.delete(id);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
            Squadre
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci le squadre e i roster
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuova Squadra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crea Squadra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Nome della squadra"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTeam()}
              />
              <Button onClick={addTeam} className="w-full">
                Crea
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Users className="w-16 h-16 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-lg">
            Nessuna squadra ancora creata
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const teamPlayers = players.filter(
              (p) => p.fantasy_team_id === team.id
            );
            return (
              <div
                key={team.id}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-lg font-bold uppercase tracking-wide">
                      {team.name}
                    </h3>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Elimina squadra</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler eliminare {team.name}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTeam(team.id)}>
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      {teamPlayers.length} giocatori
                    </p>
                    <span className="text-sm font-semibold">
                      💰 {team.credits ?? 0} crediti
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {["C", "A", "G"].map((role) => {
                      const count = teamPlayers.filter(
                        (p) => p.role === role
                      ).length;
                      return (
                        <span
                          key={role}
                          className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                        >
                          {role}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <Link
                  to={`/squadre/${team.id}`}
                  className="block px-5 py-3 bg-secondary/50 text-sm font-medium text-muted-foreground hover:text-primary transition-colors text-center"
                >
                  Gestisci Roster →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}