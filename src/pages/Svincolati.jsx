import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, Filter, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Svincolati() {
  const [allNbaPlayers, setAllNbaPlayers] = useState([]);
  const [rosteredIds, setRosteredIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Stati per i filtri (vivono solo sul dispositivo dell'utente!)
  const [searchName, setSearchName] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [teamSearch, setTeamSearch] = useState("");
  const [sortBy, setSortBy] = useState("credits_desc");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // 1. Scarichiamo TUTTI i giocatori NBA dal listone
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/nba_players?select=*&limit=1000`;
      const resNba = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      const nbaData = await resNba.json();

      // 2. Scarichiamo TUTTI i giocatori già nelle rose del fanta
      const rosteredData = await base44.entities.Player.filter({}, "", 1000);
      
      // Creiamo un Set (una lista super veloce da leggere) con gli ID occupati
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

  // La magia dei filtri: si ricalcola in automatico quando cambi un'impostazione
  const freeAgents = useMemo(() => {
    // Prima regola: deve essere libero (non presente in rosteredIds)
    let filtered = allNbaPlayers.filter((p) => !rosteredIds.has(p.id));

    // Filtro per Nome
    if (searchName) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // Filtro per Ruolo
    if (roleFilter !== "ALL") {
      filtered = filtered.filter((p) => p.role === roleFilter);
    }

    // Filtro per Squadre (es: se scrivi "LAL BOS", cerca chi sta ai Lakers o ai Celtics)
    if (teamSearch) {
      const teamsToSearch = teamSearch.toUpperCase().split(/[\s,]+/).filter(Boolean);
      if (teamsToSearch.length > 0) {
        filtered = filtered.filter((p) =>
          teamsToSearch.some((t) => p.nba_team_abbr.includes(t))
        );
      }
    }

    // Ordinamento
    filtered.sort((a, b) => {
      if (sortBy === "credits_desc") return b.credits - a.credits;
      if (sortBy === "credits_asc") return a.credits - b.credits;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "team_asc") return a.nba_team_abbr.localeCompare(b.nba_team_abbr);
      return 0;
    });

    return filtered;
  }, [allNbaPlayers, rosteredIds, searchName, roleFilter, teamSearch, sortBy]);

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

      {/* Pannello Filtri */}
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

          <Input
            placeholder="Squadre (es: LAL, BOS, MIA)"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            title="Scrivi le sigle delle squadre separate da spazio o virgola"
          />

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
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista Giocatori */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {freeAgents.slice(0, 150).map((player) => ( // Limite a 150 per non bloccare il browser
          <div
            key={player.id}
            className="flex items-center justify-between bg-card border border-border rounded-xl p-4 transition-colors hover:border-primary/50"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{player.name}</span>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-bold">
                  {player.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {player.position_full} • {player.nba_team} ({player.nba_team_abbr})
              </p>
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