# Flyff DB & Charakter-Simulator – Programm-Übersicht

> Letzte Aktualisierung: 2026-03-12  
> Stack: React 18 · TypeScript · Vite · Tailwind CSS

---

## Inhaltsverzeichnis

1. [Projektstruktur](#1-projektstruktur)
2. [Datenpipeline: Datenbank → JSON](#2-datenpipeline-datenbank--json)
3. [JSON-Datenformate](#3-json-datenformate)
4. [TypeScript-Typen (types.ts)](#4-typescript-typen-typests)
5. [Formeln (formulas.ts)](#5-formeln-formulasts)
6. [Stat-Berechnung (useStatCalculator.ts)](#6-stat-berechnung-usestatcalculatorts)
7. [Komponenten-Übersicht](#7-komponenten-übersicht)
8. [Datenfluss im Simulator](#8-datenfluss-im-simulator)
9. [Item-Manager & Vergleich](#9-item-manager--vergleich)
10. [Stat-Key-Mapping (Konvertierungstabelle)](#10-stat-key-mapping-konvertierungstabelle)
11. [Upgrade-Systeme im Überblick](#11-upgrade-systeme-im-überblick)
12. [Bekannte Lücken / nicht berechnete Stats](#12-bekannte-lücken--nicht-berechnete-stats)

---

## 1. Projektstruktur

```
Flyff Simulator:Database verdent/
│
├── Datenbank/                     ← Originale Flyff-Datenbankdateien
│   └── Datares/
│       ├── propItem.txt.txt       ← Item-Basisdaten (Name, Level, Stats)
│       ├── propItemEtc.inc        ← Set-Effekte, Upgrade-Boni, Job-Prefixes (UTF-16-LE)
│       ├── propJob.inc            ← Klassen-Multiplikatoren & Waffen-Faktoren
│       ├── propSkill.inc          ← Skill-Definitionen
│       ├── propSkillAdd.inc       ← Skill-Schadenswerte (atkMin/atkMax)
│       ├── accessory.inc          ← Accessoire-Upgrade-Tabellen
│       ├── expTable.inc           ← EXP-Tabelle pro Level
│       ├── Ultimate_GemAbility.txt
│       ├── Suit_GemAbility.txt
│       └── Costume_GemAbility.txt
│
├── parse_db.py                    ← Parst Items → items.json
├── parse_set_effects.py           ← Parst Set-Effekte → set_effects.json
├── parse_upgrade_bonuses.py       ← Parst Accessoire-Upgrades → upgrade_bonuses.json
├── parse_jobs.py                  ← Parst Klassen → jobs.json + skills.json
├── parse_monsters.py              ← Parst Monster → monsters.json
├── parse_awakening.py             ← Parst Gems/Erweckung → gem_bonuses.json + awakening_options.json
├── convert_icons.py               ← Konvertiert BMP/PNG mit pinkem BG → transparente WebP
│
└── flyff-app/                     ← React-Anwendung
    ├── public/data/               ← Generierte JSON-Dateien (statisch)
    │   ├── items.json             ← ~10.000 Items
    │   ├── set_effects.json       ← Set-Bonus-Definitionen
    │   ├── upgrade_bonuses.json   ← Accessoire-Upgrade-Tabellen
    │   ├── jobs.json              ← Klassen + Multiplikatoren
    │   ├── skills.json            ← Skill-Daten
    │   ├── monsters.json          ← Monster-Datenbank
    │   ├── gem_bonuses.json       ← Ultimate/Suit/Costume Gem-Werte
    │   ├── job_prefixes.json      ← Baruna Job-Prefix-Boni
    │   ├── awakening_options.json ← Erweckungs-Optionen
    │   └── exp_table.json         ← EXP pro Level
    │
    └── src/
        ├── App.tsx                ← Tab-Navigation (4 Tabs)
        ├── types.ts               ← Alle TypeScript-Interfaces
        ├── formulas.ts            ← Schadens- und Stat-Formeln
        ├── hooks/
        │   ├── useItemDatabase.ts ← Lädt alle JSON-Dateien (gecacht)
        │   ├── useStatCalculator.ts← Vollständige Stat-Berechnung
        │   └── useSimulatorData.ts ← Lädt Jobs/Skills/Monster für Simulator
        └── components/
            ├── CharacterSimulator.tsx ← Haupt-Simulator (5 Spalten)
            ├── EquipmentPanel.tsx     ← Ausrüstungs-Layout (Silhouette)
            ├── EquipmentSlot.tsx      ← Einzelner Slot (Klick → ItemConfigPanel)
            ├── ItemConfigPanel.tsx    ← Item auswählen + konfigurieren
            ├── ItemTooltip.tsx        ← Hover-Tooltip mit allen Stats
            ├── PowerupPanel.tsx       ← Powerup/Buff-Auswahl
            ├── SetEffectPanel.tsx     ← Aktive Set-Boni anzeigen
            ├── ItemManager.tsx        ← Datenbank-Browser (Filter + Suche)
            ├── ItemCard.tsx           ← Item-Karte im Manager
            ├── ItemComparison.tsx     ← Side-by-Side Vergleich
            └── MonsterManager.tsx     ← Monster-Datenbank + Filter
```

---

## 2. Datenpipeline: Datenbank → JSON

Alle Parse-Skripte laufen einmalig (oder nach DB-Updates) und erzeugen statische JSON-Dateien.

```
Originaldateien (Datenbank/)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ parse_db.py                                                         │
│  • propItem.txt.txt → Item-Basisdaten                               │
│  • propItemEtc.inc  → Set-Mitgliedschaft, Powerup-Infos, Soulbound  │
│  • Bilder/          → Icon-Pfad pro Item                            │
│  Ausgabe: items.json                                                │
├─────────────────────────────────────────────────────────────────────┤
│ parse_set_effects.py                                                │
│  • propItemEtc.inc → SetItem-Blöcke                                 │
│  Ausgabe: set_effects.json                                          │
├─────────────────────────────────────────────────────────────────────┤
│ parse_upgrade_bonuses.py                                            │
│  • accessory.inc → Upgrade-Tabellen (Level 1–20 pro Item-ID)        │
│  Ausgabe: upgrade_bonuses.json                                      │
├─────────────────────────────────────────────────────────────────────┤
│ parse_jobs.py                                                       │
│  • propJob.inc  → Klassen-Multiplikatoren + Waffen-Faktoren         │
│  • propSkill.inc + propSkillAdd.inc → Skill-Daten                   │
│  Ausgabe: jobs.json + skills.json                                   │
├─────────────────────────────────────────────────────────────────────┤
│ parse_monsters.py                                                   │
│  • propMover.txt / propMonster.inc → Monster-Stats                  │
│  Ausgabe: monsters.json                                             │
├─────────────────────────────────────────────────────────────────────┤
│ parse_awakening.py                                                  │
│  • Ultimate_GemAbility.txt → Ultimate-Gem-Werte                     │
│  • Suit_GemAbility.txt → Piercing-Werte (klassen-spezifisch)        │
│  • Costume_GemAbility.txt → CS-Gem-Werte                            │
│  • propItemEtc.inc → SetGemItem (Job-Prefixes) + Erweckungs-Optionen│
│  Ausgabe: gem_bonuses.json + job_prefixes.json + awakening_options.json│
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
flyff-app/public/data/*.json
        │
        ▼
React-App (useItemDatabase.ts lädt beim ersten Mount, gecacht danach)
```

---

## 3. JSON-Datenformate

### items.json
```json
{
  "total": 9847,
  "categories": { "Waffe": ["Schwert", "Axt", ...], ... },
  "items": [
    {
      "id": "II_WEA_SWO_LEAGEND",
      "name": "Legend Sword",
      "nameId": "IDS_PROPITEM_TXT_000234",
      "description": "...",
      "level": 120,
      "category": "Waffe",
      "subcategory": "Schwert",
      "type": "Schwert",
      "job": "Mercenary",
      "grade": "Ultimate",
      "slot": "Right Hand",
      "twoHanded": false,
      "atkMin": 1200,
      "atkMax": 1400,
      "defMin": 0,
      "defMax": 0,
      "icon": "wea_swo_leagend.webp",
      "hasIcon": true,
      "isSet": false,
      "setFamily": "",
      "setMembers": [],
      "soulbound": null,
      "powerup": null,
      "stats": {
        "Critical Bonus": 32,
        "Chr Chancecritical": 5
      }
    }
  ]
}
```

### set_effects.json
```json
{
  "SET_PRIMORDIAL_SLAYER": {
    "name": "Primordial Slayer",
    "bonuses": [
      { "pieces": 2, "effects": [
          { "stat": "Max HP", "value": 45, "unit": "%" },
          { "stat": "Block Melee", "value": 30, "unit": "%" }
      ]},
      { "pieces": 3, "effects": [
          { "stat": "ATK", "value": 40, "unit": "%" }
      ]},
      { "pieces": 4, "effects": [
          { "stat": "Suck Blood", "value": 3, "unit": "%" },
          { "stat": "Crit DMG", "value": 30, "unit": "%" }
      ]}
    ]
  }
}
```

### upgrade_bonuses.json
```json
{
  "II_ACC_RING_PRIMORDIAL": [
    { "level": 1,  "stats": { "STR": { "value": 2, "unit": "" } } },
    { "level": 5,  "stats": { "STR": { "value": 10, "unit": "" }, "STA": { "value": 5, "unit": "" } } },
    { "level": 10, "stats": { "STR": { "value": 20, "unit": "" }, "Max HP": { "value": 10, "unit": "%" } } }
  ]
}
```

### gem_bonuses.json
```json
{
  "ultimate": {
    "DST_HP_MAX":    [228, 455, 683, 910, 1365],
    "DST_ATKPOWER":  [150, 300, 450, 600, 900],
    "DST_STR":       [5, 10, 15, 20, 30]
  },
  "suit": {
    "JOB_BLADE": {
      "DST_ATKPOWER": [81, 162, 244, 325],
      "DST_STR":      [10, 20, 30, 40]
    }
  },
  "costume": {
    "DST_STR":   [3, 6, 10, 15],
    "DST_SPEED": [5, 10, 15, 20]
  }
}
```

### job_prefixes.json
```json
{
  "JOB_BLADE": {
    "id": 6,
    "label": "Blade",
    "stats": [
      { "stat": "DST_STR",          "valuePerTier": 20, "tiers": 4 },
      { "stat": "DST_ATKPOWER_RATE","valuePerTier": 10, "tiers": 4 },
      { "stat": "DST_ATTACKSPEED",  "valuePerTier": 200, "tiers": 4 },
      { "stat": "DST_HP_MAX_RATE",  "valuePerTier": 10, "tiers": 4 }
    ]
  }
}
```

---

## 4. TypeScript-Typen (types.ts)

### Wichtigste Interfaces

```
FlyffItem          – Ein Item aus der Datenbank (Waffe, Rüstung, Accessoire, ...)
EquippedItem       – Ein angelegtes Item MIT Upgrade-Level, Erweckungs-Slots, Gems, Fusion, Job-Prefix
SimulatorState     – Vollständiger Zustand des Simulators (Klasse, Level, Stats, Ausrüstung, Buffs)
ComputedStats      – Berechnetes Ergebnis (alle finalen Stats nach Ausrüstung + Boni)
```

### EquipSlot – alle 17 Ausrüstungsslots
```
weapon    shield                        ← Waffe / Schild (oder 2. Waffe bei Blade)
hat       suit       glove    boots     ← Normale Rüstung (4 Teile)
cs_hat    cs_suit    cs_glove cs_boots  ← CS / Kostüm-Rüstung (4 Teile)
cloak     mask                          ← Umhang, Maske
ring1     ring2                         ← 2× Ring
ear1      ear2                          ← 2× Ohrring
necklace                                ← Halskette
talisman1 talisman2                     ← 2× Talisman
```

### EquippedItem – Aufbau
```typescript
EquippedItem {
  itemId: string           // Verweis auf FlyffItem.id
  upgradeLevel: number     // 0–20 (Waffen/Rüstungen/Accessoires)
  awakenSlots: [           // bis zu 5 Erweckungs-Slots
    { stat: "DST_CRITICAL_BONUS", value: 19 },
    ...
  ]
  gemSlots: [              // bis zu 4 Gem/Piercing-Slots
    { gemType: "ultimate"|"suit"|"costume", stat: "DST_ATKPOWER", tier: 3 }
  ]
  fusedWeapon?: {          // Nur für 2H-Waffen: eingeschmolzene Waffe
    itemId: string, upgradeLevel: number
  }
  jobPrefixTier?: number   // 0–4, nur Baruna-Rüstungen
}
```

### ComputedStats – Berechnungs-Ausgabe
```typescript
ComputedStats {
  str, sta, dex, int       // Basis-Stats (Spieler + Ausrüstung)
  hp, mp, fp               // Lebens-/Mana-/FP-Punkte (nach Job-Formel + Boni)
  defMin, defMax           // Rüstungswert (inkl. DEF%)
  atkMin, atkMax           // Waffen-ATK (inkl. Upgrade)
  critRate                 // Crit-Chance % (aus Equipment)
  critDmg                  // Crit-Schadens-Bonus % (aus Equipment)
  atkPct                   // ATK% (Multiplikator)
  equipAtk                 // Flat ATK-Bonus aus Equipment
  addMagic                 // Magic ATK-Bonus
  activeSetBonuses[]       // Aktive Set-Boni mit Details
  activePowerups[]         // Aktive Buffs mit Effekten
}
```

---

## 5. Formeln (formulas.ts)

### 5.1 Charakter-Angriff (Melee)

```
CharATK = [ STR × (Level/5 + 5) + STR²/5 + WaffenATK × WaffenFaktor ]
            × (1 + ATK% / 100)
            + FlatATK

Quelle: Community-reverse-engineered, basiert auf propJob.inc Faktoren
```

**WaffenFaktor** (aus jobs.json pro Klasse):

| Klasse       | Schwert | Axt  | Stab | Stock | Knöchel | Zauberstab | Yoyo |
|--------------|---------|------|------|-------|---------|------------|------|
| Vagrant      | 4.5     | 4.5  | 4.5  | 4.5   | 4.5     | 4.5        | 4.5  |
| Blade        | 5.0     | 4.8  | –    | –     | –       | –          | –    |
| Knight       | 5.5     | 5.2  | –    | –     | –       | –          | –    |
| Ranger       | 4.0     | 4.0  | –    | –     | –       | –          | 5.5  |
| Psykeeper    | –       | –    | 5.0  | –     | –       | –          | –    |
| Elementor    | –       | –    | –    | –     | –       | 5.5        | –    |
*(Werte vereinfacht – exakte Werte in jobs.json)*

### 5.2 Kritischer Treffer

```
Crit Rate (gesamt)  = job.criticalFactor  +  ComputedStats.critRate
                    = Klassen-Basisrate   +  Equipment-Boni (Chr Chancecritical)

Jester / Windlurker: criticalFactor = 4  → +4% Basis
Alle anderen:        criticalFactor = 1  → +1% Basis

Crit Schaden = CharATK × 2.0 × (1 + critDmg / 100)
```

### 5.3 Skill-Schaden

```
SkillFaktor = (SkillAtkMin + SkillAtkMax) / 200
  → Beispiel: atkMin=180, atkMax=220 → Faktor 2.0 (200% von CharATK)

Normal DMG (Skill) = CharATK × SkillFaktor
Krit   DMG (Skill) = Normal  × 2.0 × (1 + critDmg / 100)

Erwartungswert = Normal × (1 - critRate%) + Krit × critRate%
```

### 5.4 Schaden gegen Monster

```
LevelMod   = 1 + (CharLevel - MonsterLevel) × 0.01
effDEF     = MonsterDEF / max(0.1, LevelMod)
DMG        = max(1, (CharATK − effDEF) × LevelMod)
```

> +1% Schaden pro Level ÜBER dem Monster, −1% pro Level UNTER dem Monster.

### 5.5 HP / MP / FP

```
HP = round( (STA × 5  + (Level−1) × 28) × job.hpMultiplier )  × (1 + HP%/100)  + HPflat
MP = round( (INT × 6  + (Level−1) × 12) × job.mpMultiplier )  × (1 + MP%/100)  + MPflat
FP = round( (DEX × 4  + (Level−1) × 12) × job.fpMultiplier )  × (1 + FP%/100)  + FPflat
```

**HP/MP/FP-Multiplikatoren** (Beispielwerte aus jobs.json):

| Klasse     | HP ×  | MP ×  | FP ×  | DEF × |
|------------|-------|-------|-------|-------|
| Vagrant    | 1.0   | 1.0   | 1.0   | 1.0   |
| Knight     | 2.8   | 0.5   | 1.2   | 2.5   |
| Blade      | 2.2   | 0.6   | 1.0   | 1.8   |
| Elementor  | 0.8   | 2.5   | 1.0   | 0.8   |
| Ringmaster | 1.2   | 2.0   | 1.0   | 1.2   |

### 5.6 Defense (STA-Anteil, nicht in UI gezeigt)

```
DEF (STA-Anteil) = round( STA × job.defMultiplier )
Gesamt-DEF       = DEF (STA) + Summe(item.defMin/-defMax) + Upgrade-DEF-Bonus
                   × (1 + DEF% / 100)
```

---

## 6. Stat-Berechnung (useStatCalculator.ts)

Die Berechnung läuft in einem `useMemo` in fester Reihenfolge:

```
Eingabe: SimulatorState (Klasse, Level, Basis-Stats, Ausrüstung, Buffs)
         + alle geladenen Datenbanken

Schritt 1  Für jedes ausgerüstete Item:
           ├── 2. Item-Basis-Stats (applyItemStat)
           │       → STR/STA/DEX/INT, ATK Power, Crit Rate/DMG, DEF, HP, ...
           ├── 2b. Waffen-ATK direkt aus item.atkMin/atkMax
           ├── 2c. Rüstungs-DEF direkt aus item.defMin/defMax
           ├── 3. Upgrade-Boni
           │       Accessoires → upgrade_bonuses.json (Tabelle)
           │       Waffen      → avgATK × upgradeLevel × 5%
           │       Rüstungen   → avgDEF × upgradeLevel × 5%
           ├── 4. Erweckungs-Slots (DST_* Keys → applyDstStat)
           ├── 5. Gem/Piercing-Slots (gem_bonuses.json, Tier-Wert)
           └── 5b. Baruna Job-Prefix (job_prefixes.json × Tier)

Schritt 6  Set-Boni zählen und anwenden (applyLabelStat)

Schritt 7  Aktive Powerup-Buffs anwenden (applyLabelStat)

Schritt 8  Base HP/MP/FP berechnen (calcHP/calcMP/calcFP mit STR/STA nach Equip)

Schritt 9  Deferred HP/MP/FP-Boni anwenden:
           HP_final = (HP_base + HPflat) × (1 + HP%/100)
           MP_final = (MP_base + MPflat) × (1 + MP%/100)
           FP_final = (FP_base + FPflat) × (1 + FP%/100)

Schritt 10 DEF%-Multiplikator anwenden:
           DEF_final = DEF_sum × (1 + DEF%/100)

Ausgabe: ComputedStats
```

### Warum Deferred?
HP/MP/FP werden erst in Schritt 8 berechnet. Prozentuale Boni (`Max HP %`, `DST_HP_MAX_RATE`) müssen daher gesammelt und erst **nach** der Basisberechnung angewendet werden. Gleiches gilt für DEF%.

### Drei Stat-Mapper-Funktionen

| Funktion         | Eingabe-Format          | Verwendet von                                  |
|------------------|-------------------------|------------------------------------------------|
| `applyItemStat`  | `"Chr Chancecritical"`  | Items aus items.json (Klartextformat)          |
| `applyDstStat`   | `"DST_CHR_CHANCECRITICAL"` | Erweckung, Gems, Job-Prefix (DST-Format)    |
| `applyLabelStat` | `"Crit Rate"` + unit    | Set-Effekte, Powerups, Upgrade-Tabellen        |

---

## 7. Komponenten-Übersicht

### App.tsx – Tab-Navigation

```
App
├── Tab: "Item Manager"   → ItemManager
├── Tab: "Vergleich"      → ItemComparison
├── Tab: "Char-Simulator" → CharacterSimulator
└── Tab: "Monster-DB"     → MonsterManager
```

### CharacterSimulator.tsx – 5-Spalten-Layout

```
Spalte 1: Job + Basis-Stats
  ├── JobSelector (Klassen-Auswahl nach Tier)
  ├── Geschlecht-Toggle (M/F)
  └── StatInput × 5 (Level, STR, STA, DEX, INT)

Spalte 2: Equipment
  ├── EquipmentPanel (Silhouette-Layout aller 17 Slots)
  └── PowerupPanel (Buff-Auswahl mit Suche + Filter)

Spalte 3: Charakter-Blatt
  ├── Basis-Stats (STR/STA/DEX/INT nach Equip)
  ├── HP/MP/FP
  ├── DEF (Min–Max)
  ├── Angriff (CharATK Min/Max, Crit Rate, Crit DMG)
  ├── Normalangriff (normal + krit Min/Max)
  ├── Klassen-Multiplikatoren
  └── ActiveBonusPanel (aktive Set-Boni + Powerups)

Spalte 4: Skills
  └── SkillCard × N (mit Skillstufen-Slider + DMG-Ausgabe)

Spalte 5: Monster-Ziel
  ├── Monster-Suche
  ├── Monster-Details (HP/DEF/EXP)
  ├── DMG vs Monster (Normal/Krit)
  └── Kills für Level-Up
```

### EquipmentPanel.tsx – Slot-Layout

```
[Ring1]  [Ohr1]  [Kette]  [Ohr2]  [Ring2]
[Tal1]   [Tal2]
[Waffe]  [        Charakter       ]  [Helm ]
[Schild] [        Silhouette      ]  [Rüst ]
[     ]  [                       ]  [Hand ]
[Umhang] [                       ]  [Stief]
[Maske]  [CS-H]  [CS-R]  [CS-G]  [CS-B ]
```

Klick auf Slot → öffnet `ItemConfigPanel` als Slide-in

### ItemConfigPanel.tsx – Slot-Konfiguration

Inhalte je nach Slot-Typ:

```
Alle Slots:
  ├── Item-Suche (gefiltert nach Slot + Klasse + Geschlecht)
  ├── Upgrade-Stufe (Slider, max abhängig von Item-Typ)
  └── Erweckungs-Slots (0–5, nur bei awakeable Items)

Weapon/Shield (Ultimate/Baruna):
  └── Ultimate Gem-Slots (0–4, aus gem_bonuses.ultimate)

Helm/Rüstung/Hand/Stiefel:
  └── Piercing-Slots (0–4, aus gem_bonuses.suit)
      +12% Normal / +18% Baruna

CS-Slots:
  └── Costume Gem-Slots (0–4, aus gem_bonuses.costume)

Baruna-Rüstungen:
  └── Job-Prefix (Stufe 0–4, klassenspezifisch)

2H-Waffen:
  └── Fusion-Waffe (zweite Waffe einschmelzen)
```

---

## 8. Datenfluss im Simulator

```
                    ┌─────────────────────────────────┐
                    │        useItemDatabase           │
                    │  (lädt alle JSONs einmalig,      │
                    │   gecacht im Modul-Scope)        │
                    └─────────────┬───────────────────┘
                                  │
                    items, setEffects, upgrades,
                    gems, jobPrefixes, awakening
                                  │
                    ┌─────────────▼───────────────────┐
                    │      CharacterSimulator          │
                    │                                  │
                    │  SimulatorState (React useState) │
                    │  ├── jobId: "JOB_BLADE"          │
                    │  ├── level: 130                  │
                    │  ├── baseStr/Sta/Dex/Int: ...    │
                    │  ├── equipment: {                │
                    │  │     weapon: EquippedItem,     │
                    │  │     hat: EquippedItem, ...    │
                    │  │   }                           │
                    │  └── activeBuffIds: [...]        │
                    └─────────────┬───────────────────┘
                                  │ SimulatorState + DBs
                    ┌─────────────▼───────────────────┐
                    │      useStatCalculator           │
                    │   (useMemo, neu bei Änderung)    │
                    │                                  │
                    │  Schritt 1–10 (siehe Abschnitt 6)│
                    └─────────────┬───────────────────┘
                                  │ ComputedStats
                    ┌─────────────▼───────────────────┐
                    │    Anzeige + Formeln             │
                    │                                  │
                    │  CharATK = calcCharATK(...)      │
                    │  critRate = job.critFactor       │
                    │           + computed.critRate    │
                    │  SkillDMG = calcSkillDMG(...)    │
                    │  MonsterDMG = calcDmgVsMonster(.)│
                    └─────────────────────────────────┘
```

---

## 9. Item-Manager & Vergleich

### ItemManager.tsx
- Lädt `items.json` via `useItemDatabase`
- Filter: Kategorie, Subkategorie, Klasse, Grad, Level-Range, Freitext
- Zeigt `ItemCard` mit Icon (WebP), Stats, Set-Zugehörigkeit
- Hover → `ItemTooltip` (alle Stats + Set-Boni + Upgrade-Info)
- Button "Zum Vergleich" → `compareList` in App.tsx

### ItemComparison.tsx
- Bis zu 4 Items gleichzeitig
- Side-by-Side Stat-Vergleich (grün = besser, rot = schlechter als Referenz)

### ItemTooltip.tsx
- Zeigt: Name, Level, Job, Grad, ATK/DEF, alle Stats (mit lesbaren Labels), Set-Info

---

## 10. Stat-Key-Mapping (Konvertierungstabelle)

### items.json Klartextformat → Berechnungsfeld

| items.json Key           | ComputedStats Feld | Einheit  |
|--------------------------|--------------------|----------|
| `STR`                    | str                | flat     |
| `STA`                    | sta                | flat     |
| `DEX`                    | dex                | flat     |
| `INT`                    | int                | flat     |
| `Stat Allup`             | str+sta+dex+int    | flat je  |
| `ATK Power`              | equipAtk           | flat     |
| `Atkpower Rate`          | atkPct             | %        |
| `Chr Dmg`                | equipAtk           | flat     |
| `Chr Weaeatkchange`      | atkPct             | %        |
| `Chr Chancecritical`     | critRate           | %        |
| `Critical Bonus`         | critDmg            | %        |
| `Addmagic`               | addMagic           | flat     |
| `DEF`                    | defMin + defMax    | flat     |
| `Adjdef Rate`            | DEF% (deferred)    | %        |
| `Max HP`                 | hpFlat (deferred)  | flat     |
| `Max HP %`               | hpPct (deferred)   | %        |
| `Max MP`                 | mpFlat (deferred)  | flat     |
| `Mp Max Rate`            | mpPct (deferred)   | %        |
| `Max FP`                 | fpFlat (deferred)  | flat     |
| `Fp Max Rate`            | fpPct (deferred)   | %        |

### DST-Format → Berechnungsfeld (Erweckung, Gems, Job-Prefix)

| DST-Key                    | ComputedStats Feld | Einheit  |
|----------------------------|--------------------|----------|
| `DST_STR`                  | str                | flat     |
| `DST_STA`                  | sta                | flat     |
| `DST_DEX`                  | dex                | flat     |
| `DST_INT`                  | int                | flat     |
| `DST_ATKPOWER`             | equipAtk           | flat     |
| `DST_ATKPOWER_RATE`        | atkPct             | %        |
| `DST_ADJDEF`               | defMin + defMax    | flat     |
| `DST_ADJDEF_RATE`          | DEF% (deferred)    | %        |
| `DST_CHR_CHANCECRITICAL`   | critRate           | %        |
| `DST_CRITICAL_BONUS`       | critDmg            | %        |
| `DST_ADDMAGIC`             | addMagic           | flat     |
| `DST_HP_MAX`               | hpFlat (deferred)  | flat     |
| `DST_HP_MAX_RATE`          | hpPct (deferred)   | %        |
| `DST_MP_MAX`               | mpFlat (deferred)  | flat     |
| `DST_MP_MAX_RATE`          | mpPct (deferred)   | %        |
| `DST_FP_MAX`               | fpFlat (deferred)  | flat     |
| `DST_FP_MAX_RATE`          | fpPct (deferred)   | %        |

### Label-Format → Berechnungsfeld (Set-Effekte, Powerups, Upgrade-Tabellen)

| Label         | Unit   | ComputedStats Feld           |
|---------------|--------|------------------------------|
| `STR`         | –      | str                          |
| `STA`         | –      | sta                          |
| `DEX`         | –      | dex                          |
| `INT`         | –      | int                          |
| `ATK`         | –      | equipAtk                     |
| `ATK`         | `%`    | atkPct                       |
| `DEF`         | –      | defMin + defMax              |
| `DEF`         | `%`    | DEF% (deferred)              |
| `Crit Rate`   | –      | critRate                     |
| `Crit DMG`    | –      | critDmg                      |
| `Magic ATK`   | –      | addMagic                     |
| `Max HP`      | –      | hpFlat (deferred)            |
| `Max HP`      | `%`    | hpPct (deferred)             |
| `Max MP`      | –      | mpFlat (deferred)            |
| `Max MP`      | `%`    | mpPct (deferred)             |
| `Max FP`      | –      | fpFlat (deferred)            |
| `Max FP`      | `%`    | fpPct (deferred)             |

---

## 11. Upgrade-Systeme im Überblick

| System              | Items                          | Werte                          | Datenquelle              |
|---------------------|--------------------------------|--------------------------------|--------------------------|
| **Waffe** (normal)  | Alle Waffen                    | avgATK × Level × 5%           | Formel                   |
| **Waffe** (Baruna)  | Baruna-Waffen (+20 max)        | avgATK × Level × 5%           | Formel                   |
| **Rüstung**         | Helm/Rüst/Hand/Stief (+20)     | avgDEF × Level × 5%           | Formel                   |
| **Accessoire**      | Ring/Ohrring/Kette/Talisman    | Exakte Tabelle (STR/DEX/etc.) | upgrade_bonuses.json     |
| **Erweckung**       | Helm/Rüst/Hand/Stief/Waffe/Schild | 1–5 Slots, DST_* Stats     | awakening_options.json   |
| **Ultimate Gems**   | Ultimate/Baruna-Waffen         | max 4 Sockel, Tier 1–5        | gem_bonuses.ultimate     |
| **Piercing Normal** | Normale Rüstungen              | max 4 Sockel, +12% pro        | gem_bonuses.suit         |
| **Piercing Baruna** | Baruna-Rüstungen               | max 4 Sockel, +18% pro        | gem_bonuses.suit         |
| **Costume Gems**    | CS-Helm/Rüst/Hand/Stief        | max 4 Sockel, Tier 1–4        | gem_bonuses.costume      |
| **Fusion**          | 2H-Waffen                      | +zweite Waffe ATK × 5%/Level  | Formel                   |
| **Job-Prefix**      | Baruna-Rüstungen               | 4 Stufen, klassenspezifisch   | job_prefixes.json        |

### Erweckbare Slots
Nur folgende Slots können Erweckungs-Boni tragen:
`weapon`, `shield`, `hat`, `suit`, `glove`, `boots`

---

## 12. Bekannte Lücken / nicht berechnete Stats

Diese Stats werden aus der Datenbank gelesen und **angezeigt** (im Item-Tooltip), aber fließen **nicht** in die Schadens-/Überlebens-Berechnung ein:

| Stat                | items.json Key                           | Anmerkung                            |
|---------------------|------------------------------------------|--------------------------------------|
| Angriffsgeschw.     | `Attackspeed`, `Attackspeed Rate`        | beeinflusst Angriffe/s, nicht DMG/Treffer |
| Bewegungsgeschw.    | `Speed`, `Locomotion`                   |                                      |
| Trefferrate         | `Hit Rate`, `Hawkeye Rate`              |                                      |
| Ausweichen/Block    | `Block Melee`, `Block Range`, `Parry`   | Parry wird als flat DEF addiert      |
| Monster-DMG%        | `Monster Dmg`                           | würde DMG vs Monster erhöhen        |
| PvP-DMG%            | `Pvp Dmg`, `Pvp Dmg Rate`              |                                      |
| Lifesteal           | `Melee Stealhp`, `Kill Hp`             |                                      |
| EXP-Bonus           | `Experience`                            |                                      |
| Drop-Rate-Bonus     | `Drop Item Allgrade Rate`              |                                      |
| Magieresistenz      | `Magic RES`                             |                                      |
| Element-DMG         | `Give Pve Dmg Element *`               |                                      |
| Element-Meisterschaft| `Mastry Fire/Wind/Electricity`         |                                      |
| Zauberrate          | `Spell Rate`                            | erhöht Magie-DMG                    |
| Reflexionsschaden   | `Reflect DMG`                           |                                      |
| Waffentyp-DMG       | `Swd Dmg`, `Axe Dmg`, `Bow Dmg`, `Yoy Dmg` |                               |

> Diese Stats könnten in zukünftigen Versionen in `ComputedStats` ergänzt werden.
