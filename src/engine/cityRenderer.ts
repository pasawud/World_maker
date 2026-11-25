import { getBiomeMetaWithCustom } from '../data/biomes';
import { ARCHITECTURE_STYLES, CITY_TIERS } from '../data/goods';
import {
  City,
  CityPlanData,
  HexMapData,
} from '../types/map';
import { cardinalToAngle } from './cityGenerator';
import { hexIndex } from './hexMath';
import { mulberry32 } from './noise';

export interface CityRenderViewState {
  camX: number;
  camY: number;
  zoom: number;
  selectedDistrictId?: string | null;
  selectedBuildingId?: string | null;
}

function drawWaterEdge(
  ctx: CanvasRenderingContext2D,
  plan: CityPlanData
): void {
  if (plan.waterSide === 'none') return;
  ctx.save();
  ctx.fillStyle = '#1b4f78';
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 4;

  const coastPos = 740;
  const invPos = 260;
  ctx.beginPath();
  if (plan.waterSide === 'east') {
    ctx.moveTo(coastPos, -200);
    ctx.quadraticCurveTo(coastPos - 45, 500, coastPos + 15, 1200);
    ctx.lineTo(1300, 1200);
    ctx.lineTo(1300, -200);
  } else if (plan.waterSide === 'west') {
    ctx.moveTo(invPos, -200);
    ctx.quadraticCurveTo(invPos + 45, 500, invPos - 15, 1200);
    ctx.lineTo(-300, 1200);
    ctx.lineTo(-300, -200);
  } else if (plan.waterSide === 'south') {
    ctx.moveTo(-200, coastPos);
    ctx.quadraticCurveTo(500, coastPos - 45, 1200, coastPos + 15);
    ctx.lineTo(1200, 1300);
    ctx.lineTo(-200, 1300);
  } else {
    ctx.moveTo(-200, invPos);
    ctx.quadraticCurveTo(500, invPos + 45, 1200, invPos - 15);
    ctx.lineTo(1200, -300);
    ctx.lineTo(-200, -300);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Shallow surf band
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Draw wooden docks near harbor districts
  for (const d of plan.districts) {
    if (d.type !== 'harbor') continue;
    const ang = cardinalToAngle(plan.waterSide);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(ang);
    ctx.fillStyle = '#7c5338';
    for (let k = -1; k <= 1; k++) {
      ctx.fillRect(10, k * 24 - 4, 65, 8);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawCliffEscarpment(ctx: CanvasRenderingContext2D, plan: CityPlanData): void {
  if (!plan.hasCliff) return;
  const ang = cardinalToAngle(plan.cliffSide);
  ctx.save();
  ctx.translate(500, 500);
  ctx.rotate(ang);
  ctx.strokeStyle = '#3f362e';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, plan.wallRadius + 24, -0.75, 0.75);
  ctx.stroke();

  ctx.strokeStyle = '#a89a8e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, plan.wallRadius + 16, -0.73, 0.73);
  ctx.stroke();
  ctx.restore();
}

function drawCityRiver(ctx: CanvasRenderingContext2D, plan: CityPlanData): void {
  if (!plan.hasRiver) return;
  ctx.save();
  ctx.translate(500, 500);
  ctx.rotate(plan.riverAngle);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1e4e73';
  ctx.lineWidth = 44;
  ctx.beginPath();
  ctx.moveTo(-700, -25);
  ctx.bezierCurveTo(-220, 45, 220, -45, 700, 25);
  ctx.stroke();

  ctx.strokeStyle = '#3898d4';
  ctx.lineWidth = 30;
  ctx.stroke();
  ctx.restore();
}

function drawWallsAndGates(ctx: CanvasRenderingContext2D, plan: CityPlanData): void {
  if (!plan.hasWalls || plan.wallStyle === 'none') return;
  const r = plan.wallRadius;
  const cx = 500;
  const cy = 500;

  ctx.save();
  const isWood = plan.wallStyle === 'wooden';
  ctx.strokeStyle = isWood ? '#7c5338' : '#cbd5e1';
  ctx.lineWidth = plan.wallStyle === 'citadel_double' ? 11 : isWood ? 7 : 9;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + (isWood ? 3.5 : 4.5), 0, Math.PI * 2);
  ctx.stroke();

  if (plan.wallStyle === 'citadel_double') {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Watchtowers around perimeter
  const towerCount = 10;
  for (let i = 0; i < towerCount; i++) {
    const a = (i / towerCount) * Math.PI * 2;
    const tx = cx + Math.cos(a) * r;
    const ty = cy + Math.sin(a) * r;
    ctx.fillStyle = isWood ? '#926242' : '#94a3b8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // City Gates
  for (const gate of plan.gates) {
    const gx = cx + Math.cos(gate.angle) * r;
    const gy = cy + Math.sin(gate.angle) * r;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(gate.angle);
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.fillRect(-8, -14, 16, 28);
    ctx.strokeRect(-8, -14, 16, 28);
    ctx.restore();

    ctx.font = '600 11px Sarabun, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(gate.name, gx + Math.cos(gate.angle) * 24, gy + Math.sin(gate.angle) * 24);
  }

  ctx.restore();
}

/** Render interactive 2D city blueprint canvas in 0..1000 city world coordinates. */
export function renderCityPlan(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  city: City,
  plan: CityPlanData,
  map: HexMapData,
  viewState?: CityRenderViewState
): void {
  const camX = viewState?.camX ?? 500;
  const camY = viewState?.camY ?? 500;
  const zoom = viewState?.zoom ?? Math.min(viewW, viewH) / 1040;

  const cityIdx = hexIndex(city.q, city.r, map.width);
  const biomeMeta = getBiomeMetaWithCustom(map.biomes[cityIdx] ?? 7, map.customBiomes);
  const archStyleId = city.profile?.architectureStyle || 'medieval';
  const archMeta = ARCHITECTURE_STYLES.find((a) => a.id === archStyleId) ?? ARCHITECTURE_STYLES[0];

  ctx.fillStyle = '#141d26';
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.save();
  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  // Outer ground & subtle farmland grid
  ctx.fillStyle = biomeMeta.isWater ? '#4a6b48' : biomeMeta.color;
  ctx.globalAlpha = 0.34;
  ctx.fillRect(-300, -300, 1600, 1600);
  ctx.globalAlpha = 1;

  // Background parchment / cartography grass base
  ctx.fillStyle = '#25352b';
  ctx.beginPath();
  ctx.arc(500, 500, 480, 0, Math.PI * 2);
  ctx.fill();

  drawWaterEdge(ctx, plan);
  drawCityRiver(ctx, plan);
  drawCliffEscarpment(ctx, plan);

  // Districts (organic zones + miniature rooftops)
  const rng = mulberry32(plan.seed);
  for (const d of plan.districts) {
    const isSel = viewState?.selectedDistrictId === d.id;
    ctx.save();
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
    ctx.fillStyle = `${d.color}30`;
    ctx.fill();
    ctx.strokeStyle = isSel ? '#fde047' : `${d.color}aa`;
    ctx.lineWidth = isSel ? 3.5 : 1.8;
    if (!isSel) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Miniature deterministic rooftops inside district
    if (d.type !== 'farmstead') {
      const houseCount = Math.max(4, Math.min(22, Math.round(d.radius * 0.22)));
      for (let i = 0; i < houseCount; i++) {
        const a = rng() * Math.PI * 2;
        const dist = Math.sqrt(rng()) * (d.radius - 16);
        const hx = d.x + Math.cos(a) * dist;
        const hy = d.y + Math.sin(a) * dist;
        const hw = 9 + rng() * 10;
        const hh = 7 + rng() * 9;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(rng() * Math.PI);
        ctx.fillStyle = d.type === 'citadel' || d.type === 'temple' ? archMeta.wallColor : archMeta.roofColor;
        ctx.strokeStyle = 'rgba(10, 15, 22, 0.75)';
        ctx.lineWidth = 1;
        ctx.fillRect(-hw / 2, -hh / 2, hw, hh);
        ctx.strokeRect(-hw / 2, -hh / 2, hw, hh);
        ctx.restore();
      }
    } else {
      // Farmland stripes
      ctx.strokeStyle = 'rgba(132, 204, 22, 0.35)';
      ctx.lineWidth = 3;
      for (let s = -d.radius + 18; s < d.radius - 18; s += 14) {
        ctx.beginPath();
        ctx.moveTo(d.x - d.radius * 0.55, d.y + s);
        ctx.lineTo(d.x + d.radius * 0.55, d.y + s);
        ctx.stroke();
      }
    }

    ctx.font = '600 12px Sarabun, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isSel ? '#fef08a' : '#f1f5f9';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(d.name, d.x, d.y + d.radius - 10);
    ctx.restore();
  }

  // Roads & bridges
  for (const road of plan.roads) {
    if (road.points.length < 2) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (road.kind === 'bridge') {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 14;
    } else if (road.kind === 'main') {
      ctx.strokeStyle = '#d6c7ae';
      ctx.lineWidth = 9;
    } else {
      ctx.strokeStyle = 'rgba(214, 199, 174, 0.55)';
      ctx.lineWidth = 4;
    }
    ctx.beginPath();
    road.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  drawWallsAndGates(ctx, plan);

  // Landmarks / Buildings
  for (const b of plan.buildings) {
    const isSel = viewState?.selectedBuildingId === b.id;
    ctx.save();
    if (isSel) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 19, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = isSel ? '#fbbf24' : '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.symbol, b.x, b.y + 1);

    ctx.font = '600 11px Sarabun, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    ctx.fillText(b.name, b.x, b.y - 22);
    ctx.restore();
  }

  ctx.restore();
}

/** Export the city blueprint as a high-resolution cartographic PNG with title and district legend. */
export function exportCityPlanToPng(city: City, plan: CityPlanData, map: HexMapData): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 960;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0e1722';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render city plan on left 960x880 region
  ctx.save();
  ctx.translate(20, 70);
  ctx.beginPath();
  ctx.rect(0, 0, 940, 870);
  ctx.clip();
  renderCityPlan(ctx, 940, 870, city, plan, map, { camX: 500, camY: 500, zoom: 0.84 });
  ctx.restore();

  ctx.strokeStyle = 'rgba(217, 155, 56, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 70, 940, 870);

  // Title banner
  const tierLabel = CITY_TIERS.find((t) => t.id === city.tier)?.label ?? city.tier;
  const kingdom = map.kingdoms.find((k) => k.id === city.kingdomId);
  ctx.fillStyle = '#f3d08a';
  ctx.font = '700 26px Cinzel, Sarabun, serif';
  ctx.fillText(`ผังเมือง ${city.name}`, 24, 34);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 14px Sarabun, sans-serif';
  ctx.fillText(
    `${tierLabel} · ประชากร ${city.population.toLocaleString()} คน · ${kingdom?.name ?? 'อิสระ'} · พิกัด (${city.q}, ${city.r})`,
    24,
    56
  );

  // Legend panel on right
  const lx = 985;
  let ly = 90;
  ctx.fillStyle = '#f3d08a';
  ctx.font = '600 16px Sarabun, sans-serif';
  ctx.fillText('เขตย่านในเมือง (Districts)', lx, ly);
  ly += 24;

  for (const d of plan.districts) {
    ctx.fillStyle = d.color;
    ctx.fillRect(lx, ly - 10, 14, 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '400 13px Sarabun, sans-serif';
    ctx.fillText(`${d.name} (${d.populationShare}%)`, lx + 22, ly + 1);
    ly += 22;
  }

  ly += 14;
  ctx.fillStyle = '#f3d08a';
  ctx.font = '600 16px Sarabun, sans-serif';
  ctx.fillText('อาคารสำคัญ (Landmarks)', lx, ly);
  ly += 24;

  for (const b of plan.buildings.slice(0, 14)) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '400 13px Sarabun, sans-serif';
    ctx.fillText(`${b.symbol} ${b.name}`, lx, ly);
    ly += 21;
  }

  return canvas.toDataURL('image/png');
}
