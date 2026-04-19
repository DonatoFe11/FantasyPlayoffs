import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Zap, TrendingUp } from "lucide-react";
import { getPlayerLastName } from "@/lib/utils";

const ROLE_COLORS = {
  G: "bg-orange-100 text-orange-700 border-orange-200",
  A: "bg-green-100 text-green-700 border-green-200",
  C: "bg-blue-100 text-blue-700 border-blue-200",
};

const SECTION_ORDER = ["capitano", "titolare", "sesto_uomo", "panchinaro"];

function RoleBadge({ role }) {
  return (
    <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded sm:rounded-lg ${ROLE_COLORS[role] || 'bg-muted'} flex items-center justify-center font-display font-bold text-[10px] sm:text-xs border flex-shrink-0`}>
      {role}
    </div>
  );
}

function SectionBlock({ label, homeEntries, awayEntries }) {
  const maxRows = Math.max(homeEntries.length, awayEntries.length);
  if (maxRows === 0) return null;

  // Stili responsivi: più piccoli su mobile, più grandi da "sm:" (tablet/PC) in poi
  const scoreBaseClasses = "font-display font-bold text-center rounded-md sm:rounded-lg px-1 py-1 sm:px-2.5 sm:py-1.5 border min-w-[50px] sm:min-w-[64px] text-[13px] sm:text-base";
  const liveScoreClasses = "bg-red-50 text-red-700 border-red-200 shadow-sm animate-pulse-subtle";
  const finalScoreClasses = "bg-secondary text-foreground border-border";

  const nameBaseClasses = "font-display text-[11px] sm:text-sm uppercase tracking-wide truncate";
  const injuredNameClasses = "text-red-600 font-semibold";
  const standardNameClasses = "text-foreground font-bold";

  return (
    <div className="mb-6">
      {label && (
        <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-wider text-center mb-3">
          {label}
        </h2>
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/50">
        {Array.from({ length: maxRows }).map((_, i) => {
          const home = homeEntries[i];
          const away = awayEntries[i];
          
          const homeScore = home?.final_score || 0;
          const awayScore = away?.final_score || 0;
          
          const isHomeLive = home && home.is_live_score;
          const isAwayLive = away && away.is_live_score;

          return (
            <div key={i} className="py-2 px-2 sm:px-4">
              {/* Griglia super-ottimizzata: gap ridotti su mobile (gap-x-1.5) e normali su desktop (sm:gap-x-3.5) */}
              <div className="grid grid-cols-[auto,1fr,auto,auto,auto,1fr,auto] items-center gap-x-1.5 sm:gap-x-3.5">
                
                {/* === SQUADRA IN CASA (Sinistra) === */}
                {home ? (
                  <>
                    <RoleBadge role={home.player_role} />

                    <div className="overflow-hidden">
                      <p className={`${nameBaseClasses} ${home.player_status === "INJURED" ? injuredNameClasses : standardNameClasses} ${home.lineup_role === "capitano" ? "!text-red-500" : ""}`}>
                        {getPlayerLastName(home.player_name)}
                      </p>
                    </div>

                    <div className="relative">
                      {isHomeLive && (
                        <div className="absolute -top-1.5 -left-1.5 p-0.5 rounded-full bg-red-500 text-white">
                          <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </div>
                      )}
                      <div className={`${scoreBaseClasses} ${isHomeLive ? liveScoreClasses : finalScoreClasses}`}>
                        {homeScore.toFixed(2)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-3" />
                )}

                {/* === SEPARATORE CENTRALE === */}
                <div className="flex justify-center text-center font-semibold text-muted-foreground text-[10px] sm:text-xl px-0.5 sm:px-1">
                  -
                </div>

                {/* === SQUADRA IN TRASFERTA (Destra) === */}
                {away ? (
                  <>
                    <div className="relative">
                      {isAwayLive && (
                        <div className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white">
                          <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </div>
                      )}
                      <div className={`${scoreBaseClasses} ${isAwayLive ? liveScoreClasses : finalScoreClasses}`}>
                        {awayScore.toFixed(2)}
                      </div>
                    </div>

                    <div className="overflow-hidden text-right">
                      <p className={`${nameBaseClasses} ${away.player_status === "INJURED" ? injuredNameClasses : standardNameClasses} ${away.lineup_role === "capitano" ? "!text-red-500" : ""}`}>
                        {getPlayerLastName(away.player_name)}
                      </p>
                    </div>

                    <RoleBadge role={away.player_role} />
                  </>
                ) : (
                  <div className="col-span-3" />
                )}

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
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-display font-bold uppercase tracking-wide text-xs sm:text-sm text-muted-foreground">{match.team_home_name}</p>
            <p className={`font-display text-2xl sm:text-3xl font-bold mt-1 ${match.score_home > match.score_away ? "text-primary" : ""}`}>
              {(match.score_home || 0).toFixed(2)}
            </p>
          </div>
          <div className="px-2 sm:px-4">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 text-right">
            <p className="font-display font-bold uppercase tracking-wide text-xs sm:text-sm text-muted-foreground">{match.team_away_name}</p>
            <p className={`font-display text-2xl sm:text-3xl font-bold mt-1 ${match.score_away > match.score_home ? "text-primary" : ""}`}>
              {(match.score_away || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <SectionBlock label="TITOLARI" homeEntries={homeStarters} awayEntries={awayStarters} />
      <SectionBlock label="SESTO UOMO" homeEntries={homeSixth} awayEntries={awaySixth} />
      <SectionBlock label="PANCHINA" homeEntries={homeBench} awayEntries={awayBench} />

      {(match.lineup_home_last_updated || match.lineup_away_last_updated) && (
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex justify-between text-[10px] sm:text-xs text-muted-foreground mt-2">
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