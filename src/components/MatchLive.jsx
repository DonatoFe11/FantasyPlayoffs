import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Zap } from "lucide-react";
import { getPlayerLastName } from "@/lib/utils";

const ROLE_COLORS = {
  C: "bg-blue-500 text-white",
  A: "bg-green-600 text-white",
  G: "bg-orange-500 text-white",
};

const SECTION_ORDER = ["capitano", "titolare", "sesto_uomo", "panchinaro"];
const SECTION_LABELS = {
  capitano: "TITOLARI",
  titolare: null, // grouped with capitano
  sesto_uomo: "SESTO UOMO",
  panchinaro: "PANCHINA",
};

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold flex-shrink-0 ${ROLE_COLORS[role] || "bg-gray-400 text-white"}`}>
      {role}
    </span>
  );
}

function PlayerCell({ entry, align = "left" }) {
  if (!entry) return <div className="flex-1" />;
  const isCaptain = entry.lineup_role === "capitano";
  const lastName = getPlayerLastName(entry.player_name);

  if (align === "left") {
    return (
      <div className="flex items-center gap-2 flex-1">
        <RoleBadge role={entry.player_role} />
        <span className={`font-display font-bold text-sm tracking-wide ${isCaptain ? "text-red-500" : ""}`}>{lastName}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-1 justify-end">
      <span className={`font-display font-bold text-sm tracking-wide ${isCaptain ? "text-red-500" : ""}`}>{lastName}</span>
      <RoleBadge role={entry.player_role} />
    </div>
  );
}

function ScoreBox({ value, highlight }) {
  return (
    <div className={`px-2.5 py-1 rounded text-sm font-bold tabular-nums min-w-[52px] text-center ${highlight ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"}`}>
      {(value || 0).toFixed(2)}
    </div>
  );
}

function SectionBlock({ label, homeEntries, awayEntries }) {
  const maxRows = Math.max(homeEntries.length, awayEntries.length);
  if (maxRows === 0) return null;

  return (
    <div className="mb-6">
      {label && (
        <h2 className="font-display text-xl font-bold uppercase tracking-wider text-center mb-3">
          {label}
        </h2>
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {Array.from({ length: maxRows }).map((_, i) => {
          const home = homeEntries[i];
          const away = awayEntries[i];
          const homeScore = home?.final_score || 0;
          const awayScore = away?.final_score || 0;
          return (
            <div key={i} className="flex items-center px-4 py-3">
              <div className="flex-1 flex items-center gap-2">
                {home ? <>
                  <RoleBadge role={home.player_role} />
                  <span className={`font-display font-bold text-sm tracking-wide ${home.lineup_role === "capitano" ? "text-red-500" : ""}`}>
                    {getPlayerLastName(home.player_name)}
                  </span>
                </> : null}
              </div>
              <div className="flex items-center gap-1 mx-2">
                <ScoreBox value={homeScore} highlight={homeScore > awayScore && homeScore > 0} />
                <ScoreBox value={awayScore} highlight={awayScore > homeScore && awayScore > 0} />
              </div>
              <div className="flex-1 flex items-center gap-2 justify-end">
                {away ? <>
                  <span className={`font-display font-bold text-sm tracking-wide ${away.lineup_role === "capitano" ? "text-red-500" : ""}`}>
                    {getPlayerLastName(away.player_name)}
                  </span>
                  <RoleBadge role={away.player_role} />
                </> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MatchLive({ match }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [match?.id]);

  async function load() {
    if (!match) return;
    const e = await base44.entities.LineupEntry.filter({ match_id: match.id }, null, 100);
    setEntries(e);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Deduplicate by player_id (keep first occurrence)
  const dedup = (list) => {
    const seen = new Set();
    return list.filter((e) => { if (seen.has(e.player_id)) return false; seen.add(e.player_id); return true; });
  };
  const homeEntries = dedup(entries.filter((e) => e.team_id === match.team_home_id));
  const awayEntries = dedup(entries.filter((e) => e.team_id === match.team_away_id));

  const ROLE_ORDER = { C: 0, A: 1, G: 2 };
  const getByRole = (list, roles) =>
    list.filter((e) => roles.includes(e.lineup_role))
        .sort((a, b) => {
          const roleDiff = (ROLE_ORDER[a.player_role] ?? 9) - (ROLE_ORDER[b.player_role] ?? 9);
          if (roleDiff !== 0) return roleDiff;
          return SECTION_ORDER.indexOf(a.lineup_role) - SECTION_ORDER.indexOf(b.lineup_role);
        });

  const homeStarters = getByRole(homeEntries, ["capitano", "titolare"]);
  const awayStarters = getByRole(awayEntries, ["capitano", "titolare"]);
  const homeSixth = getByRole(homeEntries, ["sesto_uomo"]);
  const awaySixth = getByRole(awayEntries, ["sesto_uomo"]);
  const homeBench = getByRole(homeEntries, ["panchinaro"]);
  const awayBench = getByRole(awayEntries, ["panchinaro"]);

  return (
    <div>
      {/* Score header */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-display font-bold uppercase tracking-wide text-sm text-muted-foreground">{match.team_home_name}</p>
            <p className={`font-display text-3xl font-bold mt-1 ${match.score_home > match.score_away ? "text-primary" : ""}`}>
              {(match.score_home || 0).toFixed(2)}
            </p>
          </div>
          <div className="px-4">
            <Zap className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 text-right">
            <p className="font-display font-bold uppercase tracking-wide text-sm text-muted-foreground">{match.team_away_name}</p>
            <p className={`font-display text-3xl font-bold mt-1 ${match.score_away > match.score_home ? "text-primary" : ""}`}>
              {(match.score_away || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <SectionBlock label="TITOLARI" homeEntries={homeStarters} awayEntries={awayStarters} />
      <SectionBlock label="SESTO UOMO" homeEntries={homeSixth} awayEntries={awaySixth} />
      <SectionBlock label="PANCHINA" homeEntries={homeBench} awayEntries={awayBench} />

      {/* Last updated */}
      {(match.lineup_home_last_updated || match.lineup_away_last_updated) && (
        <div className="bg-card border border-border rounded-xl p-4 flex justify-between text-xs text-muted-foreground mt-2">
          <div>
            {match.lineup_home_last_updated && (
              <>
                <p className="font-bold text-foreground">
                  {new Date(match.lineup_home_last_updated).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
                <p>Ultimo Salvataggio</p>
              </>
            )}
          </div>
          <div className="text-right">
            {match.lineup_away_last_updated && (
              <>
                <p className="font-bold text-foreground">
                  {new Date(match.lineup_away_last_updated).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
                <p>Ultimo Salvataggio</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}