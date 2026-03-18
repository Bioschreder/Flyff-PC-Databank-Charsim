#!/usr/bin/env python3
"""
Flyff Database Parser
Converts raw Flyff game data files into JSON for the web app.
"""

import re
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
DB_DIR = BASE_DIR / "Datenbank"
OUTPUT_DIR = BASE_DIR / "flyff-app" / "public" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SPEC_ITEM      = DB_DIR / "datasub2" / "Spec_Item.txt"
PROP_ITEM_TEXT = DB_DIR / "datasub2" / "propItem.txt.txt"
PROP_ITEM_ETC  = DB_DIR / "Datares" / "propItemEtc.inc"
PROP_ITEM_ETC_TXT = DB_DIR / "Datares" / "propItemEtc.txt.txt"

# ── Column indices (0-based) confirmed from Spec_Item.txt header ──────────────
COL_ID          = 1
COL_NAME_IDS    = 2
COL_IK1         = 5
COL_IK2         = 6
COL_IK3         = 7
COL_JOB         = 8
COL_COST        = 12
COL_HANDED      = 16
COL_PARTS       = 18
COL_ITEMSET_IDX = 22   # set group index (non-zero for set items)
COL_LEVEL       = 23
COL_ABILITY_MIN = 30   # ATK min (weapons) / DEF min (armor)
COL_ABILITY_MAX = 31   # ATK max (weapons) / DEF max (armor)
# DST stat key columns
COL_DST1 = 53; COL_DST2 = 54; COL_DST3 = 55
COL_DST4 = 56; COL_DST5 = 57; COL_DST6 = 58
# DST stat value columns
COL_ADJ1 = 59; COL_ADJ2 = 60; COL_ADJ3 = 61
COL_ADJ4 = 62; COL_ADJ5 = 63; COL_ADJ6 = 64
COL_WEAPON_KIND  = 103  # WEAPON_GENERAL / ARMOR_SET / BARUNA_x etc.
COL_ICON         = 132
COL_ITEM_GRADE   = 163
COL_BIND_ON_EQUIP  = 144  # 1 = binds when equipped
COL_SOULBOUND      = 145  # 0 = not bound, 1 = always bound, 2 = bound (unbindable)
COL_EFFECT_TYPE    = 93   # XI_SYS_EXPAN01 etc. for consumables
COL_DURATION_SEC   = 97   # duration in seconds (scrolls)
COL_DURATION_MS    = 98   # duration in milliseconds (food/keep items)

# ── Lookup tables ─────────────────────────────────────────────────────────────

# IK1 → visible category; internal-only categories map to None and are filtered out
IK1_MAP = {
    'IK1_WEAPON':   'Weapon',
    'IK1_ARMOR':    'Armor',
    'IK1_GENERAL':  'General',
    'IK1_RIDE':     'Mount',
    'IK1_EFFECT':   'Consumable',
    'IK1_CHARGED':  'Consumable',
    # internal / system categories → hidden from UI
    'IK1_NONE':     None,
    'IK1_SYSTEM':   None,
    'IK1_HOUSING':  None,
    'IK1_ACTIVE':   None,
    'IK1_PASSIVE':  None,
    'IK1_ACTIVEUI': None,
    'IK1_GOLD':     None,
}

# IK2 → visible subcategory; None = inherit parent category name or hide
IK2_MAP = {
    # Weapons
    'IK2_WEAPON_DIRECT': 'Melee',
    'IK2_WEAPON_MAGIC':  'Magic Weapon',
    'IK2_WEAPON_HAND':   'Knuckle',
    # Armor
    'IK2_ARMOR':         'Armor',
    'IK2_ARMORETC':      'Armor Set',
    'IK2_CLOTH':         'Costume',
    'IK2_CLOTHETC':      'Costume Accessory',
    # Accessories
    'IK2_JEWELRY':       'Jewelry',
    # Consumables
    'IK2_REFRESHER':     'Refresher',
    'IK2_POTION':        'Potion',
    'IK2_FOOD':          'Food',
    'IK2_BUFF':          'Buff Scroll',
    'IK2_BUFF2':         'Buff Scroll',
    'IK2_KEEP':          'Buff Scroll',
    'IK2_ONCE':          'Scroll',
    'IK2_MAGIC':         'Magic Item',
    # General
    'IK2_GEM':           'Gem',
    'IK2_MATERIAL':      'Material',
    'IK2_TOOLS':         'Tools',
    'IK2_CHARM':         'Charm',
    'IK2_BULLET':        'Bullet',
    'IK2_SKILL':         'Skill Item',
    'IK2_WARP':          'Warp Scroll',
    # Mount
    'IK2_RIDING':        'Mount',
    'IK2_AIRFUEL':       'Air Fuel',
    'IK2_BLINKWING':     'Blink Wing',
    # Misc internal – collapse to None (item uses parent category)
    'IK2_SYSTEM':        None,
    'IK2_GENERAL':       None,
    'IK2_MOB':           None,
    'IK2_BARUNA':        None,
    'IK2_TWOWEAPONMERGE': None,
    'IK2_TREASURE':      None,
    'IK2_COUNT':         None,
    'IK2_TOCASH':        None,
    'IK2_BUFF_TOGIFT':   'Buff Scroll',
    'IK2_ELLDINPOTION':  'Potion',
    'IK2_LEVELDOWNSCROLL': 'Scroll',
    'IK2_RANDOMOPTION':  'Scroll',
    'IK2_GUILDHOUES_COMEBACK': None,
    'IK2_GUILDHOUSE_FURNITURE': None,
    'IK2_GUILDHOUSE_NPC': None,
    'IK2_GUILDHOUSE_PAPERING': None,
    'IK2_FURNITURE':     None,
    'IK2_PAPERING':      None,
    'IK2_GMTEXT':        None,
    'IK2_TEXT':          None,
    'IK2_TELEPORTMAP':   None,
    'IK2_SKILL':         'Skill Item',
}

IK3_MAP = {
    'IK3_SWD': 'Sword', 'IK3_AXE': 'Axe', 'IK3_KNUCKLE': 'Knuckle',
    'IK3_WAND': 'Wand', 'IK3_STAFF': 'Staff', 'IK3_BOW': 'Bow',
    'IK3_YOYO': 'Yo-Yo', 'IK3_TWOHANDAXE': 'Two-Hand Axe',
    'IK3_TWOHANDSWORD': 'Two-Hand Sword', 'IK3_CROSSBOW': 'Crossbow',
    'IK3_SHIELD': 'Shield', 'IK3_CHEERSTICK': 'Stick',
    'IK3_HEAD': 'Helmet', 'IK3_SUIT': 'Suit', 'IK3_GLOVE': 'Gloves',
    'IK3_BOOTS': 'Boots', 'IK3_CLOAK': 'Cloak',
    'IK3_RING': 'Ring', 'IK3_NECKLACE': 'Necklace',
    'IK3_EARRING': 'Earring', 'IK3_MASKHELM': 'Mask',
    'IK3_HAT': 'CS Helmet', 'IK3_CLOTH': 'CS Suit',
    'IK3_CANNONBALL': 'Cannonball', 'IK3_ARROW': 'Arrow',
    'IK3_TALISMAN': 'Talisman',
    'IK3_FORCEGEM': 'Forcegem', 'IK3_SPELL': 'Spellbook',
}

# Job names and canonical sort order (index = sort position)
JOB_ORDER = [
    'Vagrant',
    'Mercenary', 'Assist', 'Acrobat', 'Magician',
    'Knight', 'Blade', 'Ringmaster', 'Billposter',
    'Jester', 'Ranger', 'Psykeeper', 'Elementor',
    'Knight (Master)', 'Blade (Master)', 'Ringmaster (Master)', 'Billposter (Master)',
    'Jester (Master)', 'Ranger (Master)', 'Psykeeper (Master)', 'Elementor (Master)',
    'Knight (Hero)', 'Blade (Hero)', 'Ringmaster (Hero)', 'Billposter (Hero)',
    'Jester (Hero)', 'Ranger (Hero)', 'Psykeeper (Hero)', 'Elementor (Hero)',
    'Templar', 'Slayer', 'Seraph', 'Force Master',
    'Harlequin', 'Crackshooter', 'Mentalist', 'Arcanist',
    'Lord Templar', 'Lumina Slayer', 'Windrunner',
]

JOB_MAP = {
    'JOB_VAGRANT':    'Vagrant',
    'JOB_MERCENARY':  'Mercenary',
    'JOB_ACROBAT':    'Acrobat',
    'JOB_ASSIST':     'Assist',
    'JOB_MAGICIAN':   'Magician',
    'JOB_KNIGHT':     'Knight',
    'JOB_BLADE':      'Blade',
    'JOB_JESTER':     'Jester',
    'JOB_RANGER':     'Ranger',
    'JOB_RINGMASTER': 'Ringmaster',
    'JOB_BILLPOSTER': 'Billposter',
    'JOB_PSYKEEPER':  'Psykeeper',
    'JOB_PSYCHIKEEPER': 'Psykeeper',
    'JOB_ELEMENTOR':  'Elementor',
    # Master tier
    'JOB_KNIGHT_MASTER':     'Knight (Master)',
    'JOB_BLADE_MASTER':      'Blade (Master)',
    'JOB_RINGMASTER_MASTER': 'Ringmaster (Master)',
    'JOB_BILLPOSTER_MASTER': 'Billposter (Master)',
    'JOB_JESTER_MASTER':     'Jester (Master)',
    'JOB_RANGER_MASTER':     'Ranger (Master)',
    'JOB_PSYCHIKEEPER_MASTER': 'Psykeeper (Master)',
    'JOB_ELEMENTOR_MASTER':  'Elementor (Master)',
    # Hero tier (60–130)
    'JOB_KNIGHT_HERO':       'Knight (Hero)',
    'JOB_BLADE_HERO':        'Blade (Hero)',
    'JOB_RINGMASTER_HERO':   'Ringmaster (Hero)',
    'JOB_BILLPOSTER_HERO':   'Billposter (Hero)',
    'JOB_JESTER_HERO':       'Jester (Hero)',
    'JOB_RANGER_HERO':       'Ranger (Hero)',
    'JOB_PSYCHIKEEPER_HERO': 'Psykeeper (Hero)',
    'JOB_CRACKSHOOTER_HERO': 'Crackshooter',
    'JOB_ELEMENTORLORD_HERO':'Elementor (Hero)',
    'JOB_ELEMENTOR_HERO':    'Elementor (Hero)',
    'JOB_FLORIST_HERO':      'Seraph',
    'JOB_FORCEMASTER_HERO':  'Force Master',
    'JOB_WINDLURKER_HERO':   'Crackshooter',
    'JOB_STORMBLADE_HERO':   'Slayer',
    # Advanced Hero classes (130+)
    'JOB_HERO':         'Hero',
    'JOB_SLAYER':       'Slayer',
    'JOB_TEMPLAR':      'Templar',
    'JOB_HARLEQUIN':    'Harlequin',
    'JOB_WINDRUNNER':   'Windrunner',
    'JOB_SERAPH':       'Seraph',
    'JOB_FORCEMASTER':  'Force Master',
    'JOB_ARCANIST':     'Arcanist',
    'JOB_CRACKSHOOTER': 'Crackshooter',
    'JOB_MENTALIST':    'Mentalist',
    'JOB_LORDTEMPLER':  'Lord Templar',
    'JOB_LUMINASLAYER': 'Lumina Slayer',
}

GRADE_MAP = {
    'ITEM_GRADE_NORMAL':   'Normal',
    'ITEM_GRADE_RARE':     'Rare',
    'ITEM_GRADE_UNIQUE':   'Unique',
    'ITEM_GRADE_ULTIMATE': 'Ultimate',
    'ITEM_GRADE_BARUNA':   'Baruna',
}

GRADE_ORDER = ['Normal', 'Rare', 'Unique', 'Ultimate', 'Baruna']

PARTS_MAP = {
    'PARTS_RWEAPON': 'Right Hand', 'PARTS_LWEAPON': 'Left Hand',
    'PARTS_HELMET': 'Head', 'PARTS_UPPER_BODY': 'Body',
    'PARTS_LOWER_BODY': 'Legs', 'PARTS_HAND': 'Hands',
    'PARTS_FOOT': 'Feet', 'PARTS_RSHIELD': 'Shield',
    'PARTS_CLOAK': 'Cloak', 'PARTS_NECKLACE': 'Necklace',
    'PARTS_RING': 'Ring', 'PARTS_EAR': 'Earring', 'PARTS_MASK': 'Mask',
}

# DST stat labels for powerup auto-parsing
DST_POWERUP_LABELS = {
    'DST_SPEED': ('Move Speed', ''),
    'DST_JUMPING': ('Jump Power', ''),
    'DST_STR': ('STR', ''),
    'DST_INT': ('INT', ''),
    'DST_DEX': ('DEX', ''),
    'DST_STA': ('STA', ''),
    'DST_HP_MAX': ('Max HP', ''),
    'DST_MP_MAX': ('Max MP', ''),
    'DST_FP_MAX': ('Max FP', ''),
    'DST_HP_MAX_RATE': ('Max HP', '%'),
    'DST_MP_MAX_RATE': ('Max MP', '%'),
    'DST_FP_MAX_RATE': ('Max FP', '%'),
    'DST_ATKPOWER': ('ATK', ''),
    'DST_ATKPOWER_RATE': ('ATK', '%'),
    'DST_ADJDEF': ('DEF', ''),
    'DST_ADJDEF_RATE': ('DEF', '%'),
    'DST_CRITICAL_BONUS': ('Crit DMG', '%'),
    'DST_CRITICAL_RATE': ('Crit Rate', '%'),
    'DST_EXPERIENCE': ('EXP', '%'),
    'DST_PVP_DMG': ('PvP DMG', '%'),
    'DST_RES_FIRE_RATE': ('Fire RES', '%'),
    'DST_RES_WATER_RATE': ('Water RES', '%'),
    'DST_RES_WIND_RATE': ('Wind RES', '%'),
    'DST_RES_ELEC_RATE': ('Elec RES', '%'),
    'DST_RES_EARTH_RATE': ('Earth RES', '%'),
    'DST_GIVE_PVE_DMG_ELEMENT_WIND_RATE': ('Wind DMG', '%'),
}

# Prefix-based effects: items whose IDs start with a prefix share the same effects
POWERUP_EFFECTS_PREFIX = [
    ('II_CHR_SYS_SCR_UPCUTSTONE',     [{'stat': 'ATK', 'value': 20, 'unit': '%'}]),
    ('II_SYS_SYS_SCR_DEUPCUT',        [{'stat': 'ATK', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_FIREASTONE',     [{'stat': 'Fire ATK', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_WATEILSTONE',    [{'stat': 'Water ATK', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_WINDYOSTONE',    [{'stat': 'Wind ATK', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_LIGHTINESTONE',  [{'stat': 'Elec ATK', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_EARTHYSTONE',    [{'stat': 'Earth ATK', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_DEFIREASTONE',   [{'stat': 'Fire RES', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_DEWATEILSTONE',  [{'stat': 'Water RES', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_DEWINDYOSTONE',  [{'stat': 'Wind RES', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_DELIGHTINESTONE',[{'stat': 'Elec RES', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_DEEARTHYSTONE',  [{'stat': 'Earth RES', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_SHOUTFULL15',    [{'stat': 'Shout Full', 'value': 15, 'unit': ' Tage'}]),
    ('II_CHR_SYS_SCR_SHOUTFULL30',    [{'stat': 'Shout Full', 'value': 30, 'unit': ' Tage'}]),
    ('II_CHR_SYS_SCR_PSKILLFULL15',   [{'stat': 'Passive Skills Full', 'value': 15, 'unit': ' Tage'}]),
    ('II_CHR_SYS_SCR_PSKILLFULL30',   [{'stat': 'Passive Skills Full', 'value': 30, 'unit': ' Tage'}]),
    ('II_CHR_REF_REF_HOLD',           [{'stat': 'HP/MP/FP', 'value': 100, 'unit': '% Regeneration'}]),
    ('II_CHR_POT_DRI_VITALX',         [{'stat': 'FP', 'value': 100, 'unit': '% Regeneration'}]),
    ('II_CHR_SYS_SCR_COMMBANK',       [{'stat': 'Gemeinsame Bank', 'value': 0, 'unit': ' (Zugang)'}]),
    ('II_CHR_SYS_SCR_ACTIVITION',     [{'stat': 'Aktivierungsscroll', 'value': 0, 'unit': ''}]),
    ('II_SYS_SYS_SCR_BLESSING',       [{'stat': 'Segen', 'value': 0, 'unit': ''}]),
    ('II_SYS_SYS_SCR_BXMPSKILLFULL',  [{'stat': 'Passive Skills Full', 'value': 1, 'unit': ' Tag'}]),
    ('II_SYS_SYS_SCR_BXMSHOUTFULL',   [{'stat': 'Shout Full', 'value': 1, 'unit': ' Tag'}]),
    ('II_SYS_SYS_SCR_BXPARSKILLFULL', [{'stat': 'Passive Skills Full', 'value': 1, 'unit': ' Tag'}]),
    ('II_SYS_SYS_SCR_BXSHOUTFULL',    [{'stat': 'Shout Full', 'value': 1, 'unit': ' Tag'}]),
    ('II_CHR_SYS_SCR_APRIL_FOOL_UPCUTSTONE_2015_01', [{'stat': 'ATK', 'value': 20, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_APRIL_FOOL_UPCUTSTONE_2015_02', [{'stat': 'ATK', 'value': 30, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_APRIL_FOOL_UPCUTSTONE_2015_03', [{'stat': 'ATK', 'value': 40, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_APRIL_FOOL_UPCUTSTONE_2015_04', [{'stat': 'ATK', 'value': 50, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_APRIL_FOOL_UPCUTSTONE_2015_05', [{'stat': 'ATK', 'value': 60, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_APRIL_FOOL_UPCUTSTONE_2015_06', [{'stat': 'ATK', 'value': 70, 'unit': '%'}]),
    ('II_CHR_SYS_SCR_APRIL_FOOL_UPCUTSTONE_2015_07', [{'stat': 'ATK', 'value': 80, 'unit': '%'}]),
]

def get_powerup_effects(item_id, dst_cols):
    """Return known effects list for a powerup item.
    First tries prefix map, then falls back to DST columns in the spec file."""
    # Exact / prefix match in priority order
    for prefix, effects in POWERUP_EFFECTS_PREFIX:
        if item_id == prefix or item_id.startswith(prefix + '_') or item_id.startswith(prefix):
            # Exact prefix match (avoids UPCUTSTONE matching UPCUTSTONE01 via startswith)
            if item_id == prefix or item_id[len(prefix):1+len(prefix)] in ('_', ''):
                return effects
    # Auto-parse DST columns for items with known DST entries
    auto = []
    for dst, val_str in dst_cols:
        try:
            val = int(val_str)
        except:
            continue
        label, unit = DST_POWERUP_LABELS.get(dst, (dst.replace('DST_', '').replace('_', ' ').title(), ''))
        auto.append({'stat': label, 'value': val, 'unit': unit})
    return auto

EFFECT_TYPE_LABELS = {
    'XI_SYS_EXPAN01':  'Buff Scroll',
    'XI_CHR_CURE01':   'Food / Buff',
    'XI_GEN_CURE01':   'Food / Buff',
    'XI_CHR_REF01':    'Refresher',
    'XI_SYS_REMOVE01': 'Remove Effect',
    'XI_SYS_RELEASE01': 'Account Bank',
    'XI_SYS_EXCHAN01': 'Exchange',
}

STAT_LABELS = {
    'DST_STR': 'STR', 'DST_INT': 'INT', 'DST_DEX': 'DEX', 'DST_STA': 'STA',
    'DST_HP': 'Max HP', 'DST_HP_MAX': 'Max HP', 'DST_MP': 'Max MP',
    'DST_FP': 'Max FP', 'DST_HP_MAX_RATE': 'Max HP %',
    'DST_ATKPOWER': 'ATK Power', 'DST_ADJDEF': 'DEF',
    'DST_ATKSPEED': 'ATK Speed', 'DST_MOVING_SPEED': 'Move Speed',
    'DST_CRITICAL_BONUS': 'Critical Bonus', 'DST_CRITICAL_RATE': 'Critical Rate',
    'DST_HPDAMAGE_RATE': 'HP Damage', 'DST_MELEE_ATK': 'Melee ATK',
    'DST_MAGIC_ATK': 'Magic ATK', 'DST_MELEE_BLOCK': 'Block Rate',
    'DST_MAGIC_BLOCK': 'Magic Block', 'DST_PARRY': 'Parry',
    'DST_REFLECT_DAMAGE': 'Reflect DMG', 'DST_ADJ_HITRATE': 'Hit Rate',
    'DST_RES_WIND': 'Wind RES', 'DST_RES_FIRE': 'Fire RES',
    'DST_RES_WATER': 'Water RES', 'DST_RES_ELECTRICITY': 'Elec RES',
    'DST_RES_EARTH': 'Earth RES', 'DST_RESIST_MAGIC': 'Magic RES',
    'DST_ADDEXP': 'EXP Bonus', 'DST_ADDPENYA': 'Penya Bonus',
}


def load_text_ids(filepath):
    """Load IDS_* → text mapping. Returns (names, all_entries) dicts.
    all_entries contains every non-empty IDS entry; names is the same dict.
    Description for an item with nameId X is found at entry X+1."""
    entries = {}
    with open(filepath, 'r', encoding='cp1252', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('//'):
                continue
            parts = line.split('\t', 1)
            if len(parts) == 2:
                key = parts[0].strip()
                val = parts[1].strip()
                # Skip placeholder values (key used as its own value)
                if val and val != key:
                    entries[key] = val
    return entries, entries  # both point to same dict; desc looked up via nameId+1


def load_set_names(filepath) -> dict:
    """Load IDS_PROPITEMETC_INC_* → set name mapping from propItemEtc.txt.txt."""
    result = {}
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('//'):
                    continue
                parts = line.split('\t', 1)
                if len(parts) == 2 and parts[0].startswith('IDS_'):
                    val = parts[1].strip()
                    if val and val != parts[0]:
                        result[parts[0]] = val
    except Exception:
        pass
    return result


def to_int(val, default=0):
    try:
        return int(val)
    except:
        return default


def parse_items(spec_file, text_ids, descriptions):
    items = []

    with open(spec_file, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    default_row = None

    for line in lines:
        line = line.rstrip('\n\r')
        if not line.strip() or line.strip().startswith('//'):
            continue

        cols = line.split('\t')
        if len(cols) < 10:
            continue

        item_id = cols[COL_ID].strip() if len(cols) > COL_ID else ''
        if not item_id or item_id.startswith('//'):
            continue

        if item_id == 'II_DEFAULT':
            default_row = cols
            continue

        if not item_id.startswith('II_'):
            continue

        def get(idx, default=''):
            if idx >= len(cols):
                return default
            v = cols[idx].strip()
            if v == '=' and default_row and idx < len(default_row):
                v = default_row[idx].strip()
            return v if v != '=' else default

        name_ids = get(COL_NAME_IDS)
        display_name = text_ids.get(name_ids, '')
        if not display_name:
            # Fallback: humanize the item ID (e.g. II_ARM_F_ELF_BOOTS → Elf Boots)
            raw = item_id.replace('II_', '').replace('_', ' ').title()
            display_name = raw if raw else item_id
        # Description uses the odd IDS entry (name_num + 1)
        try:
            name_num = int(name_ids.split('_')[-1])
            desc_key = name_ids.rsplit('_', 1)[0] + '_' + str(name_num + 1).zfill(6)
            description = descriptions.get(desc_key, '')
        except (ValueError, IndexError):
            description = ''

        ik1_raw = get(COL_IK1, 'IK1_SYSTEM')
        ik2_raw = get(COL_IK2)
        ik3_raw = get(COL_IK3)
        is_weapon = ik1_raw == 'IK1_WEAPON'
        is_armor  = ik1_raw == 'IK1_ARMOR'
        handed    = get(COL_HANDED)
        is_twohanded = (
            handed == 'HD_TWO' or
            ik3_raw in ('IK3_BOW', 'IK3_STAFF', 'IK3_TWOHANDAXE', 'IK3_TWOHANDSWORD', 'IK3_CHEERSTICK', 'IK3_CROSSBOW')
        )

        ability_min = to_int(get(COL_ABILITY_MIN))
        ability_max = to_int(get(COL_ABILITY_MAX))

        # Resolve category; skip internal/system items (IK1_MAP returns None)
        category = IK1_MAP.get(ik1_raw)
        if category is None:
            continue  # hide from UI

        # Resolve subcategory; None → fall back to category name
        sub_raw = IK2_MAP.get(ik2_raw)
        subcategory = sub_raw if sub_raw is not None else category

        item = {
            'id': item_id,
            'name': display_name,
            'nameId': name_ids,
            'level': to_int(get(COL_LEVEL)),
            'category': category,
            'subcategory': subcategory,
            'type': IK3_MAP.get(ik3_raw, ik3_raw),
            'job': JOB_MAP.get(get(COL_JOB)) or None,
            'grade': GRADE_MAP.get(get(COL_ITEM_GRADE, 'ITEM_GRADE_NORMAL'), 'Normal'),
            'slot': PARTS_MAP.get(get(COL_PARTS), get(COL_PARTS)),
            'cost': to_int(get(COL_COST)),
            'twoHanded': is_twohanded,
            # Weapons: abilityMin/Max = ATK. Armor: = DEF.
            'atkMin': ability_min if is_weapon else 0,
            'atkMax': ability_max if is_weapon else 0,
            'defMin': ability_min if is_armor else 0,
            'defMax': ability_max if is_armor else 0,
            'icon': get(COL_ICON).strip('"'),
            'isSet': get(COL_WEAPON_KIND) in ('ARMOR_SET', 'BARUNA_D'),
            'description': description,
        }

        # Soulbound status (col 145: 0=free, 1=bound, 2=permanently bound)
        soulbound_val = get(COL_SOULBOUND)
        if soulbound_val == '1':
            item['soulbound'] = 'always'
        elif soulbound_val == '2':
            item['soulbound'] = 'permanent'
        else:
            item['soulbound'] = None

        # Powerup / buff info for consumables with a timed effect
        effect_type = get(COL_EFFECT_TYPE)
        # col 97 = seconds (scrolls), col 98 = milliseconds (food/keep)
        duration_sec = to_int(get(COL_DURATION_SEC))
        if duration_sec == 0:
            duration_sec = to_int(get(COL_DURATION_MS)) // 1000
        if effect_type and effect_type not in ('', '0') and duration_sec > 60:
            # Collect DST columns for auto-effect detection
            dst_cols = []
            for dst_col, adj_col in [
                (COL_DST1, COL_ADJ1), (COL_DST2, COL_ADJ2),
                (COL_DST3, COL_ADJ3), (COL_DST4, COL_ADJ4),
                (COL_DST5, COL_ADJ5), (COL_DST6, COL_ADJ6),
            ]:
                dst = get(dst_col)
                adj = get(adj_col)
                if dst and dst not in ('_NONE', '0', ''):
                    dst_cols.append((dst, adj))
            item['powerup'] = {
                'effectType': EFFECT_TYPE_LABELS.get(effect_type, effect_type),
                'durationSec': duration_sec,
                'effects': get_powerup_effects(item_id, dst_cols),
            }
        else:
            item['powerup'] = None

        # Set group key (e.g. "MER_SET_01" from "II_ARM_F_MER_BOOTS_SET_01")
        set_match = re.search(r'_((?:[A-Z]+_)*SET_\d+)$', item_id)
        item['setGroup'] = set_match.group(1) if set_match else ''

        # Bonus stats from DST/ADJ columns
        stats = {}
        for dst_col, adj_col in [
            (COL_DST1, COL_ADJ1), (COL_DST2, COL_ADJ2),
            (COL_DST3, COL_ADJ3), (COL_DST4, COL_ADJ4),
            (COL_DST5, COL_ADJ5), (COL_DST6, COL_ADJ6),
        ]:
            dst = get(dst_col)
            adj = get(adj_col)
            if dst and dst not in ('_NONE', '0', '') and adj:
                val = to_int(adj)
                if val != 0:
                    label = STAT_LABELS.get(dst, dst.replace('DST_', '').replace('_', ' ').title())
                    stats[label] = val

        item['stats'] = stats
        items.append(item)

    print(f"Parsed {len(items)} items")
    return items


SET_SLOTS = re.compile(
    r'_(BOOTS|HELM|HELMET|SUIT|GLOVE|GLOVES|CLOAK|GAUNTLET)(?=_|$)',
    re.IGNORECASE
)

def derive_set_family(item_id: str) -> str:
    """Derive the logical set family from an item ID.
    II_ARM_F_MER_BOOTS_SET_01 -> MER_SET_01
    II_ARM_M_KIN_HELM_SET_33  -> KIN_SET_33
    """
    m = re.match(r'II_ARM_[FM]_(.+)', item_id)
    if not m:
        return ''
    rest = SET_SLOTS.sub('', m.group(1))
    return rest


def load_set_member_ids() -> dict:
    """Parse propItemEtc.inc and return {item_id: family_key} for every set member.
    The family_key is derived from the canonical member IDs so M/F variants share one key."""
    try:
        with open(PROP_ITEM_ETC, encoding='utf-16-le', errors='replace') as f:
            content = f.read()
    except Exception:
        return {}

    # First pass: collect all set blocks as {set_number: [item_ids]}
    set_blocks = []
    in_set = False
    in_elem = False
    depth = 0
    current_members = []

    for line in content.splitlines():
        stripped = line.strip()
        if not in_set:
            if stripped.startswith('SetItem') or stripped.startswith('세트아이템'):
                in_set = True
                in_elem = False
                depth = 0
                current_members = []
            continue
        if stripped.startswith('{'):
            depth += 1
        elif stripped.startswith('}'):
            depth -= 1
            if depth == 0:
                in_set = False
                in_elem = False
                if current_members:
                    set_blocks.append(list(current_members))
            elif depth == 1:
                in_elem = False
        elif stripped == 'Elem':
            in_elem = True
        elif in_elem and depth == 2:
            parts = stripped.split()
            if parts and parts[0].startswith('II_'):
                current_members.append(parts[0])

    # Second pass: derive a family key from each block
    # Use derive_set_family on the first II_ARM_ member; for jewelry/misc use
    # the longest common substring of all member IDs after removing prefixes.
    result = {}
    for members in set_blocks:
        # Deduplicate while preserving order
        unique = list(dict.fromkeys(members))
        # Try ARM-based family first
        family = ''
        for mid in unique:
            f = derive_set_family(mid)
            if f:
                family = f
                break
        if not family:
            # Fallback for jewelry/misc: use the first unique member ID as the family key.
            # This matches the key format produced by parse_set_effects.py for non-armor sets.
            family = unique[0] if unique else ''
        for mid in unique:
            result[mid] = family

    return result


def build_set_groups(items):
    """Group set items by logical set family and attach sibling item IDs."""
    from collections import defaultdict

    # Assign setFamily: prefer override from propItemEtc.inc, fall back to pattern derivation
    for item in items:
        if item['isSet']:
            override = item.pop('_setFamilyOverride', None)
            item['setFamily'] = override if override else derive_set_family(item['id'])
        else:
            item.pop('_setFamilyOverride', None)
            item['setFamily'] = ''

    groups = defaultdict(list)
    for item in items:
        if item['setFamily']:
            groups[item['setFamily']].append(item['id'])

    for item in items:
        sf = item['setFamily']
        if sf:
            item['setMembers'] = [i for i in groups[sf] if i != item['id']]
        else:
            item['setMembers'] = []

    return dict(groups)


def build_icon_map():
    icon_dirs = [BASE_DIR / "Bilder" / "Icon", BASE_DIR / "Bilder" / "Item"]
    icon_map = {}
    for d in icon_dirs:
        if d.exists():
            for f in d.rglob("*.dds"):
                icon_map[f.stem.lower()] = True
    return icon_map


def main():
    print("Loading text IDs...")
    text_ids, descriptions = load_text_ids(PROP_ITEM_TEXT)
    print(f"  {len(text_ids)} names, {len(descriptions)} descriptions")

    print("Loading set names from propItemEtc.txt.txt...")
    set_names = load_set_names(PROP_ITEM_ETC_TXT)
    print(f"  {len(set_names)} set names")

    print("Loading set member IDs from propItemEtc.inc...")
    set_member_ids = load_set_member_ids()
    print(f"  {len(set_member_ids)} items found in set definitions")

    print("Parsing items...")
    items = parse_items(SPEC_ITEM, text_ids, descriptions)

    # Override isSet for items found in SetItem blocks (catches costume sets etc.)
    # Also assign setFamily directly from the parsed set data
    for item in items:
        family = set_member_ids.get(item['id'])
        if family is not None:
            item['isSet'] = True
            item['_setFamilyOverride'] = family

    print("Building set groups...")
    set_groups = build_set_groups(items)
    print(f"  {len(set_groups)} set groups")

    print("Building icon map...")
    icon_map = build_icon_map()
    print(f"  {len(icon_map)} icons")

    # Mark which items have a converted PNG available
    for item in items:
        stem = Path(item['icon']).stem.lower() if item['icon'] else ''
        item['hasIcon'] = stem in icon_map

    # Sort items by level ascending, then name alphabetically
    items.sort(key=lambda i: (i['level'], i['name'].lower()))

    # Build filter metadata
    categories = {}
    for item in items:
        cat = item['category']
        sub = item['subcategory']
        if cat not in categories:
            categories[cat] = set()
        if sub and sub != cat:
            categories[cat].add(sub)
    categories = {k: sorted(v) for k, v in sorted(categories.items())}

    # Jobs: sorted by game progression order; unmapped leftovers appended alphabetically
    all_jobs = sorted(set(i['job'] for i in items if i['job']))
    def job_sort_key(j):
        try:
            return JOB_ORDER.index(j)
        except ValueError:
            return len(JOB_ORDER) + 1

    # Grades: fixed progression order
    all_grades = [g for g in GRADE_ORDER if g in set(i['grade'] for i in items if i['grade'])]

    output = {
        'items': items,
        'categories': categories,
        'jobs': sorted(all_jobs, key=job_sort_key),
        'grades': all_grades,
        'total': len(items),
    }

    out_file = OUTPUT_DIR / "items.json"
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print(f"\nDone! {len(items)} items → {out_file}")
    print(f"Size: {out_file.stat().st_size / 1024 / 1024:.1f} MB")

    # Quick sanity check
    weapons = [i for i in items if i['category'] == 'Weapon' and i['atkMax'] > 0]
    armors  = [i for i in items if i['category'] == 'Armor'  and i['defMax'] > 0]
    with_stats = [i for i in items if i['stats']]
    set_items  = [i for i in items if i['isSet']]
    print(f"\nSanity: {len(weapons)} weapons with ATK, {len(armors)} armors with DEF")
    print(f"        {len(with_stats)} items with bonus stats, {len(set_items)} set items")


if __name__ == '__main__':
    main()
