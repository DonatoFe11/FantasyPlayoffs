import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Loader2, X, ClipboardList, Save, RotateCcw } from "lucide-react";
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
} from "@/components/ui/dialog";
import CourtView from "./CourtView";
import ScoreDialog from "./ScoreDialog";

const FORMATIONS = ["2-2-1", "3-1-1", "1-3-1", "2-1-2", "1-2-2"];
const LINEUP_ROLE_ORDER = ["capitano", "titolare", "sesto_uomo", "panchinaro"];
const LINEUP_ROLE_LABELS = {
  capitano: "Capitano (×1.5)",
  titolare: "Titolare",
  sesto_uomo: "Sesto Uomo",
  panchinaro: "Panchinaro (×0.5)",
};
const ROLE_COLORS = { C: "bg-blue-500", A: "bg-green-600", G: "bg-orange-500" };

function parseFormation(f) {
  const [g, a, c] = f.split("-").map(Number);
  return { G: g, A: a, C: c };
}

export default function TeamLineup({ matchId, teamId, teamName, lineupField }) {
  // DB State (la verità nel database)
  const [entries, setEntries] = useState([]);
  
  // UI State (la bozza che vedi sullo schermo prima di salvare)
  const [draftEntries, setDraftEntries] = useState([]);
  
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingLineup, setSavingLineup] = useState(false);
  const [formation, setFormation] = useState("2-2-1");
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFilter, setDialogFilter] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedRole, setSelectedRole] = useState("titolare");

  useEffect(() => { load(); }, [matchId, teamId]);

  async function load() {
    const [e, p] = await Promise.all([
      base44.entities.LineupEntry.filter({ match_id: matchId, team_id: teamId }, null, 50),
      base44.entities.Player.filter({ fantasy_team_id: teamId }, null, 100),
    ]);
    e.sort((a, b) => LINEUP_ROLE_ORDER.indexOf(a.lineup_role) - LINEUP_ROLE_ORDER.indexOf(b.lineup_role));
    
    const starters = e.filter((x) => x.lineup_role === "capitano" || x.lineup_role === "titolare");
    let initialFormation = "2-2-1"; 

    if (starters.length > 0) {
      const counts = { G: 0, A: 0, C: 0 };
      starters.forEach((x) => { if (x.player_role) counts[x.player_role]++; });
      const bestFormation = FORMATIONS.find((f) => {
        const [g, a, c] = f.split("-").map(Number);
        return g >= counts.G && a >= counts.A && c >= counts.C;
      });
      if (bestFormation) initialFormation = bestFormation;
    }
    
    setFormation(initialFormation); 
    setEntries(e);
    setDraftEntries(e); // Sincronizziamo la bozza col DB
    setLoading(false);
  }

  async function touchMatch() {
    await base44.entities.Match.update(matchId, { [lineupField]: new Date().toISOString() });
  }

  function openSlotDialog(playerRole, lineupRole) {
    setDialogFilter({ playerRole, lineupRole });
    setSelectedPlayerId("");
    setSelectedRole(lineupRole);
    setDialogOpen(true);
  }

  // --- NUOVA LOGICA: Aggiunge solo alla bozza temporanea ---
  function addToLineup() {
    if (!selectedPlayerId) return;
    const player = players.find((p) => p.id === selectedPlayerId);
    
    const newEntry = {
      id: `temp-${Date.now()}`, // ID fittizio per riconoscerlo
      match_id: matchId,
      team_id: teamId,
      player_id: selectedPlayerId,
      player_name: player.name,
      player_role: player.role,
      player_nba_team: player.nba_team || "",
      lineup_role: selectedRole,
      raw_score: 0,
      final_score: 0,
      is_temp: true // Flag per dire "Non è ancora nel DB"
    };

    setDraftEntries([...draftEntries, newEntry]);
    setDialogOpen(false);
  }

  // --- NUOVA LOGICA: Rimuove solo dalla bozza temporanea ---
  function removeEntry(entryId) {
    setDraftEntries(draftEntries.filter((e) => e.id !== entryId));
  }

  // --- NUOVA LOGICA: Il salvataggio reale su DB ---
  async function saveLineup() {
    setSavingLineup(true);
    try {
      // 1. Trova chi è stato rimosso (c'è nel DB ma non nella bozza)
      const draftIds = draftEntries.map(e => e.id);
      const toDelete = entries.filter(e => !draftIds.includes(e.id));
      
      // 2. Trova chi è stato aggiunto (c'è nella bozza col flag is_temp)
      const toAdd = draftEntries.filter(e => e.is_temp);

      // 3. Esegui cancellazioni su Supabase
      for (const d of toDelete) {
        await base44.entities.LineupEntry.delete(d.id);
      }
      
      // 4. Esegui inserimenti su Supabase
      for (const a of toAdd) {
        const { id, is_temp, ...dbData } = a; // Rimuoviamo i campi temporanei
        await base44.entities.LineupEntry.create(dbData);
      }

      if (toDelete.length > 0 || toAdd.length > 0) {
        await touchMatch();
      }
      
      // Ricarichiamo tutto dal DB per sicurezza
      await load();
    } catch (err) {
      console.error("Errore salvataggio:", err);
    } finally {
      setSavingLineup(false);
    }
  }

  function cancelChanges() {
    setDraftEntries(entries); // Ripristina la bozza allo stato originale del DB
    setFormation(formation); // (Opzionale) Potremmo ripristinare anche il modulo originale, ma non è essenziale
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Calcoliamo le differenze per capire se far apparire il bottone Salva
  const toDelete = entries.filter(e => !draftEntries.find(d => d.id === e.id));
  const toAdd = draftEntries.filter(e => e.is_temp);
  const hasChanges = toDelete.length > 0 || toAdd.length > 0;

  // --- TUTTI I CALCOLI ORA USANO LA BOZZA (draftEntries) E NON IL DB ---
  const usedPlayerIds = draftEntries.map((e) => e.player_id);
  const availablePlayers = players.filter((p) => !usedPlayerIds.includes(p.id));

  const captainCount = draftEntries.filter((e) => e.lineup_role === "capitano").length;
  const starterCount = draftEntries.filter((e) => e.lineup_role === "titolare").length;
  const sixthCount = draftEntries.filter((e) => e.lineup_role === "sesto_uomo").length;
  const benchCount = draftEntries.filter((e) => e.lineup_role === "panchinaro").length;

  const canAdd = {
    capitano: captainCount < 1,
    titolare: starterCount < 4,
    sesto_uomo: sixthCount < 1,
    panchinaro: benchCount < 4,
  };

  const availableRoles = Object.entries(canAdd).filter(([, v]) => v).map(([k]) => k);
  const MAX_IN_LINEUP = { C: 2, A: 4, G: 4 };
  const inLineupByRole = { C: 0, A: 0, G: 0 };
  draftEntries.forEach((e) => { if (e.player_role) inLineupByRole[e.player_role]++; });

  const canAddByRole = (role) => {
    const max = MAX_IN_LINEUP[role];
    if (max === undefined) return false;
    return inLineupByRole[role] < max;
  };

  const formationCounts = parseFormation(formation);
  const startersByRole = { C: 0, A: 0, G: 0 };
  draftEntries
    .filter((e) => e.lineup_role === "capitano" || e.lineup_role === "titolare")
    .forEach((e) => { if (e.player_role) startersByRole[e.player_role]++; });

  const canAddStarterByRole = (role) => {
    if (!canAddByRole(role)) return false;
    return startersByRole[role] < formationCounts[role];
  };

  const dialogLineupRoles = dialogFilter
    ? (dialogFilter.lineupRole === "sesto_uomo"
        ? (canAdd.sesto_uomo ? ["sesto_uomo"] : [])
        : dialogFilter.lineupRole === "panchinaro"
          ? (canAdd.panchinaro ? ["panchinaro"] : [])
          : availableRoles.filter((r) => r === "capitano" || r === "titolare"))
    : availableRoles;

  const dialogPlayers = (dialogFilter?.playerRole
    ? availablePlayers.filter((p) => p.role === dialogFilter.playerRole)
    : availablePlayers
  ).filter((p) => {
    if (dialogFilter?.lineupRole === "panchinaro" || dialogFilter?.lineupRole === "sesto_uomo") {
      return canAddByRole(p.role);
    }
    return canAddStarterByRole(p.role);
  });

  const starterEntries = draftEntries.filter((e) => e.lineup_role === "capitano" || e.lineup_role === "titolare");
  const sixthEntry = draftEntries.find((e) => e.lineup_role === "sesto_uomo");
  const benchEntries = draftEntries.filter((e) => e.lineup_role === "panchinaro");
  const totalScore = draftEntries.reduce((sum, e) => sum + (e.final_score || 0), 0);

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${hasChanges ? 'border-primary ring-1 ring-primary/20 shadow-lg shadow-primary/10' : 'border-border'}`}>
      {/* Header */}
      <div className="p-4 border-b border-border relative">
        {hasChanges && (
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
            Modifiche non salvate
          </div>
        )}
        <div className="flex items-center justify-between mb-3 mt-1">
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-wide">{teamName}</h3>
            <p className="text-sm text-muted-foreground">
              Totale: <span className="font-bold text-foreground">{totalScore.toFixed(2)}</span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setScoreDialogOpen(true)}
          >
            <ClipboardList className="w-4 h-4" />
            Punteggi
          </Button>
        </div>
        {/* Formation selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium mr-1">Modulo:</span>
          {FORMATIONS.map((f) => (
            <button
              key={f}
              onClick={() => setFormation(f)}
              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all ${
                formation === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Court */}
      <div className="p-3">
        <CourtView
          entries={starterEntries}
          formation={formation}
          onRemove={removeEntry}
          onSlotClick={(playerRole) => openSlotDialog(playerRole, canAdd.capitano ? "capitano" : "titolare")}
        />
      </div>

      {/* Sesto Uomo */}
      <div className="px-4 pb-3">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Sesto Uomo <span className="text-primary">(×1.0)</span>
        </p>
        {sixthEntry ? (
          <div className="flex items-center gap-3 bg-secondary/50 rounded-lg px-3 py-2">
            <div className={`w-7 h-7 rounded-full ${ROLE_COLORS[sixthEntry.player_role] || "bg-gray-500"} flex items-center justify-center text-white text-xs font-bold`}>
              {sixthEntry.player_role}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{sixthEntry.player_name}</p>
              <p className="text-xs text-muted-foreground">{(sixthEntry.final_score || 0).toFixed(2)} pt</p>
            </div>
            <button onClick={() => removeEntry(sixthEntry.id)} className="text-muted-foreground hover:text-destructive">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => canAdd.sesto_uomo && openSlotDialog(null, "sesto_uomo")}
            className="w-full bg-secondary/30 rounded-lg px-3 py-2.5 text-xs text-muted-foreground text-center border border-dashed border-border hover:border-primary/50 hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Aggiungi sesto uomo
          </button>
        )}
      </div>

      {/* Panchina */}
      <div className="px-4 pb-4">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Panchina <span className="text-muted-foreground">(×0.5)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {benchEntries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-2.5 py-2">
              <div className={`w-6 h-6 rounded-full ${ROLE_COLORS[entry.player_role] || "bg-gray-500"} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                {entry.player_role}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{entry.player_name}</p>
                <p className="text-[10px] text-muted-foreground">{(entry.final_score || 0).toFixed(2)} pt</p>
              </div>
              <button onClick={() => removeEntry(entry.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - benchEntries.length) }).map((_, i) => (
            <button
              key={`empty-bench-${i}`}
              onClick={() => canAdd.panchinaro && openSlotDialog(null, "panchinaro")}
              className="flex items-center justify-center gap-1.5 bg-secondary/20 rounded-lg px-2.5 py-2 border border-dashed border-border hover:border-primary/50 hover:text-foreground transition-colors text-xs text-muted-foreground"
            >
              <Plus className="w-3 h-3" />
              Aggiungi
            </button>
          ))}
        </div>
      </div>

      {/* Barra di Salvataggio (Appare solo se ci sono modifiche) */}
      {hasChanges && (
        <div className="bg-primary/5 border-t border-primary/20 p-3 flex items-center justify-end gap-2 animate-in slide-in-from-bottom-2 fade-in">
          <Button variant="ghost" size="sm" onClick={cancelChanges} disabled={savingLineup} className="text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Annulla
          </Button>
          <Button size="sm" onClick={saveLineup} disabled={savingLineup} className="bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
            {savingLineup ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salva Formazione
          </Button>
        </div>
      )}

      {/* Add player dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogFilter?.playerRole
                ? `Aggiungi ${dialogFilter.playerRole === "C" ? "Centro" : dialogFilter.playerRole === "A" ? "Ala" : "Guardia"}`
                : "Aggiungi giocatore"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona giocatore" />
              </SelectTrigger>
              <SelectContent>
                {dialogPlayers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nessun giocatore disponibile</div>
                ) : (
                  dialogPlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className={`inline-block w-5 h-5 rounded text-white text-[10px] font-bold text-center leading-5 mr-1 ${ROLE_COLORS[p.role] || "bg-gray-500"}`}>{p.role}</span>
                      {p.name}{p.nba_team ? ` (${p.nba_team})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {dialogLineupRoles.length > 1 && (
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dialogLineupRoles.map((r) => (
                    <SelectItem key={r} value={r}>{LINEUP_ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button onClick={addToLineup} className="w-full" disabled={!selectedPlayerId || dialogPlayers.length === 0}>
              Aggiungi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Score dialog */}
      <ScoreDialog
        open={scoreDialogOpen}
        onOpenChange={setScoreDialogOpen}
        matchId={matchId}
        teamId={teamId}
        teamName={teamName}
        lineupField={lineupField}
        onSaved={load}
      />
    </div>
  );
}