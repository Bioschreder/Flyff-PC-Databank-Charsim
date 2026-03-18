#!/usr/bin/env python3
"""
Parses propItemEtc.inc to extract all SetItem definitions and outputs set_effects.json.
"""

import re
import json
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent
ETC_INC  = BASE_DIR / "Datenbank" / "Datares" / "propItemEtc.inc"
ETC_TXT  = BASE_DIR / "Datenbank" / "Datares" / "propItemEtc.txt.txt"
OUTPUT   = BASE_DIR / "flyff-app" / "public" / "data" / "set_effects.json"

STAT_LABELS = {
    'DST_STR': 'STR', 'DST_INT': 'INT', 'DST_DEX': 'DEX', 'DST_STA': 'STA',
    'DST_HP_MAX': 'Max HP', 'DST_HP_MAX_RATE': 'HP',
    'DST_MP_MAX': 'Max MP', 'DST_MP_MAX_RATE': 'MP',
    'DST_FP_MAX': 'Max FP', 'DST_FP_MAX_RATE': 'FP',
    'DST_SPEED': 'Move Speed', 'DST_ATKSPEED': 'ATK Speed',
    'DST_ADJDEF': 'DEF', 'DST_ADJDEF_RATE': 'DEF',
    'DST_ATKPOWER': 'ATK Power', 'DST_ATKPOWER_RATE': 'Attack',
    'DST_CRITICAL_BONUS': 'Critical Bonus',
    'DST_CHR_CHANCECRITICAL': 'Critical Rate',
    'DST_CHR_DMG': 'Critical Damage',
    'DST_MASTRY_CRITICAL_BONUS': 'I. Crit DMG',
    'DST_ADJ_HITRATE': 'Hit Rate',
    'DST_BLOCK_MELEE': 'Melee Block', 'DST_BLOCK_RANGE': 'Ranged Block',
    'DST_PARRY': 'Parry', 'DST_REFLECT_DAMAGE': 'Reflect DMG',
    'DST_HPDAMAGE_RATE': 'HP Damage', 'DST_MONSTER_DMG': 'Monster Damage',
    'DST_EXPERIENCE': 'EXP Bonus', 'DST_ADDEXP': 'EXP Bonus',
    'DST_DROP_ITEM_RATE': 'Drop Rate', 'DST_DROP_ITEM_ALLGRADE_RATE': 'Drop Rate',
    'DST_ADDPENYA': 'Penya Bonus',
    'DST_RES_WIND': 'Wind RES', 'DST_RES_FIRE': 'Fire RES',
    'DST_RES_WATER': 'Water RES', 'DST_RES_ELECTRICITY': 'Elec RES',
    'DST_RES_EARTH': 'Earth RES', 'DST_RESIST_MAGIC': 'Magic RES',
    'DST_SUCK_HP_RATE': 'Suck Blood', 'DST_SUCK_MP_RATE': 'Suck MP',
    'DST_DOUBLE_OPTIME': 'Double Chance',
    'DST_MELEE_ATK': 'Melee ATK', 'DST_MAGIC_ATK': 'Magic ATK',
    'DST_MAGIC_ATK_RATE': 'Magic ATK', 'DST_PIERCINGDMG_RATE': 'Piercing DMG',
    'DST_ALL_RESISTEDATK_RATE': 'Resist ATK Rate',
    'DST_POISON_RATE': 'Poison Rate', 'DST_BLEEDING_RATE': 'Bleed Rate',
    'DST_CRITICAL_RESIST': 'Critical Resist',
}

RATE_STATS = {
    'DST_EXPERIENCE', 'DST_ADDEXP', 'DST_DROP_ITEM_RATE', 'DST_DROP_ITEM_ALLGRADE_RATE',
    'DST_MONSTER_DMG', 'DST_ATKPOWER_RATE', 'DST_HP_MAX_RATE', 'DST_MP_MAX_RATE',
    'DST_FP_MAX_RATE', 'DST_HPDAMAGE_RATE', 'DST_SUCK_HP_RATE', 'DST_SUCK_MP_RATE',
    'DST_DOUBLE_OPTIME', 'DST_MAGIC_ATK_RATE', 'DST_PIERCINGDMG_RATE',
    'DST_ALL_RESISTEDATK_RATE', 'DST_MASTRY_CRITICAL_BONUS', 'DST_CHR_CHANCECRITICAL',
    'DST_BLOCK_MELEE', 'DST_BLOCK_RANGE', 'DST_ADJDEF_RATE', 'DST_REFLECT_DAMAGE',
    'DST_POISON_RATE', 'DST_BLEEDING_RATE', 'DST_CRITICAL_RESIST',
}

SLOT_STRIP = re.compile(
    r'_(BOOTS|HELM|HELMET|SUIT|GLOVE|GLOVES|CLOAK|GAUNTLET|HAT|SHOES|'
    r'CAP|COAT|PANTS|UPPER_BODY|HAND|FOOT|CLOTH)(?=_|$)',
    re.IGNORECASE
)


def stat_label(key: str) -> str:
    return STAT_LABELS.get(key, key.replace('DST_', '').replace('_', ' ').title())


def is_rate(key: str) -> bool:
    return '_RATE' in key or key in RATE_STATS


def derive_family(item_ids: list[str]) -> str:
    """Derive logical set family key from item IDs."""
    families = set()
    for iid in item_ids:
        m = re.match(r'II_ARM_[FMS]_(.+)', iid)
        if m:
            rest = SLOT_STRIP.sub('', m.group(1))
            rest = re.sub(r'_(F|M)$', '', rest)
            families.add(rest)
    if not families:
        return item_ids[0] if item_ids else ''
    return sorted(families)[0]


def load_set_names(filepath: Path) -> dict[str, str]:
    names = {}
    try:
        with open(filepath, encoding='utf-8', errors='replace') as f:
            for line in f:
                parts = line.strip().split('\t', 1)
                if len(parts) == 2:
                    key, val = parts[0].strip(), parts[1].strip()
                    if val and val != key:
                        names[key] = val
    except Exception as e:
        print(f"  Warning: {e}")
    return names


def extract_block(content: str, start: int) -> tuple[str, int]:
    """Extract the content between matching {} starting from 'start', return (inner, end_pos)."""
    depth = 0
    i = start
    while i < len(content):
        if content[i] == '{':
            depth += 1
            if depth == 1:
                block_start = i + 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                return content[block_start:i], i + 1
        i += 1
    return '', len(content)


def parse_all_sets(filepath: Path, set_names: dict[str, str]) -> dict:
    with open(filepath, encoding='utf-16-le', errors='replace') as f:
        content = f.read()

    sets = {}
    pattern = re.compile(r'SetItem\s+(\d+)\s+(\S+)')

    for m in pattern.finditer(content):
        set_id  = int(m.group(1))
        ids_key = m.group(2).strip()
        set_name = set_names.get(ids_key, ids_key)

        # Extract the outer block { ... }
        outer_body, _ = extract_block(content, m.end())
        if not outer_body:
            continue

        # Parse Elem block
        item_ids = []
        em = re.search(r'Elem\s*\{', outer_body)
        if em:
            elem_body, _ = extract_block(outer_body, em.start())
            for line in elem_body.splitlines():
                parts = line.strip().split()
                if parts and parts[0].startswith('II_'):
                    item_ids.append(parts[0])

        # Parse Avail block
        bonuses_by_pieces: dict[int, list] = {}
        am = re.search(r'Avail\s*\{', outer_body)
        if am:
            avail_body, _ = extract_block(outer_body, am.start())
            for line in avail_body.splitlines():
                line = re.sub(r'//.*', '', line).strip()
                parts = line.split()
                if len(parts) >= 2 and parts[0].startswith('DST_'):
                    dst = parts[0]
                    try:
                        value = int(parts[1])
                    except:
                        continue
                    pieces = int(parts[2]) if len(parts) >= 3 and parts[2].isdigit() else (len(item_ids) or 2)
                    bonuses_by_pieces.setdefault(pieces, []).append({
                        'stat': stat_label(dst),
                        'value': value,
                        'unit': '%' if is_rate(dst) else '',
                    })

        if not item_ids:
            continue

        family = derive_family(item_ids)
        sets[set_id] = {
            'setFamily': family,
            'name': set_name,
            'items': item_ids,
            'bonuses': [{'pieces': k, 'effects': v} for k, v in sorted(bonuses_by_pieces.items())],
        }

    return sets


def main():
    print("Loading set names...")
    set_names = load_set_names(ETC_TXT)
    print(f"  {len(set_names)} entries")

    print("Parsing set effects from propItemEtc.inc ...")
    sets = parse_all_sets(ETC_INC, set_names)
    print(f"  {len(sets)} set definitions parsed")

    # Merge M/F gender variants under one family key
    by_family: dict[str, dict] = {}
    for sid, sdata in sorted(sets.items()):
        family = sdata['setFamily']
        if family not in by_family:
            by_family[family] = {
                'name': sdata['name'],
                'bonuses': sdata['bonuses'],
                'items': list(sdata['items']),
            }
        else:
            for iid in sdata['items']:
                if iid not in by_family[family]['items']:
                    by_family[family]['items'].append(iid)

    print(f"  {len(by_family)} unique set families after merging")

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(by_family, f, ensure_ascii=False, indent=2)

    print(f"\nDone → {OUTPUT}  ({OUTPUT.stat().st_size/1024:.0f} KB)")

    # Sanity: check match rate against items.json
    items_path = BASE_DIR / "flyff-app" / "public" / "data" / "items.json"
    if items_path.exists():
        with open(items_path) as f:
            items_data = json.load(f)
        se_keys = set(by_family.keys())
        matched   = sum(1 for i in items_data['items'] if i.get('setFamily') and i['setFamily'] in se_keys)
        set_total = sum(1 for i in items_data['items'] if i.get('isSet'))
        print(f"  Match rate: {matched}/{set_total} set items have effects")

        # Show unmatched families (first 10)
        item_fams = set(i['setFamily'] for i in items_data['items'] if i.get('isSet') and i.get('setFamily'))
        unmatched = item_fams - se_keys
        if unmatched:
            print(f"  Unmatched ({len(unmatched)}): {sorted(unmatched)[:10]}")

    # Sample output
    for k, v in list(by_family.items())[-5:]:
        print(f"\n  [{k}] {v['name']}")
        for b in v['bonuses']:
            print(f"    {b['pieces']}pcs:", ', '.join(f"{e['stat']} +{e['value']}{e['unit']}" for e in b['effects']))


if __name__ == '__main__':
    main()
