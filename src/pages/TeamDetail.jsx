import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { Plus, Loader2, ArrowLeft, Trash2, Coins, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function TeamDetail() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCredits, setEditingCredits] = useState(false);
  const [creditsValue, setCreditsValue] = useState("");
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    role: "G",
    nba_team: "",
  });

  useEffect(() => {
    load();
  }, [teamId]);

  async function load() {
    const [teams, allPlayers] = await Promise.all([
      base44.entities.Team.filter({ id: teamId }),
      base44.entities.Player.filter({ fantasy_team_id: teamId }, "-created_date", 100),
    ]);
    setTeam(teams[0]);
    setPlayers(allPlayers);
    setLoading(false);
  }

  async function addPlayer() {
    if (!newPlayer.name.trim()) return;
    await base44.entities.Player.create({
      name: newPlayer.name.trim(),
      role: newPlayer.role,
      nba_team: newPlayer.nba_team.trim().toUpperCase(),
      fantasy_team_id: teamId,
    });
    setNewPlayer({ name: "", role: "G", nba_team: "" });
    setDialogOpen(false);
    load();
  }

  async function saveCredits() {
    const val = parseFloat(creditsValue);
    if (isNaN(val)) return;
    await base44.entities.Team.update(teamId, { credits: val });
    setEditingCredits(false);
    load();
  }

  async function deletePlayer(id) {
    await base44.entities.Player.delete(id);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!team) {
    return <p className="text-center text-muted-foreground">Squadra non trovata</p>;
  }

  const grouped = { C: [], A: [], G: [] };
  players.forEach((p) => {
    if (grouped[p.role]) grouped[p.role].push(p);
  });

  const roleLabels = { C: "Centri", A: "Ali", G: "Guardie" };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          to="/squadre"
          className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
            {team.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {players.length} giocatori nel roster
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Aggiungi Giocatore
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuovo Giocatore</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Nome giocatore (es. LeBron)"
                value={newPlayer.name}
                onChange={(e) =>
                  setNewPlayer({ ...newPlayer, name: e.target.value })
                }
              />
              <Select
                value={newPlayer.role}
                onValueChange={(v) =>
                  setNewPlayer({ ...newPlayer, role: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="C">Centro (C)</SelectItem>
                  <SelectItem value="A">Ala (A)</SelectItem>
                  <SelectItem value="G">Guardia (G)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Squadra NBA (es. LAL)"
                value={newPlayer.nba_team}
                onChange={(e) =>
                  setNewPlayer({ ...newPlayer, nba_team: e.target.value })
                }
              />
              <Button onClick={addPlayer} className="w-full">
                Aggiungi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Crediti */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Crediti</p>
              {editingCredits ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    className="w-28 h-8 rounded-lg border border-border bg-background px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    value={creditsValue}
                    onChange={(e) => setCreditsValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveCredits(); if (e.key === "Escape") setEditingCredits(false); }}
                    autoFocus
                  />
                  <button onClick={saveCredits} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingCredits(false)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="font-display text-2xl font-bold">{team.credits ?? 0}</p>
              )}
            </div>
          </div>
          {!editingCredits && (
            <Button variant="outline" size="sm" onClick={() => { setCreditsValue(String(team.credits ?? 0)); setEditingCredits(true); }}>
              Modifica
            </Button>
          )}
        </div>
      </div>

      {Object.entries(grouped).map(([role, rolePlayers]) => (
        <div key={role} className="space-y-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
              {role}
            </span>
            {roleLabels[role]}
            <span className="text-sm text-muted-foreground font-sans font-normal">
              ({rolePlayers.length})
            </span>
          </h2>

          {rolePlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-10">
              Nessun giocatore in questo ruolo
            </p>
          ) : (
            <div className="space-y-2">
              {rolePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{player.name}</span>
                    {player.nba_team && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                        {player.nba_team}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deletePlayer(player.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}