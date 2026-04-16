import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LineupEntryRow from "./LineupEntryRow";

const LINEUP_ROLE_ORDER = ["capitano", "titolare", "sesto_uomo", "panchinaro"];

export default function ScoreDialog({ open, onOpenChange, matchId, teamId, teamName, lineupField, onSaved }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) load();
  }, [open, matchId, teamId]);

  async function load() {
    setLoading(true);
    const e = await base44.entities.LineupEntry.filter({ match_id: matchId, team_id: teamId }, null, 50);
    
    // --- NUOVO ORDINAMENTO STABILE ---
    e.sort((a, b) => {
      // 1. Ordina per ruolo in campo (Capitano, Titolare...)
      const roleDiff = LINEUP_ROLE_ORDER.indexOf(a.lineup_role) - LINEUP_ROLE_ORDER.indexOf(b.lineup_role);
      if (roleDiff !== 0) return roleDiff;
      
      // 2. Regola di spareggio: Se hanno lo stesso ruolo, ordina in ordine alfabetico!
      return a.player_name.localeCompare(b.player_name);
    });
    // ---------------------------------

    setEntries(e);
    setLoading(false);
  }

  async function updateEntry(entryId, data) {
    await base44.entities.LineupEntry.update(entryId, data);
    await base44.entities.Match.update(matchId, { [lineupField]: new Date().toISOString() });
    if (onSaved) onSaved();
    load();
  }

  async function removeEntry(entryId) {
    await base44.entities.LineupEntry.delete(entryId);
    await base44.entities.Match.update(matchId, { [lineupField]: new Date().toISOString() });
    if (onSaved) onSaved();
    load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide">
            Punteggi — {teamName}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nessun giocatore in formazione</p>
        ) : (
          <div className="divide-y divide-border -mx-6">
            {entries.map((entry) => (
              <LineupEntryRow
                key={entry.id}
                entry={entry}
                onRemove={() => removeEntry(entry.id)}
                onUpdate={(data) => updateEntry(entry.id, data)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}