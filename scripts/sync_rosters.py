import os
import time
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from nba_api.stats.endpoints import commonallplayers

# --- CONFIGURAZIONE PATH ---
script_path = Path(__file__).resolve()
project_root = script_path.parent.parent
env_path = project_root / ".env"

print(f"🔍 Cerco il file .env in: {env_path}")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")

if not url or not key:
    print("❌ Errore: Variabili .env non trovate!")
    exit()

supabase: Client = create_client(url, key)

def sync_rosters():
    print("🏀 Recupero roster ufficiali dall'NBA...")
    
    try:
        # Recupero dati ufficiali della stagione attuale
        nba_data = commonallplayers.CommonAllPlayers(is_only_current_season=1).get_data_frames()[0]
    except Exception as e:
        print(f"❌ Errore nel contattare i server NBA: {e}")
        return

    # Prendiamo i tuoi giocatori dal database Supabase
    miei_giocatori = supabase.table("nba_players").select("*").execute().data
    
    print(f"Analisi di {len(miei_giocatori)} giocatori nel tuo database...")
    updates_count = 0

    for p in miei_giocatori:
        nome_fanta = p['name']
        
        # Cerchiamo il match nell'API NBA
        match = nba_data[nba_data['DISPLAY_FIRST_LAST'].str.lower() == nome_fanta.lower()]
        
        if not match.empty:
            nuova_abbr = match.iloc[0]['TEAM_ABBREVIATION']
            
            # --- LOGICA FA: Se l'abbreviazione è vuota, diventa FA ---
            if not nuova_abbr or str(nuova_abbr).strip() == "":
                nuova_abbr = "FA"
                team_completo = "Free Agent"
            else:
                nuova_city = match.iloc[0]['TEAM_CITY']
                nuovo_nome_team = match.iloc[0]['TEAM_NAME']
                team_completo = f"{nuova_city} {nuovo_nome_team}"
            # -------------------------------------------------------

            # Se la squadra è diversa da quella salvata nel DB, aggiorniamo
            # (Usiamo .get() per evitare errori se la colonna nel DB è nulla)
            current_abbr = p.get('nba_team_abbr') or ""
            
            if nuova_abbr != current_abbr:
                print(f"🔄 AGGIORNAMENTO: {nome_fanta}")
                print(f"   Da: '{current_abbr}' -> A: '{nuova_abbr}'")
                
                supabase.table("nba_players").update({
                    "nba_team_abbr": nuova_abbr,
                    "nba_team": team_completo
                }).eq("id", p['id']).execute()
                
                updates_count += 1
        
        # Delay per stabilità
        time.sleep(0.1)

    print(f"\n✅ Sincronizzazione finita! Giocatori aggiornati: {updates_count}")

if __name__ == "__main__":
    sync_rosters()