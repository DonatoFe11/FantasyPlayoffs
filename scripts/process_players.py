#!/usr/bin/env python3
"""
process_players.py

Legge un CSV di giocatori, rimuove le righe con Position == Head Coach,
traduce le posizioni in italiano e aggiunge una colonna `Team_abbr`.

Uso:
  python scripts/process_players.py --input "Listone Dunkest Fantasy NBA 2025_26 - Dunkest Fantasy NBA 2025_26 Player List.csv"

Output: crea un file con suffisso `_processed.csv` nella stessa cartella.
"""
import argparse
import csv
import os
import re
from collections import OrderedDict

def normalize_team(name: str) -> str:
    if name is None:
        return ""
    s = name.lower()
    s = re.sub(r"[^a-z0-9]", "", s)
    return s


POSITION_MAP = {
    "guard": "Guardia",
    "forward": "Ala",
    "center": "Centro",
}


RAW_TEAM_MAP = {
    "Detroit Pistons": "DET",
    "Boston Celtics": "BOS",
    "New York Knicks": "NYK",
    "Cleveland Cavaliers": "CLE",
    "Toronto Raptors": "TOR",
    "Atlanta Hawks": "ATL",
    "Philadelphia 76ers": "PHI",
    "Orlando Magic": "ORL",
    "Charlotte Hornets": "CHA",
    "Miami Heat": "MIA",
    "Milwaukee Bucks": "MIL",
    "Chicago Bulls": "CHI",
    "Brooklyn Nets": "BKN",
    "Indiana Pacers": "IND",
    "Washington Wizards": "WAS",
    "Oklahoma City Thunder": "OKC",
    "San Antonio Spurs": "SAS",
    "San Antonioi Spurs": "SAS",
    "Denver Nuggets": "DEN",
    "Los Angeles Lakers": "LAL",
    "Houston Rockets": "HOU",
    "Minnesota Timberwolves": "MIN",
    "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR",
    "Portland Trailblazers": "POR",
    "Los Angeles Clippers": "LAC",
    "Golden State Warriors": "GSW",
    "New Orleans Pelicans": "NOP",
    "Dallas Mavericks": "DAL",
    "Memphis Grizzlies": "MEM",
    "Sacramento Kings": "SAC",
    "Utah Jazz": "UTA",
}


def build_normalized_map(raw_map: dict) -> dict:
    out = {}
    for k, v in raw_map.items():
        out[normalize_team(k)] = v
    return out


TEAM_MAP = build_normalized_map(RAW_TEAM_MAP)


def find_team_abbr(team_name: str) -> str:
    norm = normalize_team(team_name)
    if not norm:
        return ""
    # exact normalized lookup
    if norm in TEAM_MAP:
        return TEAM_MAP[norm]
    # fallback: substring match
    for k_norm, abbr in TEAM_MAP.items():
        if k_norm in norm or norm in k_norm:
            return abbr
    return ""


def process_file(input_path: str, output_path: str) -> None:
    removed = 0
    total_in = 0
    total_out = 0

    with open(input_path, "r", encoding="utf-8", errors="replace") as inf:
        reader = csv.DictReader(inf)
        fieldnames = list(reader.fieldnames or [])
        if "Team_abbr" not in fieldnames:
            fieldnames.append("Team_abbr")

        rows_out = []
        for row in reader:
            total_in += 1
            pos = (row.get("Position") or "").strip()
            if pos.lower() == "head coach":
                removed += 1
                continue

            # translate position if matches
            pos_key = pos.lower()
            if pos_key in POSITION_MAP:
                row["Position"] = POSITION_MAP[pos_key]

            # team abbreviation
            team_name = row.get("Team") or ""
            row["Team_abbr"] = find_team_abbr(team_name)

            rows_out.append(row)
            total_out += 1

    # write output
    with open(output_path, "w", encoding="utf-8", newline="") as outf:
        writer = csv.DictWriter(outf, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows_out:
            writer.writerow(r)

    print(f"Input rows: {total_in}")
    print(f"Removed (Head Coach): {removed}")
    print(f"Output rows: {total_out}")
    print(f"Wrote: {output_path}")


def main():
    p = argparse.ArgumentParser(description="Process players CSV: remove Head Coach, translate positions, add Team_abbr")
    p.add_argument("--input", "-i", default="Listone Dunkest Fantasy NBA 2025_26 - Dunkest Fantasy NBA 2025_26 Player List.csv", help="Input CSV path")
    p.add_argument("--output", "-o", help="Output CSV path (optional)")
    args = p.parse_args()

    input_path = args.input
    if not os.path.exists(input_path):
        print(f"Input file not found: {input_path}")
        return

    if args.output:
        output_path = args.output
    else:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_processed{ext}"

    process_file(input_path, output_path)


if __name__ == "__main__":
    main()
