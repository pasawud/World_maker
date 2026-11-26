import { DEFAULT_GEOGRAPHY_CONFIG, generateWorld } from './worldGenerator';
import { formatElevationMeters } from './elevation';
import {
  DiplomaticRelation,
  DiplomaticRelationType,
  HexCoord,
  HexMapData,
  WikiCategory,
} from '../types/map';

export const DIPLOMACY_STATUS_META: Record<
  DiplomaticRelationType,
  { labelTh: string; color: string; short: string }
> = {
  ally: { labelTh: 'พันธมิตร', color: '#22c55e', short: 'พันธมิตร' },
  trade: { labelTh: 'สนธิสัญญาค้าขาย', color: '#f59e0b', short: 'การค้า' },
  neutral: { labelTh: 'เป็นกลาง', color: '#94a3b8', short: 'กลาง' },
  rival: { labelTh: 'คู่แข่งตึงเครียด', color: '#f97316', short: 'คู่แข่ง' },
  war: { labelTh: 'ทำสงคราม', color: '#ef4444', short: 'สงคราม' },
  vassal: { labelTh: 'รัฐบรรณาการ', color: '#a855f7', short: 'บรรณาการ' },
};

export const WIKI_CATEGORY_META: Record<
  WikiCategory,
  { labelTh: string; icon: string }
> = {
  character: { labelTh: 'ตัวละคร / วีรชน', icon: '👤' },
  faction: { labelTh: 'องค์กร / กิลด์ / ราชวงศ์', icon: '🛡️' },
  species: { labelTh: 'เผ่าพันธุ์ / สิ่งมีชีวิต', icon: '🧬' },
  legend: { labelTh: 'ตำนาน / นิทานปรัมปรา', icon: '📜' },
  history: { labelTh: 'ประวัติศาสตร์', icon: '⏳' },
  artifact: { labelTh: 'สิ่งประดิษฐ์ / ศาสตราวุธ', icon: '⚔️' },
  location: { labelTh: 'สถานที่พิเศษ', icon: '🗺️' },
};

function canonicalPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function getDiplomaticRelation(
  relations: DiplomaticRelation[] | undefined,
  kingdomA: string,
  kingdomB: string
): DiplomaticRelation | null {
  if (!relations || kingdomA === kingdomB) return null;
  const [a, b] = canonicalPair(kingdomA, kingdomB);
  return (
    relations.find(
      (r) =>
        (r.kingdomA === a && r.kingdomB === b) ||
        (r.kingdomA === b && r.kingdomB === a)
    ) ?? null
  );
}

export function upsertDiplomaticRelation(
  relations: DiplomaticRelation[] | undefined,
  kingdomA: string,
  kingdomB: string,
  status: DiplomaticRelationType,
  notes?: string
): DiplomaticRelation[] {
  if (kingdomA === kingdomB) return relations ?? [];
  const [a, b] = canonicalPair(kingdomA, kingdomB);
  const existing = (relations ?? []).filter(
    (r) =>
      !(
        (r.kingdomA === a && r.kingdomB === b) ||
        (r.kingdomA === b && r.kingdomB === a)
      )
  );
  if (status === 'neutral' && (!notes || !notes.trim())) {
    return existing;
  }
  return [
    ...existing,
    {
      id: `dip_${a}_${b}`,
      kingdomA: a,
      kingdomB: b,
      status,
      notes: notes?.trim() || undefined,
    },
  ];
}

export interface MentionTarget {
  name: string;
  kind: 'city' | 'kingdom' | 'religion' | 'culture' | 'poi' | 'wiki';
  id: string;
  coord?: HexCoord;
}

export function collectMentionTargets(map: HexMapData): MentionTarget[] {
  const list: MentionTarget[] = [];
  for (const c of map.cities) {
    list.push({ name: c.name, kind: 'city', id: c.id, coord: { q: c.q, r: c.r } });
  }
  for (const k of map.kingdoms) {
    const cap =
      (k.details?.capitalCityId && map.cities.find((c) => c.id === k.details?.capitalCityId)) ||
      map.cities.find((c) => c.kingdomId === k.id);
    list.push({
      name: k.name,
      kind: 'kingdom',
      id: k.id,
      coord: cap ? { q: cap.q, r: cap.r } : undefined,
    });
  }
  for (const r of map.religionList) {
    const city = map.cities.find((c) => c.religionId === r.id);
    list.push({
      name: r.name,
      kind: 'religion',
      id: r.id,
      coord: city ? { q: city.q, r: city.r } : undefined,
    });
  }
  for (const cu of map.cultureList ?? []) {
    const city = map.cities.find((c) => c.cultureId === cu.id);
    list.push({
      name: cu.name,
      kind: 'culture',
      id: cu.id,
      coord: city ? { q: city.q, r: city.r } : undefined,
    });
  }
  for (const p of map.pois) {
    list.push({ name: p.name, kind: 'poi', id: p.id, coord: { q: p.q, r: p.r } });
  }
  for (const w of map.wikiEntries ?? []) {
    list.push({ name: w.title, kind: 'wiki', id: w.id, coord: w.linkedCoord });
  }
  // Longer names first so substring collisions match accurately
  return list.sort((a, b) => b.name.length - a.name.length);
}

export interface MentionToken {
  text: string;
  mention?: MentionTarget;
}

/** Split text containing @EntityName references into clickable mention tokens. */
export function parseWikiMentions(text: string, map: HexMapData): MentionToken[] {
  if (!text) return [];
  const targets = collectMentionTargets(map);
  const tokens: MentionToken[] = [];
  let i = 0;
  let plainStart = 0;

  while (i < text.length) {
    if (text[i] === '@') {
      const rest = text.slice(i + 1);
      const matched = targets.find((t) => rest.startsWith(t.name));
      if (matched) {
        if (i > plainStart) {
          tokens.push({ text: text.slice(plainStart, i) });
        }
        tokens.push({ text: `@${matched.name}`, mention: matched });
        i += 1 + matched.name.length;
        plainStart = i;
        continue;
      }
    }
    i++;
  }
  if (plainStart < text.length) {
    tokens.push({ text: text.slice(plainStart) });
  }
  return tokens;
}

/** Export complete worldbuilding compendium as Markdown. */
export function exportLorebookMarkdown(map: HexMapData): string {
  const lines: string[] = [];
  const maxElev = map.elevation.reduce((m, v) => (v > m ? v : m), -1);
  const minElev = map.elevation.reduce((m, v) => (v < m ? v : m), 1);

  lines.push(`# ${map.name} — World Lorebook`);
  lines.push('');
  lines.push(`- **ขนาดแผนที่**: ${map.width} × ${map.height} ช่อง (${map.hexSizeKm} กม./ช่อง)`);
  lines.push(`- **พิกัด**: Lat ${map.geography.latSouth}°..${map.geography.latNorth}° · Lon ${map.geography.lonWest ?? -180}°..${map.geography.lonEast ?? 180}°`);
  lines.push(`- **ช่วงระดับความสูง**: ${formatElevationMeters(minElev)} ถึง ${formatElevationMeters(maxElev)}`);
  lines.push(`- **จำนวนเมือง / อาณาจักร**: ${map.cities.length} เมือง / ${map.kingdoms.length} อาณาจักร`);
  lines.push('');

  lines.push('## อาณาจักรและการปกครอง');
  for (const k of map.kingdoms) {
    lines.push(`### ${k.name} (${k.government})`);
    if (k.description) lines.push(k.description);
    if (k.details?.rulerTitle || k.details?.rulerName) {
      lines.push(`- **ผู้ปกครอง**: ${k.details.rulerTitle ?? ''} ${k.details.rulerName ?? ''}`.trim());
    }
    if (k.details?.motto) lines.push(`- **คำขวัญ**: "${k.details.motto}"`);
    const kCities = map.cities.filter((c) => c.kingdomId === k.id);
    if (kCities.length > 0) {
      lines.push(`- **เมืองในปกครอง**: ${kCities.map((c) => `${c.name} (${c.population.toLocaleString()})`).join(', ')}`);
    }
    lines.push('');
  }

  if ((map.diplomacy ?? []).length > 0) {
    lines.push('## ความสัมพันธ์ทางการทูต');
    for (const d of map.diplomacy!) {
      const ka = map.kingdoms.find((k) => k.id === d.kingdomA)?.name ?? d.kingdomA;
      const kb = map.kingdoms.find((k) => k.id === d.kingdomB)?.name ?? d.kingdomB;
      const meta = DIPLOMACY_STATUS_META[d.status];
      lines.push(`- **${ka} ↔ ${kb}**: ${meta.labelTh}${d.notes ? ` — ${d.notes}` : ''}`);
    }
    lines.push('');
  }

  if ((map.campaigns ?? []).length > 0) {
    lines.push('## ยุทธการและการเคลื่อนทัพ');
    for (const cp of map.campaigns!) {
      const kName = map.kingdoms.find((k) => k.id === cp.kingdomId)?.name ?? cp.kingdomId;
      lines.push(`- **${cp.name}** (${kName} · สถานะ: ${cp.status}) — เส้นทาง ${cp.points.length} จุด`);
    }
    lines.push('');
  }

  lines.push('## ศาสนาและวัฒนธรรม');
  for (const r of map.religionList) {
    lines.push(`- ${r.symbol} **${r.name}** (${r.type}): ${r.description ?? ''}`);
  }
  for (const cu of map.cultureList ?? []) {
    lines.push(`- ${cu.symbol} **${cu.name}** (${cu.type}): ${cu.description ?? ''}`);
  }
  lines.push('');

  if ((map.wikiEntries ?? []).length > 0) {
    lines.push('## สารานุกรมโลก (Wiki)');
    for (const w of map.wikiEntries!) {
      const cat = WIKI_CATEGORY_META[w.category];
      lines.push(`### ${cat.icon} ${w.title} [${cat.labelTh}]`);
      if (w.summary) lines.push(`> ${w.summary}`);
      if (w.linkedCoord) lines.push(`- พิกัดบนแผนที่: (${w.linkedCoord.q}, ${w.linkedCoord.r})`);
      if (w.content) lines.push('', w.content);
      if (w.tags.length > 0) lines.push('', `แท็ก: ${w.tags.map((t) => `#${t}`).join(' ')}`);
      lines.push('');
    }
  }

  if (map.timeline && map.timeline.events.length > 0) {
    lines.push('## ไทม์ไลน์ประวัติศาสตร์');
    const sorted = [...map.timeline.events].sort((a, b) => a.year - b.year);
    for (const ev of sorted) {
      lines.push(`- **ปี ${ev.year} (${ev.category})**: ${ev.title} — ${ev.description}`);
    }
  }

  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Export styled standalone HTML Lorebook. */
export function exportLorebookHtml(map: HexMapData): string {
  const md = exportLorebookMarkdown(map);
  const bodyHtml = md
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith('> ')) return `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
      if (line.startsWith('- ')) return `<li>${escapeHtml(line.slice(2))}</li>`;
      if (!line.trim()) return '<br/>';
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(map.name)} — Lorebook</title>
<style>
  body { font-family: Georgia, 'Sarabun', serif; background: #141820; color: #e5e7eb; max-width: 860px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.7; }
  h1, h2, h3 { color: #f3c87a; border-bottom: 1px solid #2b3444; padding-bottom: 0.25rem; }
  blockquote { border-left: 3px solid #d99b38; margin: 0.6rem 0; padding: 0.3rem 0.9rem; background: #1b2230; color: #cbd5e1; }
  li { margin-left: 1.2rem; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function createSampleWorldWithDefaults(name: string): HexMapData {
  return generateWorld(120, 80, 30, DEFAULT_GEOGRAPHY_CONFIG, name);
}
