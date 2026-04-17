import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, Filter, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

// Funzione magica per recuperare i loghi dai server ESPN
function getTeamLogo(abbr) {
  if (!abbr || abbr === "FA") return "";
  // ESPN usa alcune sigle leggermente diverse da quelle standard, le correggiamo qui:
  const exceptions = {
    GSW: "gs", NOP: "no", NYK: "ny", SAS: "sa", UTA: "utah", WAS: "wsh", CHO: "cha"
  };
  const espnAbbr = exceptions[abbr] || abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${espnAbbr}.png`;
}

export default function Svincolati() {
  const [allNbaPlayers, setAllNbaPlayers] = useState([]);
  const [rosteredIds, setRosteredIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const [searchName, setSearchName] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("credits_desc");
  
  // Stato per le squadre selezionate
  const [selectedTeams, setSelectedTeams] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/nba_players?select=*&limit=1000`;
      const resNba = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      const nbaData = await resNba.json();

      const rosteredData = await base44.entities.Player.filter({}, "", 1000);
      
      const occupiedIds = new Set(
        rosteredData.map((p) => p.nba_player_id).filter(Boolean)
      );

      setAllNbaPlayers(nbaData);
      setRosteredIds(occupiedIds);
    } catch (error) {
      console.error("Errore nel caricamento svincolati:", error);
    } finally {
      setLoading(false);
    }
  }

  // Estraiamo le squadre NBA dal listone
  const uniqueTeams = useMemo(() => {
    const teams = new Set(allNbaPlayers.map(p => p.nba_team_abbr || "FA"));
    return Array.from(teams).filter(Boolean).sort((a, b) => {
      if (a === "FA") return 1; // Mettiamo FA in fondo alla lista dei loghi
      if (b === "FA") return -1;
      return a.localeCompare(b);
    });
  }, [allNbaPlayers]);

  const freeAgents = useMemo(() => {
    let filtered = allNbaPlayers.filter((p) => !rosteredIds.has(p.id));

    if (searchName) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (roleFilter !== "ALL") {
      filtered = filtered.filter((p) => p.role === roleFilter);
    }

    if (selectedTeams.length > 0) {
      filtered = filtered.filter((p) => selectedTeams.includes(p.nba_team_abbr || "FA"));
    }

    filtered.sort((a, b) => {
      const abbrA = a.nba_team_abbr || "FA";
      const abbrB = b.nba_team_abbr || "FA";
      
      if (sortBy === "credits_desc") return b.credits - a.credits;
      if (sortBy === "credits_asc") return a.credits - b.credits;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "team_asc") return abbrA.localeCompare(abbrB);
      if (sortBy === "team_desc") return abbrB.localeCompare(abbrA);
      return 0;
    });

    return filtered;
  }, [allNbaPlayers, rosteredIds, searchName, roleFilter, selectedTeams, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
          Mercato Svincolati
        </h1>
        <p className="text-muted-foreground mt-1">
          {freeAgents.length} giocatori liberi sul mercato
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm uppercase tracking-wider">Filtra e Ordina</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cerca nome..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Ruolo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti i Ruoli</SelectItem>
              <SelectItem value="G">Guardie (G)</SelectItem>
              <SelectItem value="A">Ali (A)</SelectItem>
              <SelectItem value="C">Centri (C)</SelectItem>
            </SelectContent>
          </Select>

          {/* Dropdown con Loghi NBA */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal bg-background">
                {selectedTeams.length === 0
                  ? "Tutte le squadre"
                  : `${selectedTeams.length} squadre selezionate`}
                <span className="opacity-50 text-xs">▼</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <div className="flex justify-between items-center mb-3 pb-2 border-b">
                <span className="text-sm font-semibold">Filtra per Squadra</span>
                {selectedTeams.length > 0 && (
                  <button
                    className="text-xs text-primary hover:underline font-medium"
                    onClick={() => setSelectedTeams([])}
                  >
                    Resetta
                  </button>
                )}
              </div>
              <ScrollArea className="h-64 pr-3">
                <div className="grid grid-cols-4 gap-2">
                  {uniqueTeams.map((team) => {
                    const isSelected = selectedTeams.includes(team);
                    return (
                      <div
                        key={team}
                        onClick={() => {
                          setSelectedTeams(prev =>
                            prev.includes(team)
                              ? prev.filter(t => t !== team)
                              : [...prev, team]
                          )
                        }}
                        className={`cursor-pointer rounded-lg border-2 p-2 flex flex-col items-center justify-center transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/10 shadow-sm" 
                            : "border-transparent hover:bg-secondary/80"
                        }`}
                      >
                        {team !== "FA" ? (
                          <img 
                            src={getTeamLogo(team)} 
                            alt={team} 
                            className="w-10 h-10 object-contain mb-1 drop-shadow-sm"
                            onError={(e) => { e.target.style.display = 'none'; }} 
                          />
                        ) : (
                          <div className="w-10 h-10 flex items-center justify-center mb-1 bg-background rounded-full border">
                            <span className="text-[10px] font-black">FA</span>
                          </div>
                        )}
                        <span className="text-[10px] font-bold text-center">{team}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="flex gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <SelectValue placeholder="Ordina per" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credits_desc">Crediti (Decrescente)</SelectItem>
              <SelectItem value="credits_asc">Crediti (Crescente)</SelectItem>
              <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
              <SelectItem value="name_desc">Nome (Z-A)</SelectItem>
              <SelectItem value="team_asc">Squadra NBA (A-Z)</SelectItem>
              <SelectItem value="team_desc">Squadra NBA (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {freeAgents.slice(0, 150).map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between bg-card border border-border rounded-xl p-4 transition-colors hover:border-primary/50"
          >
            <div className="flex items-center gap-3">
              {/* Gestione logo o quadratino FA per il giocatore */}
              {player.nba_team_abbr && player.nba_team_abbr !== "FA" ? (
                <img 
                  src={getTeamLogo(player.nba_team_abbr)} 
                  alt={player.nba_team_abbr}
                  className="w-8 h-8 object-contain drop-shadow-md"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-8 h-8 flex items-center justify-center bg-muted rounded text-[10px] font-bold text-muted-foreground border">
                  FA
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{player.name}</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-bold">
                    {player.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {player.position_full} • {player.nba_team_abbr || "FA"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg font-bold">
                {player.credits} Cr
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {freeAgents.length > 150 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Mostrati i primi 150 giocatori di {freeAgents.length}. Usa i filtri per restringere la ricerca.
        </p>
      )}
    </div>
  );
}