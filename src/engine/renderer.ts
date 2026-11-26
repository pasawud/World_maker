import { getBiomeMetaWithCustom, getPaintableBiomes } from '../data/biomes';
import { getFeatureMetaWithCustom } from '../data/features';
import {
  getAllCultureTypes,
  getAllGovernmentTypes,
  getAllPoiTypes,
} from '../data/goods';
import {
  getAllTerrains,
  getTerrainMetaWithCustom,
  isWaterTerrainWithCustom,
  TerrainMeta,
} from '../data/terrains';
import {
  BiomeDetailStyle,
  BiomeId,
  City,
  ClimateOverlay,
  HexCoord,
  HexMapData,
  LayerVisibility,
  MapLabel,
  MapTheme,
  SpecialFeatureMeta,
  TerrainId,
  ToolMode,
} from '../types/map';
import { getCliffEdges } from './cliffs';
import {
  computeOceanCurrents,
  CurrentStreamline,
  OceanCurrentField,
  traceOceanCurrentStreams,
} from './currents';
import {
  getHexTerrain,
  getNeighborsWithEdge,
  hexIndex,
  hexToPixel,
  isWaterBiome,
  SQRT3,
} from './hexMath';
import {
  formatLatitude,
  formatLongitude,
  getColLongitude,
  getPrevailingWindVector,
  getRowLatitude,
} from './worldGenerator';

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

function mixRgbTuple(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const cl = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * cl),
    Math.round(a[1] + (b[1] - a[1]) * cl),
    Math.round(a[2] + (b[2] - a[2]) * cl),
  ];
}

function applyThemeColor(
  rgb: [number, number, number],
  theme: MapTheme,
  isWater: boolean,
  terrainId: number
): [number, number, number] {
  if (theme === 'parchment') {
    if (isWater) {
      if (terrainId === TerrainId.LAKE) return [169, 178, 152];
      if (terrainId === TerrainId.SHALLOW_WATER) return [205, 194, 162];
      return [188, 176, 144];
    }
    const lum = Math.round(rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114);
    const muted = mixRgbTuple(rgb, [lum, Math.round(lum * 0.94), Math.round(lum * 0.8)], 0.55);
    return mixRgbTuple(muted, [218, 200, 162], 0.52);
  }
  if (theme === 'atlas') {
    if (isWater) {
      if (terrainId === TerrainId.LAKE) return [72, 168, 224];
      return terrainId === TerrainId.SHALLOW_WATER ? [68, 146, 204] : [32, 92, 148];
    }
    return mixRgbTuple(rgb, [242, 240, 226], 0.14);
  }
  if (theme === 'dark') {
    return mixRgbTuple(rgb, [14, 20, 32], isWater ? 0.42 : 0.3);
  }
  return rgb;
}

function computeHillshadeDelta(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  q: number,
  r: number
): number {
  const sample = (sq: number, sr: number, fallback: number) => {
    const cq = Math.max(0, Math.min(width - 1, sq));
    const cr = Math.max(0, Math.min(height - 1, sr));
    const v = elevation[hexIndex(cq, cr, width)];
    return Number.isFinite(v) ? v : fallback;
  };
  const center = sample(q, r, 0);
  const nw = sample(q - 1, r - 1, center);
  const w = sample(q - 1, r, center);
  const n = sample(q, r - 1, center);
  const se = sample(q + 1, r + 1, center);
  const e = sample(q + 1, r, center);
  const s = sample(q, r + 1, center);
  const grad = (nw + w + n - (se + e + s)) / 3;
  return Math.max(-28, Math.min(24, Math.round(grad * 95)));
}

function segmentGraphemes(text: string): string[] {
  const Seg = (Intl as unknown as {
    Segmenter?: new (
      locale: string,
      opts: { granularity: string }
    ) => { segment: (s: string) => Iterable<{ segment: string }> };
  }).Segmenter;
  if (typeof Seg === 'function') {
    const segmenter = new Seg('th', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

function drawCurvedMapLabel(
  ctx: CanvasRenderingContext2D,
  lbl: MapLabel,
  px: number,
  py: number,
  theme: MapTheme
): void {
  const fontSize = lbl.size === 'lg' ? 22 : lbl.size === 'md' ? 16 : 12;
  const rotRad = ((lbl.rotationDeg ?? 0) * Math.PI) / 180;
  const curve = lbl.curveAmount ?? 0;

  ctx.save();
  ctx.font = `700 ${fontSize}px Cinzel, Sarabun, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fillColor =
    theme === 'parchment'
      ? lbl.style === 'water'
        ? '#2e4a5e'
        : '#3a2818'
      : lbl.style === 'water'
      ? 'rgba(147, 213, 245, 0.88)'
      : lbl.style === 'mountain'
      ? 'rgba(226, 216, 198, 0.92)'
      : 'rgba(248, 232, 188, 0.94)';

  ctx.fillStyle = fillColor;
  ctx.shadowColor = theme === 'parchment' ? 'rgba(240, 228, 198, 0.85)' : 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = theme === 'parchment' ? 3 : 6;

  ctx.translate(px, py);
  if (rotRad !== 0) ctx.rotate(rotRad);

  const graphemes = segmentGraphemes(lbl.text);
  if (Math.abs(curve) < 0.05 || graphemes.length < 3) {
    ctx.fillText(lbl.text, 0, 0);
    ctx.restore();
    return;
  }

  const widths = graphemes.map((g) => Math.max(4, ctx.measureText(g).width + (lbl.letterSpacing ?? 1)));
  const totalW = widths.reduce((a, b) => a + b, 0);
  const arcRadius = Math.max(totalW * 0.65, (totalW * 1.1) / Math.max(0.15, Math.abs(curve)));
  const dir = curve >= 0 ? 1 : -1;

  let cursor = -totalW / 2;
  for (let i = 0; i < graphemes.length; i++) {
    const gw = widths[i];
    const mid = cursor + gw / 2;
    const angle = (mid / arcRadius) * dir;
    ctx.save();
    ctx.translate(Math.sin(angle) * arcRadius * dir, (1 - Math.cos(angle)) * arcRadius * dir);
    ctx.rotate(angle);
    ctx.fillText(graphemes[i], 0, 0);
    ctx.restore();
    cursor += gw;
  }
  ctx.restore();
}

function elevationColor(e: number): string {
  const c = Math.max(-1, Math.min(1, Number.isFinite(e) ? e : 0));
  if (c <= -0.65) return mixRgb([8, 24, 48], [16, 46, 82], (c + 1) / 0.35);
  if (c <= -0.25) return mixRgb([16, 46, 82], [32, 88, 134], (c + 0.65) / 0.4);
  if (c <= 0) return mixRgb([32, 88, 134], [82, 166, 198], (c + 0.25) / 0.25);
  if (c <= 0.14) return mixRgb([62, 132, 74], [116, 162, 84], c / 0.14);
  if (c <= 0.32) return mixRgb([116, 162, 84], [182, 190, 98], (c - 0.14) / 0.18);
  if (c <= 0.48) return mixRgb([182, 190, 98], [186, 144, 78], (c - 0.32) / 0.16);
  if (c <= 0.58) return mixRgb([186, 144, 78], [154, 102, 62], (c - 0.48) / 0.1);
  if (c <= 0.78) return mixRgb([154, 102, 62], [178, 168, 160], (c - 0.58) / 0.2);
  return mixRgb([178, 168, 160], [246, 250, 255], (c - 0.78) / 0.22);
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

function oceanCurrentFillColor(thermal: number, speed: number): string {
  if (speed < 0.08) return '#152f4a';
  if (thermal >= 0.15) {
    return mixRgb([24, 58, 92], [220, 92, 62], Math.min(1, thermal));
  }
  if (thermal <= -0.15) {
    return mixRgb([22, 54, 92], [56, 189, 248], Math.min(1, -thermal));
  }
  return '#1a476e';
}

function drawLakeDetails(
  ctx: CanvasRenderingContext2D,
  map: HexMapData,
  q: number,
  r: number,
  cx: number,
  cy: number,
  radius: number
): void {
  const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
  ctx.save();
  ctx.strokeStyle = 'rgba(196, 238, 255, 0.45)';
  ctx.lineWidth = Math.max(1.0, radius * 0.075);
  ctx.lineCap = 'round';
  for (const nb of nbs) {
    if (!nb.inMap) continue;
    const nbIdx = hexIndex(nb.q, nb.r, map.width);
    const nbIsWater = isWaterBiome(map.biomes[nbIdx], map.customBiomes);
    if (!nbIsWater) {
      const [x1, y1] = hexVertex(cx, cy, radius - 0.6, nb.edge);
      const [x2, y2] = hexVertex(cx, cy, radius - 0.6, nb.edge + 1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // Calm freshwater ripple glint
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.28)';
  ctx.lineWidth = Math.max(0.8, radius * 0.055);
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.34, cy - radius * 0.12);
  ctx.lineTo(cx + radius * 0.26, cy - radius * 0.12);
  ctx.moveTo(cx - radius * 0.2, cy + radius * 0.14);
  ctx.lineTo(cx + radius * 0.36, cy + radius * 0.14);
  ctx.stroke();
  ctx.restore();
}

function drawOceanCurrentStreams(
  ctx: CanvasRenderingContext2D,
  streams: CurrentStreamline[],
  hexRadius: number,
  zoom: number
): void {
  if (streams.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const st of streams) {
    if (st.points.length < 2) continue;
    const pts = st.points.map((pt) => hexToPixel(pt.q, pt.r, hexRadius));
    const fgColor =
      st.kind === 'warm'
        ? '#fb7185'
        : st.kind === 'cold'
        ? '#38bdf8'
        : '#67e8f9';

    const traceCurve = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) * 0.5;
        const my = (pts[i].y + pts[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    };

    const baseWidth = Math.max(2.0, Math.min(4.2, 2.4 / Math.max(0.45, zoom * 0.6)));
    ctx.strokeStyle = 'rgba(8, 15, 26, 0.62)';
    ctx.lineWidth = baseWidth + 2.2;
    traceCurve();
    ctx.stroke();

    ctx.strokeStyle = fgColor;
    ctx.lineWidth = baseWidth;
    traceCurve();
    ctx.stroke();

    // Arrowhead at end of streamline
    const pPrev = pts[pts.length - 2];
    const pEnd = pts[pts.length - 1];
    const angle = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
    const headLen = Math.max(7, baseWidth * 3.1);
    ctx.fillStyle = fgColor;
    ctx.beginPath();
    ctx.moveTo(pEnd.x + Math.cos(angle) * 2, pEnd.y + Math.sin(angle) * 2);
    ctx.lineTo(
      pEnd.x - Math.cos(angle - 0.52) * headLen,
      pEnd.y - Math.sin(angle - 0.52) * headLen
    );
    ctx.lineTo(
      pEnd.x - Math.cos(angle + 0.52) * headLen,
      pEnd.y - Math.sin(angle + 0.52) * headLen
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
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

/** Draw physical landform details (hills, highland terraces, mountains, high peaks) over any biome. */
export function drawTerrainDetail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  terrainMeta: TerrainMeta,
  biomeId: number,
  temp: number,
  neutralStyle: boolean
): void {
  const r = radius;
  switch (terrainMeta.reliefStyle) {
    case 'hills': {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(38, 30, 20, 0.5)';
      ctx.lineWidth = Math.max(1.1, r * 0.1);
      ctx.beginPath();
      ctx.arc(cx - r * 0.16, cy + r * 0.15, r * 0.28, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.2, cy + r * 0.23, r * 0.22, Math.PI, 0);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 245, 220, 0.28)';
      ctx.lineWidth = Math.max(0.7, r * 0.05);
      ctx.beginPath();
      ctx.arc(cx - r * 0.16, cy + r * 0.13, r * 0.24, Math.PI * 1.15, Math.PI * 1.78);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'highland': {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = 'rgba(54, 42, 30, 0.22)';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.44, cy + r * 0.22);
      ctx.lineTo(cx - r * 0.24, cy - r * 0.12);
      ctx.lineTo(cx + r * 0.22, cy - r * 0.12);
      ctx.lineTo(cx + r * 0.44, cy + r * 0.22);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(42, 32, 22, 0.58)';
      ctx.lineWidth = Math.max(1.1, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy + r * 0.2);
      ctx.lineTo(cx - r * 0.24, cy - r * 0.12);
      ctx.lineTo(cx + r * 0.22, cy - r * 0.12);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 240, 210, 0.35)';
      ctx.lineWidth = Math.max(0.8, r * 0.055);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.22, cy - r * 0.14);
      ctx.lineTo(cx + r * 0.2, cy - r * 0.14);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'mountain': {
      const isIcy = !neutralStyle && (biomeId === BiomeId.SNOW_ICE || temp <= -3);
      const isArid = !neutralStyle && (biomeId === BiomeId.DESERT || biomeId === BiomeId.SAVANNA);
      const isLush =
        !neutralStyle &&
        (biomeId === BiomeId.RAINFOREST ||
          biomeId === BiomeId.DECIDUOUS_FOREST ||
          biomeId === BiomeId.TAIGA);

      const darkFace = isIcy
        ? '#738291'
        : isArid
        ? '#7b5a3c'
        : isLush
        ? '#455046'
        : '#53493e';
      const lightFace = isIcy
        ? '#c7d2dc'
        : isArid
        ? '#c2996b'
        : isLush
        ? '#7e8b7a'
        : '#968978';

      ctx.fillStyle = darkFace;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.56);
      ctx.lineTo(cx + r * 0.52, cy + r * 0.36);
      ctx.lineTo(cx, cy + r * 0.36);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = lightFace;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.56);
      ctx.lineTo(cx - r * 0.52, cy + r * 0.36);
      ctx.lineTo(cx, cy + r * 0.36);
      ctx.closePath();
      ctx.fill();

      if (isIcy) {
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.56);
        ctx.lineTo(cx - r * 0.18, cy - r * 0.22);
        ctx.lineTo(cx, cy - r * 0.15);
        ctx.lineTo(cx + r * 0.18, cy - r * 0.22);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'peak': {
      const hasSnowCap =
        neutralStyle ||
        biomeId === BiomeId.SNOW_ICE ||
        biomeId === BiomeId.TUNDRA ||
        temp <= 4;
      const isArid = !neutralStyle && (biomeId === BiomeId.DESERT || biomeId === BiomeId.SAVANNA);

      const darkFace = hasSnowCap ? '#7b8996' : isArid ? '#664830' : '#4a433c';
      const lightFace = hasSnowCap ? '#d2dce5' : isArid ? '#b38659' : '#8e847a';

      // Secondary shoulder peak
      ctx.fillStyle = darkFace;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.26, cy - r * 0.32);
      ctx.lineTo(cx - r * 0.02, cy + r * 0.36);
      ctx.lineTo(cx - r * 0.54, cy + r * 0.36);
      ctx.closePath();
      ctx.fill();

      // Main tall crag
      ctx.fillStyle = darkFace;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.04, cy - r * 0.64);
      ctx.lineTo(cx + r * 0.56, cy + r * 0.38);
      ctx.lineTo(cx + r * 0.04, cy + r * 0.38);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = lightFace;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.04, cy - r * 0.64);
      ctx.lineTo(cx - r * 0.44, cy + r * 0.38);
      ctx.lineTo(cx + r * 0.04, cy + r * 0.38);
      ctx.closePath();
      ctx.fill();

      if (hasSnowCap) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.04, cy - r * 0.64);
        ctx.lineTo(cx - r * 0.18, cy - r * 0.2);
        ctx.lineTo(cx + r * 0.04, cy - r * 0.11);
        ctx.lineTo(cx + r * 0.26, cy - r * 0.2);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'plateau': {
      ctx.save();
      ctx.fillStyle = 'rgba(72, 42, 26, 0.35)';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.46, cy + r * 0.26);
      ctx.lineTo(cx - r * 0.3, cy - r * 0.22);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.22);
      ctx.lineTo(cx + r * 0.46, cy + r * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 224, 178, 0.45)';
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.28, cy - r * 0.22);
      ctx.lineTo(cx + r * 0.28, cy - r * 0.22);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'canyon': {
      ctx.save();
      ctx.strokeStyle = 'rgba(20, 14, 10, 0.72)';
      ctx.lineWidth = Math.max(1.5, r * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy - r * 0.18);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.1);
      ctx.lineTo(cx + r * 0.16, cy - r * 0.06);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220, 175, 130, 0.42)';
      ctx.lineWidth = Math.max(0.8, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * 0.25);
      ctx.lineTo(cx - r * 0.08, cy + r * 0.02);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'crater': {
      ctx.save();
      ctx.strokeStyle = 'rgba(25, 22, 20, 0.65)';
      ctx.lineWidth = Math.max(1.3, r * 0.11);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(15, 15, 20, 0.35)';
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'volcano': {
      ctx.save();
      ctx.fillStyle = '#47312c';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.52, cy + r * 0.34);
      ctx.lineTo(cx - r * 0.14, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.14, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.52, cy + r * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.44, r * 0.14, r * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'ice_shelf': {
      ctx.save();
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
      ctx.lineWidth = Math.max(1, r * 0.07);
      for (const offset of [-0.18, 0.04, 0.24]) {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.36, cy + r * offset);
        ctx.lineTo(cx + r * 0.36, cy + r * (offset - 0.08));
        ctx.stroke();
      }
      ctx.restore();
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
  featureId: string,
  customFeatures?: SpecialFeatureMeta[],
  featureOverrides?: Record<string, Partial<Omit<SpecialFeatureMeta, 'id'>>>
): void {
  if (featureId === 'cliff') return;
  const meta = getFeatureMetaWithCustom(featureId, customFeatures, featureOverrides);
  if (!meta) return;
  const r = radius;
  const styleKey = meta.visualStyle && meta.visualStyle !== 'default' ? meta.visualStyle : featureId;

  ctx.save();
  // Soft tinted hex wash so special feature is recognizable at a glance
  traceHexPath(ctx, cx, cy, r * 0.88);
  ctx.fillStyle = `${meta.color}42`;
  ctx.fill();
  ctx.strokeStyle = `${meta.color}aa`;
  ctx.lineWidth = Math.max(0.9, r * 0.06);
  ctx.stroke();

  if (styleKey === 'custom' && meta.symbol) {
    ctx.font = `${Math.round(r * 0.72)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(meta.symbol, cx, cy + 1);
    ctx.restore();
    return;
  }

  switch (styleKey) {
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
    case 'reef':
    case 'coral_reef':
    case 'atoll': {
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = Math.max(1.2, r * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.36, 0.3, Math.PI * 1.85);
      ctx.stroke();
      break;
    }
    case 'volcano':
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
    case 'geothermal':
    case 'hot_springs':
    case 'lagoon': {
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.08, r * 0.32, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'whirlpool':
    case 'maelstrom': {
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = Math.max(1.2, r * 0.09);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.18, 0.5, Math.PI * 2.0);
      ctx.stroke();
      break;
    }
    case 'crystal':
    case 'crystal_cavern': {
      ctx.fillStyle = meta.color;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.42);
      ctx.lineTo(cx + r * 0.22, cy);
      ctx.lineTo(cx, cy + r * 0.38);
      ctx.lineTo(cx - r * 0.22, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ruins':
    case 'ancient_ruins': {
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = Math.max(1.3, r * 0.1);
      ctx.strokeRect(cx - r * 0.26, cy - r * 0.18, r * 0.52, r * 0.38);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.32, cy - r * 0.22);
      ctx.lineTo(cx + r * 0.32, cy - r * 0.22);
      ctx.stroke();
      break;
    }
    case 'mesa': {
      ctx.fillStyle = meta.color;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.34, cy + r * 0.22);
      ctx.lineTo(cx - r * 0.2, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.2, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.34, cy + r * 0.22);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'waterfall': {
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.1, cy - r * 0.32);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.28);
      ctx.moveTo(cx + r * 0.1, cy - r * 0.32);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.28);
      ctx.stroke();
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
      if (meta.symbol) {
        ctx.font = `${Math.round(r * 0.65)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(meta.symbol, cx, cy + 1);
      } else {
        ctx.fillStyle = meta.color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.26);
        ctx.lineTo(cx + r * 0.24, cy);
        ctx.lineTo(cx, cy + r * 0.26);
        ctx.lineTo(cx - r * 0.24, cy);
        ctx.closePath();
        ctx.fill();
      }
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
  private currentCache: {
    key: string;
    field: OceanCurrentField;
    streams: CurrentStreamline[];
  } | null = null;

  private getCurrentData(map: HexMapData): {
    field: OceanCurrentField;
    streams: CurrentStreamline[];
  } {
    const manualSig = (map.manualCurrents ?? [])
      .map((c) => `${c.id}:${c.kind}:${c.strength}:${c.points.length}`)
      .join(',');
    const key = `${map.id}_${map.width}x${map.height}_${map.geography.latNorth}_${map.geography.latSouth}_${map.geography.lonWest ?? -180}_${map.geography.lonEast ?? 180}_${map.geography.windMode}_${map.geography.oceanCurrents !== false}_${map.geography.currentStrength ?? 1}_${map.geography.coriolisDirection ?? 'normal'}_${manualSig}`;
    if (this.currentCache && this.currentCache.key === key) {
      return this.currentCache;
    }
    const field = computeOceanCurrents(
      map.width,
      map.height,
      map.elevation,
      map.geography,
      map.terrains,
      map.manualCurrents
    );
    const streams = traceOceanCurrentStreams(
      map.width,
      map.height,
      map.elevation,
      field,
      map.terrains
    );
    this.currentCache = { key, field, streams };
    return this.currentCache;
  }

  public invalidateAll(): void {
    this.chunks.clear();
    this.currentCache = null;
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
    this.currentCache = null;
  }

  private getOrBuildChunk(
    map: HexMapData,
    cq: number,
    cr: number,
    overlay: ClimateOverlay,
    layers: LayerVisibility,
    mapTheme: MapTheme
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
    const cultureColorMap = new Map((map.cultureList ?? []).map((c) => [c.id, c.color]));
    const currentField = overlay === 'currents' ? this.getCurrentData(map).field : null;

    for (let r = startR; r < endR; r++) {
      for (let q = startQ; q < endQ; q++) {
        const idx = hexIndex(q, r, map.width);
        const biomeId = map.biomes[idx];
        const terrainId = getHexTerrain(map, idx);
        const terrainMeta = getTerrainMetaWithCustom(
          terrainId,
          map.customTerrains,
          map.terrainOverrides
        );
        const meta = getBiomeMetaWithCustom(biomeId, map.customBiomes);
        const isWater =
          isWaterTerrainWithCustom(terrainId, map.customTerrains, map.terrainOverrides) ||
          meta.isWater;
        const pos = hexToPixel(q, r, BASE_HEX_RADIUS);
        const lx = pos.x - originX;
        const ly = pos.y - originY;
        const rnd = hash2D(q, r);
        const temp = map.temperature[idx] ?? 15;

        let fill = meta.color;
        if (overlay === 'elevation') {
          fill = elevationColor(map.elevation[idx] ?? 0);
        } else if (overlay === 'temperature') {
          fill = temperatureColor(temp);
        } else if (overlay === 'moisture') {
          fill = moistureColor(map.moisture[idx] ?? 0.5);
        } else if (overlay === 'currents' && currentField) {
          if (terrainId === TerrainId.LAKE) {
            fill = '#3b8ec2';
          } else if (isWater) {
            fill = oceanCurrentFillColor(currentField.thermal[idx], currentField.speed[idx]);
          } else {
            fill = mixRgb(hexToRgb(terrainMeta.color), [42, 50, 62], 0.45);
          }
        } else if (overlay === 'terrain') {
          const rgb0 = hexToRgb(terrainMeta.color);
          const themed = applyThemeColor(rgb0, mapTheme, isWater, terrainId);
          const hillDelta =
            !isWater && layers.hillshade !== false
              ? computeHillshadeDelta(map.elevation, map.width, map.height, q, r)
              : 0;
          const delta = (rnd - 0.5) * 10 + hillDelta;
          fill = `rgb(${Math.max(0, Math.min(255, Math.round(themed[0] + delta)))},${Math.max(
            0,
            Math.min(255, Math.round(themed[1] + delta))
          )},${Math.max(0, Math.min(255, Math.round(themed[2] + delta)))})`;
        } else if (overlay === 'biome') {
          const baseCol = isWater ? (meta.isCustom ? meta.color : terrainMeta.color) : meta.color;
          const rgb0 = hexToRgb(baseCol);
          const themed = applyThemeColor(rgb0, mapTheme, isWater, terrainId);
          const hillDelta =
            !isWater && layers.hillshade !== false
              ? computeHillshadeDelta(map.elevation, map.width, map.height, q, r)
              : 0;
          const delta = (rnd - 0.5) * 10 + hillDelta;
          fill = `rgb(${Math.max(0, Math.min(255, Math.round(themed[0] + delta)))},${Math.max(
            0,
            Math.min(255, Math.round(themed[1] + delta))
          )},${Math.max(0, Math.min(255, Math.round(themed[2] + delta)))})`;
        } else {
          let baseHexCol = isWater
            ? meta.isCustom
              ? meta.color
              : terrainMeta.color
            : meta.color;
          if (!isWater) {
            if (terrainId === TerrainId.MOUNTAIN) {
              baseHexCol = mixRgb(hexToRgb(baseHexCol), [122, 112, 101], 0.24);
            } else if (terrainId === TerrainId.HIGH_PEAK) {
              const targetRgb: [number, number, number] =
                biomeId === BiomeId.SNOW_ICE || temp <= 4 ? [207, 216, 224] : [123, 115, 106];
              baseHexCol = mixRgb(hexToRgb(baseHexCol), targetRgb, 0.32);
            }
          }
          const rgb0 = baseHexCol.startsWith('rgb')
            ? (baseHexCol.match(/\d+/g)!.map(Number) as [number, number, number])
            : hexToRgb(baseHexCol);
          const rgb = applyThemeColor(rgb0, mapTheme, isWater, terrainId);
          const elevShift = ((map.elevation[idx] ?? 0) - 0.15) * 16;
          const hillDelta =
            !isWater && layers.hillshade !== false
              ? computeHillshadeDelta(map.elevation, map.width, map.height, q, r)
              : 0;
          const delta = (rnd - 0.5) * 10 + (isWater ? 0 : elevShift + hillDelta);
          fill = `rgb(${Math.max(0, Math.min(255, Math.round(rgb[0] + delta)))},${Math.max(
            0,
            Math.min(255, Math.round(rgb[1] + delta))
          )},${Math.max(0, Math.min(255, Math.round(rgb[2] + delta)))})`;
        }

        traceHexPath(ctx, lx, ly, BASE_HEX_RADIUS + 0.45);
        ctx.fillStyle = fill;
        ctx.fill();

        // Elevation Contour Lines
        if (layers.contours && !isWater) {
          const curLvl = Math.floor(Math.max(0, map.elevation[idx] ?? 0) * 10);
          if (curLvl > 0) {
            const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
            ctx.save();
            ctx.strokeStyle =
              mapTheme === 'parchment'
                ? 'rgba(72, 48, 28, 0.48)'
                : curLvl % 2 === 0
                ? 'rgba(15, 23, 42, 0.55)'
                : 'rgba(15, 23, 42, 0.32)';
            ctx.lineWidth = curLvl % 2 === 0 ? 1.5 : 0.9;
            for (const nb of nbs) {
              if (!nb.inMap) continue;
              const nbIdx = hexIndex(nb.q, nb.r, map.width);
              const nbElev = Math.max(0, map.elevation[nbIdx] ?? 0);
              if (Math.floor(nbElev * 10) < curLvl) {
                const [x1, y1] = hexVertex(lx, ly, BASE_HEX_RADIUS - 0.4, nb.edge);
                const [x2, y2] = hexVertex(lx, ly, BASE_HEX_RADIUS - 0.4, nb.edge + 1);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
        }

        // Parchment antique coastal shoreline & concentric ink ripple lines
        if (mapTheme === 'parchment' && isWater) {
          const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
          ctx.save();
          ctx.strokeStyle = 'rgba(74, 52, 32, 0.62)';
          ctx.lineWidth = 1.25;
          for (const nb of nbs) {
            if (!nb.inMap) continue;
            const nbIdx = hexIndex(nb.q, nb.r, map.width);
            const nbWater = isWaterBiome(map.biomes[nbIdx], map.customBiomes);
            if (!nbWater) {
              const [x1, y1] = hexVertex(lx, ly, BASE_HEX_RADIUS - 0.4, nb.edge);
              const [x2, y2] = hexVertex(lx, ly, BASE_HEX_RADIUS - 0.4, nb.edge + 1);
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
              const rx1 = x1 + (lx - x1) * 0.22;
              const ry1 = y1 + (ly - y1) * 0.22;
              const rx2 = x2 + (lx - x2) * 0.22;
              const ry2 = y2 + (ly - y2) * 0.22;
              ctx.strokeStyle = 'rgba(74, 52, 32, 0.25)';
              ctx.lineWidth = 0.7;
              ctx.beginPath();
              ctx.moveTo(rx1, ry1);
              ctx.lineTo(rx2, ry2);
              ctx.stroke();
            }
          }
          ctx.restore();
        }

        if (
          overlay === 'none' ||
          overlay === 'terrain' ||
          overlay === 'biome' ||
          overlay === 'political' ||
          overlay === 'religion' ||
          overlay === 'culture'
        ) {
          if (terrainId === TerrainId.SHALLOW_WATER) {
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
          } else if (terrainId === TerrainId.LAKE) {
            drawLakeDetails(ctx, map, q, r, lx, ly, BASE_HEX_RADIUS);
          }
          if (overlay === 'none') {
            if (!isWater && terrainId !== TerrainId.MOUNTAIN && terrainId !== TerrainId.HIGH_PEAK) {
              drawBiomeDetail(ctx, lx, ly, BASE_HEX_RADIUS, meta.detailStyle, rnd);
            }
            if (
              !isWater &&
              terrainMeta.reliefStyle !== 'flat' &&
              terrainMeta.reliefStyle !== 'water' &&
              terrainMeta.reliefStyle !== 'lake'
            ) {
              drawTerrainDetail(ctx, lx, ly, BASE_HEX_RADIUS, terrainMeta, biomeId, temp, false);
            }
            if (layers.features && map.features?.[idx]) {
              if (map.features[idx] === 'cliff') {
                drawCliffOverlay(ctx, map, q, r, lx, ly, BASE_HEX_RADIUS);
              } else {
                drawSpecialFeature(
                  ctx,
                  lx,
                  ly,
                  BASE_HEX_RADIUS,
                  map.features[idx],
                  map.customFeatures,
                  map.featureOverrides
                );
              }
            }
          } else if (overlay === 'terrain') {
            if (
              !isWater &&
              terrainMeta.reliefStyle !== 'flat' &&
              terrainMeta.reliefStyle !== 'water' &&
              terrainMeta.reliefStyle !== 'lake'
            ) {
              drawTerrainDetail(ctx, lx, ly, BASE_HEX_RADIUS, terrainMeta, biomeId, 15, true);
            }
            if (layers.features && map.features?.[idx] === 'cliff') {
              drawCliffOverlay(ctx, map, q, r, lx, ly, BASE_HEX_RADIUS);
            }
          } else if (overlay === 'biome') {
            if (!isWater) {
              drawBiomeDetail(ctx, lx, ly, BASE_HEX_RADIUS, meta.detailStyle, rnd);
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

        // Culture tint & dotted borders
        const cultId = map.cultures?.[idx] ?? '';
        if (cultId && (overlay === 'culture' || layers.cultures)) {
          const cCol = cultureColorMap.get(cultId);
          if (cCol) {
            traceHexPath(ctx, lx, ly, BASE_HEX_RADIUS + 0.2);
            ctx.fillStyle = overlay === 'culture' ? `${cCol}88` : `${cCol}2c`;
            ctx.fill();

            const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
            ctx.save();
            ctx.strokeStyle = cCol;
            ctx.lineWidth = overlay === 'culture' ? 2.4 : 1.5;
            ctx.setLineDash([2.5, 2.5]);
            for (const nb of nbs) {
              const nbCult = nb.inMap ? map.cultures?.[hexIndex(nb.q, nb.r, map.width)] ?? '' : '';
              if (nbCult !== cultId) {
                const [x1, y1] = hexVertex(lx, ly, BASE_HEX_RADIUS - 1.5, nb.edge);
                const [x2, y2] = hexVertex(lx, ly, BASE_HEX_RADIUS - 1.5, nb.edge + 1);
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
      mapTheme?: MapTheme;
      refImage?: HTMLImageElement | null;
      refOpacity?: number;
    }
  ): void {
    const mapTheme = options.mapTheme ?? map.mapTheme ?? 'standard';
    const sizeKey = `${map.width}x${map.height}`;
    const customSig = `${mapTheme}_${options.layers.hillshade !== false}_${Boolean(options.layers.contours)}_${map.customBiomes.length}_${map.customTerrains?.length ?? 0}_${map.customFeatures?.length ?? 0}_${JSON.stringify(map.terrainOverrides ?? {})}_${JSON.stringify(map.featureOverrides ?? {})}_${map.geography.currentStrength ?? 1}_${map.geography.coriolisDirection ?? 'normal'}`;
    const flagsKey = `${options.layers.grid}_${options.layers.features}_${options.layers.territories}_${options.layers.borders}_${options.layers.religions}_${options.layers.cultures}_${customSig}`;
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

    ctx.fillStyle =
      mapTheme === 'parchment'
        ? '#b8a987'
        : mapTheme === 'dark'
        ? '#070b12'
        : mapTheme === 'atlas'
        ? '#122940'
        : '#0e1926';
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
          options.layers,
          mapTheme
        );
        ctx.drawImage(canvas, originX, originY);
      }
    }

    const mapPixelW = map.width * SQRT3 * BASE_HEX_RADIUS + BASE_HEX_RADIUS;
    const mapPixelH = map.height * 1.5 * BASE_HEX_RADIUS + BASE_HEX_RADIUS;

    // Optional reference sketch/trace image overlay
    if (options.refImage && options.refImage.complete && (options.refOpacity ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(0.95, options.refOpacity ?? 0.4));
      ctx.drawImage(
        options.refImage,
        -BASE_HEX_RADIUS,
        -BASE_HEX_RADIUS,
        mapPixelW,
        mapPixelH
      );
      ctx.restore();
    }

    ctx.strokeStyle =
      mapTheme === 'parchment' ? 'rgba(82, 54, 28, 0.55)' : 'rgba(217, 155, 56, 0.35)';
    ctx.lineWidth = Math.max(1.5, 2 / cam.zoom);
    ctx.strokeRect(-BASE_HEX_RADIUS, -BASE_HEX_RADIUS, mapPixelW, mapPixelH);

    const currentStreams =
      options.layers.currents || options.overlay === 'currents'
        ? this.getCurrentData(map).streams
        : undefined;
    drawDynamicLayers(ctx, map, cam.zoom, { ...options, mapTheme, currentStreams });

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
    currentStreams?: CurrentStreamline[];
    mapTheme?: MapTheme;
  }
): void {
  const { layers } = options;
  const mapTheme = options.mapTheme ?? map.mapTheme ?? 'standard';

  // -1. Ocean current streamlines + manual user-drawn currents
  if (layers.currents || options.overlay === 'currents' || options.tool === 'current') {
    const streams =
      options.currentStreams ??
      traceOceanCurrentStreams(
        map.width,
        map.height,
        map.elevation,
        computeOceanCurrents(
          map.width,
          map.height,
          map.elevation,
          map.geography,
          map.terrains,
          map.manualCurrents
        ),
        map.terrains
      );
    drawOceanCurrentStreams(ctx, streams, BASE_HEX_RADIUS, zoom);

    for (const mc of map.manualCurrents ?? []) {
      if (!mc.points || mc.points.length < 2) continue;
      ctx.save();
      const stroke =
        mc.kind === 'warm'
          ? 'rgba(251, 146, 60, 0.92)'
          : mc.kind === 'cold'
          ? 'rgba(56, 189, 248, 0.92)'
          : 'rgba(165, 243, 252, 0.9)';
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(2.2, (1.8 + mc.strength * 1.4) / Math.max(0.55, zoom * 0.7));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      mc.points.forEach((pt, idx) => {
        const p = hexToPixel(pt.q, pt.r, BASE_HEX_RADIUS);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Arrowhead at end of manual current
      const pPrev = hexToPixel(
        mc.points[mc.points.length - 2].q,
        mc.points[mc.points.length - 2].r,
        BASE_HEX_RADIUS
      );
      const pEnd = hexToPixel(
        mc.points[mc.points.length - 1].q,
        mc.points[mc.points.length - 1].r,
        BASE_HEX_RADIUS
      );
      const ang = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
      const headLen = Math.max(7, 8.5 / Math.max(0.55, zoom * 0.75));
      ctx.fillStyle = stroke;
      ctx.beginPath();
      ctx.moveTo(pEnd.x, pEnd.y);
      ctx.lineTo(pEnd.x - Math.cos(ang - 0.52) * headLen, pEnd.y - Math.sin(ang - 0.52) * headLen);
      ctx.lineTo(pEnd.x - Math.cos(ang + 0.52) * headLen, pEnd.y - Math.sin(ang + 0.52) * headLen);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // 0. Lat/Lon Graticule lines & labels
  if (
    layers.graticule ||
    options.overlay === 'temperature' ||
    options.overlay === 'moisture'
  ) {
    const mapPixelW = map.width * SQRT3 * BASE_HEX_RADIUS;
    const mapPixelH = Math.max(1, map.height - 1) * 1.5 * BASE_HEX_RADIUS;
    const { latNorth, latSouth } = map.geography;
    const lonWest = map.geography.lonWest ?? -180;
    const lonEast = map.geography.lonEast ?? 180;
    const latSpan = Math.abs(latNorth - latSouth);
    const lonSpan = Math.abs(lonEast - lonWest);
    const latStep = latSpan > 90 ? 30 : latSpan > 40 ? 15 : 10;
    const lonStep = lonSpan > 180 ? 60 : lonSpan > 80 ? 30 : 15;

    ctx.save();
    const labelFont = Math.max(10, Math.round(11 / Math.max(0.4, zoom * 0.85)));
    ctx.font = `600 ${labelFont}px Sarabun, sans-serif`;

    // Regular latitude parallels
    const drawLatLine = (
      deg: number,
      stroke: string,
      dash: number[],
      lineWidth: number,
      tag?: string
    ) => {
      if (Math.abs(latNorth - latSouth) < 0.01) return;
      const t = (deg - latNorth) / (latSouth - latNorth);
      if (t < 0 || t > 1) return;
      const py = t * mapPixelH;
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(mapPixelW, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = stroke;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(tag ?? formatLatitude(deg), 8, py - 3);
      ctx.restore();
    };

    const minLat = Math.min(latNorth, latSouth);
    const maxLat = Math.max(latNorth, latSouth);
    const startLat = Math.ceil(minLat / latStep) * latStep;
    for (let deg = startLat; deg <= maxLat; deg += latStep) {
      if (Math.abs(deg) < 0.1) continue;
      drawLatLine(deg, 'rgba(148, 163, 184, 0.32)', [4, 4], Math.max(0.8, 1 / zoom));
    }

    // Special Earth parallels: Equator, Tropics (±23.5°), Polar Circles (±66.5°)
    drawLatLine(0, 'rgba(56, 189, 248, 0.72)', [], Math.max(1.2, 1.5 / zoom), '0° เส้นศูนย์สูตร');
    drawLatLine(23.5, 'rgba(251, 191, 36, 0.48)', [6, 5], Math.max(0.9, 1.1 / zoom), '23.5°N (Tropic)');
    drawLatLine(-23.5, 'rgba(251, 191, 36, 0.48)', [6, 5], Math.max(0.9, 1.1 / zoom), '23.5°S (Tropic)');
    drawLatLine(66.5, 'rgba(186, 230, 253, 0.48)', [2, 4], Math.max(0.9, 1.1 / zoom), '66.5°N (Arctic)');
    drawLatLine(-66.5, 'rgba(186, 230, 253, 0.48)', [2, 4], Math.max(0.9, 1.1 / zoom), '66.5°S (Antarctic)');

    // Meridians (Longitude)
    const minLon = Math.min(lonWest, lonEast);
    const maxLon = Math.max(lonWest, lonEast);
    const startLon = Math.ceil(minLon / lonStep) * lonStep;
    for (let deg = startLon; deg <= maxLon; deg += lonStep) {
      if (Math.abs(lonEast - lonWest) < 0.01) break;
      const t = (deg - lonWest) / (lonEast - lonWest);
      if (t < 0 || t > 1) continue;
      const px = t * mapPixelW;
      const isPrime = Math.abs(deg) < 0.1;
      ctx.save();
      ctx.strokeStyle = isPrime ? 'rgba(251, 191, 36, 0.55)' : 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = isPrime ? Math.max(1.1, 1.4 / zoom) : Math.max(0.8, 1 / zoom);
      ctx.setLineDash(isPrime ? [6, 4] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, mapPixelH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = isPrime ? 'rgba(251, 191, 36, 0.85)' : 'rgba(203, 213, 225, 0.72)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(isPrime ? '0° (Prime)' : formatLongitude(deg), px, 8);
      ctx.restore();
    }
    ctx.restore();
  }

  // 1. Prevailing 2D wind arrows on climate overlays
  if (options.overlay === 'moisture' || options.overlay === 'temperature') {
    const stepR = Math.max(7, Math.floor(map.height / 7));
    const stepQ = Math.max(10, Math.floor(map.width / 8));
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = Math.max(1.2, 1.8 / zoom);
    ctx.lineCap = 'round';
    for (let r = Math.floor(stepR / 2); r < map.height; r += stepR) {
      const lat = getRowLatitude(r, map.height, map.geography);
      for (let q = Math.floor(stepQ / 2); q < map.width; q += stepQ) {
        const lon = getColLongitude(q, map.width, map.geography);
        const { dx, dy } = getPrevailingWindVector(lat, lon, map.geography.windMode);
        const angle = Math.atan2(dy, dx);
        const p = hexToPixel(q, r, BASE_HEX_RADIUS);
        const halfLen = BASE_HEX_RADIUS * 0.85;
        const tipX = p.x + Math.cos(angle) * halfLen;
        const tipY = p.y + Math.sin(angle) * halfLen;
        const tailX = p.x - Math.cos(angle) * halfLen;
        const tailY = p.y - Math.sin(angle) * halfLen;

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        const headLen = BASE_HEX_RADIUS * 0.42;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - Math.cos(angle - 0.55) * headLen,
          tipY - Math.sin(angle - 0.55) * headLen
        );
        ctx.lineTo(
          tipX - Math.cos(angle + 0.55) * headLen,
          tipY - Math.sin(angle + 0.55) * headLen
        );
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 2. Political & Religion centroid labels
  if (options.overlay === 'political') {
    const govMap = new Map(
      getAllGovernmentTypes(map.customGovernmentTypes).map((g) => [g.id, g.label])
    );
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
  } else if (options.overlay === 'culture' || layers.cultures) {
    const cultTypeMap = new Map(
      getAllCultureTypes(map.customCultureTypes).map((ct) => [ct.id, ct.label])
    );
    drawCentroidLabels(
      ctx,
      map,
      map.cultures ?? [],
      (map.cultureList ?? []).map((c) => ({
        id: c.id,
        name: `${c.symbol} ${c.name}`,
        color: c.color,
        sub: options.overlay === 'culture' ? cultTypeMap.get(c.type) ?? c.type : undefined,
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
    ctx.strokeStyle =
      options.tool === 'river'
        ? '#38bdf8'
        : options.tool === 'current'
        ? '#fb923c'
        : options.tool === 'campaign'
        ? '#ef4444'
        : '#fbbf24';
    ctx.lineWidth = options.tool === 'current' || options.tool === 'campaign' ? 3.8 : 3.2;
    ctx.lineCap = 'round';
    if (options.tool === 'current' || options.tool === 'campaign') ctx.setLineDash([7, 5]);
    ctx.beginPath();
    options.draftPath.forEach((h, i) => {
      const p = hexToPixel(h.q, h.r, BASE_HEX_RADIUS);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  // 5b. Military Campaigns & Advance Arrows
  if (layers.campaigns !== false && (map.campaigns ?? []).length > 0) {
    const kColorMap = new Map(map.kingdoms.map((k) => [k.id, k.color]));
    for (const cp of map.campaigns!) {
      if (!cp.points || cp.points.length < 2) continue;
      const col = kColorMap.get(cp.kingdomId) ?? '#ef4444';
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = cp.status === 'defeat' ? 'rgba(148, 163, 184, 0.72)' : col;
      ctx.lineWidth = cp.status === 'active' ? 3.8 : 3.0;
      if (cp.status === 'planned') ctx.setLineDash([6, 4]);
      else if (cp.status === 'defeat') ctx.setLineDash([3, 4]);

      ctx.beginPath();
      cp.points.forEach((pt, i) => {
        const p = hexToPixel(pt.q, pt.r, BASE_HEX_RADIUS);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const pPrev = hexToPixel(
        cp.points[cp.points.length - 2].q,
        cp.points[cp.points.length - 2].r,
        BASE_HEX_RADIUS
      );
      const pEnd = hexToPixel(
        cp.points[cp.points.length - 1].q,
        cp.points[cp.points.length - 1].r,
        BASE_HEX_RADIUS
      );
      const ang = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
      const head = Math.max(8, 10 / Math.max(0.6, zoom * 0.8));
      ctx.fillStyle = cp.status === 'defeat' ? '#94a3b8' : col;
      ctx.beginPath();
      ctx.moveTo(pEnd.x, pEnd.y);
      ctx.lineTo(pEnd.x - Math.cos(ang - 0.48) * head, pEnd.y - Math.sin(ang - 0.48) * head);
      ctx.lineTo(pEnd.x - Math.cos(ang + 0.48) * head, pEnd.y - Math.sin(ang + 0.48) * head);
      ctx.closePath();
      ctx.fill();

      // Campaign Name tag at midpoint
      if (zoom >= 0.4) {
        const midPt = cp.points[Math.floor(cp.points.length / 2)];
        const mp = hexToPixel(midPt.q, midPt.r, BASE_HEX_RADIUS);
        ctx.font = '600 10px Sarabun, sans-serif';
        const label = `⚔️ ${cp.name}`;
        const tw = ctx.measureText(label).width + 10;
        ctx.fillStyle = 'rgba(15, 23, 34, 0.88)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mp.x - tw / 2, mp.y - 16, tw, 17, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, mp.x, mp.y - 7.5);
      }

      // Battle markers along campaign
      for (const b of cp.battles ?? []) {
        const bp = hexToPixel(b.q, b.r, BASE_HEX_RADIUS);
        ctx.fillStyle = '#7f1d1d';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText('⚔', bp.x, bp.y + 0.5);
      }
      ctx.restore();
    }
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

  // 8. Custom Map Labels (supports curved arcs & rotation)
  if (layers.labels) {
    for (const lbl of map.labels) {
      const p = hexToPixel(lbl.q, lbl.r, BASE_HEX_RADIUS);
      drawCurvedMapLabel(ctx, lbl, p.x, p.y, mapTheme);
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
      options.tool === 'terrain' ||
      options.tool === 'biome' ||
      options.tool === 'territory' ||
      options.tool === 'religion' ||
      options.tool === 'culture'
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
    mapTheme?: MapTheme;
  }
): string {
  const mapTheme = options.mapTheme ?? map.mapTheme ?? 'standard';
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
  const cultureColorMap = new Map((map.cultureList ?? []).map((c) => [c.id, c.color]));
  const exportCurrents =
    options.overlay === 'currents' || options.layers.currents
      ? computeOceanCurrents(
          map.width,
          map.height,
          map.elevation,
          map.geography,
          map.terrains,
          map.manualCurrents
        )
      : null;

  for (let r = 0; r < map.height; r++) {
    for (let q = 0; q < map.width; q++) {
      const idx = hexIndex(q, r, map.width);
      const biomeId = map.biomes[idx];
      const terrainId = getHexTerrain(map, idx);
      const terrainMeta = getTerrainMetaWithCustom(
        terrainId,
        map.customTerrains,
        map.terrainOverrides
      );
      const meta = getBiomeMetaWithCustom(biomeId, map.customBiomes);
      const isWater =
        isWaterTerrainWithCustom(terrainId, map.customTerrains, map.terrainOverrides) ||
        meta.isWater;
      const temp = map.temperature[idx] ?? 15;
      const pos = hexToPixel(q, r, hexRadius);
      traceHexPath(ctx, pos.x, pos.y, hexRadius + 0.4);
      let hexFill =
        options.overlay === 'elevation'
          ? elevationColor(map.elevation[idx] ?? 0)
          : options.overlay === 'temperature'
          ? temperatureColor(temp)
          : options.overlay === 'moisture'
          ? moistureColor(map.moisture[idx] ?? 0.5)
          : options.overlay === 'currents' && exportCurrents
          ? terrainId === TerrainId.LAKE
            ? '#3b8ec2'
            : isWater
            ? oceanCurrentFillColor(exportCurrents.thermal[idx], exportCurrents.speed[idx])
            : mixRgb(hexToRgb(terrainMeta.color), [42, 50, 62], 0.45)
          : options.overlay === 'terrain'
          ? terrainMeta.color
          : options.overlay === 'biome'
          ? isWater
            ? meta.isCustom
              ? meta.color
              : terrainMeta.color
            : meta.color
          : isWater
          ? meta.isCustom
            ? meta.color
            : terrainMeta.color
          : meta.color;
      if (
        !isWater &&
        options.overlay !== 'elevation' &&
        options.overlay !== 'temperature' &&
        options.overlay !== 'moisture' &&
        options.overlay !== 'currents' &&
        options.overlay !== 'terrain' &&
        options.overlay !== 'biome'
      ) {
        if (terrainId === TerrainId.MOUNTAIN) {
          hexFill = mixRgb(hexToRgb(hexFill), [122, 112, 101], 0.24);
        } else if (terrainId === TerrainId.HIGH_PEAK) {
          const targetRgb: [number, number, number] =
            biomeId === BiomeId.SNOW_ICE || temp <= 4 ? [207, 216, 224] : [123, 115, 106];
          hexFill = mixRgb(hexToRgb(hexFill), targetRgb, 0.32);
        }
      }
      if (
        options.overlay === 'none' ||
        options.overlay === 'terrain' ||
        options.overlay === 'biome'
      ) {
        const rgb0 = hexFill.startsWith('rgb')
          ? (hexFill.match(/\d+/g)!.map(Number) as [number, number, number])
          : hexToRgb(hexFill);
        const themed = applyThemeColor(rgb0, mapTheme, isWater, terrainId);
        const hillDelta =
          !isWater && options.layers.hillshade !== false
            ? computeHillshadeDelta(map.elevation, map.width, map.height, q, r)
            : 0;
        hexFill = `rgb(${Math.max(0, Math.min(255, themed[0] + hillDelta))},${Math.max(
          0,
          Math.min(255, themed[1] + hillDelta)
        )},${Math.max(0, Math.min(255, themed[2] + hillDelta))})`;
      }
      ctx.fillStyle = hexFill;
      ctx.fill();
      if (options.layers.contours && !isWater) {
        const curLvl = Math.floor(Math.max(0, map.elevation[idx] ?? 0) * 10);
        if (curLvl > 0) {
          const nbs = getNeighborsWithEdge(q, r, map.width, map.height);
          ctx.save();
          ctx.strokeStyle =
            mapTheme === 'parchment' ? 'rgba(72, 48, 28, 0.48)' : 'rgba(15, 23, 42, 0.45)';
          ctx.lineWidth = curLvl % 2 === 0 ? 1.4 : 0.85;
          for (const nb of nbs) {
            if (!nb.inMap) continue;
            const nbIdx = hexIndex(nb.q, nb.r, map.width);
            if (Math.floor(Math.max(0, map.elevation[nbIdx] ?? 0) * 10) < curLvl) {
              const [x1, y1] = hexVertex(pos.x, pos.y, hexRadius - 0.4, nb.edge);
              const [x2, y2] = hexVertex(pos.x, pos.y, hexRadius - 0.4, nb.edge + 1);
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
      if (
        options.overlay === 'none' ||
        options.overlay === 'terrain' ||
        options.overlay === 'biome' ||
        options.overlay === 'political' ||
        options.overlay === 'religion' ||
        options.overlay === 'culture'
      ) {
        if (terrainId === TerrainId.SHALLOW_WATER) {
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
        } else if (terrainId === TerrainId.LAKE) {
          drawLakeDetails(ctx, map, q, r, pos.x, pos.y, hexRadius);
        }
      }
      if (options.overlay === 'none') {
        if (!isWater && terrainId !== TerrainId.MOUNTAIN && terrainId !== TerrainId.HIGH_PEAK) {
          drawBiomeDetail(ctx, pos.x, pos.y, hexRadius, meta.detailStyle, hash2D(q, r));
        }
        if (
          !isWater &&
          terrainMeta.reliefStyle !== 'flat' &&
          terrainMeta.reliefStyle !== 'water' &&
          terrainMeta.reliefStyle !== 'lake'
        ) {
          drawTerrainDetail(ctx, pos.x, pos.y, hexRadius, terrainMeta, biomeId, temp, false);
        }
        if (options.layers.features && map.features?.[idx]) {
          if (map.features[idx] === 'cliff') {
            drawCliffOverlay(ctx, map, q, r, pos.x, pos.y, hexRadius);
          } else {
            drawSpecialFeature(
              ctx,
              pos.x,
              pos.y,
              hexRadius,
              map.features[idx],
              map.customFeatures,
              map.featureOverrides
            );
          }
        }
      } else if (options.overlay === 'terrain') {
        if (
          !isWater &&
          terrainMeta.reliefStyle !== 'flat' &&
          terrainMeta.reliefStyle !== 'water' &&
          terrainMeta.reliefStyle !== 'lake'
        ) {
          drawTerrainDetail(ctx, pos.x, pos.y, hexRadius, terrainMeta, biomeId, 15, true);
        }
        if (options.layers.features && map.features?.[idx] === 'cliff') {
          drawCliffOverlay(ctx, map, q, r, pos.x, pos.y, hexRadius);
        }
      } else if (options.overlay === 'biome') {
        if (!isWater) {
          drawBiomeDetail(ctx, pos.x, pos.y, hexRadius, meta.detailStyle, hash2D(q, r));
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
      const cultId = map.cultures?.[idx] ?? '';
      if (cultId && (options.overlay === 'culture' || options.layers.cultures)) {
        const cCol = cultureColorMap.get(cultId);
        if (cCol) {
          traceHexPath(ctx, pos.x, pos.y, hexRadius + 0.2);
          ctx.fillStyle = options.overlay === 'culture' ? `${cCol}88` : `${cCol}2c`;
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
  const exportStreams =
    exportCurrents && (options.overlay === 'currents' || options.layers.currents)
      ? traceOceanCurrentStreams(
          map.width,
          map.height,
          map.elevation,
          exportCurrents,
          map.terrains
        )
      : undefined;
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
    currentStreams: exportStreams,
    mapTheme,
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
        : options.overlay === 'culture'
        ? 'วัฒนธรรม & อารยธรรม'
        : options.overlay === 'elevation'
        ? 'ความสูง & ความลึก (ม.)'
        : options.overlay === 'currents'
        ? 'กระแสน้ำมหาสมุทร (Currents)'
        : options.overlay === 'terrain'
        ? 'ภูมิประเทศ (Terrain)'
        : options.overlay === 'biome'
        ? 'ไบโอม (Biomes)'
        : 'ภูมิประเทศ & ไบโอม',
      lx,
      ly
    );
    ly += 22;

    if (options.overlay === 'elevation') {
      const bands = [
        { color: elevationColor(0.92), label: '+6,000 ถึง +8,850 ม. (ยอดเขาสูง)' },
        { color: elevationColor(0.68), label: '+3,000 ถึง +5,200 ม. (เทือกเขา)' },
        { color: elevationColor(0.52), label: '+1,400 ถึง +2,800 ม. (ที่ราบสูง)' },
        { color: elevationColor(0.38), label: '+400 ถึง +1,400 ม. (เนินเขา)' },
        { color: elevationColor(0.14), label: '0 ถึง +400 ม. (ที่ราบลุ่ม)' },
        { color: elevationColor(-0.12), label: '-200 ถึง 0 ม. (ไหล่ทวีป/น้ำตื้น)' },
        { color: elevationColor(-0.65), label: '-6,000 ถึง -200 ม. (ร่องลึกมหาสมุทร)' },
      ];
      for (const item of bands) {
        ctx.fillStyle = item.color;
        ctx.fillRect(lx, ly - 10, 14, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(lx, ly - 10, 14, 14);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 11px Sarabun, sans-serif';
        ctx.fillText(item.label, lx + 22, ly + 1);
        ly += 20;
      }
    } else if (options.overlay === 'currents') {
      const items = [
        { color: '#f97316', label: 'กระแสน้ำอุ่น (Warm Current)' },
        { color: '#38bdf8', label: 'กระแสน้ำเย็น (Cold Current)' },
        { color: '#67e8f9', label: 'กระแสน้ำกลาง (Neutral Drift)' },
        { color: '#3b8ec2', label: 'ทะเลสาบ (Lake)' },
      ];
      for (const item of items) {
        ctx.fillStyle = item.color;
        ctx.fillRect(lx, ly - 10, 14, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(lx, ly - 10, 14, 14);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 12px Sarabun, sans-serif';
        ctx.fillText(item.label, lx + 22, ly + 1);
        ly += 22;
      }
    } else if (options.overlay === 'political') {
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
    } else if (options.overlay === 'culture') {
      for (const c of map.cultureList ?? []) {
        ctx.fillStyle = c.color;
        ctx.fillRect(lx, ly - 10, 14, 14);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 12px Sarabun, sans-serif';
        ctx.fillText(`${c.symbol} ${c.name}`, lx + 22, ly + 1);
        ly += 22;
      }
    } else if (options.overlay === 'terrain') {
      const tCounts = new Map<number, number>();
      for (let i = 0; i < map.biomes.length; i++) {
        const tId = getHexTerrain(map, i);
        tCounts.set(tId, (tCounts.get(tId) ?? 0) + 1);
      }
      for (const t of getAllTerrains(map.customTerrains, map.terrainOverrides)) {
        const cnt = tCounts.get(t.id) ?? 0;
        if (cnt === 0) continue;
        ctx.fillStyle = t.color;
        ctx.fillRect(lx, ly - 10, 14, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(lx, ly - 10, 14, 14);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 12px Sarabun, sans-serif';
        ctx.fillText(`${t.nameTh} (${cnt})`, lx + 22, ly + 1);
        ly += 22;
      }
    } else if (options.overlay === 'biome') {
      const bCounts = new Map<number, number>();
      for (const b of map.biomes) bCounts.set(b, (bCounts.get(b) ?? 0) + 1);
      for (const b of getPaintableBiomes(map.customBiomes)) {
        const cnt = bCounts.get(b.id) ?? 0;
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
    } else {
      const tCounts = new Map<number, number>();
      const bCounts = new Map<number, number>();
      for (let i = 0; i < map.biomes.length; i++) {
        const tId = getHexTerrain(map, i);
        tCounts.set(tId, (tCounts.get(tId) ?? 0) + 1);
        const b = map.biomes[i];
        bCounts.set(b, (bCounts.get(b) ?? 0) + 1);
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 11px Sarabun, sans-serif';
      ctx.fillText('ภูมิประเทศ', lx, ly);
      ly += 16;
      for (const t of getAllTerrains(map.customTerrains, map.terrainOverrides)) {
        const cnt = tCounts.get(t.id) ?? 0;
        if (cnt === 0) continue;
        ctx.fillStyle = t.color;
        ctx.fillRect(lx, ly - 9, 12, 12);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(lx, ly - 9, 12, 12);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 11px Sarabun, sans-serif';
        ctx.fillText(`${t.nameTh} (${cnt})`, lx + 18, ly + 1);
        ly += 18;
      }

      ly += 6;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 11px Sarabun, sans-serif';
      ctx.fillText('ไบโอม', lx, ly);
      ly += 16;
      for (const b of getPaintableBiomes(map.customBiomes)) {
        const cnt = bCounts.get(b.id) ?? 0;
        if (cnt === 0) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(lx, ly - 9, 12, 12);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(lx, ly - 9, 12, 12);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '400 11px Sarabun, sans-serif';
        ctx.fillText(`${b.nameTh} (${cnt})`, lx + 18, ly + 1);
        ly += 18;
      }
    }
  }

  return canvas.toDataURL('image/png');
}
