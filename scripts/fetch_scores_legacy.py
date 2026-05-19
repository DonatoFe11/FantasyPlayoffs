import os
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

from nba_api.live.nba.endpoints import scoreboard, boxscore

def super_clean(name):
    if not name: return ""
    name = "".join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn')
    name = name.lower().replace(".", "").replace("-", " ").strip()
    for suffix in [" jr", " sr", " iii", " ii", " iv"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    return name

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

def calculate_fantasy_points(p_data, team_won):
    stats = p_data.get('statistics', {})
    minutes = str(stats.get('minutes', '')).strip()
    
    if not minutes or 'PT00M00' in minutes or minutes == '00:00' or minutes == '0':
        return 0.0

    pts = safe_int(stats.get('points'))
    dreb = safe_int(stats.get('reboundsDefensive'))
    oreb = safe_int(stats.get('reboundsOffensive'))
    ast = safe_int(stats.get('assists'))
    stl = safe_int(stats.get('steals'))
    blk = safe_int(stats.get('blocks'))
    tov = safe_int(stats.get('turnovers'))
    fgm = safe_int(stats.get('fieldGoalsMade'))
    fga = safe_int(stats.get('fieldGoalsAttempted'))
    fg3m = safe_int(stats.get('threePointersMade'))
    ftm = safe_int(stats.get('freeThrowsMade'))
    fta = safe_int(stats.get('freeThrowsAttempted'))
    blka = safe_int(stats.get('blocksReceived', stats.get('blocksAgainst', 0)))
    start_pos = str(p_data.get('position', '')).strip()
    is_starter = str(p_data.get('starter', '')).strip() == '1'

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

    if is_starter or start_pos != "": score += 1.0
    if team_won: score = score * 1.05

    return round(score, 2)

def fetch_and_update_scores():
    print(f"🔄 Avvio Aggiornamento Punteggi tramite NBA Live API")
    
    res_lineups = supabase.table("lineups").select("*").eq("is_manual_score", False).eq("is_locked", False).execute()
    all_unlocked_lineups = res_lineups.data
    
    if not all_unlocked_lineups:
        print("🤷 Nessuna formazione attiva da aggiornare.")
        return

    lineups_to_process = all_unlocked_lineups

    try:
        board = scoreboard.ScoreBoard()
        games = board.games.get_dict()
    except Exception as e:
        print(f"⚠️ Errore caricamento Live Scoreboard: {e}")
        return
    
    active_games = [g for g in games if g.get('gameStatus') in [2, 3]]
    
    if not active_games:
        print(f"😴 Tutte le partite odierne devono ancora iniziare (o non ce ne sono). Skip.")
        return

    updates_count = 0

    for game in active_games:
        game_id = game.get('gameId')
        status_num = game.get('gameStatus')
        is_nba_final = (status_num == 3)
        
        print(f"🏀 Analizzo Partita: {game_id} | Status: {status_num}")

        try:
            box = boxscore.BoxScore(game_id)
            game_data = box.game.get_dict()
            time.sleep(0.5)
            
            home_team = game_data.get('homeTeam', {})
            away_team = game_data.get('awayTeam', {})
            
            winning_team_id = None
            if is_nba_final:
                h_score = safe_int(home_team.get('score'))
                a_score = safe_int(away_team.get('score'))
                if h_score > a_score:
                    winning_team_id = safe_int(home_team.get('teamId'))
                elif a_score > h_score:
                    winning_team_id = safe_int(away_team.get('teamId'))

            player_map = {}
            for t_dict in [home_team, away_team]:
                current_team_id = safe_int(t_dict.get('teamId'))
                for p in t_dict.get('players', []):
                    p['teamId'] = current_team_id
                    
                    full_name = p.get('name') or f"{p.get('firstName', '')} {p.get('familyName', '')}".strip()
                    last_name = p.get('familyName', '').strip()
                    
                    player_map[super_clean(full_name)] = p
                    if last_name:
                        player_map[super_clean(last_name)] = p

        except Exception as e:
            print(f"⚠️ Errore download partita {game_id}: {e}")
            continue

        for entry in lineups_to_process:
            fanta_name_clean = super_clean(entry['player_name'])
            
            if fanta_name_clean in player_map:
                p_data = player_map[fanta_name_clean]
                team_won = (is_nba_final and safe_int(p_data.get('teamId')) == winning_team_id)

                raw = calculate_fantasy_points(p_data, team_won)
                multiplier = get_multiplier(entry['lineup_role'])
                final = round(raw * multiplier, 2)

                stats = p_data.get('statistics', {})
                minutes = str(stats.get('minutes', '')).strip()
                is_playing = bool(minutes and 'PT00M00' not in minutes and minutes not in ['00:00', '0'])
                
                is_live_score_now = (status_num == 2) and is_playing

                update_data = {
                    "raw_score": raw,
                    "final_score": final
                }
                
                if is_nba_final:
                    # GESTIONE RITARDO LUCCHETTO (Smart Lock)
                    was_live = entry.get('is_live_score', False)
                    
                    if was_live:
                        # Primo giro dopo la sirena: spegniamo il live ma NON lucchettiamo
                        update_data["is_live_score"] = False
                        update_data["is_locked"] = False
                        print(f"   ⏳ Fine gara per {entry['player_name']}. Voto: {final}. Attendo 5 min per eventuali correzioni NBA...")
                    else:
                        # Secondo giro (5 min dopo) oppure giocatore che non è mai entrato in campo: Lucchettiamo!
                        update_data["is_live_score"] = False
                        update_data["is_locked"] = True
                        print(f"   🔒 LUCCHETTO DEFINITIVO per {entry['player_name']} in Gara {entry['match_id']} ({final})")
                else:
                    # Partita ancora in corso
                    update_data["is_live_score"] = is_live_score_now
                    
                    if float(entry.get('final_score') or 0) != final or entry.get('is_live_score') != is_live_score_now:
                        print(f"   ✅ Aggiorno {entry['player_name']} (Gara {entry['match_id']}): {final} | Live: {is_live_score_now}")
                
                supabase.table("lineups").update(update_data).eq("id", entry['id']).execute()
                updates_count += 1

    print(f"\n🎉 Fine. Totale aggiornamenti effettuati: {updates_count}")

if __name__ == "__main__":
    fetch_and_update_scores()