import os
import time
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from nba_api.stats.endpoints import scoreboardv3, boxscoretraditionalv3, boxscoremiscv3

# --- FUNZIONE PER PULIRE I NOMI ---
def super_clean(name):
    if not name: return ""
    name = "".join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn')
    name = name.lower().replace(".", "").replace("-", " ").strip()
    for suffix in [" jr", " sr", " iii", " ii", " iv"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    return name

# --- SETUP SUPABASE ---
script_path = Path(__file__).resolve()
env_path = script_path.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def get_multiplier(role):
    if role == 'capitano': return 1.5
    if role == 'panchinaro': return 0.5
    return 1.0

def safe_int(val):
    try: return int(val)
    except: return 0

def calculate_fantasy_points(p_trad, p_misc, team_won):
    minutes = str(p_trad.get('minutes', '')).strip()
    if not minutes or minutes.startswith('00:00') or minutes == '0': return 0.0

    pts = safe_int(p_trad.get('points'))
    dreb = safe_int(p_trad.get('reboundsDefensive'))
    oreb = safe_int(p_trad.get('reboundsOffensive'))
    ast = safe_int(p_trad.get('assists'))
    stl = safe_int(p_trad.get('steals'))
    blk = safe_int(p_trad.get('blocks'))
    tov = safe_int(p_trad.get('turnovers'))
    fgm = safe_int(p_trad.get('fieldGoalsMade'))
    fga = safe_int(p_trad.get('fieldGoalsAttempted'))
    fg3m = safe_int(p_trad.get('threePointersMade'))
    ftm = safe_int(p_trad.get('freeThrowsMade'))
    fta = safe_int(p_trad.get('freeThrowsAttempted'))
    start_pos = str(p_trad.get('position', '')).strip()
    blka = safe_int(p_misc.get('blocksAgainst')) if p_misc else 0

    missed_fg = fga - fgm
    missed_ft = fta - ftm
    reb = dreb + oreb
    stats_list = [pts, reb, ast, stl, blk]
    doubles = sum(1 for stat in stats_list if stat >= 10)

    score = 0.0
    score += pts * 1.0
    score += dreb * 1.0
    score += oreb * 1.25
    score += ast * 1.5
    score += stl * 1.5
    score += tov * -1.5
    score += blk * 1.5
    score += blka * -0.5
    score += missed_fg * -1.0
    score += missed_ft * -1.0

    if fg3m == 3: score += 3.0
    elif fg3m == 4: score += 4.0
    elif fg3m >= 5: score += 5.0

    if doubles == 2: score += 5.0
    elif doubles == 3: score += 10.0
    elif doubles >= 4: score += 50.0

    if start_pos in ['G', 'F', 'C']: score += 1.0
    if team_won: score = score * 1.05

    return round(score, 2)

def fetch_and_update_scores():
    nba_date = (datetime.now() - timedelta(hours=9)).strftime('%Y-%m-%d')
    print(f"🔄 Aggiornamento Punteggi - NBA Date: {nba_date}")
    
    # 1. RECUPERIAMO SOLO LE FORMAZIONI SENZA LUCCHETTO
    res_lineups = supabase.table("lineups").select("*").eq("is_manual_score", False).eq("is_locked", False).execute()
    all_unlocked_lineups = res_lineups.data
    
    if not all_unlocked_lineups:
        print("🤷 Nessuna formazione attiva da aggiornare (o tutte chiuse).")
        return

    # 2. FILTRO LOGICO: PRENDIAMO SOLO LA PRIMA PARTITA DISPONIBILE PER OGNI GIOCATORE
    # Questo impedisce di scrivere i punti di Gara 1 anche nella formazione di Gara 2 se è già schierata
    target_lineups = {}
    for entry in all_unlocked_lineups:
        key = (entry['team_id'], entry['player_name'])
        if key not in target_lineups:
            target_lineups[key] = entry
        else:
            # Se troviamo una Gara precedente (ID più basso), diamo la priorità a quella
            if entry['match_id'] < target_lineups[key]['match_id']:
                target_lineups[key] = entry

    lineups_to_process = list(target_lineups.values())

    try:
        # Aumentiamo anche il timeout da 30 a 60 secondi per dare più tempo all'NBA di rispondere
        board = scoreboardv3.ScoreboardV3(game_date=nba_date, timeout=60)
        all_games = board.get_dict().get('scoreboard', {}).get('games', [])
    except Exception as e:
        print(f"⚠️ I server NBA non rispondono (Timeout/Errore). Riproverò al prossimo giro. Dettaglio: {e}")
        return
    
    active_games = [g for g in all_games if "Preevent" not in g.get('gameStatusText', '')]
    
    if not active_games:
        print(f"😴 Tutte le partite per il {nba_date} devono ancora iniziare. Skip.")
        return

    updates_count = 0

    for game in active_games:
        game_id = game.get('gameId')
        status = game.get('gameStatusText')
        is_nba_final = (status == 'Final')
        
        print(f"🏀 Analizzo Partita: {game_id} | Stato: {status}")

        winning_team_id = None
        if is_nba_final:
            home = game.get('homeTeam', {})
            away = game.get('awayTeam', {})
            if safe_int(home.get('score')) > safe_int(away.get('score')):
                winning_team_id = safe_int(home.get('teamId'))
            else:
                winning_team_id = safe_int(away.get('teamId'))

        try:
            trad_df = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id).get_data_frames()[0]
            trad_players = trad_df.to_dict('records') if not trad_df.empty else []
            time.sleep(0.5)
            
            misc_df = boxscoremiscv3.BoxScoreMiscV3(game_id=game_id).get_data_frames()[0]
            misc_players = misc_df.to_dict('records') if not misc_df.empty else []
            time.sleep(0.5)
            
            trad_map = {}
            for p in trad_players:
                last = str(p.get('familyName', ''))
                full = p.get('name') or f"{p.get('firstName', '')} {last}".strip()
                trad_map[super_clean(full)] = p
                if last: trad_map[super_clean(last)] = p

            misc_map = {super_clean(p.get('name') or p.get('familyName')): p for p in misc_players}

        except Exception as e:
            print(f"⚠️ Errore download partita {game_id}: {e}")
            continue

        for entry in lineups_to_process:
            fanta_name_clean = super_clean(entry['player_name'])
            
            if fanta_name_clean in trad_map:
                p_trad = trad_map[fanta_name_clean]
                p_misc = misc_map.get(fanta_name_clean)
                
                team_won = (is_nba_final and safe_int(p_trad.get('teamId')) == winning_team_id)

                raw = calculate_fantasy_points(p_trad, p_misc, team_won)
                multiplier = get_multiplier(entry['lineup_role'])
                final = round(raw * multiplier, 2)

                # Se il punteggio è cambiato OPPURE la partita NBA è finita (e dobbiamo bloccare)
                if float(entry.get('raw_score') or 0) != raw or is_nba_final:
                    update_data = {
                        "raw_score": raw,
                        "final_score": final
                    }
                    
                    if is_nba_final:
                        update_data["is_locked"] = True
                        print(f"   🔒 LUCCHETTO CHIUSO per {entry['player_name']} in Gara (Match ID {entry['match_id']})")
                    else:
                        print(f"   ✅ Aggiorno {entry['player_name']} (Match ID {entry['match_id']}): {raw} -> {final}")
                    
                    supabase.table("lineups").update(update_data).eq("id", entry['id']).execute()
                    updates_count += 1

    print(f"\n🎉 Fine. Totale aggiornamenti effettuati: {updates_count}")

if __name__ == "__main__":
    fetch_and_update_scores()