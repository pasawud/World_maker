import { CITY_TIERS } from '../data/goods';
import {
  City,
  CityBlueprintTheme,
  CityPlanData,
  HexMapData,
} from '../types/map';
import { buildCityGeometry, CityGeometry, Point2D } from './cityGeometry';

export interface CityRenderViewState {
  camX: number;
  camY: number;
  zoom: number;
  selectedDistrictId?: string | null;
  selectedBuildingId?: string | null;
  geometry?: CityGeometry;
}

interface Palette {
  paperBg: string;
  streetBg: string;
  buildingFill: string;
  buildingStroke: string;
  parkFill: string;
  waterFill: string;
  waterStroke: string;
  waterContour: string;
  wallStroke: string;
  roadFill: string;
  roadStroke: string;
  farmHatch: string;
  treeFill: string;
  treeStroke: string;
  textColor: string;
  scaleDark: string;
  scaleLight: string;
}

function getThemePalette(theme: CityBlueprintTheme): Palette {
  if (theme === 'dark') {
    return {
      paperBg: '#111822',
      streetBg: '#192433',
      buildingFill: '#3b4a5e',
      buildingStroke: '#94a3b8',
      parkFill: '#24352f',
      waterFill: '#173e61',
      waterStroke: '#38bdf8',
      waterContour: 'rgba(125, 211, 252, 0.25)',
      wallStroke: '#e2e8f0',
      roadFill: '#223144',
      roadStroke: '#64748b',
      farmHatch: 'rgba(100, 116, 139, 0.35)',
      treeFill: '#2f5e44',
      treeStroke: '#12291d',
      textColor: '#f1f5f9',
      scaleDark: '#e2e8f0',
      scaleLight: '#1e293b',
    };
  }
  return {
    paperBg: '#d5ccbe',
    streetBg: '#e4ddd0',
    buildingFill: '#aaa396',
    buildingStroke: '#1c1a17',
    parkFill: '#9a9589',
    waterFill: '#848078',
    waterStroke: '#2b2824',
    waterContour: 'rgba(42, 39, 34, 0.42)',
    wallStroke: '#141210',
    roadFill: '#e4ddd0',
    roadStroke: '#3b3731',
    farmHatch: 'rgba(115, 108, 96, 0.56)',
    treeFill: '#8b867b',
    treeStroke: '#46423b',
    textColor: '#1f1c18',
    scaleDark: '#1c1a17',
    scaleLight: '#e4ddd0',
  };
}

function tracePoly(ctx: CanvasRenderingContext2D, pts: Point2D[]): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
}

function drawTreeGroup(
  ctx: CanvasRenderingContext2D,
  trees: { x: number; y: number; r: number }[],
  pal: Palette
): void {
  if (trees.length === 0) return;
  ctx.save();
  // First pass: dark outline circles
  ctx.fillStyle = pal.treeStroke;
  for (const t of trees) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r + 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // Second pass: inner muted foliage fills so adjacent trees fuse organically
  ctx.fillStyle = pal.treeFill;
  for (const t of trees) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  _viewW: number,
  viewH: number,
  zoom: number,
  pal: Palette
): void {
  // 100 world units ~= 100 yards/meters; keep clean 5-segment cartographic bar
  const segPx = Math.max(18, Math.min(48, 38 * Math.min(1.3, Math.max(0.65, zoom))));
  const totalW = segPx * 5;
  const x0 = 18;
  const y0 = viewH - 22;
  const barH = 6;

  ctx.save();
  ctx.font = '600 12px Cinzel, Georgia, serif';
  ctx.fillStyle = pal.textColor;
  ctx.textBaseline = 'bottom';

  for (let i = 0; i < 5; i++) {
    const sx = x0 + i * segPx;
    ctx.fillStyle = i % 2 === 0 ? pal.scaleLight : pal.scaleDark;
    ctx.fillRect(sx, y0, segPx, barH);
    ctx.strokeStyle = pal.scaleDark;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, y0, segPx, barH);

    const val = (i + 1) * 100;
    const label = i === 4 ? `${val} ม.` : `${val}`;
    ctx.fillStyle = pal.textColor;
    ctx.textAlign = 'center';
    ctx.fillText(label, sx + segPx, y0 - 4);
  }
  // Subtle baseline tick at 0
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y0 + barH + 2);
  ctx.moveTo(x0 + totalW, y0);
  ctx.lineTo(x0 + totalW, y0 + barH + 2);
  ctx.strokeStyle = pal.scaleDark;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** Render medieval cartographic 2D city blueprint matching Watabou parchment-and-ink aesthetics. */
export function renderCityPlan(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  city: City,
  plan: CityPlanData,
  _map: HexMapData,
  viewState?: CityRenderViewState
): void {
  const camX = viewState?.camX ?? 500;
  const camY = viewState?.camY ?? 500;
  const zoom = viewState?.zoom ?? Math.min(viewW, viewH) / 1040;
  const theme: CityBlueprintTheme = plan.theme ?? 'parchment';
  const pal = getThemePalette(theme);
  const geom = viewState?.geometry ?? buildCityGeometry(plan, city);

  // 1. Warm Parchment Background
  ctx.fillStyle = pal.paperBg;
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.save();
  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  // 2. Parallel-Hatched Farmland Fields (no bounding box, pure Watabou hatch stripes)
  for (const field of geom.farmFields) {
    ctx.save();
    tracePoly(ctx, field.polygon);
    ctx.clip();

    const cx = field.polygon.reduce((s, p) => s + p.x, 0) / field.polygon.length;
    const cy = field.polygon.reduce((s, p) => s + p.y, 0) / field.polygon.length;
    ctx.translate(cx, cy);
    ctx.rotate(field.hatchAngle);
    ctx.strokeStyle = pal.farmHatch;
    ctx.lineWidth = 0.85;
    for (let y = -70; y <= 70; y += 4.2) {
      ctx.beginPath();
      ctx.moveTo(-75, y);
      ctx.lineTo(75, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Outer Roads (double-lined cartographic tracks)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const road of geom.outerRoads) {
    if (road.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(road[0].x, road[0].y);
    for (let i = 1; i < road.length; i++) ctx.lineTo(road[i].x, road[i].y);
    ctx.strokeStyle = pal.roadStroke;
    ctx.lineWidth = 9.5;
    ctx.stroke();

    ctx.strokeStyle = pal.roadFill;
    ctx.lineWidth = 7.2;
    ctx.stroke();
  }
  ctx.restore();

  // 4. Interior Street Ground inside City Wall Footprint
  if (geom.wallPolygon.length >= 3) {
    ctx.save();
    tracePoly(ctx, geom.wallPolygon);
    ctx.fillStyle = pal.streetBg;
    ctx.fill();
    ctx.restore();
  }

  // 5. Coastal Bay + 5 Concentric Shoreline Contours + Wooden Piers
  if (geom.waterPolygon) {
    ctx.save();
    tracePoly(ctx, geom.waterPolygon);
    ctx.fillStyle = pal.waterFill;
    ctx.fill();

    // Clip concentric contours inside water polygon
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = pal.waterContour;
    ctx.lineWidth = 1.05;
    for (const cPts of geom.waterContours) {
      if (cPts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(cPts[0].x, cPts[0].y);
      for (let i = 1; i < cPts.length; i++) ctx.lineTo(cPts[i].x, cPts[i].y);
      ctx.stroke();
    }
    ctx.restore();

    // Crisp dark shoreline edge
    const shoreEnd = geom.waterPolygon.length - 2;
    ctx.beginPath();
    ctx.moveTo(geom.waterPolygon[0].x, geom.waterPolygon[0].y);
    for (let i = 1; i < shoreEnd; i++) {
      ctx.lineTo(geom.waterPolygon[i].x, geom.waterPolygon[i].y);
    }
    ctx.strokeStyle = pal.waterStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Wooden piers jutting out from the bay shore
    ctx.strokeStyle = pal.wallStroke;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'butt';
    for (const pier of geom.piers) {
      ctx.beginPath();
      ctx.moveTo(pier.x1, pier.y1);
      ctx.lineTo(pier.x2, pier.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // River (if city has inland/coastal river)
  if (geom.riverPath && geom.riverPath.length >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(geom.riverPath[0].x, geom.riverPath[0].y);
    for (let i = 1; i < geom.riverPath.length; i++) {
      ctx.lineTo(geom.riverPath[i].x, geom.riverPath[i].y);
    }
    ctx.strokeStyle = pal.waterStroke;
    ctx.lineWidth = 30;
    ctx.stroke();
    ctx.strokeStyle = pal.waterFill;
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.restore();
  }

  // 6. Cliff Escarpment (ink hachures)
  if (geom.cliffArc.length >= 2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(geom.cliffArc[0].x, geom.cliffArc[0].y);
    for (let i = 1; i < geom.cliffArc.length; i++) {
      ctx.lineTo(geom.cliffArc[i].x, geom.cliffArc[i].y);
    }
    ctx.strokeStyle = pal.wallStroke;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.lineWidth = 1.1;
    for (const pt of geom.cliffArc) {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + pt.nx * 10, pt.y + pt.ny * 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 7. Wards, Citadel/Park Yards & Packed Edge-Aligned Buildings
  const allWardTrees: { x: number; y: number; r: number }[] = [];
  for (const ward of geom.wards) {
    if (ward.isCitadelOrPark) {
      ctx.save();
      tracePoly(ctx, ward.polygon);
      ctx.fillStyle = pal.parkFill;
      ctx.fill();
      ctx.strokeStyle = pal.waterStroke;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    } else if (theme === 'districts') {
      ctx.save();
      tracePoly(ctx, ward.polygon);
      ctx.fillStyle = `${ward.districtColor}2e`;
      ctx.fill();
      ctx.strokeStyle = `${ward.districtColor}88`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = pal.buildingFill;
    ctx.strokeStyle = pal.buildingStroke;
    ctx.lineWidth = 0.95;
    ctx.lineJoin = 'round';
    for (const b of ward.buildings) {
      tracePoly(ctx, b);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    allWardTrees.push(...ward.trees);
  }

  // Central Market Plaza + Prominent Hall + Fountain
  ctx.save();
  tracePoly(ctx, geom.plazaPolygon);
  ctx.fillStyle = pal.streetBg;
  ctx.fill();

  tracePoly(ctx, geom.plazaHall);
  ctx.fillStyle = pal.buildingFill;
  ctx.fill();
  ctx.strokeStyle = pal.wallStroke;
  ctx.lineWidth = 1.7;
  ctx.stroke();

  ctx.fillStyle = pal.buildingFill;
  ctx.strokeStyle = pal.wallStroke;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(geom.plazaFountain.x, geom.plazaFountain.y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 8. Suburban Ribbon Buildings outside gates
  ctx.save();
  ctx.fillStyle = pal.buildingFill;
  ctx.strokeStyle = pal.buildingStroke;
  ctx.lineWidth = 0.95;
  ctx.lineJoin = 'round';
  for (const b of geom.suburbBuildings) {
    tracePoly(ctx, b);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 9. User-Drawn Bridges & Custom Road Segments
  for (const rd of plan.roads) {
    if (rd.points.length < 2) continue;
    if (rd.kind === 'bridge' || rd.id.startsWith('road_1')) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(rd.points[0].x, rd.points[0].y);
      for (let i = 1; i < rd.points.length; i++) ctx.lineTo(rd.points[i].x, rd.points[i].y);
      ctx.strokeStyle = rd.kind === 'bridge' ? pal.wallStroke : pal.roadStroke;
      ctx.lineWidth = rd.kind === 'bridge' ? 11 : 8;
      ctx.stroke();
      ctx.strokeStyle = pal.roadFill;
      ctx.lineWidth = rd.kind === 'bridge' ? 7 : 5.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 10. Polygonal Curtain Wall & Circular Bastion Towers
  if (plan.hasWalls && plan.wallStyle !== 'none') {
    ctx.save();
    ctx.strokeStyle = pal.wallStroke;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth =
      plan.wallStyle === 'wooden'
        ? 3.2
        : plan.wallStyle === 'citadel_double'
        ? 5.4
        : 4.6;

    for (const chain of geom.wallChains) {
      if (chain.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(chain[0].x, chain[0].y);
      for (let i = 1; i < chain.length; i++) ctx.lineTo(chain[i].x, chain[i].y);
      ctx.stroke();
    }

    ctx.fillStyle = pal.wallStroke;
    for (const t of geom.towers) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 11. Scalloped Tree Copses & Courtyard Trees
  drawTreeGroup(ctx, [...geom.treeClusters, ...allWardTrees], pal);

  // 12. Interactive District Handles & Landmark Labels (toggleable via showLabels)
  const showLabels = plan.showLabels !== false;
  for (const d of plan.districts) {
    const isSel = viewState?.selectedDistrictId === d.id;
    if (isSel || theme === 'districts') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.strokeStyle = isSel ? '#d97706' : `${d.color}aa`;
      ctx.lineWidth = isSel ? 2.8 : 1.3;
      ctx.setLineDash(isSel ? [] : [5, 4]);
      ctx.stroke();
      ctx.restore();
    }
    if (showLabels || isSel) {
      ctx.save();
      ctx.font = '700 11.5px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(d.name).width + 10;
      ctx.fillStyle =
        theme === 'dark' ? 'rgba(15, 23, 42, 0.84)' : 'rgba(229, 222, 208, 0.88)';
      ctx.strokeStyle = isSel ? '#d97706' : 'rgba(28, 26, 23, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(d.x - tw / 2, d.y - 9, tw, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pal.textColor;
      ctx.fillText(d.name, d.x, d.y);
      ctx.restore();
    }
  }

  for (const b of plan.buildings) {
    const isSel = viewState?.selectedBuildingId === b.id;
    if (!showLabels && !isSel) continue;
    ctx.save();
    ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#e4ddd0';
    ctx.strokeStyle = isSel ? '#d97706' : pal.buildingStroke;
    ctx.lineWidth = isSel ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.symbol, b.x, b.y + 0.5);

    ctx.font = '600 10.5px Sarabun, sans-serif';
    const bw = ctx.measureText(b.name).width + 8;
    ctx.fillStyle =
      theme === 'dark' ? 'rgba(15, 23, 42, 0.86)' : 'rgba(229, 222, 208, 0.9)';
    ctx.fillRect(b.x - bw / 2, b.y - 25, bw, 14);
    ctx.fillStyle = pal.textColor;
    ctx.fillText(b.name, b.x, b.y - 18);
    ctx.restore();
  }

  ctx.restore();

  // 13. Cartographic Serif Scale Bar in Screen Space (bottom-left)
  drawScaleBar(ctx, viewW, viewH, zoom, pal);
}

/** Export the city blueprint as a high-resolution cartographic PNG matching the selected theme. */
export function exportCityPlanToPng(city: City, plan: CityPlanData, map: HexMapData): string {
  const showLegend = plan.showLabels !== false;
  const theme: CityBlueprintTheme = plan.theme ?? 'parchment';
  const pal = getThemePalette(theme);
  const geom = buildCityGeometry(plan, city);

  const canvas = document.createElement('canvas');
  canvas.width = showLegend ? 1280 : 1080;
  canvas.height = 960;
  const ctx = canvas.getContext('2d')!;

  if (!showLegend) {
    renderCityPlan(ctx, canvas.width, canvas.height, city, plan, map, {
      camX: 500,
      camY: 500,
      zoom: 1.0,
      geometry: geom,
    });
    return canvas.toDataURL('image/png');
  }

  ctx.fillStyle = theme === 'dark' ? '#0e1722' : '#cfc5b5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(18, 68);
  ctx.beginPath();
  ctx.rect(0, 0, 942, 872);
  ctx.clip();
  renderCityPlan(ctx, 942, 872, city, plan, map, {
    camX: 500,
    camY: 500,
    zoom: 0.92,
    geometry: geom,
  });
  ctx.restore();

  ctx.strokeStyle = pal.wallStroke;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 68, 942, 872);

  const tierLabel = CITY_TIERS.find((t) => t.id === city.tier)?.label ?? city.tier;
  const kingdom = map.kingdoms.find((k) => k.id === city.kingdomId);
  ctx.fillStyle = pal.textColor;
  ctx.font = '700 26px Cinzel, Sarabun, serif';
  ctx.fillText(`ผังเมือง ${city.name}`, 20, 34);
  ctx.font = '400 14px Sarabun, sans-serif';
  ctx.fillText(
    `${tierLabel} · ประชากร ${city.population.toLocaleString()} คน · ${kingdom?.name ?? 'อิสระ'} · พิกัด (${city.q}, ${city.r})`,
    20,
    56
  );

  const lx = 982;
  let ly = 90;
  ctx.fillStyle = pal.textColor;
  ctx.font = '700 16px Sarabun, sans-serif';
  ctx.fillText('เขตย่านในเมือง (Districts)', lx, ly);
  ly += 24;

  for (const d of plan.districts) {
    ctx.fillStyle = d.color;
    ctx.fillRect(lx, ly - 10, 14, 14);
    ctx.strokeStyle = pal.wallStroke;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(lx, ly - 10, 14, 14);
    ctx.fillStyle = pal.textColor;
    ctx.font = '400 13px Sarabun, sans-serif';
    ctx.fillText(`${d.name} (${d.populationShare}%)`, lx + 22, ly + 1);
    ly += 22;
  }

  ly += 14;
  ctx.font = '700 16px Sarabun, sans-serif';
  ctx.fillText('อาคารสำคัญ (Landmarks)', lx, ly);
  ly += 24;

  for (const b of plan.buildings.slice(0, 14)) {
    ctx.font = '400 13px Sarabun, sans-serif';
    ctx.fillText(`${b.symbol} ${b.name}`, lx, ly);
    ly += 21;
  }

  return canvas.toDataURL('image/png');
}
