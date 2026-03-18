import type { FlyffItem, SetEffectsDB } from '../types';

interface Props {
  item: FlyffItem;
  setEffects: SetEffectsDB | null;
  allItems: FlyffItem[];
}

export function SetEffectPanel({ item, setEffects, allItems }: Props) {
  if (!item.isSet) return null;

  const family = item.setFamily;
  const effect = setEffects?.[family] ?? null;

  // Build member item list
  const memberItems = item.setMembers
    .map(id => allItems.find(i => i.id === id))
    .filter((i): i is FlyffItem => !!i);

  // Deduplicate by slot only – M and F variants of the same slot count as one piece.
  // Prefer the item matching the current item's gender, otherwise take the first found.
  const currentGender = item.id.includes('_F_') ? '_F_' : '_M_';
  const slotMap = new Map<string, FlyffItem>();
  for (const m of [item, ...memberItems]) {
    const slot = m.slot || m.id;
    if (!slotMap.has(slot)) {
      slotMap.set(slot, m);
    } else if (m.id.includes(currentGender)) {
      // Prefer same-gender variant
      slotMap.set(slot, m);
    }
  }
  const uniqueMembers = Array.from(slotMap.values());

  return (
    <div className="bg-gray-900 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-yellow-400">
          {effect?.name ?? family.replace(/_/g, ' ')}
        </span>
        <span className="text-xs text-gray-500">{uniqueMembers.length} pieces</span>
      </div>

      {/* Set members list */}
      <div className="flex flex-col gap-0.5">
        {uniqueMembers.map(m => (
          <div key={m.id} className={`text-xs ${m.id === item.id ? 'text-yellow-300' : 'text-gray-400'}`}>
            {m.id === item.id ? '▶ ' : '  '}{m.slot} – {m.name}
          </div>
        ))}
      </div>

      {/* Set bonuses */}
      {effect ? (
        <div className="mt-1 flex flex-col gap-2">
          {effect.bonuses.map(tier => (
            <div key={tier.pieces} className="border-l-2 border-yellow-600/50 pl-2">
              <div className="text-xs font-semibold text-yellow-500 mb-0.5">{tier.pieces}/{uniqueMembers.length} Set</div>
              {tier.effects.map((eff, i) => (
                <div key={i} className="text-xs text-green-400">
                  {eff.stat} +{eff.value}{eff.unit}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-600 italic mt-1">
          Set effects not yet defined for this set.
        </div>
      )}
    </div>
  );
}
