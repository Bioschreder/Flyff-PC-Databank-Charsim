#!/usr/bin/env python3
"""
Parses accessory.inc to extract per-item upgrade bonuses (level 0-20).
Output: flyff-app/public/data/upgrade_bonuses.json
  { "II_ITEM_ID": [ {level:0, stats:{STR:1}}, ... ], ... }
"""

import re
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
ACC_INC  = BASE_DIR / "Datenbank" / "Datares" / "accessory.inc"
OUTPUT   = BASE_DIR / "flyff-app" / "public" / "data" / "upgrade_bonuses.json"

STAT_LABELS = {
    'DST_STR': 'STR', 'DST_INT': 'INT', 'DST_DEX': 'DEX', 'DST_STA': 'STA',
    'DST_HP_MAX': 'Max HP', 'DST_HP_MAX_RATE': 'HP',
    'DST_MP_MAX': 'Max MP', 'DST_MP_MAX_RATE': 'MP',
    'DST_FP_MAX': 'Max FP',
    'DST_SPEED': 'Move Speed', 'DST_ATKSPEED': 'ATK Speed',
    'DST_ADJDEF': 'DEF', 'DST_ADJDEF_RATE': 'DEF',
    'DST_ATKPOWER': 'ATK Power', 'DST_ATKPOWER_RATE': 'Attack',
    'DST_CRITICAL_BONUS': 'Critical Bonus',
    'DST_CHR_CHANCECRITICAL': 'Critical Rate',
    'DST_CHR_DMG': 'Critical Damage',
    'DST_MASTRY_CRITICAL_BONUS': 'I. Crit DMG',
    'DST_ADJ_HITRATE': 'Hit Rate',
    'DST_BLOCK_MELEE': 'Melee Block', 'DST_BLOCK_RANGE': 'Ranged Block',
    'DST_PARRY': 'Parry',
    'DST_HPDAMAGE_RATE': 'HP Damage', 'DST_MONSTER_DMG': 'Monster Damage',
    'DST_EXPERIENCE': 'EXP Bonus', 'DST_ADDEXP': 'EXP Bonus',
    'DST_DROP_ITEM_RATE': 'Drop Rate', 'DST_DROP_ITEM_ALLGRADE_RATE': 'Drop Rate',
    'DST_ADDPENYA': 'Penya Bonus',
    'DST_RES_WIND': 'Wind RES', 'DST_RES_FIRE': 'Fire RES',
    'DST_RES_WATER': 'Water RES', 'DST_RES_ELECTRICITY': 'Elec RES',
    'DST_RES_EARTH': 'Earth RES', 'DST_RESIST_MAGIC': 'Magic RES',
    'DST_SUCK_HP_RATE': 'Suck Blood', 'DST_SUCK_MP_RATE': 'Suck MP',
    'DST_MELEE_ATK': 'Melee ATK', 'DST_MAGIC_ATK': 'Magic ATK',
    'DST_MAGIC_ATK_RATE': 'Magic ATK',
    'DST_PIERCINGDMG_RATE': 'Piercing DMG',
    'DST_REFLECT_DAMAGE': 'Reflect DMG',
}

RATE_STATS = {
    'DST_EXPERIENCE', 'DST_ADDEXP', 'DST_DROP_ITEM_RATE', 'DST_DROP_ITEM_ALLGRADE_RATE',
    'DST_MONSTER_DMG', 'DST_ATKPOWER_RATE', 'DST_HP_MAX_RATE', 'DST_MP_MAX_RATE',
    'DST_FP_MAX_RATE', 'DST_HPDAMAGE_RATE', 'DST_SUCK_HP_RATE', 'DST_SUCK_MP_RATE',
    'DST_MAGIC_ATK_RATE', 'DST_PIERCINGDMG_RATE', 'DST_CHR_CHANCECRITICAL',
    'DST_BLOCK_MELEE', 'DST_BLOCK_RANGE', 'DST_ADJDEF_RATE', 'DST_REFLECT_DAMAGE',
    'DST_MASTRY_CRITICAL_BONUS',
}

def stat_label(key):
    return STAT_LABELS.get(key, key.replace('DST_', '').replace('_', ' ').title())

def is_rate(key):
    return '_RATE' in key or key in RATE_STATS


def extract_block(content, start):
    """Return (inner_text, end_pos) for the {} block starting at/after 'start'."""
    i = content.find('{', start)
    if i < 0:
        return '', start
    depth = 0
    block_start = i + 1
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                return content[block_start:i], i + 1
        i += 1
    return '', len(content)


def parse_level_block(text):
    """Parse 'DST_KEY val DST_KEY val ...' from a level { } block."""
    stats = {}
    tokens = text.split()
    i = 0
    while i < len(tokens) - 1:
        if tokens[i].startswith('DST_'):
            try:
                val = int(tokens[i + 1])
                label = stat_label(tokens[i])
                unit  = '%' if is_rate(tokens[i]) else ''
                # Merge same labels (rare)
                stats[label] = {'value': val, 'unit': unit}
                i += 2
                continue
            except ValueError:
                pass
        i += 1
    return stats


def parse_accessory(filepath):
    with open(filepath, encoding='cp1252', errors='replace') as f:
        content = f.read()

    result = {}

    # Find outer Accessory { } block
    acc_start = content.find('Accessory')
    if acc_start < 0:
        print("ERROR: 'Accessory' block not found")
        return result
    outer_body, _ = extract_block(content, acc_start)

    # Find all item blocks: II_... { level { ... } ... }
    item_pattern = re.compile(r'(II_\w+)\s*(?://[^\n]*)?\n\s*\{')
    pos = 0
    while True:
        m = item_pattern.search(outer_body, pos)
        if not m:
            break
        item_id = m.group(1)
        item_body, end_pos = extract_block(outer_body, m.start())
        pos = end_pos

        # Parse level entries: digit(s) { ... }
        levels = []
        level_pattern = re.compile(r'\b(\d+)\s*\{([^}]*)\}')
        for lm in level_pattern.finditer(item_body):
            lvl   = int(lm.group(1))
            stats = parse_level_block(lm.group(2))
            if stats:  # only store levels that actually have bonuses
                levels.append({'level': lvl, 'stats': stats})

        if levels:
            result[item_id] = levels

    return result


def main():
    print("Parsing accessory.inc ...")
    data = parse_accessory(ACC_INC)
    print(f"  {len(data)} items with upgrade bonuses")

    # Stats
    total_levels = sum(len(v) for v in data.values())
    multi_stat   = sum(1 for v in data.values() if any(len(e['stats']) > 1 for e in v))
    print(f"  {total_levels} total level entries, {multi_stat} items with multi-stat levels")

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

    size_kb = OUTPUT.stat().st_size / 1024
    print(f"\nDone → {OUTPUT}  ({size_kb:.0f} KB)")

    # Sample
    sample = [(k, v) for k, v in data.items() if len(v[0]['stats']) >= 2]
    if sample:
        kid, kv = sample[0]
        print(f"\nSample (multi-stat): {kid}")
        for e in kv[:5]:
            print(f"  +{e['level']}: {e['stats']}")
    else:
        kid, kv = list(data.items())[0]
        print(f"\nSample: {kid}")
        for e in kv[:5]:
            print(f"  +{e['level']}: {e['stats']}")


if __name__ == '__main__':
    main()
