#!/usr/bin/env python3
"""Parse propMover.txt + propMover.txt.txt → monsters.json"""

import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
DATARES = os.path.join(BASE, "Datenbank", "Datares")
SPECITEM = os.path.join(BASE, "Datenbank", "datasub2", "Spec_Item.txt")

MOVER_FILE = os.path.join(DATARES, "propMover.txt")
NAMES_FILE = os.path.join(DATARES, "propMover.txt.txt")
OUT_FILE   = os.path.join(BASE, "flyff-app", "public", "data", "monsters.json")

# ── Maps ──────────────────────────────────────────────────────────────────────

ELEMENT_MAP = {
    "0": "None", "1": "Fire", "2": "Water", "3": "Electric",
    "4": "Wind", "5": "Earth", "6": "All",
}
RANK_MAP = {
    "=": "Normal", "RANK_NORMAL": "Normal", "RANK_CAPTAIN": "Captain",
    "RANK_BOSS": "Boss", "RANK_LOW": "Low", "RANK_GUARD": "Guard",
    "RANK_MINI": "Mini-Boss", "RANK_MIDBOSS": "Midboss", "RANK_SUPER": "Super",
}

# Skill attack damage multiplier by rank (vs. base atkMax).
# SUPER/Boss monsters use devastating skill attacks well above their basic ATK.
# These multipliers are derived from observed in-game values:
#   Kalipogon SUPER (atkMax≈855K) → ~2M skill hit → ×2.5
SKILL_MULTIPLIER = {
    "Super":     2.5,
    "Midboss":   1.8,
    "Boss":      1.5,
    "Mini-Boss": 1.3,
    "Captain":   1.2,
    "Normal":    1.0,
    "Low":       1.0,
    "Guard":     1.0,
}

RACE_MAP = {
    "=": "Unknown", "RACE_HUMAN": "Human", "RACE_ANIMAL": "Animal",
    "RACE_MACHINE": "Machine", "RACE_UNDEAD": "Undead", "RACE_WATER": "Water",
    "RACE_GHOST": "Ghost", "RACE_DEVIL": "Devil",
}

# Rows/columns not part of combat monsters
SKIP_IDS = {"MI_DEFAULT", "MI_MALE", "MI_FEMALE", "MI_PC_DEFAULT",
            "MI_NYANG", "MI_PENYA"}

def safe_int(v: str, default: int = 0) -> int:
    try: return int(v)
    except: return default

def safe_float(v: str, default: float = 0.0) -> float:
    try: return float(v)
    except: return default

# ── Load names ────────────────────────────────────────────────────────────────

def load_names(path: str) -> dict[str, str]:
    names: dict[str, str] = {}
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) >= 2 and parts[0].startswith("IDS_PROPMOVER"):
                val = parts[1].strip()
                if val:
                    names[parts[0]] = val
    return names

# ── Load mob weapon ATK values from Spec_Item.txt ─────────────────────────────
# col[1]=itemID, col[30]=abilityMin (atkMin), col[31]=abilityMax (atkMax)

def load_mob_weapon_atk(path: str) -> dict[str, tuple[int, int]]:
    """Return {itemID: (atkMin, atkMax)} for IK2_MOB weapon items."""
    weapons: dict[str, tuple[int, int]] = {}
    try:
        with open(path, encoding="cp949", errors="replace") as f:
            lines = f.readlines()
    except FileNotFoundError:
        return weapons

    default_cols = lines[2].strip().split("\t") if len(lines) > 2 else []

    def dcol(idx: int) -> str:
        if idx < len(default_cols):
            v = default_cols[idx]
            return "0" if v in ("=", "") else v.strip()
        return "0"

    for line in lines[2:]:
        cols = line.strip().split("\t")
        if len(cols) < 32:
            continue
        item_id = cols[1].strip() if len(cols) > 1 else ""
        if not item_id.startswith("II_WEA_MOB"):
            continue

        def col(idx: int) -> str:
            v = cols[idx] if idx < len(cols) else "="
            v = v.strip()
            return v if v != "=" else dcol(idx)

        atk_min = safe_int(col(30))
        atk_max = safe_int(col(31))
        if atk_min > 0 or atk_max > 0:
            weapons[item_id] = (atk_min, atk_max)

    print(f"Loaded {len(weapons)} mob weapon ATK entries")
    return weapons

# ── Parse ──────────────────────────────────────────────────────────────────────

def parse():
    names      = load_names(NAMES_FILE)
    mob_atk    = load_mob_weapon_atk(SPECITEM)
    print(f"Loaded {len(names)} monster names")

    with open(MOVER_FILE, encoding="cp949", errors="replace") as f:
        lines = f.readlines()

    # Default row at index 2
    default_cols = lines[2].strip().split("\t")

    def dcol(idx: int) -> str:
        v = default_cols[idx] if idx < len(default_cols) else "0"
        return "0" if v == "=" else v.strip()

    monsters = []
    skipped  = 0

    for line in lines[2:]:
        cols = line.strip().split("\t")
        if not cols[0].startswith("MI_"):
            continue
        mid = cols[0].strip()
        if mid in SKIP_IDS:
            continue

        def col(idx: int) -> str:
            v = cols[idx] if idx < len(cols) else "="
            v = v.strip()
            if v == "=":
                v = dcol(idx)
            return v

        name_id = col(1)
        name = names.get(name_id, "")
        if not name:
            name = mid.replace("MI_", "").replace("_", " ").title()

        level   = safe_int(col(12))
        atk_min = safe_int(col(20))
        atk_max = safe_int(col(21))
        add_hp  = safe_int(col(35))
        add_mp  = safe_int(col(36))
        def_nat = safe_int(col(37))
        exp     = safe_int(col(62))

        # Skip guards / NPCs / purely empty entries
        if level == 0 and exp <= 1 and add_hp <= 0:
            skipped += 1
            continue

        rank_raw = col(15)
        race_raw = col(9)
        elem_raw = col(41)
        elem_atk = safe_int(col(42))

        rank = RANK_MAP.get(rank_raw, rank_raw)
        race = RACE_MAP.get(race_raw, race_raw)
        elem = ELEMENT_MAP.get(elem_raw, "None")

        hp = add_hp if add_hp > 0 else max(1, level * 10)

        # ── Skill attack data ────────────────────────────────────────────────
        # dwAtk1/2/3 (cols 22-24) reference mob weapon item IDs.
        # The skill damage multiplier is server-side; we approximate by rank.
        skill_atk_ids = [col(22), col(23), col(24)]
        has_skill = any(sid.startswith("II_WEA_MOB") for sid in skill_atk_ids)

        # Compute estimated skill ATK (highest mob weapon ATK or rank multiplier)
        skill_mult = SKILL_MULTIPLIER.get(rank, 1.0)

        # Check if the specific mob weapons have noteworthy ATK values
        # (some boss weapons have high base values that act as additional flat bonus)
        best_skill_bonus = 0
        for sid in skill_atk_ids:
            if sid in mob_atk:
                _, w_max = mob_atk[sid]
                best_skill_bonus = max(best_skill_bonus, w_max)

        # Estimated skill damage: base ATK × multiplier + weapon bonus (if meaningful)
        # Only show estimated skill if monster has skill attack weapons
        if has_skill and atk_max > 0:
            skill_atk_min = round(atk_min * skill_mult)
            skill_atk_max = round(atk_max * skill_mult)
        else:
            skill_atk_min = 0
            skill_atk_max = 0

        monsters.append({
            "id":             mid,
            "name":           name,
            "level":          level,
            "rank":           rank,
            "race":           race,
            "hp":             hp,
            "mp":             add_mp,
            "atkMin":         atk_min,
            "atkMax":         atk_max,
            "skillAtkMin":    skill_atk_min,
            "skillAtkMax":    skill_atk_max,
            "skillMult":      skill_mult if has_skill else 1.0,
            "def":            def_nat,
            "exp":            exp,
            "element":        elem,
            "elementAtk":     elem_atk,
            "resMagic":       round(safe_float(col(50)), 3),
            "resElec":        round(safe_float(col(51)), 3),
            "resFire":        round(safe_float(col(52)), 3),
            "resWind":        round(safe_float(col(53)), 3),
            "resWater":       round(safe_float(col(54)), 3),
            "resEarth":       round(safe_float(col(55)), 3),
        })

    monsters.sort(key=lambda m: (m["level"], m["name"]))
    print(f"Parsed {len(monsters)} monsters, skipped {skipped}")

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"monsters": monsters}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Written → {OUT_FILE}")

if __name__ == "__main__":
    parse()
