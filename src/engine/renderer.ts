import { getAllBiomes, getBiomeMetaWithCustom } from '../data/biomes';
import { getFeatureMeta } from '../data/features';
import { getAllPoiTypes, GOVERNMENT_TYPES } from '../data/goods';
import {
  BiomeDetailStyle,
  BiomeId,
  City,
  ClimateOverlay,
  HexCoord,
  HexMapData,
  LayerVisibility,
  ToolMode,
} from '../types/map';
import { getCliffEdges } from './cliffs';
import {
  getNeighborsWithEdge,
  hexIndex,
  hexToPixel,
  isWaterBiome,
  SQRT3,
} from './hexMath';
import { getPrevailingWindDir, getRowLatitude } from './worldGenerator';

export const BASE_HEX_RADIUS = 18;
export const CHUNK_SIZE = 16;

function hash2D(q: number, r: number): number {
  let h = (q * 374761393 + r * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  if (!Number.isFinite(n)) return [120, 130, 140];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const cl = Math.max(0, Math.min(1, t));
  const r = Math.round(a[0] + (b[0] - a[0]) * cl);
  const g = Math.round(a[1] + (b[1] - a[1]) * cl);
  const bl = Math.round(a[2] + (b[2] - a[2]) * cl);
  return `rgb(${r},${g},${bl})`;
}

function elevationColor(e: number): string {
  if (e <= -0.35) return '#122c47';
  if (e <= 0) return mixRgb([24, 66, 108], [58, 128, 168], (e + 0.35) / 0.35);
  if (e <= 0.25) return mixRgb([72, 134, 72], [174, 184, 96], e / 0.25);
  if (e <= 0.55) return mixRgb([174, 184, 96], [148, 102, 66], (e - 0.25) / 0.3);
  if (e <= 0.78) return mixRgb([148, 102, 66], [190, 182, 174], (e - 0.55) / 0.23);
  return '#f2f6fa';
}

function temperatureColor(t: number): string {
  const norm = Math.max(0, Math.min(1, (t + 22) / 56));
  if (norm < 0.25) return mixRgb([36, 72, 168], [56, 176, 214], norm / 0.25);
  if (norm < 0.5) return mixRgb([56, 176, 214], [108, 198, 92], (norm - 0.25) / 0.25);
  if (norm < 0.75) return mixRgb([108, 198, 92], [242, 186, 60], (norm - 0.5) / 0.25);
  return mixRgb([242, 186, 60], [214, 58, 42], (norm - 0.75) / 0.25);
}

function moistureColor(m: number): string {
  const cl = Math.max(0, Math.min(1, m));
  if (cl < 0.28) return mixRgb([186, 132, 68], [216, 194, 114], cl / 0.28);
  if (cl < 0.58) return mixRgb([216, 194, 114], [82, 166, 94], (cl - 0.28) / 0.3);
  return mixRgb([82, 166, 94], [24, 132, 168], (cl - 0.58) / 0.42);
}

function hexVertex(cx: number, cy: number, radius: number, idx: number): [number, number] {
  const angle = (Math.PI / 180) * (60 * (idx % 6) - 30);
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function traceHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const [px, py] = hexVertex(cx, cy, radius, i);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Draw stylized cartographic details inside a hex tile (including fantasy custom biome patterns). */
export function drawBiomeDetail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  style: BiomeDetailStyle | string,
  seed: number
): void {
  const r = radius;
  switch (style) {
    case 'pine': {
      const offsets = [
        [-0.36, 0.14],
        [0.02, -0.22],
        [0.34, 0.18],
      ];
      for (let i = 0; i < offsets.length; i++) {
        const tx = cx + offsets[i][0] * r + (seed - 0.5) * r * 0.12;
        const ty = cy + offsets[i][1] * r;
        ctx.fillStyle = '#1b352a';
        ctx.beginPath();
        ctx.moveTo(tx, ty - r * 0.32);
        ctx.lineTo(tx - r * 0.2, ty + r * 0.14);
        ctx.lineTo(tx + r * 0.2, ty + r * 0.14);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'leafy': {
      const spots = [
        [-0.32, 0.1],
        [0.06, -0.2],
        [0.3, 0.16],
        [-0.08, 0.22],
      ];
      for (let i = 0; i < spots.length; i++) {
        const tx = cx + spots[i][0] * r;
        const ty = cy + spots[i][1] * r;
        ctx.fillStyle = i % 2 === 0 ? '#31542d' : '#588546';
        ctx.beginPath();
        ctx.arc(tx, ty, r * 0.19, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'jungle': {
      const spots = [
        [-0.3, -0.05],
        [0.12, -0.22],
        [0.32, 0.12],
        [-0.1, 0.22],
        [0.05, 0.02],
      ];
      for (let i = 0; i < spots.length; i++) {
        const tx = cx + spots[i][0] * r;
        const ty = cy + spots[i][1] * r;
        ctx.fillStyle = i % 2 === 0 ? '#1b4223' : '#35743f';
        ctx.beginPath();
        ctx.arc(tx, ty, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'hills': {
      ctx.strokeStyle = 'rgba(42, 34, 22, 0.45)';
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.beginPath();
      ctx.arc(cx - r * 0.16, cy + r * 0.14, r * 0.28, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.2, cy + r * 0.22, r * 0.22, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case 'mountain':
    case 'snow_peak': {
      const isSnow = style === 'snow_peak';
      ctx.fillStyle = isSnow ? '#8c9aa6' : '#53493e';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.56);
      ctx.lineTo(cx + r * 0.52, cy + r * 0.36);
      ctx.lineTo(cx, cy + r * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = isSnow ? '#dce5ec' : '#968978';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.56);
      ctx.lineTo(cx - r * 0.52, cy + r * 0.36);
      ctx.lineTo(cx, cy + r * 0.36);
      ctx.closePath();
      ctx.fill();
      if (isSnow) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.56);
        ctx.lineTo(cx - r * 0.22, cy - r * 0.16);
        ctx.lineTo(cx, cy - r * 0.08);
        ctx.lineTo(cx + r * 0.22, cy - r * 0.16);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'dunes': {
      ctx.strokeStyle = 'rgba(150, 108, 48, 0.45)';
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy - r * 0.05);
      ctx.quadraticCurveTo(cx, cy - r * 0.25, cx + r * 0.4, cy - r * 0.04);
      ctx.moveTo(cx - r * 0.35, cy + r * 0.22);
      ctx.quadraticCurveTo(cx + r * 0.05, cy + r * 0.05, cx + r * 0.38, cy + r * 0.22);
      ctx.stroke();
      break;
    }
    case 'swamp': {
      ctx.fillStyle = 'rgba(35, 86, 106, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.12, r * 0.34, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2d442d';
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.22, cy + r * 0.05);
      ctx.lineTo(cx - r * 0.26, cy - r * 0.22);
      ctx.moveTo(cx - r * 0.16, cy + r * 0.06);
      ctx.lineTo(cx - r * 0.12, cy - r * 0.18);
      ctx.stroke();
      break;
    }
    case 'tundra': {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.beginPath();
      ctx.arc(cx + (seed - 0.5) * r * 0.3, cy, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crystal': {
      const shards = [
        [-0.22, 0.18, 0.28],
        [0.14, 0.1, 0.34],
        [0.0, -0.1, 0.22],
      ];
      for (const [ox, oy, h] of shards) {
        const tx = cx + ox * r;
        const ty = cy + oy * r;
        ctx.fillStyle = 'rgba(186, 230, 253, 0.72)';
        ctx.beginPath();
        ctx.moveTo(tx, ty - h * r);
        ctx.lineTo(tx - r * 0.12, ty + r * 0.1);
        ctx.lineTo(tx + r * 0.12, ty + r * 0.1);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'lava': {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.85)';
      ctx.lineWidth = Math.max(1.2, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.35, cy - r * 0.2);
      ctx.lineTo(cx, cy + r * 0.05);
      ctx.lineTo(cx + r * 0.32, cy - r * 0.12);
      ctx.moveTo(cx, cy + r * 0.05);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
      ctx.stroke();
      break;
    }
    case 'mushroom': {
      const caps = [
        [-0.24, 0.15, '#c084fc'],
        [0.18, -0.05, '#38bdf8'],
      ];
      for (const [ox, oy, col] of caps) {
        const tx = cx + Number(ox) * r;
        const ty = cy + Number(oy) * r;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(tx - r * 0.05, ty, r * 0.1, r * 0.18);
        ctx.fillStyle = String(col);
        ctx.beginPath();
        ctx.arc(tx, ty, r * 0.18, Math.PI, 0);
        ctx.fill();
      }
      break;
    }
    case 'ruins_floor': {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = Math.max(0.8, r * 0.06);
      ctx.strokeRect(cx - r * 0.28, cy - r * 0.24, r * 0.24, r * 0.2);
      ctx.strokeRect(cx + r * 0.05, cy + r * 0.04, r * 0.24, r * 0.2);
      break;
    }
  }
}

/** Draw realistic cartographic escarpments, basalt rock faces, hachures, and coastal surf for cliffs. */
function drawCliffOverlay(
  ctx: CanvasRenderingContext2D,
  map: HexMapData,
  q: number,
  r: number,
  cx: number,
  cy: number,
  radius: number
): void {
  const dropEdges = getCliffEdges(map, q, r);
  if (dropEdges.length === 0) return;

  const dropSet = new Set(dropEdges);
  const nbs = getNeighborsWithEdge(q, r, map.width, map.height);

  ctx.save();
  for (const nb of nbs) {
    if (!dropSet.has(nb.edge)) continue;

    const [x1, y1] = hexVertex(cx, cy, radius + 0.3, nb.edge);
    const [x2, y2] = hexVertex(cx, cy, radius + 0.3, nb.edge + 1);
    const ix1 = x1 + (cx - x1) * 0.34;
    const iy1 = y1 + (cy - y1) * 0.34;
    const ix2 = x2 + (cx - x2) * 0.34;
    const iy2 = y2 + (cy - y2) * 0.34;

    const nbIsWater =
      nb.inMap && isWaterBiome(map.biomes[hexIndex(nb.q, nb.r, map.width)], map.customBiomes);

    // Subtle ocean drop-off shadow + white surf line when cliff drops straight into deep water
    if (nbIsWater) {
      const ox1 = x1 - (cx - x1) * 0.14;
      const oy1 = y1 - (cy - y1) * 0.14;
      const ox2 = x2 - (cx - x2) * 0.14;
      const oy2 = y2 - (cy - y2) * 0.14;

      ctx.fillStyle = 'rgba(10, 22, 36, 0.36)';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(ox2, oy2);
      ctx.lineTo(ox1, oy1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(195, 232, 255, 0.42)';
      ctx.lineWidth = Math.max(0.8, radius * 0.055);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1 + (ox1 - x1) * 0.38, y1 + (oy1 - y1) * 0.38);
      ctx.lineTo(x2 + (ox2 - x2) * 0.38, y2 + (oy2 - y2) * 0.38);
      ctx.stroke();
    }

    // Rock face polygon
    ctx.fillStyle = nbIsWater ? '#3a332d' : '#473e37';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(ix2, iy2);
    ctx.lineTo(ix1, iy1);
    ctx.closePath();
    ctx.fill();

    // Vertical rock hachures / striations
    ctx.lineCap = 'round';
    for (let s = 1; s <= 4; s++) {
      const t = s / 5;
      const sx1 = ix1 + (ix2 - ix1) * t;
      const sy1 = iy1 + (iy2 - iy1) * t;
      const sx2 = x1 + (x2 - x1) * t;
      const sy2 = y1 + (y2 - y1) * t;
      ctx.strokeStyle = s % 2 === 0 ? 'rgba(190, 178, 165, 0.35)' : '#1f1916';
      ctx.lineWidth = Math.max(0.9, radius * 0.065);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }

    // Upper crest highlight
    ctx.strokeStyle = '#cfc3b6';
    ctx.lineWidth = Math.max(1.1, radius * 0.075);
    ctx.beginPath();
    ctx.moveTo(ix1, iy1);
    ctx.lineTo(ix2, iy2);
    ctx.stroke();

    // Steep base shadow
    ctx.strokeStyle = '#1a1411';
    ctx.lineWidth = Math.max(1.4, radius * 0.095);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw distinct visual symbol/overlay for each of the special features. */
function drawSpecialFeature(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  featureId: string
): void {
  if (featureId === 'cliff') return;
  const meta = getFeatureMeta(featureId);
  if (!meta) return;
  const r = radius;

  ctx.save();
  // Soft tinted hex wash so special feature is recognizable at a glance
  traceHexPath(ctx, cx, cy, r * 0.88);
  ctx.fillStyle = `${meta.color}42`;
  ctx.fill();
  ctx.strokeStyle = `${meta.color}aa`;
  ctx.lineWidth = Math.max(0.9, r * 0.06);
  ctx.stroke();

  switch (featureId) {
    case 'oasis': {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.1, r * 0.3, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(cx - r * 0.18, cy - r * 0.12, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'coral_reef':
    case 'atoll': {
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = Math.max(1.2, r * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.36, 0.3, Math.PI * 1.85);
      ctx.stroke();
      break;
    }
    case 'volcanic_island':
    case 'volcanic_soil': {
      ctx.fillStyle = '#5c3c31';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.42);
      ctx.lineTo(cx - r * 0.38, cy + r * 0.28);
      ctx.lineTo(cx + r * 0.38, cy + r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.38, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'canyon':
    case 'cliff': {
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = Math.max(1.4, r * 0.11);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.38, cy - r * 0.15);
      ctx.lineTo(cx - r * 0.08, cy + r * 0.1);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.22);
      ctx.stroke();
      break;
    }
    case 'hot_springs':
    case 'lagoon': {
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.08, r * 0.32, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'salt_flats': {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.36, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      // Crisp colored cartographic diamond badge
      ctx.fillStyle = meta.color;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.26);
      ctx.lineTo(cx + r * 0.24, cy);
      ctx.lineTo(cx, cy + r * 0.26);
      ctx.lineTo(cx - r * 0.24, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export class ChunkedMapRenderer {
  private chunks = new Map<string, HTMLCanvasElement>();
  private lastMapId = '';
  private lastSizeKey = '';
  private lastOverlay: ClimateOverlay = 'none';
  private lastFlagsKey = '';

  public invalidateAll(): void {
    this.chunks.clear();
  }

  public invalidateHexes(hexes: HexCoord[]): void {
    const touched = new Set<string>();
    for (const h of hexes) {
      for (let dq = -1; dq <= 1; dq++) {
        for (let dr = -1; dr <= 1; dr++) {
          const cq = Math.floor((h.q + dq) / CHUNK_SIZE);
          const cr = Math.floor((h.r + dr) / CHUNK_SIZE);
          if (cq >= 0 && cr >= 0) touched.add(`${cq},${cr}`);
        }
      }
    }
    for (const key of touched) {
      this.chunks.delete(key);
    }
  }

  private getOrBuildChunk(
    map: HexMapData,
    cq: number,
    cr: number,
    overlay: ClimateOverlay,
    layers: LayerVisibility
  ): { canvas: HTMLCanvasElement; originX: number; originY: number } {
    const pad = BASE_HEX_RADIUS * 2;
    const startQ = cq * CHUNK_SIZE;
    const startR = cr * CHUNK_SIZE;
    const endQ = Math.min(map.width, startQ + CHUNK_SIZE);
    const endR = Math.min(map.height, startR + CHUNK_SIZE);

    const topLeft = hexToPixel(startQ, startR, BASE_HEX_RADIUS);
    const originX = topLeft.x - pad;
    const originY = topLeft.y - pad;

    const key = `${cq},${cr}`;
    const existing = this.chunks.get(key);
    if (existing) return { canvas: existing, originX, originY };

    const chunkW = Math.ceil(CHUNK_SIZE * SQRT3 * BASE_HEX_RADIUS + pad * 2.6);
    const chunkH = Math.ceil(CHUNK_SIZE * 1.5 * BASE_HEX_RADIUS + pad * 2.6);
    const canvas = document.createElement('canvas');
    canvas.width = chunkW;
    canvas.height = chunkH;
    const ctx = canvas.getContext('2d')!;

    const kingdomColorMap = new Map(map.kingdoms.map((k) => [k.id, k.color]));
    const religionColorMap = new Map(map.religionList.map((r) => [r.id, r.color]));

    for (let r = startR; r < endR; r++) {
      for (let q = startQ; q < endQ; q++) {
        const idx = hexIndex(q, r, map.width);
        const biomeId = map.biomes[idx];
        const meta = getBiomeMetaWithCustom(biomeId, map.customBiomes);
        const pos = hexToPixel(q, r, BASE_HEX_RADIUS);
        const lx = pos.x - originX;
        const ly = pos.y - originY;
        const rnd = hash2D(q, r);

        let fill = meta.color;
        if (overlay === 'elevation') {
          fill = elevationColor(map.elevation[idx] ?? 0);
        } else if (overlay === 'temperature') {
          fill = temperatureColor(map.temperature[idx] ?? 15);
        } else if (overlay === 'moisture') {
          fill = moistureColor(map.moisture[idx] ?? 0.5);
        } else {
          const rgb = hexToRgb(meta.color);
          const elevShift = ((map.elevation[idx] ?? 0) - 0.15) * 18;
          const delta = (rnd - 0.5) * 10 + (meta.isWater ? 0 : elevShift);
          fill = `rgb(${Math.max(0, Math.min(255, Math.round(rgb[0] + delta)))},${Math.max(
            0,
            Math.min(255, Math.round(rgb[1] + delta))
          )},${Math.max(0, Math.min(255, Math.round(rgb[2] + delta)))})`;
        }

        traceHexPath(ctx, lx, ly, BASE_HEX_RADIUS + 0.45);
        ctx.fillStyle = fill;
        ctx.fill();

        if (overlay === 'none' || overlay === 'political' || overlay === 'religion') {
          if (biomeId === BiomeId.SHALLOW_WATER) {
            const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
            let touchesNonCliffLand = false;
            ctx.save();
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.32)';
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            for (const nb of nbs) {
              if (!nb.inMap) continue;
              const nbIdx = hexIndex(nb.q, nb.r, map.width);
              const nbIsWater = isWaterBiome(map.biomes[nbIdx], map.customBiomes);
              if (!nbIsWater && map.features?.[nbIdx] !== 'cliff') {
                touchesNonCliffLand = true;
                const [x1, y1] = hexVertex(lx, ly, BASE_HEX_RADIUS - 0.5, nb.edge);
                const [x2, y2] = hexVertex(lx, ly, BASE_HEX_RADIUS - 0.5, nb.edge + 1);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
              }
            }
            ctx.restore();
            if (touchesNonCliffLand) {
              traceHexPath(ctx, lx, ly, BASE_HEX_RADIUS + 0.45);
              ctx.fillStyle = 'rgba(130, 210, 240, 0.14)';
              ctx.fill();
            }
          }
          if (overlay === 'none') {
            drawBiomeDetail(ctx, lx, ly, BASE_HEX_RADIUS, meta.detailStyle, rnd);
            if (layers.features && map.features?.[idx]) {
              if (map.features[idx] === 'cliff') {
                drawCliffOverlay(ctx, map, q, r, lx, ly, BASE_HEX_RADIUS);
              } else {
                drawSpecialFeature(ctx, lx, ly, BASE_HEX_RADIUS, map.features[idx]);
              }
            }
          }
        } else if (overlay === 'elevation' && layers.features && map.features?.[idx] === 'cliff') {
          ctx.save();
          ctx.globalAlpha = 0.7;
          drawCliffOverlay(ctx, map, q, r, lx, ly, BASE_HEX_RADIUS);
          ctx.restore();
        }

        // Political / Territory tint & borders
        const ownerId = map.territories?.[idx] ?? '';
        if (ownerId && (overlay === 'political' || layers.territories)) {
          const kCol = kingdomColorMap.get(ownerId);
          if (kCol) {
            traceHexPath(ctx, lx, ly, BASE_HEX_RADIUS + 0.2);
            ctx.fillStyle = overlay === 'political' ? `${kCol}90` : `${kCol}26`;
            ctx.fill();
          }
        }

        if (ownerId && (overlay === 'political' || layers.borders)) {
          const kCol = kingdomColorMap.get(ownerId) ?? '#f59e0b';
          const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
          ctx.strokeStyle = kCol;
          ctx.lineWidth = overlay === 'political' ? 2.6 : 1.8;
          ctx.lineCap = 'round';
          for (const nb of nbs) {
            const nbOwner = nb.inMap ? map.territories?.[hexIndex(nb.q, nb.r, map.width)] ?? '' : '';
            if (nbOwner !== ownerId) {
              const [x1, y1] = hexVertex(lx, ly, BASE_HEX_RADIUS - 0.5, nb.edge);
              const [x2, y2] = hexVertex(lx, ly, BASE_HEX_RADIUS - 0.5, nb.edge + 1);
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }
        }

        // Religion tint & dashed borders
        const relId = map.religions?.[idx] ?? '';
        if (relId && (overlay === 'religion' || layers.religions)) {
          const rCol = religionColorMap.get(relId);
          if (rCol) {
            traceHexPath(ctx, lx, ly, BASE_HEX_RADIUS + 0.2);
            ctx.fillStyle = overlay === 'religion' ? `${rCol}88` : `${rCol}30`;
            ctx.fill();

            const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
            ctx.save();
            ctx.strokeStyle = rCol;
            ctx.lineWidth = overlay === 'religion' ? 2.4 : 1.5;
            ctx.setLineDash([4, 3]);
            for (const nb of nbs) {
              const nbRel = nb.inMap ? map.religions?.[hexIndex(nb.q, nb.r, map.width)] ?? '' : '';
              if (nbRel !== relId) {
                const [x1, y1] = hexVertex(lx, ly, BASE_HEX_RADIUS - 1.2, nb.edge);
                const [x2, y2] = hexVertex(lx, ly, BASE_HEX_RADIUS - 1.2, nb.edge + 1);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
        }

        if (layers.grid) {
          traceHexPath(ctx, lx, ly, BASE_HEX_RADIUS);
          ctx.strokeStyle = 'rgba(12, 20, 30, 0.28)';
          ctx.lineWidth = 0.75;
          ctx.stroke();
        }
      }
    }

    this.chunks.set(key, canvas);
    return { canvas, originX, originY };
  }

  public renderViewport(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    map: HexMapData,
    cam: { x: number; y: number; zoom: number },
    options: {
      overlay: ClimateOverlay;
      layers: LayerVisibility;
      hoverHex: HexCoord | null;
      brushRadius: number;
      tool: ToolMode;
      selectedCityId: string | null;
      tradeStartCityId: string | null;
      draftPath: HexCoord[];
      previewPath?: { hexes: HexCoord[]; valid: boolean } | null;
      measurePoints: HexCoord[];
    }
  ): void {
    const sizeKey = `${map.width}x${map.height}`;
    const flagsKey = `${options.layers.grid}_${options.layers.features}_${options.layers.territories}_${options.layers.borders}_${options.layers.religions}_${map.customBiomes.length}`;
    if (
      map.id !== this.lastMapId ||
      sizeKey !== this.lastSizeKey ||
      options.overlay !== this.lastOverlay ||
      flagsKey !== this.lastFlagsKey
    ) {
      this.chunks.clear();
      this.lastMapId = map.id;
      this.lastSizeKey = sizeKey;
      this.lastOverlay = options.overlay;
      this.lastFlagsKey = flagsKey;
    }

    ctx.fillStyle = '#0e1926';
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const halfW = viewW / (2 * cam.zoom);
    const halfH = viewH / (2 * cam.zoom);
    const minWX = cam.x - halfW - BASE_HEX_RADIUS * 4;
    const maxWX = cam.x + halfW + BASE_HEX_RADIUS * 4;
    const minWY = cam.y - halfH - BASE_HEX_RADIUS * 4;
    const maxWY = cam.y + halfH + BASE_HEX_RADIUS * 4;

    const totalChunksX = Math.ceil(map.width / CHUNK_SIZE);
    const totalChunksY = Math.ceil(map.height / CHUNK_SIZE);
    const chunkPixelW = CHUNK_SIZE * SQRT3 * BASE_HEX_RADIUS;
    const chunkPixelH = CHUNK_SIZE * 1.5 * BASE_HEX_RADIUS;

    const cStartX = Math.max(0, Math.floor(minWX / chunkPixelW) - 1);
    const cEndX = Math.min(totalChunksX - 1, Math.ceil(maxWX / chunkPixelW) + 1);
    const cStartY = Math.max(0, Math.floor(minWY / chunkPixelH) - 1);
    const cEndY = Math.min(totalChunksY - 1, Math.ceil(maxWY / chunkPixelH) + 1);

    for (let cr = cStartY; cr <= cEndY; cr++) {
      for (let cq = cStartX; cq <= cEndX; cq++) {
        const { canvas, originX, originY } = this.getOrBuildChunk(
          map,
          cq,
          cr,
          options.overlay,
          options.layers
        );
        ctx.drawImage(canvas, originX, originY);
      }
    }

    const mapPixelW = map.width * SQRT3 * BASE_HEX_RADIUS + BASE_HEX_RADIUS;
    const mapPixelH = map.height * 1.5 * BASE_HEX_RADIUS + BASE_HEX_RADIUS;
    ctx.strokeStyle = 'rgba(217, 155, 56, 0.35)';
    ctx.lineWidth = Math.max(1.5, 2 / cam.zoom);
    ctx.strokeRect(-BASE_HEX_RADIUS, -BASE_HEX_RADIUS, mapPixelW, mapPixelH);

    drawDynamicLayers(ctx, map, cam.zoom, options);

    ctx.restore();
  }
}

function drawCentroidLabels(
  ctx: CanvasRenderingContext2D,
  map: HexMapData,
  assignments: string[],
  items: { id: string; name: string; color: string; sub?: string }[],
  zoom: number
): void {
  const acc = new Map<string, { sumX: number; sumY: number; count: number }>();
  for (let r = 0; r < map.height; r++) {
    for (let q = 0; q < map.width; q++) {
      const id = assignments[hexIndex(q, r, map.width)];
      if (!id) continue;
      const p = hexToPixel(q, r, BASE_HEX_RADIUS);
      const cur = acc.get(id);
      if (cur) {
        cur.sumX += p.x;
        cur.sumY += p.y;
        cur.count++;
      } else {
        acc.set(id, { sumX: p.x, sumY: p.y, count: 1 });
      }
    }
  }

  const fontSize = Math.max(12, Math.min(24, Math.round(14 / Math.max(0.45, zoom * 0.8))));
  for (const item of items) {
    const stat = acc.get(item.id);
    if (!stat || stat.count < 3) continue;
    const cx = stat.sumX / stat.count;
    const cy = stat.sumY / stat.count;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${fontSize}px Cinzel, Sarabun, serif`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(item.name, cx, cy);

    if (item.sub) {
      ctx.font = `500 ${Math.max(10, fontSize - 4)}px Sarabun, sans-serif`;
      ctx.fillStyle = item.color;
      ctx.fillText(item.sub, cx, cy + fontSize * 0.95);
    }
    ctx.restore();
  }
}

function drawDynamicLayers(
  ctx: CanvasRenderingContext2D,
  map: HexMapData,
  zoom: number,
  options: {
    overlay: ClimateOverlay;
    layers: LayerVisibility;
    hoverHex: HexCoord | null;
    brushRadius: number;
    tool: ToolMode;
    selectedCityId: string | null;
    tradeStartCityId: string | null;
    draftPath: HexCoord[];
    previewPath?: { hexes: HexCoord[]; valid: boolean } | null;
    measurePoints: HexCoord[];
  }
): void {
  const { layers } = options;

  // 1. Prevailing wind arrows on climate overlays
  if (options.overlay === 'moisture' || options.overlay === 'temperature') {
    const stepR = Math.max(8, Math.floor(map.height / 7));
    const stepQ = Math.max(12, Math.floor(map.width / 8));
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = Math.max(1.2, 1.8 / zoom);
    for (let r = Math.floor(stepR / 2); r < map.height; r += stepR) {
      const lat = getRowLatitude(r, map.height, map.geography);
      const dir = getPrevailingWindDir(lat, map.geography.windMode);
      for (let q = Math.floor(stepQ / 2); q < map.width; q += stepQ) {
        const p = hexToPixel(q, r, BASE_HEX_RADIUS);
        const len = BASE_HEX_RADIUS * 1.6 * dir;
        ctx.beginPath();
        ctx.moveTo(p.x - len * 0.5, p.y);
        ctx.lineTo(p.x + len * 0.5, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x + len * 0.5, p.y);
        ctx.lineTo(p.x + len * 0.25, p.y - BASE_HEX_RADIUS * 0.3);
        ctx.lineTo(p.x + len * 0.25, p.y + BASE_HEX_RADIUS * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 2. Political & Religion centroid labels
  if (options.overlay === 'political') {
    const govMap = new Map(GOVERNMENT_TYPES.map((g) => [g.id, g.label]));
    drawCentroidLabels(
      ctx,
      map,
      map.territories,
      map.kingdoms.map((k) => ({
        id: k.id,
        name: k.name,
        color: k.color,
        sub: govMap.get(k.government) ?? k.government,
      })),
      zoom
    );
  } else if (options.overlay === 'religion' || layers.religions) {
    drawCentroidLabels(
      ctx,
      map,
      map.religions,
      map.religionList.map((r) => ({
        id: r.id,
        name: `${r.symbol} ${r.name}`,
        color: r.color,
      })),
      zoom
    );
  }

  // 3. Rivers
  if (layers.rivers) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const river of map.rivers) {
      if (river.points.length < 2) continue;
      for (let i = 0; i < river.points.length - 1; i++) {
        const a = hexToPixel(river.points[i].q, river.points[i].r, BASE_HEX_RADIUS);
        const b = hexToPixel(river.points[i + 1].q, river.points[i + 1].r, BASE_HEX_RADIUS);
        const flux = river.points[i + 1].flux || 10;
        const w = Math.min(BASE_HEX_RADIUS * 0.42, Math.max(1.8, Math.sqrt(flux) * 0.42));

        ctx.strokeStyle = 'rgba(14, 38, 62, 0.55)';
        ctx.lineWidth = w + 1.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.strokeStyle = '#53b8ec';
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 4. Roads & Trade Routes
  if (layers.routes) {
    for (const road of map.roads) {
      if (road.hexes.length < 2) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (road.type === 'stone') {
        ctx.strokeStyle = '#d6cfc2';
        ctx.lineWidth = 3.2;
      } else if (road.type === 'sea') {
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 6]);
      } else {
        ctx.strokeStyle = '#b68b57';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([5, 4]);
      }
      ctx.beginPath();
      road.hexes.forEach((h, idx) => {
        const p = hexToPixel(h.q, h.r, BASE_HEX_RADIUS);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    for (const route of map.tradeRoutes) {
      if (route.hexes.length < 2) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle =
        route.mode === 'sea' ? 'rgba(56, 189, 248, 0.85)' : 'rgba(245, 185, 66, 0.88)';
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      route.hexes.forEach((h, idx) => {
        const p = hexToPixel(h.q, h.r, BASE_HEX_RADIUS);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      if (zoom >= 0.45) {
        const mid = route.hexes[Math.floor(route.hexes.length / 2)];
        const mp = hexToPixel(mid.q, mid.r, BASE_HEX_RADIUS);
        const label = `${route.distanceKm.toLocaleString()} กม.`;
        ctx.font = `600 ${Math.max(10, 11 / Math.max(0.65, zoom))}px Sarabun, sans-serif`;
        const tw = ctx.measureText(label).width + 10;
        ctx.fillStyle = 'rgba(13, 20, 30, 0.86)';
        ctx.strokeStyle = route.mode === 'sea' ? '#38bdf8' : '#d99b38';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mp.x - tw / 2, mp.y - 10, tw, 19, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, mp.x, mp.y);
      }
      ctx.restore();
    }
  }

  // 5. Draft or live A* Preview road/river path
  if (options.previewPath && options.previewPath.hexes.length > 0) {
    ctx.save();
    ctx.strokeStyle = options.previewPath.valid ? '#4ade80' : '#f43f5e';
    ctx.lineWidth = 3.6;
    ctx.setLineDash([6, 4]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    options.previewPath.hexes.forEach((h, i) => {
      const p = hexToPixel(h.q, h.r, BASE_HEX_RADIUS);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  if (options.draftPath.length > 1) {
    ctx.save();
    ctx.strokeStyle = options.tool === 'river' ? '#38bdf8' : '#fbbf24';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    options.draftPath.forEach((h, i) => {
      const p = hexToPixel(h.q, h.r, BASE_HEX_RADIUS);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  // 6. POIs (built-in + custom)
  if (layers.pois) {
    const poiMeta = new Map(getAllPoiTypes(map.customPoiTypes).map((p) => [p.id, p]));
    for (const poi of map.pois) {
      const p = hexToPixel(poi.q, poi.r, BASE_HEX_RADIUS);
      const meta = poiMeta.get(poi.type);
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 34, 0.85)';
      ctx.strokeStyle = meta?.color ?? '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BASE_HEX_RADIUS * 0.56, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = `${Math.round(BASE_HEX_RADIUS * 0.65)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta?.symbol ?? '📍', p.x, p.y + 1);

      if (layers.labels && zoom >= 0.55) {
        ctx.font = '500 11px Sarabun, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(poi.name, p.x, p.y + BASE_HEX_RADIUS * 0.98);
      }
      ctx.restore();
    }
  }

  // 7. Cities
  for (const city of map.cities) {
    drawCityMarker(
      ctx,
      city,
      map,
      zoom,
      layers.cityNames,
      city.id === options.selectedCityId,
      city.id === options.tradeStartCityId
    );
  }

  // 8. Custom Map Labels
  if (layers.labels) {
    for (const lbl of map.labels) {
      const p = hexToPixel(lbl.q, lbl.r, BASE_HEX_RADIUS);
      const fontSize = lbl.size === 'lg' ? 22 : lbl.size === 'md' ? 16 : 12;
      ctx.save();
      ctx.font = `700 ${fontSize}px Cinzel, Sarabun, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle =
        lbl.style === 'water'
          ? 'rgba(147, 213, 245, 0.85)'
          : lbl.style === 'mountain'
          ? 'rgba(226, 216, 198, 0.9)'
          : 'rgba(248, 232, 188, 0.92)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.fillText(lbl.text, p.x, p.y);
      ctx.restore();
    }
  }

  // 9. Distance measurement polyline
  if (options.measurePoints.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(2, 2.5 / zoom);
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    options.measurePoints.forEach((pt, idx) => {
      const p = hexToPixel(pt.q, pt.r, BASE_HEX_RADIUS);
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < options.measurePoints.length; i++) {
      const p = hexToPixel(options.measurePoints[i].q, options.measurePoints[i].r, BASE_HEX_RADIUS);
      ctx.fillStyle = i === 0 ? '#22c55e' : '#38bdf8';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 / Math.min(1, zoom), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 10. Hover brush / hex cursor highlight
  if (options.hoverHex && options.tool !== 'view') {
    const r =
      options.tool === 'terrain' || options.tool === 'territory' || options.tool === 'religion'
        ? options.brushRadius
        : 0;
    const p = hexToPixel(options.hoverHex.q, options.hoverHex.r, BASE_HEX_RADIUS);
    ctx.save();
    if (r === 0) {
      traceHexPath(ctx, p.x, p.y, BASE_HEX_RADIUS);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = Math.max(1.5, 2 / zoom);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
      ctx.lineWidth = Math.max(1.5, 2 / zoom);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (r + 0.55) * SQRT3 * BASE_HEX_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCityMarker(
  ctx: CanvasRenderingContext2D,
  city: City,
  map: HexMapData,
  zoom: number,
  showName: boolean,
  isSelected: boolean,
  isTradeStart: boolean
): void {
  const p = hexToPixel(city.q, city.r, BASE_HEX_RADIUS);
  const kingdomColor =
    map.kingdoms.find((k) => k.id === city.kingdomId)?.color ?? '#f59e0b';
  const markerR =
    city.tier === 'capital'
      ? BASE_HEX_RADIUS * 0.72
      : city.tier === 'city'
      ? BASE_HEX_RADIUS * 0.62
      : BASE_HEX_RADIUS * 0.5;

  ctx.save();

  if (isSelected || isTradeStart) {
    ctx.strokeStyle = isTradeStart ? '#38bdf8' : '#fde047';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, markerR + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#111827';
  ctx.strokeStyle = kingdomColor;
  ctx.lineWidth = city.tier === 'capital' ? 3 : 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, markerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = city.tier === 'capital' ? '#fbbf24' : '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (city.tier === 'capital') {
    ctx.font = `${Math.round(markerR * 1.05)}px sans-serif`;
    ctx.fillText('★', p.x, p.y + 0.5);
  } else if (city.tier === 'port') {
    ctx.font = `${Math.round(markerR * 1.0)}px sans-serif`;
    ctx.fillText('⚓', p.x, p.y + 0.5);
  } else if (city.tier === 'city') {
    ctx.fillRect(p.x - markerR * 0.36, p.y - markerR * 0.36, markerR * 0.72, markerR * 0.72);
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, markerR * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }

  if (showName && (zoom >= 0.3 || city.tier === 'capital' || isSelected)) {
    const labelScale = Math.max(0.75, Math.min(1.25, 0.9 / Math.max(0.5, zoom * 0.9)));
    const fontSize = Math.round((city.tier === 'capital' ? 13 : 11.5) * labelScale);
    ctx.font = `600 ${fontSize}px Sarabun, sans-serif`;
    const tw = ctx.measureText(city.name).width + 12;
    const ly = p.y - markerR - 14 * labelScale;

    ctx.fillStyle = 'rgba(13, 19, 28, 0.86)';
    ctx.strokeStyle = isSelected ? '#fbbf24' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(p.x - tw / 2, ly - 10 * labelScale, tw, 20 * labelScale, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = city.tier === 'capital' ? '#fde68a' : '#f1f5f9';
    ctx.fillText(city.name, p.x, ly);
  }

  ctx.restore();
}

/** Export the entire map as a high-resolution cartographic PNG with title, compass, scale bar, and optional legend. */
export function exportMapToPng(
  map: HexMapData,
  options: {
    overlay: ClimateOverlay;
    layers: LayerVisibility;
    includeLegend: boolean;
    includeScale: boolean;
  }
): string {
  const maxDim = Math.max(map.width, map.height);
  const hexRadius = maxDim > 200 ? 10 : maxDim > 140 ? 13 : 16;
  const padTop = 64;
  const padSide = 32;
  const legendW = options.includeLegend ? 240 : 0;

  const mapW = Math.ceil(map.width * SQRT3 * hexRadius + hexRadius * 2);
  const mapH = Math.ceil(map.height * 1.5 * hexRadius + hexRadius * 2);

  const canvas = document.createElement('canvas');
  canvas.width = mapW + padSide * 2 + legendW;
  canvas.height = mapH + padTop + padSide;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0e1722';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f3d08a';
  ctx.font = '700 26px Cinzel, Sarabun, serif';
  ctx.fillText(map.name, padSide, 34);

  const widthKm = Math.round(map.width * map.hexSizeKm);
  const heightKm = Math.round(map.height * map.hexSizeKm * (SQRT3 / 2));
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 13px Sarabun, sans-serif';
  ctx.fillText(
    `${map.width} × ${map.height} ช่อง · ช่องละ ${map.hexSizeKm} กม. (${widthKm.toLocaleString()} × ${heightKm.toLocaleString()} กม.)`,
    padSide,
    54
  );

  ctx.save();
  ctx.translate(padSide + hexRadius, padTop + hexRadius);

  const kingdomColorMap = new Map(map.kingdoms.map((k) => [k.id, k.color]));
  const religionColorMap = new Map(map.religionList.map((r) => [r.id, r.color]));

  for (let r = 0; r < map.height; r++) {
    for (let q = 0; q < map.width; q++) {
      const idx = hexIndex(q, r, map.width);
      const meta = getBiomeMetaWithCustom(map.biomes[idx], map.customBiomes);
      const pos = hexToPixel(q, r, hexRadius);
      traceHexPath(ctx, pos.x, pos.y, hexRadius + 0.4);
      ctx.fillStyle =
        options.overlay === 'elevation'
          ? elevationColor(map.elevation[idx] ?? 0)
          : options.overlay === 'temperature'
          ? temperatureColor(map.temperature[idx] ?? 15)
          : options.overlay === 'moisture'
          ? moistureColor(map.moisture[idx] ?? 0.5)
          : meta.color;
      ctx.fill();
      if (options.overlay === 'none' || options.overlay === 'political' || options.overlay === 'religion') {
        if (map.biomes[idx] === BiomeId.SHALLOW_WATER) {
          const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
          let touchesNonCliffLand = false;
          ctx.save();
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.32)';
          ctx.lineWidth = Math.max(0.9, hexRadius * 0.065);
          ctx.lineCap = 'round';
          for (const nb of nbs) {
            if (!nb.inMap) continue;
            const nbIdx = hexIndex(nb.q, nb.r, map.width);
            const nbIsWater = isWaterBiome(map.biomes[nbIdx], map.customBiomes);
            if (!nbIsWater && map.features?.[nbIdx] !== 'cliff') {
              touchesNonCliffLand = true;
              const [x1, y1] = hexVertex(pos.x, pos.y, hexRadius - 0.5, nb.edge);
              const [x2, y2] = hexVertex(pos.x, pos.y, hexRadius - 0.5, nb.edge + 1);
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }
          ctx.restore();
          if (touchesNonCliffLand) {
            traceHexPath(ctx, pos.x, pos.y, hexRadius + 0.4);
            ctx.fillStyle = 'rgba(130, 210, 240, 0.14)';
            ctx.fill();
          }
        }
      }
      if (options.overlay === 'none') {
        drawBiomeDetail(ctx, pos.x, pos.y, hexRadius, meta.detailStyle, hash2D(q, r));
        if (options.layers.features && map.features?.[idx]) {
          if (map.features[idx] === 'cliff') {
            drawCliffOverlay(ctx, map, q, r, pos.x, pos.y, hexRadius);
          } else {
            drawSpecialFeature(ctx, pos.x, pos.y, hexRadius, map.features[idx]);
          }
        }
      } else if (
        options.overlay === 'elevation' &&
        options.layers.features &&
        map.features?.[idx] === 'cliff'
      ) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        drawCliffOverlay(ctx, map, q, r, pos.x, pos.y, hexRadius);
        ctx.restore();
      }
      const ownerId = map.territories?.[idx] ?? '';
      if (ownerId && (options.overlay === 'political' || options.layers.territories)) {
        const kCol = kingdomColorMap.get(ownerId);
        if (kCol) {
          traceHexPath(ctx, pos.x, pos.y, hexRadius + 0.2);
          ctx.fillStyle = options.overlay === 'political' ? `${kCol}90` : `${kCol}26`;
          ctx.fill();
        }
      }
      const relId = map.religions?.[idx] ?? '';
      if (relId && (options.overlay === 'religion' || options.layers.religions)) {
        const rCol = religionColorMap.get(relId);
        if (rCol) {
          traceHexPath(ctx, pos.x, pos.y, hexRadius + 0.2);
          ctx.fillStyle = options.overlay === 'religion' ? `${rCol}88` : `${rCol}30`;
          ctx.fill();
        }
      }
      if (options.layers.grid) {
        traceHexPath(ctx, pos.x, pos.y, hexRadius);
        ctx.strokeStyle = 'rgba(12, 20, 30, 0.25)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
  }

  ctx.save();
  ctx.scale(hexRadius / BASE_HEX_RADIUS, hexRadius / BASE_HEX_RADIUS);
  drawDynamicLayers(ctx, map, 1, {
    overlay: options.overlay,
    layers: options.layers,
    hoverHex: null,
    brushRadius: 0,
    tool: 'view',
    selectedCityId: null,
    tradeStartCityId: null,
    draftPath: [],
    measurePoints: [],
  });
  ctx.restore();
  ctx.restore();

  const compX = padSide + mapW - 44;
  const compY = padTop + 44;
  ctx.save();
  ctx.translate(compX, compY);
  ctx.fillStyle = 'rgba(14, 23, 34, 0.78)';
  ctx.strokeStyle = '#d99b38';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 12px Cinzel, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -13);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(-5, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(5, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (options.includeScale) {
    const barHexes = Math.max(4, Math.min(20, Math.round(250 / map.hexSizeKm)));
    const barKm = Math.round(barHexes * map.hexSizeKm);
    const barPx = barHexes * SQRT3 * hexRadius;
    const bx = padSide + 18;
    const by = padTop + mapH - 22;
    ctx.fillStyle = 'rgba(14, 23, 34, 0.8)';
    ctx.fillRect(bx - 8, by - 22, barPx + 24, 32);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + barPx, by);
    ctx.moveTo(bx, by - 5);
    ctx.lineTo(bx, by + 3);
    ctx.moveTo(bx + barPx, by - 5);
    ctx.lineTo(bx + barPx, by + 3);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 12px Sarabun, sans-serif';
    ctx.fillText(`${barKm.toLocaleString()} กม.`, bx, by - 9);
  }

  if (options.includeLegend) {
    const lx = padSide + mapW + 18;
    let ly = padTop + 16;
    ctx.fillStyle = '#f3d08a';
    ctx.font = '600 15px Sarabun, sans-serif';
    ctx.fillText(
      options.overlay === 'political'
        ? 'อาณาจักร & การปกครอง'
        : options.overlay === 'religion'
        ? 'ศาสนา & ความเชื่อ'
        : 'ภูมิประเทศ (Biomes)',
      lx,
      ly
    );
    ly += 22;

    if (options.overlay === 'political') {
      for (const k of map.kingdoms) {
        ctx.fillStyle = k.color;
        ctx.fillRect(lx, ly - 10, 14, 14);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 12px Sarabun, sans-serif';
        ctx.fillText(k.name, lx + 22, ly + 1);
        ly += 22;
      }
    } else if (options.overlay === 'religion') {
      for (const r of map.religionList) {
        ctx.fillStyle = r.color;
        ctx.fillRect(lx, ly - 10, 14, 14);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 12px Sarabun, sans-serif';
        ctx.fillText(`${r.symbol} ${r.name}`, lx + 22, ly + 1);
        ly += 22;
      }
    } else {
      const counts = new Map<number, number>();
      for (const b of map.biomes) counts.set(b, (counts.get(b) ?? 0) + 1);

      for (const b of getAllBiomes(map.customBiomes)) {
        const cnt = counts.get(b.id) ?? 0;
        if (cnt === 0) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(lx, ly - 10, 14, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(lx, ly - 10, 14, 14);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 12px Sarabun, sans-serif';
        ctx.fillText(`${b.nameTh} (${cnt})`, lx + 22, ly + 1);
        ly += 22;
      }
    }
  }

  return canvas.toDataURL('image/png');
}
