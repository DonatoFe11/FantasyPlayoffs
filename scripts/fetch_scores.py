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

if not url or not key:
    print("❌ Errore: Variabili .env non trovate!")
    exit()

supabase: Client = create_client(url, key)

# --- REGOLE E MOLTIPLICATORI ---
def get_multiplier(role):
    if role == 'capitano': return 1.5
    if role == 'panchinaro': return 0.5
    return 1.0

def safe_int(val):
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0

def calculate_fantasy_points(p_trad, p_misc, team_won):
    minutes = str(p_trad.get('minutes', '')).strip()
    if not minutes or minutes.startswith('00:00') or minutes == '0':
        return 0.0

    # Estrazione dati (Nomi campi standardizzati da nba_api)
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

    # --- FORMULA REGOLAMENTO ---
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

    if start_pos in ['G', 'F', 'C']:
        score += 1.0

    if team_won:
        score = score * 1.05

    return round(score, 2)

def fetch_and_update_scores():
    # CALCOLO DATA NBA (Ora italiana - 9 ore = Data corretta del Game Day USA)
    nba_date = (datetime.now() - timedelta(hours=9)).strftime('%Y-%m-%d')
    print(f"🔄 Aggiornamento Punteggi - NBA Date: {nba_date} (Italia: {datetime.now().strftime('%H:%M')})")
    
    res_lineups = supabase.table("lineups").select("*").eq("is_manual_score", False).execute()
    lineups = res_lineups.data
    
    if not lineups:
        print("🤷 Nessuna formazione automatica trovata.")
        return

    board = scoreboardv3.ScoreboardV3(game_date=nba_date)
    games = board.get_dict().get('scoreboard', {}).get('games', [])
    
    if not games:
        print(f"📭 Nessuna partita trovata per la data {nba_date}.")
        return

    updates_count = 0

    for game in games:
        game_id = game.get('gameId')
        status = game.get('gameStatusText')
        
        print(f"\n🏀 Partita: {game_id} | Stato: {status}")

        winning_team_id = None
        if status == 'Final':
            home = game.get('homeTeam', {})
            away = game.get('awayTeam', {})
            if safe_int(home.get('score')) > safe_int(away.get('score')):
                winning_team_id = safe_int(home.get('teamId'))
            else:
                winning_team_id = safe_int(away.get('teamId'))

        try:
            trad_df = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id).get_data_frames()[0]
            trad_players = trad_df.to_dict('records') if not trad_df.empty else []
            time.sleep(0.4)
            
            misc_df = boxscoremiscv3.BoxScoreMiscV3(game_id=game_id).get_data_frames()[0]
            misc_players = misc_df.to_dict('records') if not misc_df.empty else []
            time.sleep(0.4)
            
            trad_dict_by_name = {}
            for p in trad_players:
                slug = str(p.get('playerSlug', '')).replace('-', ' ')
                first, last = str(p.get('firstName', '')), str(p.get('familyName', ''))
                full = p.get('name') or slug or f"{first} {last}".strip()
                trad_dict_by_name[super_clean(full)] = p
                if last: trad_dict_by_name[super_clean(last)] = p

            misc_dict_by_name = {}
            for p in misc_players:
                slug = str(p.get('playerSlug', '')).replace('-', ' ')
                first, last = str(p.get('firstName', '')), str(p.get('familyName', ''))
                full = p.get('name') or slug or f"{first} {last}".strip()
                misc_dict_by_name[super_clean(full)] = p
                if last: misc_dict_by_name[super_clean(last)] = p

        except Exception as e:
            print(f"⚠️ Errore download statistiche partita {game_id}: {e}")
            continue

        for entry in lineups:
            fanta_name_clean = super_clean(entry['player_name'])
            
            if fanta_name_clean in trad_dict_by_name:
                p_trad = trad_dict_by_name[fanta_name_clean]
                p_misc = misc_dict_by_name.get(fanta_name_clean)
                
                p_team_id = safe_int(p_trad.get('teamId'))
                team_won = (status == 'Final' and p_team_id == winning_team_id)

                raw = calculate_fantasy_points(p_trad, p_misc, team_won)
                multiplier = get_multiplier(entry['lineup_role'])
                final = round(raw * multiplier, 2)

                if float(entry.get('raw_score') or 0) != raw or float(entry.get('final_score') or 0) != final:
                    print(f"   ✅ {entry['player_name']}: {raw} -> {final} ({entry['lineup_role']})")
                    supabase.table("lineups").update({"raw_score": raw, "final_score": final}).eq("id", entry['id']).execute()
                    updates_count += 1

    print(f"\n🎉 Fine processo. Totale aggiornamenti: {updates_count}")

if __name__ == "__main__":
    fetch_and_update_scores()