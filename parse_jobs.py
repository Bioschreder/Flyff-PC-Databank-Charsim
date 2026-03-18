"""Parse propJob.inc and propSkillAdd.csv → jobs.json + skills.json for the character simulator."""
import json
from pathlib import Path

DB_DIR   = Path(__file__).parent / "Datenbank"
OUT_DIR  = Path(__file__).parent / "flyff-app/public/data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

JOB_FILE       = DB_DIR / "dataSub1" / "propJob.inc"
SKILL_FILE     = DB_DIR / "Datares" / "propSkillAdd.csv"
SKILL_TXT_FILE = DB_DIR / "Datares" / "propSkill.txt.txt"

# Column order from propJob.inc comment:
# JOB_ID, MAXLVL, HP_MULT, MP_MULT, FP_MULT, DEF_MULT, HP_REC, MP_REC, FP_REC,
# SWD, AXE, STAFF, STICK, KNUCKLE, WAND, BLOCKING, YOYO, CRITICAL, ICON

COLS = [
    "id", "maxLevel",
    "hpMultiplier", "mpMultiplier", "fpMultiplier",
    "defMultiplier",
    "hpRecovery", "mpRecovery", "fpRecovery",
    "swordFactor", "axeFactor", "staffFactor", "stickFactor",
    "knuckleFactor", "wandFactor",
    "blockingRate", "yoyoFactor",
    "criticalFactor", "icon"
]

# Weapon type mapping: weapon factor columns → weapon types the class can use
WEAPON_FACTORS = {
    "swordFactor":  "Sword",
    "axeFactor":    "Axe",
    "staffFactor":  "Staff",
    "stickFactor":  "Stick",
    "knuckleFactor":"Knuckle",
    "wandFactor":   "Wand",
    "yoyoFactor":   "Yoyo",
}

# Human-readable class names
JOB_NAMES = {
    "JOB_VAGRANT":          "Vagrant",
    "JOB_MERCENARY":        "Mercenary",
    "JOB_ACROBAT":          "Acrobat",
    "JOB_ASSIST":           "Assist",
    "JOB_MAGICIAN":         "Magician",
    "JOB_KNIGHT":           "Knight",
    "JOB_BLADE":            "Blade",
    "JOB_JESTER":           "Jester",
    "JOB_RANGER":           "Ranger",
    "JOB_RINGMASTER":       "Ringmaster",
    "JOB_BILLPOSTER":       "Billposter",
    "JOB_PSYCHIKEEPER":     "Psykeeper",
    "JOB_ELEMENTOR":        "Elementor",
    "JOB_KNIGHT_MASTER":    "Lord Templar",
    "JOB_BLADE_MASTER":     "Blade Master",
    "JOB_JESTER_MASTER":    "Windlurker",
    "JOB_RANGER_MASTER":    "Crack Shooter",
    "JOB_RINGMASTER_MASTER":"Florist",
    "JOB_BILLPOSTER_MASTER":"Force Master",
    "JOB_PSYCHIKEEPER_MASTER":"Mentalist",
    "JOB_ELEMENTOR_MASTER": "Elementor Lord",
    "JOB_KNIGHT_HERO":      "Lord Templar (Hero)",
    "JOB_BLADE_HERO":       "Blade (Hero)",
    "JOB_JESTER_HERO":      "Jester (Hero)",
    "JOB_RANGER_HERO":      "Ranger (Hero)",
    "JOB_RINGMASTER_HERO":  "Ringmaster (Hero)",
    "JOB_BILLPOSTER_HERO":  "Billposter (Hero)",
    "JOB_PSYCHIKEEPER_HERO":"Psykeeper (Hero)",
    "JOB_ELEMENTOR_HERO":   "Elementor (Hero)",
    "JOB_LORDTEMPLER_HERO": "Lord Templar (Hero)",
    "JOB_STORMBLADE_HERO":  "Stormblade",
    "JOB_WINDLURKER_HERO":  "Windlurker",
    "JOB_CRACKSHOOTER_HERO":"Crackshooter",
    "JOB_FLORIST_HERO":     "Florist",
    "JOB_FORCEMASTER_HERO": "Force Master",
    "JOB_MENTALIST_HERO":   "Mentalist",
    "JOB_ELEMENTORLORD_HERO":"Elementor Lord",
}

# Class tree (for job unlock logic in simulator)
JOB_TREE = {
    "JOB_VAGRANT":   {"tier": 0, "parent": None},
    "JOB_MERCENARY": {"tier": 1, "parent": "JOB_VAGRANT"},
    "JOB_ACROBAT":   {"tier": 1, "parent": "JOB_VAGRANT"},
    "JOB_ASSIST":    {"tier": 1, "parent": "JOB_VAGRANT"},
    "JOB_MAGICIAN":  {"tier": 1, "parent": "JOB_VAGRANT"},
    "JOB_KNIGHT":    {"tier": 2, "parent": "JOB_MERCENARY"},
    "JOB_BLADE":     {"tier": 2, "parent": "JOB_MERCENARY"},
    "JOB_JESTER":    {"tier": 2, "parent": "JOB_ACROBAT"},
    "JOB_RANGER":    {"tier": 2, "parent": "JOB_ACROBAT"},
    "JOB_RINGMASTER":{"tier": 2, "parent": "JOB_ASSIST"},
    "JOB_BILLPOSTER":{"tier": 2, "parent": "JOB_ASSIST"},
    "JOB_PSYCHIKEEPER":{"tier": 2, "parent": "JOB_MAGICIAN"},
    "JOB_ELEMENTOR": {"tier": 2, "parent": "JOB_MAGICIAN"},
    "JOB_KNIGHT_MASTER":    {"tier": 3, "parent": "JOB_KNIGHT"},
    "JOB_BLADE_MASTER":     {"tier": 3, "parent": "JOB_BLADE"},
    "JOB_JESTER_MASTER":    {"tier": 3, "parent": "JOB_JESTER"},
    "JOB_RANGER_MASTER":    {"tier": 3, "parent": "JOB_RANGER"},
    "JOB_RINGMASTER_MASTER":{"tier": 3, "parent": "JOB_RINGMASTER"},
    "JOB_BILLPOSTER_MASTER":{"tier": 3, "parent": "JOB_BILLPOSTER"},
    "JOB_PSYCHIKEEPER_MASTER":{"tier": 3, "parent": "JOB_PSYCHIKEEPER"},
    "JOB_ELEMENTOR_MASTER": {"tier": 3, "parent": "JOB_ELEMENTOR"},
    "JOB_LORDTEMPLER_HERO": {"tier": 4, "parent": "JOB_KNIGHT_MASTER"},
    "JOB_STORMBLADE_HERO":  {"tier": 4, "parent": "JOB_BLADE_MASTER"},
    "JOB_WINDLURKER_HERO":  {"tier": 4, "parent": "JOB_JESTER_MASTER"},
    "JOB_CRACKSHOOTER_HERO":{"tier": 4, "parent": "JOB_RANGER_MASTER"},
    "JOB_FLORIST_HERO":     {"tier": 4, "parent": "JOB_RINGMASTER_MASTER"},
    "JOB_FORCEMASTER_HERO": {"tier": 4, "parent": "JOB_BILLPOSTER_MASTER"},
    "JOB_MENTALIST_HERO":   {"tier": 4, "parent": "JOB_PSYCHIKEEPER_MASTER"},
    "JOB_ELEMENTORLORD_HERO":{"tier": 4, "parent": "JOB_ELEMENTOR_MASTER"},
}

# Base stats per level (Flyff classic formula)
# HP = baseHP + (level-1) * hpPerLevel * hpMultiplier
# BASE_STATS from Flyff wiki / known constants
BASE_HP_PER_LEVEL  = 28
BASE_MP_PER_LEVEL  = 12
BASE_FP_PER_LEVEL  = 12
BASE_HP_STA        = 5     # HP per STA point
BASE_MP_INT        = 6     # MP per INT point  
BASE_FP_DEX        = 4     # FP per DEX point


def parse_jobs():
    jobs = {}
    with open(JOB_FILE, encoding="euc-kr", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            cols = line.split("\t")
            if len(cols) < len(COLS) - 1:
                continue
            job_id = cols[0].strip()
            entry = {"id": job_id, "name": JOB_NAMES.get(job_id, job_id.replace("JOB_", "").title())}
            tree_info = JOB_TREE.get(job_id, {"tier": 0, "parent": None})
            entry["tier"]   = tree_info["tier"]
            entry["parent"] = tree_info["parent"]
            for i, col_name in enumerate(COLS[1:], start=1):
                if i < len(cols):
                    val = cols[i].strip()
                    try:
                        entry[col_name] = float(val) if "." in val else int(val)
                    except ValueError:
                        entry[col_name] = val
            jobs[job_id] = entry
    return jobs


DST_LABELS = {
    "DST_STR": "STR", "DST_STA": "STA", "DST_DEX": "DEX", "DST_INT": "INT",
    "DST_HP_MAX": "Max HP", "DST_MP_MAX": "Max MP", "DST_FP_MAX": "Max FP",
    "DST_HP_MAX_RATE": "Max HP%", "DST_MP_MAX_RATE": "Max MP%", "DST_FP_MAX_RATE": "Max FP%",
    "DST_ATKPOWER": "ATK", "DST_ATKPOWER_RATE": "ATK%",
    "DST_ADJDEF": "DEF", "DST_ADJDEF_RATE": "DEF%",
    "DST_SPEED": "Move Speed",
    "DST_CRITICAL_RATE": "Crit Rate",
    "DST_CRITICAL_BONUS": "Crit DMG",
    "DST_SPELL_RATE": "Magic ATK%",
    "DST_BLOCK_MELEE": "Melee Block",
    "DST_BLOCK_RANGE": "Range Block",
    "DST_IMMUNITY": "Immunity",
    "DST_REFLECT_DAMAGE": "Reflect DMG",
    "DST_SUCK_HP": "Suck HP",
    "DST_SUCK_MP": "Suck MP",
    "DST_EXPERIENCE": "EXP",
    "DST_PVP_DMG": "PvP DMG",
    "DST_PVP_DMG_RATE": "PvP DMG%",
    "DST_MONSTER_DMG": "Mob DMG%",
}


def parse_skills(jobs: dict):
    # Load skill text names
    skill_names = {}
    try:
        enc = "utf-8"
        with open(SKILL_TXT_FILE, encoding=enc, errors="replace") as f:
            for line in f:
                parts = line.strip().split("\t", 1)
                if len(parts) == 2 and parts[1].strip() and parts[1].strip() != parts[0].strip():
                    skill_names[parts[0].strip()] = parts[1].strip()
    except Exception:
        pass

    skills = {}

    with open(SKILL_FILE, encoding="euc-kr", errors="replace") as f:
        lines = f.readlines()

    # Header comment: dwID,dwName,dwSkillLvl,dwAbilityMin,dwAtkAbilityMax,
    # dwAbilityMinPVP,dwAbilityMaxPVP, dwAttackSpeed, dwDmgShift, nProbability,
    # nProbabilityPVP, dwTaunt, dwDestParam1, dwDestParam2, nAdjParamVal1,
    # nAdjParamVal2, nAdjParamVal3(inc), nAdjParamVal4(inc), ref1, ref2, ref3,
    # dwActiveMagic, nActiveMagicProbability, nActiveMagicProbabilityPVP,
    # dwNeedMP, dwNeedFP, dwCoolTime, dwSkillReadyTime, dwSkillRange, dwKeepTime,
    # dwDmgTime, dwDestParam3, dwDestParam4, nAdjParamVal5, nAdjParamVal6, nAdjParamVal7(?)

    for line in lines[2:]:
        if line.startswith("//"):
            continue
        cols = line.strip().split(",")
        if len(cols) < 10:
            continue

        sa_id    = cols[0].strip()
        si_id    = cols[1].strip()
        if not si_id.startswith("SI_"):
            continue

        def g(i, default="="):
            return cols[i].strip() if i < len(cols) else default

        def num(i, default=0):
            v = g(i, "=")
            if v in ("=", ""):
                return default
            try:
                return float(v) if "." in v else int(v)
            except:
                return default

        skill_lvl  = num(2)
        atk_min    = num(3)
        atk_max    = num(4)
        atk_spd    = num(7)
        dst1       = g(12, "")
        dst2       = g(13, "")
        adj1       = num(14)
        adj2       = num(15)
        adj3_inc   = num(16)  # per level increase
        adj4_inc   = num(17)
        need_mp    = num(24)
        need_fp    = num(25)
        cooldown   = num(26, 0)  # ms
        skill_range= num(28, 0)
        keep_time  = num(29, 0)  # ms

        effects = []
        for dst, val, inc in [(dst1, adj1, adj3_inc), (dst2, adj2, adj4_inc)]:
            if dst and dst not in ("=", ""):
                label = DST_LABELS.get(dst, dst.replace("DST_", "").replace("_", " ").title())
                is_rate = "_RATE" in dst or "_BONUS" in dst
                effects.append({
                    "stat": label, "value": val,
                    "valuePerLevel": inc,
                    "unit": "%" if is_rate else "",
                })

        if si_id not in skills:
            name_key = f"IDS_SKILL_{si_id.replace('SI_', '')}"
            skills[si_id] = {
                "id": si_id,
                "name": skill_names.get(name_key, si_id.replace("SI_", "").replace("_", " ").title()),
                "maxLevel": 0,
                "levels": [],
            }

        skills[si_id]["maxLevel"] = max(skills[si_id]["maxLevel"], int(skill_lvl))
        skills[si_id]["levels"].append({
            "level":     int(skill_lvl),
            "atkMin":    atk_min,
            "atkMax":    atk_max,
            "attackSpeed": atk_spd,
            "needMP":    need_mp,
            "needFP":    need_fp,
            "cooldown":  cooldown // 1000 if cooldown > 100 else cooldown,
            "range":     skill_range,
            "keepTime":  keep_time // 1000 if keep_time > 100 else keep_time,
            "effects":   effects,
        })

    # Assign skills to jobs based on SI_ naming patterns
    job_skill_map = {
        "JOB_VAGRANT":          ["VAG"],
        "JOB_MERCENARY":        ["MER"],
        "JOB_ACROBAT":          ["ACR"],
        "JOB_ASSIST":           ["ASS"],
        "JOB_MAGICIAN":         ["MAG"],
        "JOB_KNIGHT":           ["KNIGHT", "KNI"],
        "JOB_BLADE":            ["BLADE", "BLA"],
        "JOB_JESTER":           ["JESTER", "JES"],
        "JOB_RANGER":           ["RANGER", "RAN"],
        "JOB_RINGMASTER":       ["RING", "RIN"],
        "JOB_BILLPOSTER":       ["BILL", "BIL"],
        "JOB_PSYCHIKEEPER":     ["PSYCH", "PSY"],
        "JOB_ELEMENTOR":        ["ELEMENT", "ELE"],
        "JOB_KNIGHT_MASTER":    ["KNIGHT", "KNI"],
        "JOB_BLADE_MASTER":     ["BLADE", "BLA"],
        "JOB_JESTER_MASTER":    ["JESTER", "JES"],
        "JOB_RANGER_MASTER":    ["RANGER", "RAN"],
        "JOB_RINGMASTER_MASTER":["RING", "RIN"],
        "JOB_BILLPOSTER_MASTER":["BILL", "BIL"],
        "JOB_PSYCHIKEEPER_MASTER":["PSYCH", "PSY"],
        "JOB_ELEMENTOR_MASTER": ["ELEMENT", "ELE"],
        "JOB_LORDTEMPLER_HERO": ["KNIGHT", "KNI", "LORD"],
        "JOB_STORMBLADE_HERO":  ["BLADE", "BLA", "STORM"],
        "JOB_WINDLURKER_HERO":  ["JESTER", "JES", "WIND"],
        "JOB_CRACKSHOOTER_HERO":["RANGER", "RAN", "CRACK"],
        "JOB_FLORIST_HERO":     ["RING", "RIN", "FLOR"],
        "JOB_FORCEMASTER_HERO": ["BILL", "BIL", "FORCE"],
        "JOB_MENTALIST_HERO":   ["PSYCH", "PSY", "MENTAL"],
        "JOB_ELEMENTORLORD_HERO":["ELEMENT", "ELE"],
    }

    for job_id, job in jobs.items():
        patterns = job_skill_map.get(job_id, [])
        job_skills = []
        for si_id in skills:
            body = si_id.replace("SI_", "").upper()
            for pat in patterns:
                if pat in body:
                    job_skills.append(si_id)
                    break
        job["skills"] = sorted(set(job_skills))

    return skills


def main():
    print("Parsing jobs from propJob.inc...")
    jobs = parse_jobs()
    print(f"  {len(jobs)} jobs parsed")

    print("Parsing skills from propSkillAdd.csv...")
    skills = parse_skills(jobs)
    print(f"  {len(skills)} skills parsed")

    # Save jobs.json
    jobs_out = OUT_DIR / "jobs.json"
    with open(jobs_out, "w", encoding="utf-8") as f:
        json.dump({"jobs": list(jobs.values())}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  jobs.json → {jobs_out}  ({jobs_out.stat().st_size//1024} KB)")

    # Save skills.json
    skills_out = OUT_DIR / "skills.json"
    with open(skills_out, "w", encoding="utf-8") as f:
        json.dump({"skills": list(skills.values())}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  skills.json → {skills_out}  ({skills_out.stat().st_size//1024} KB)")

    # Print sample
    blade = jobs.get("JOB_BLADE")
    if blade:
        print(f"\nBlade: maxLvl={blade['maxLevel']}, HP×{blade['hpMultiplier']}, swordFactor={blade['swordFactor']}")
        print(f"  Skills: {blade['skills'][:5]}...")


if __name__ == "__main__":
    main()
