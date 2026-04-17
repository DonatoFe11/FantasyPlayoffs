import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { Plus, Loader2, ArrowLeft, Trash2, Coins, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  
  // Stati per la nuova barra di ricerca
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // STATO PER GLI ID OCCUPATI
  const [occupiedIds, setOccupiedIds] = useState(new Set());

  useEffect(() => {
    load();
  }, [teamId]);

  // Carica gli ID di tutti i giocatori già assegnati a una squadra
  async function loadOccupiedIds() {
    try {
      const allRostered = await base44.entities.Player.filter({}, "", 1000);
      const ids = new Set(allRostered.map(p => p.nba_player_id).filter(Boolean));
      setOccupiedIds(ids);
    } catch (error) {
      console.error("Errore nel caricamento ID occupati:", error);
    }
  }

  // Ogni volta che apriamo il Dialog, aggiorniamo la lista degli occupati
  useEffect(() => {
    if (dialogOpen) {
      loadOccupiedIds();
    }
  }, [dialogOpen]);

  // Motore di ricerca in tempo reale verso Supabase
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/nba_players?name=ilike.*${searchQuery}*&limit=20`;
        const response = await fetch(url, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        });
        const data = await response.json();
        
        // FILTRO: Escludiamo i giocatori che sono già in un roster
        const filteredData = data.filter(p => !occupiedIds.has(p.id));
        
        setSearchResults(filteredData);
      } catch (error) {
        console.error("Errore nella ricerca:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, occupiedIds]);

  async function load() {
    const [teams, allPlayers] = await Promise.all([
      base44.entities.Team.filter({ id: teamId }),
      base44.entities.Player.filter({ fantasy_team_id: teamId }, "-created_date", 100),
    ]);
    setTeam(teams[0]);
    setPlayers(allPlayers);
    setLoading(false);
  }

  async function addPlayer(selectedNbaPlayer) {
    await base44.entities.Player.create({
      name: selectedNbaPlayer.name,
      role: selectedNbaPlayer.role,
      nba_team: selectedNbaPlayer.nba_team_abbr,
      nba_player_id: selectedNbaPlayer.id,
      fantasy_team_id: teamId,
    });
    
    setSearchQuery("");
    setSearchResults([]);
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
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cerca Giocatore NBA</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Es. LeBron, Jokic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
              
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {isSearching && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                
                {!isSearching && searchResults.map((player) => (
                  <div 
                    key={player.id} 
                    onClick={() => addPlayer(player)}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-secondary/50 hover:border-primary/50 cursor-pointer transition-all"
                  >
                    <div>
                      <p className="font-bold">{player.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {player.nba_team_abbr} • {player.position_full} ({player.role})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{player.credits} Cr</p>
                    </div>
                  </div>
                ))}

                {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Giocatore non trovato o già assegnato.
                  </p>
                )}
                
                {!isSearching && searchQuery.length < 2 && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Digita almeno 2 lettere per cercare.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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