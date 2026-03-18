#!/usr/bin/env python3
"""Parse awakening options and gem bonuses from Flyff database files."""

import json
import re
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "Datenbank", "Datares")
OUTPUT_DIR = os.path.join(BASE_DIR, "flyff-app", "public", "data")


def build_awakening_options():
    """Build awakening options list (modern Flyff Universe server values)."""
    known_options = [
        {"stat": "DST_STR", "label": "STR", "minVal": -25, "maxVal": 25, "unit": ""},
        {"stat": "DST_DEX", "label": "DEX", "minVal": -25, "maxVal": 25, "unit": ""},
        {"stat": "DST_INT", "label": "INT", "minVal": -25, "maxVal": 25, "unit": ""},
        {"stat": "DST_STA", "label": "STA", "minVal": -25, "maxVal": 25, "unit": ""},
        {"stat": "DST_HP_MAX_RATE", "label": "Max HP", "minVal": 1, "maxVal": 10, "unit": "%"},
        {"stat": "DST_MP_MAX_RATE", "label": "Max MP", "minVal": 1, "maxVal": 10, "unit": "%"},
        {"stat": "DST_ATKPOWER_RATE", "label": "ATK", "minVal": 1, "maxVal": 10, "unit": "%"},
        {"stat": "DST_CRITICAL_BONUS", "label": "Crit DMG", "minVal": 1, "maxVal": 30, "unit": "%"},
        {"stat": "DST_CHR_CHANCECRITICAL", "label": "Crit Rate", "minVal": 1, "maxVal": 15, "unit": ""},
        {"stat": "DST_ATTACKSPEED", "label": "Attack Speed", "minVal": 20, "maxVal": 100, "unit": ""},
        {"stat": "DST_SPEED", "label": "Movement Speed", "minVal": 1, "maxVal": 5, "unit": "%"},
        {"stat": "DST_EXPERIENCE", "label": "EXP Bonus", "minVal": 1, "maxVal": 5, "unit": "%"},
        {"stat": "DST_ADDMAGIC", "label": "Magic ATK", "minVal": 30, "maxVal": 180, "unit": ""},
        {"stat": "DST_MELEE_STEALHP", "label": "Suck HP", "minVal": 1, "maxVal": 6, "unit": "%"},
        {"stat": "DST_PVP_DMG", "label": "PvP DMG", "minVal": 1, "maxVal": 10, "unit": "%"},
        {"stat": "DST_MONSTER_DMG", "label": "Monster DMG", "minVal": 1, "maxVal": 10, "unit": "%"},
        {"stat": "DST_BLOCK_MELEE", "label": "Melee Block", "minVal": 1, "maxVal": 15, "unit": "%"},
        {"stat": "DST_BLOCK_RANGE", "label": "Range Block", "minVal": 1, "maxVal": 15, "unit": "%"},
        {"stat": "DST_PARRY", "label": "Parry", "minVal": 1, "maxVal": 10, "unit": "%"},
        {"stat": "DST_DROP_ITEM_ALLGRADE_RATE", "label": "Item Drop", "minVal": 1, "maxVal": 5, "unit": "%"},
        {"stat": "DST_ADJDEF", "label": "DEF", "minVal": 5, "maxVal": 100, "unit": ""},
        {"stat": "DST_ATKPOWER", "label": "ATK Power", "minVal": 5, "maxVal": 200, "unit": ""},
        {"stat": "DST_HP_MAX", "label": "Max HP (flat)", "minVal": 100, "maxVal": 2000, "unit": ""},
    ]
    return {"options": known_options}


def parse_ultimate_gems():
    """Parse Ultimate_GemAbility.txt for gem bonuses (5 tiers per stat)."""
    path = os.path.join(DATA_DIR, "Ultimate_GemAbility.txt")

    for enc in ("cp1252", "utf-8", "latin-1"):
        try:
            with open(path, "r", encoding=enc, errors="replace") as f:
                content = f.read()
            break
        except Exception:
            continue
    else:
        print(f"  WARNING: Could not read {path}")
        return {}

    result = {}
    ability_pattern = re.compile(r'ABILITY\s+(DST_\w+)\s*\{([^}]*)\}', re.DOTALL)

    for match in ability_pattern.finditer(content):
        dst_key = match.group(1)
        block = match.group(2)

        gem_pattern = re.compile(r'II_\w+\s+II_\w+\s+([\d ]+)')
        all_values = []
        for gem_match in gem_pattern.finditer(block):
            raw = gem_match.group(1).strip()
            values = [int(v) for v in raw.split()]
            if values:
                all_values.append(values)

        if all_values:
            max_tiers = max(len(v) for v in all_values)
            tier_maxes = []
            for tier in range(max_tiers):
                tier_maxes.append(max(v[tier] for v in all_values if tier < len(v)))
            result[dst_key] = tier_maxes

    print(f"  Ultimate gems: {len(result)} stats parsed")
    return result


def parse_suit_gems():
    """Parse Suit_GemAbility.txt for job-specific gem bonuses (4 tiers)."""
    path = os.path.join(DATA_DIR, "Suit_GemAbility.txt")

    for enc in ("cp1252", "utf-8", "latin-1"):
        try:
            with open(path, "r", encoding=enc, errors="replace") as f:
                content = f.read()
            break
        except Exception:
            continue
    else:
        print(f"  WARNING: Could not read {path}")
        return {}

    result = {}
    ability_pattern = re.compile(r'ABILITY\s+(DST_\w+)\s*\{([^}]*)\}', re.DOTALL)

    for match in ability_pattern.finditer(content):
        dst_key = match.group(1)
        block = match.group(2)

        job_pattern = re.compile(r'(JOB_\w+)\s+II_\w+\s+([\d ]+)')
        for job_match in job_pattern.finditer(block):
            job_id = job_match.group(1)
            raw = job_match.group(2).strip()
            values = [int(v) for v in raw.split()]
            if values:
                if job_id not in result:
                    result[job_id] = {}
                result[job_id][dst_key] = values

    print(f"  Suit gems: {len(result)} jobs parsed")
    return result


def parse_costume_gems():
    """Parse Costume_GemAbility.txt for costume gem bonuses (4 tiers)."""
    path = os.path.join(DATA_DIR, "Costume_GemAbility.txt")

    for enc in ("cp1252", "utf-8", "latin-1"):
        try:
            with open(path, "r", encoding=enc, errors="replace") as f:
                content = f.read()
            break
        except Exception:
            continue
    else:
        print(f"  WARNING: Could not read {path}")
        return {}

    result = {}
    ability_pattern = re.compile(r'ABILITY\s+(DST_\w+)\s*\{([^}]*)\}', re.DOTALL)

    for match in ability_pattern.finditer(content):
        dst_key = match.group(1)
        block = match.group(2).strip()
        values = [int(v) for v in re.findall(r'\d+', block)]
        if values:
            result[dst_key] = values

    print(f"  Costume gems: {len(result)} stats parsed")
    return result


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Parsing awakening options...")
    awakening_data = build_awakening_options()
    output_path = os.path.join(OUTPUT_DIR, "awakening_options.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(awakening_data, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {len(awakening_data['options'])} options -> {output_path}")

    print("\nParsing gem bonuses...")
    ultimate_gems = parse_ultimate_gems()
    suit_gems = parse_suit_gems()
    costume_gems = parse_costume_gems()

    gem_bonuses = {
        "ultimate": ultimate_gems,
        "suit": suit_gems,
        "costume": costume_gems,
    }
    output_path = os.path.join(OUTPUT_DIR, "gem_bonuses.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(gem_bonuses, f, ensure_ascii=False, indent=2)
    print(f"  Wrote gem_bonuses.json -> {output_path}")

    print("\nDone!")


if __name__ == "__main__":
    main()
