import { computeRealDimensions, hexIndex } from './hexMath';
import { computeRealmEconomics, detectStrategicChokepoints } from './strategy';
import { HexMapData } from '../types/map';

/**
 * Export the current map's continuous elevation as a clean grayscale Heightmap PNG (0..255)
 * suitable for Blender, Unreal Engine, Unity, or Wonderdraft.
 */
export function exportHeightmapPng(
  map: HexMapData,
  options: { scale?: number; seaZeroBaseline?: boolean } = {}
): string {
  const scale = Math.max(1, Math.min(8, Math.round(options.scale ?? 4)));
  const canvas = document.createElement('canvas');
  canvas.width = map.width * scale;
  canvas.height = map.height * scale;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < map.height; r++) {
    for (let q = 0; q < map.width; q++) {
      const idx = hexIndex(q, r, map.width);
      const e = map.elevation[idx] ?? 0;
      const norm = options.seaZeroBaseline
        ? e <= 0
          ? 0
          : Math.min(1, e)
        : Math.max(0, Math.min(1, (e + 1) * 0.5));
      const v = Math.round(norm * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(q * scale, r * scale, scale, scale);
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Export Universal VTT / Foundry VTT / Roll20 compatible hex grid metadata & landmarks JSON.
 */
export function exportVttGridJson(map: HexMapData): string {
  const dims = computeRealDimensions(map.width, map.height, map.hexSizeKm);
  const chokepoints = detectStrategicChokepoints(map, 24);
  const payload = {
    schema: 'hex-worldmaker-vtt-v1',
    name: map.name,
    grid: {
      type: 'pointy_odd_r_hex',
      columns: map.width,
      rows: map.height,
      hexSizeKm: map.hexSizeKm,
      worldWidthKm: Math.round(dims.widthKm),
      worldHeightKm: Math.round(dims.heightKm),
    },
    geography: {
      latNorth: map.geography.latNorth,
      latSouth: map.geography.latSouth,
      lonWest: map.geography.lonWest ?? -180,
      lonEast: map.geography.lonEast ?? 180,
      windMode: map.geography.windMode,
    },
    cities: map.cities.map((c) => ({
      id: c.id,
      name: c.name,
      q: c.q,
      r: c.r,
      tier: c.tier,
      population: c.population,
      kingdomId: c.kingdomId,
    })),
    pois: map.pois,
    chokepoints,
    kingdoms: map.kingdoms.map((k) => ({ id: k.id, name: k.name, color: k.color })),
    labels: map.labels,
  };
  return JSON.stringify(payload, null, 2);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Export a self-contained single-file Interactive HTML Web Atlas with smooth pan/zoom,
 * searchable Cities/Kingdoms/Chokepoints/Wiki, and click-to-inspect details.
 */
export function exportInteractiveAtlasHtml(map: HexMapData, mapImageDataUrl: string): string {
  const econ = computeRealmEconomics(map);
  const chokepoints = detectStrategicChokepoints(map, 20);
  const dims = computeRealDimensions(map.width, map.height, map.hexSizeKm);

  const atlasPayload = {
    name: map.name,
    width: map.width,
    height: map.height,
    hexSizeKm: map.hexSizeKm,
    dimsKm: { w: Math.round(dims.widthKm), h: Math.round(dims.heightKm) },
    cities: map.cities.map((c) => ({
      id: c.id,
      name: c.name,
      q: c.q,
      r: c.r,
      tier: c.tier,
      pop: c.population,
      kingdom: map.kingdoms.find((k) => k.id === c.kingdomId)?.name ?? '',
      notes: c.notes,
    })),
    kingdoms: econ,
    chokepoints,
    wiki: (map.wikiEntries ?? []).map((w) => ({
      id: w.id,
      title: w.title,
      category: w.category,
      summary: w.summary,
      content: w.content,
    })),
  };

  const safeJson = JSON.stringify(atlasPayload).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(map.name)} — Interactive Web Atlas</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, 'Sarabun', sans-serif; background: #0b121c; color: #e2e8f0; display: flex; height: 100vh; overflow: hidden; }
    aside { width: 320px; background: #111a27; border-right: 1px solid #1e293b; display: flex; flex-direction: column; flex-shrink: 0; }
    header { padding: 14px 16px; border-bottom: 1px solid #1e293b; }
    header h1 { margin: 0; font-size: 16px; color: #fcd34d; }
    header p { margin: 4px 0 0; font-size: 11px; color: #94a3b8; }
    .search { padding: 10px 12px; border-bottom: 1px solid #1e293b; }
    .search input { width: 100%; background: #0b121c; border: 1px solid #334155; border-radius: 6px; padding: 6px 10px; color: #f8fafc; font-size: 12px; }
    .list { flex: 1; overflow-y: auto; padding: 10px 12px; font-size: 12px; }
    .sec { font-size: 11px; font-weight: 700; color: #fbbf24; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .card { background: #162233; border: 1px solid #1e293b; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; cursor: pointer; }
    .card:hover { border-color: #d99b38; }
    main { flex: 1; position: relative; overflow: hidden; background: #070d15; cursor: grab; }
    main:active { cursor: grabbing; }
    #stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
    #stage img { display: block; user-select: none; -webkit-user-drag: none; }
    .hud { position: absolute; right: 14px; bottom: 14px; background: rgba(15,23,42,0.88); border: 1px solid #334155; border-radius: 8px; padding: 6px 10px; font-size: 11px; color: #cbd5e1; display: flex; gap: 8px; align-items: center; }
    .hud button { background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 4px; padding: 3px 8px; cursor: pointer; }
  </style>
</head>
<body>
  <aside>
    <header>
      <h1>${escapeHtml(map.name)}</h1>
      <p>${map.width} × ${map.height} ช่อง · ${Math.round(dims.widthKm).toLocaleString()} × ${Math.round(dims.heightKm).toLocaleString()} กม.</p>
    </header>
    <div class="search">
      <input id="q" placeholder="ค้นหาเมือง อาณาจักร จุดคอขวด หรือ Wiki..." />
    </div>
    <div class="list" id="sidebarList"></div>
  </aside>
  <main id="viewport">
    <div id="stage"><img id="atlasImg" src="${mapImageDataUrl}" alt="${escapeHtml(map.name)}" /></div>
    <div class="hud">
      <span>ลากเพื่อเลื่อน · Scroll เพื่อซูม</span>
      <button id="fitBtn">พอดีจอ</button>
    </div>
  </main>
  <script>
    const DATA = ${safeJson};
    const vp = document.getElementById('viewport');
    const stage = document.getElementById('stage');
    const img = document.getElementById('atlasImg');
    const list = document.getElementById('sidebarList');
    const qInput = document.getElementById('q');
    let scale = 0.6, tx = 20, ty = 20, drag = false, sx = 0, sy = 0;

    function apply() { stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
    function fit() {
      if (!img.naturalWidth) return;
      scale = Math.min(vp.clientWidth / img.naturalWidth, vp.clientHeight / img.naturalHeight) * 0.94;
      tx = (vp.clientWidth - img.naturalWidth * scale) / 2;
      ty = (vp.clientHeight - img.naturalHeight * scale) / 2;
      apply();
    }
    img.onload = fit;
    document.getElementById('fitBtn').onclick = fit;
    vp.onwheel = (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.12 : 0.89;
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const wx = (mx - tx) / scale, wy = (my - ty) / scale;
      scale = Math.max(0.15, Math.min(4, scale * f));
      tx = mx - wx * scale; ty = my - wy * scale;
      apply();
    };
    vp.onmousedown = (e) => { drag = true; sx = e.clientX - tx; sy = e.clientY - ty; };
    window.onmousemove = (e) => { if (!drag) return; tx = e.clientX - sx; ty = e.clientY - sy; apply(); };
    window.onmouseup = () => { drag = false; };

    function render(filter) {
      const f = (filter || '').toLowerCase();
      let html = '';
      const cities = DATA.cities.filter((c) => !f || c.name.toLowerCase().includes(f) || c.kingdom.toLowerCase().includes(f));
      if (cities.length) {
        html += '<div class="sec">เมือง (' + cities.length + ')</div>';
        cities.forEach((c) => {
          html += '<div class="card"><b>' + c.name + '</b> <span style="color:#94a3b8">(' + c.tier + ' · ' + c.pop.toLocaleString() + ')</span><div style="color:#cbd5e1;margin-top:2px">' + (c.kingdom ? '👑 ' + c.kingdom + ' · ' : '') + 'พิกัด (' + c.q + ',' + c.r + ')</div></div>';
        });
      }
      const kds = DATA.kingdoms.filter((k) => !f || k.kingdomName.toLowerCase().includes(f));
      if (kds.length) {
        html += '<div class="sec">อาณาจักร & กำลังพล</div>';
        kds.forEach((k) => {
          html += '<div class="card"><b>' + k.kingdomName + '</b><div style="color:#94a3b8;margin-top:2px">ประชากร ' + k.population.toLocaleString() + ' · กำลังพล ' + k.standingArmy.toLocaleString() + ' · รายได้ +' + k.totalTreasuryIncome.toLocaleString() + 'g</div></div>';
        });
      }
      const wikis = DATA.wiki.filter((w) => !f || w.title.toLowerCase().includes(f) || w.content.toLowerCase().includes(f));
      if (wikis.length) {
        html += '<div class="sec">สารานุกรม (' + wikis.length + ')</div>';
        wikis.forEach((w) => {
          html += '<div class="card"><b>' + w.title + '</b><div style="color:#cbd5e1;margin-top:4px;white-space:pre-wrap">' + w.content + '</div></div>';
        });
      }
      list.innerHTML = html || '<div style="color:#64748b;padding:12px">ไม่พบข้อมูลที่ค้นหา</div>';
    }
    qInput.oninput = (e) => render(e.target.value);
    render('');
  </script>
</body>
</html>`;
}
