import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Droplets,
  Eraser,
  Maximize2,
  Minus,
  Mountain,
  PaintBucket,
  Paintbrush,
  Pipette,
  Plus,
  Route,
  Sparkles,
  Waves,
} from 'lucide-react';
import { getBiomeMetaWithCustom } from '../data/biomes';
import { getFeatureMeta } from '../data/features';
import { getAllGovernmentTypes, getAllPoiTypes } from '../data/goods';
import { getTerrainMeta, isWaterTerrain } from '../data/terrains';
import {
  findHexPath,
  getHexTerrain,
  hexDistance,
  hexIndex,
  inBounds,
  isWaterBiome,
  pixelToHex,
  SQRT3,
  validateRoadStep,
} from '../engine/hexMath';
import { BASE_HEX_RADIUS, ChunkedMapRenderer } from '../engine/renderer';
import {
  ClimateOverlay,
  HexCoord,
  HexMapData,
  LabelStyle,
  LayerVisibility,
  PoiType,
  RoadType,
  TerrainId,
  ToolMode,
} from '../types/map';

interface MapCanvasProps {
  map: HexMapData;
  tool: ToolMode;
  activeTerrain: TerrainId;
  onSelectTerrain: (t: TerrainId) => void;
  activeBiome: number;
  onSelectBiome: (b: number) => void;
  activeFeature: string | null;
  onClearActiveFeature: () => void;
  brushSize: number;
  onChangeBrushSize: (n: number) => void;
  autoShallowWater: boolean;
  onToggleAutoShallowWater: () => void;
  onToggleCliffBrush: () => void;
  terrainSubTool: 'brush' | 'fill' | 'eyedropper';
  onChangeTerrainSubTool: (t: 'brush' | 'fill' | 'eyedropper') => void;
  riverSubTool: 'draw' | 'erase';
  onChangeRiverSubTool: (t: 'draw' | 'erase') => void;
  roadType: RoadType;
  onChangeRoadType: (t: RoadType) => void;
  roadSubTool: 'auto' | 'manual' | 'erase';
  onChangeRoadSubTool: (t: 'auto' | 'manual' | 'erase') => void;
  territorySubTool: 'brush' | 'fill' | 'erase';
  religionSubTool: 'brush' | 'fill' | 'erase';
  cultureSubTool: 'brush' | 'fill' | 'erase';
  poiSubTool: 'poi' | 'label';
  onChangePoiSubTool: (t: 'poi' | 'label') => void;
  poiType: PoiType;
  onChangePoiType: (t: PoiType) => void;
  labelStyle: LabelStyle;
  onChangeLabelStyle: (s: LabelStyle) => void;
  climateOverlay: ClimateOverlay;
  layers: LayerVisibility;
  selectedCityId: string | null;
  tradeStartCityId: string | null;
  measurePoints: HexCoord[];
  onAddMeasurePoint: (h: HexCoord) => void;
  showMinimap: boolean;
  renderVersion: number;
  dirtyHexQueue: React.MutableRefObject<HexCoord[] | 'all'>;
  onBeginStroke: () => void;
  onPaintTerrainAt: (q: number, r: number) => { warning?: string };
  onPaintBiomeAt: (q: number, r: number) => { warning?: string };
  onPaintTerritoryAt: (q: number, r: number, erase?: boolean) => void;
  onFloodFillTerritoryAt: (q: number, r: number, erase?: boolean) => void;
  onPaintReligionAt: (q: number, r: number, erase?: boolean) => void;
  onFloodFillReligionAt: (q: number, r: number, erase?: boolean) => void;
  onPaintCultureAt: (q: number, r: number, erase?: boolean) => void;
  onFloodFillCultureAt: (q: number, r: number, erase?: boolean) => void;
  onEndStroke: () => void;
  onFloodFillAt: (q: number, r: number) => void;
  onFloodFillBiomeAt: (q: number, r: number) => void;
  onPlaceOrSelectCityAt: (q: number, r: number) => void;
  onTradeClickAt: (q: number, r: number) => void;
  onAddManualRiver: (points: { q: number; r: number; flux: number }[]) => void;
  onEraseRiverNear: (q: number, r: number) => void;
  onAutoRivers: () => void;
  onAddRoad: (hexes: HexCoord[]) => void;
  onEraseRoadNear: (q: number, r: number) => void;
  onPlacePoi: (q: number, r: number) => void;
  onPlaceLabel: (q: number, r: number, text: string) => void;
  onNotify: (msg: string) => void;
}

export const MapCanvas: React.FC<MapCanvasProps> = (props) => {
  const {
    map,
    tool,
    activeTerrain,
    onSelectTerrain,
    activeBiome,
    onSelectBiome,
    activeFeature,
    onClearActiveFeature,
    brushSize,
    onChangeBrushSize,
    autoShallowWater,
    onToggleAutoShallowWater,
    onToggleCliffBrush,
    terrainSubTool,
    onChangeTerrainSubTool,
    riverSubTool,
    onChangeRiverSubTool,
    roadType,
    onChangeRoadType,
    roadSubTool,
    onChangeRoadSubTool,
    territorySubTool,
    religionSubTool,
    cultureSubTool,
    poiSubTool,
    onChangePoiSubTool,
    poiType,
    onChangePoiType,
    labelStyle,
    onChangeLabelStyle,
    climateOverlay,
    layers,
    selectedCityId,
    tradeStartCityId,
    measurePoints,
    onAddMeasurePoint,
    showMinimap,
    renderVersion,
    dirtyHexQueue,
    onBeginStroke,
    onPaintTerrainAt,
    onPaintBiomeAt,
    onPaintTerritoryAt,
    onFloodFillTerritoryAt,
    onPaintReligionAt,
    onFloodFillReligionAt,
    onPaintCultureAt,
    onFloodFillCultureAt,
    onEndStroke,
    onFloodFillAt,
    onFloodFillBiomeAt,
    onPlaceOrSelectCityAt,
    onTradeClickAt,
    onAddManualRiver,
    onEraseRiverNear,
    onAutoRivers,
    onAddRoad,
    onEraseRoadNear,
    onPlacePoi,
    onPlaceLabel,
    onNotify,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ChunkedMapRenderer>(new ChunkedMapRenderer());

  const mapWorldW = map.width * SQRT3 * BASE_HEX_RADIUS;
  const mapWorldH = map.height * 1.5 * BASE_HEX_RADIUS;

  const [cam, setCam] = useState(() => ({
    x: mapWorldW / 2,
    y: mapWorldH / 2,
    zoom: 0.55,
  }));
  const [viewSize, setViewSize] = useState({ w: 1000, h: 700 });
  const [hoverHex, setHoverHex] = useState<HexCoord | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });
  const isPaintingRef = useRef(false);
  const draftPathRef = useRef<HexCoord[]>([]);
  const [draftPath, setDraftPath] = useState<HexCoord[]>([]);
  const [autoRoadStart, setAutoRoadStart] = useState<HexCoord | null>(null);
  const lastWarnTimeRef = useRef(0);

  const warnOnce = useCallback(
    (msg: string) => {
      const now = Date.now();
      if (now - lastWarnTimeRef.current > 1200) {
        lastWarnTimeRef.current = now;
        onNotify(msg);
      }
    },
    [onNotify]
  );

  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const zoomX = (w * 0.9) / Math.max(1, mapWorldW);
    const zoomY = (h * 0.9) / Math.max(1, mapWorldH);
    const z = Math.max(0.14, Math.min(2.2, Math.min(zoomX, zoomY)));
    setCam({ x: mapWorldW / 2, y: mapWorldH / 2, zoom: z });
  }, [mapWorldH, mapWorldW]);

  const lastFittedIdRef = useRef('');
  useEffect(() => {
    const key = `${map.id}_${map.width}x${map.height}`;
    if (lastFittedIdRef.current !== key) {
      lastFittedIdRef.current = key;
      fitToView();
    }
  }, [fitToView, map.height, map.id, map.width]);

  // Clear autoRoadStart when switching tools or road mode
  useEffect(() => {
    setAutoRoadStart(null);
  }, [tool, roadType, roadSubTool]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => setViewSize({ w: el.clientWidth, h: el.clientHeight });
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        setSpacePressed(true);
      }
      if (e.key === 'Escape') {
        setAutoRoadStart(null);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useEffect(() => {
    const q = dirtyHexQueue.current;
    if (q === 'all') {
      rendererRef.current.invalidateAll();
      dirtyHexQueue.current = [];
    } else if (q.length > 0) {
      rendererRef.current.invalidateHexes(q);
      dirtyHexQueue.current = [];
    }
  }, [dirtyHexQueue, renderVersion]);

  // Compute live A* preview when placing smart mountain-avoiding road / sea lane
  const previewPath = useMemo(() => {
    if (tool !== 'road' || roadSubTool !== 'auto' || !autoRoadStart || !hoverHex) {
      return null;
    }
    const mode = roadType === 'sea' ? 'sea' : 'land';
    const res = findHexPath(map, autoRoadStart, hoverHex, mode);
    if (res.reachable && res.hexes.length >= 2) {
      return { hexes: res.hexes, valid: true };
    }
    return { hexes: [autoRoadStart, hoverHex], valid: false };
  }, [autoRoadStart, hoverHex, map, roadSubTool, roadType, tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.floor(viewSize.w * dpr));
    const targetH = Math.max(1, Math.floor(viewSize.h * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    rendererRef.current.renderViewport(ctx, viewSize.w, viewSize.h, map, cam, {
      overlay: climateOverlay,
      layers,
      hoverHex,
      brushRadius: brushSize - 1,
      tool,
      selectedCityId,
      tradeStartCityId,
      draftPath,
      previewPath,
      measurePoints,
    });
    ctx.restore();
  }, [
    brushSize,
    cam,
    climateOverlay,
    draftPath,
    hoverHex,
    layers,
    map,
    measurePoints,
    previewPath,
    renderVersion,
    selectedCityId,
    tool,
    tradeStartCityId,
    viewSize,
  ]);

  // Minimap
  useEffect(() => {
    if (!showMinimap) return;
    const mini = minimapRef.current;
    if (!mini) return;
    const ctx = mini.getContext('2d');
    if (!ctx) return;

    const mw = mini.width;
    const mh = mini.height;
    ctx.fillStyle = '#0e1722';
    ctx.fillRect(0, 0, mw, mh);

    const sx = mw / map.width;
    const sy = mh / map.height;
    for (let r = 0; r < map.height; r++) {
      for (let q = 0; q < map.width; q++) {
        const idx = hexIndex(q, r, map.width);
        const tId = getHexTerrain(map, idx);
        const bMeta = getBiomeMetaWithCustom(map.biomes[idx], map.customBiomes);
        let color =
          climateOverlay === 'terrain'
            ? getTerrainMeta(tId).color
            : bMeta.isWater && !bMeta.isCustom
            ? getTerrainMeta(tId).color
            : bMeta.color;
        if (climateOverlay === 'none') {
          if (tId === TerrainId.MOUNTAIN) color = '#766b5d';
          else if (tId === TerrainId.HIGH_PEAK) color = '#b8c4cf';
          if (map.features?.[idx] === 'cliff') color = '#574e46';
        }
        if (climateOverlay === 'political' && map.territories?.[idx]) {
          color = map.kingdoms.find((k) => k.id === map.territories[idx])?.color ?? color;
        } else if (climateOverlay === 'religion' && map.religions?.[idx]) {
          color = map.religionList.find((rl) => rl.id === map.religions[idx])?.color ?? color;
        } else if (climateOverlay === 'culture' && map.cultures?.[idx]) {
          color = (map.cultureList ?? []).find((cu) => cu.id === map.cultures[idx])?.color ?? color;
        }
        ctx.fillStyle = color;
        ctx.fillRect(q * sx, r * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }

    ctx.fillStyle = '#fbbf24';
    for (const c of map.cities) {
      ctx.beginPath();
      ctx.arc(c.q * sx, c.r * sy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const halfW = viewSize.w / (2 * cam.zoom);
    const halfH = viewSize.h / (2 * cam.zoom);
    const vx = ((cam.x - halfW) / mapWorldW) * mw;
    const vy = ((cam.y - halfH) / mapWorldH) * mh;
    const vw = ((halfW * 2) / mapWorldW) * mw;
    const vh = ((halfH * 2) / mapWorldH) * mh;

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [cam, climateOverlay, map, mapWorldH, mapWorldW, renderVersion, showMinimap, viewSize]);

  const screenToHex = useCallback(
    (clientX: number, clientY: number): HexCoord | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const wx = (sx - viewSize.w / 2) / cam.zoom + cam.x;
      const wy = (sy - viewSize.h / 2) / cam.zoom + cam.y;
      const h = pixelToHex(wx, wy, BASE_HEX_RADIUS);
      return inBounds(h.q, h.r, map.width, map.height) ? h : null;
    },
    [cam, map.height, map.width, viewSize]
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.14 : 0.88;
    const nextZoom = Math.max(0.12, Math.min(4.0, cam.zoom * factor));
    const wx = (mx - viewSize.w / 2) / cam.zoom + cam.x;
    const wy = (my - viewSize.h / 2) / cam.zoom + cam.y;
    const nextX = wx - (mx - viewSize.w / 2) / nextZoom;
    const nextY = wy - (my - viewSize.h / 2) / nextZoom;

    setCam({ x: nextX, y: nextY, zoom: nextZoom });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const shouldPan = e.button === 1 || e.button === 2 || tool === 'view' || spacePressed;
    if (shouldPan) {
      isPanningRef.current = true;
      panStartRef.current = { mx: e.clientX, my: e.clientY, cx: cam.x, cy: cam.y };
      return;
    }

    const h = screenToHex(e.clientX, e.clientY);
    if (!h) return;

    if (tool === 'terrain') {
      if (terrainSubTool === 'eyedropper') {
        const t = getHexTerrain(map, hexIndex(h.q, h.r, map.width));
        onClearActiveFeature();
        onSelectTerrain(t);
        onChangeTerrainSubTool('brush');
      } else if (terrainSubTool === 'fill' && activeFeature === null) {
        onFloodFillAt(h.q, h.r);
      } else {
        isPaintingRef.current = true;
        onBeginStroke();
        const res = onPaintTerrainAt(h.q, h.r);
        if (res.warning) warnOnce(res.warning);
      }
    } else if (tool === 'biome') {
      if (terrainSubTool === 'eyedropper') {
        const b = map.biomes[hexIndex(h.q, h.r, map.width)];
        if (!isWaterBiome(b, map.customBiomes) || b >= 100) {
          onSelectBiome(b);
          onChangeTerrainSubTool('brush');
        } else {
          warnOnce('ช่องนี้เป็นทะเล (ใช้เครื่องมือ "ภูมิประเทศ" เพื่อดูดสีพื้นน้ำ)');
        }
      } else if (terrainSubTool === 'fill') {
        onFloodFillBiomeAt(h.q, h.r);
      } else {
        isPaintingRef.current = true;
        onBeginStroke();
        const res = onPaintBiomeAt(h.q, h.r);
        if (res.warning) warnOnce(res.warning);
      }
    } else if (tool === 'territory') {
      if (territorySubTool === 'fill') {
        onFloodFillTerritoryAt(h.q, h.r, false);
      } else {
        isPaintingRef.current = true;
        onBeginStroke();
        onPaintTerritoryAt(h.q, h.r, territorySubTool === 'erase');
      }
    } else if (tool === 'religion') {
      if (religionSubTool === 'fill') {
        onFloodFillReligionAt(h.q, h.r, false);
      } else {
        isPaintingRef.current = true;
        onBeginStroke();
        onPaintReligionAt(h.q, h.r, religionSubTool === 'erase');
      }
    } else if (tool === 'culture') {
      if (cultureSubTool === 'fill') {
        onFloodFillCultureAt(h.q, h.r, false);
      } else {
        isPaintingRef.current = true;
        onBeginStroke();
        onPaintCultureAt(h.q, h.r, cultureSubTool === 'erase');
      }
    } else if (tool === 'river') {
      if (riverSubTool === 'erase') {
        onEraseRiverNear(h.q, h.r);
      } else {
        isPaintingRef.current = true;
        draftPathRef.current = [h];
        setDraftPath([h]);
      }
    } else if (tool === 'road') {
      if (roadSubTool === 'erase') {
        onEraseRoadNear(h.q, h.r);
        return;
      }
      if (roadSubTool === 'auto') {
        if (!autoRoadStart) {
          if (!validateRoadStep(map, h, roadType, true)) {
            warnOnce(
              roadType === 'sea'
                ? 'เส้นทางเดินเรือต้องเริ่มต้นจากทะเลหรือชายฝั่งที่ไม่มีหน้าผาเท่านั้น'
                : 'ถนนทางบกไม่สามารถวางในทะเลได้'
            );
            return;
          }
          setAutoRoadStart(h);
        } else {
          if (autoRoadStart.q === h.q && autoRoadStart.r === h.r) {
            setAutoRoadStart(null);
            return;
          }
          const mode = roadType === 'sea' ? 'sea' : 'land';
          const path = findHexPath(map, autoRoadStart, h, mode);
          if (!path.reachable || path.hexes.length < 2) {
            warnOnce(
              roadType === 'sea'
                ? 'ไม่สามารถวางเส้นทางเดินเรือข้ามแผ่นดินได้ (ต้องเชื่อมผ่านน่านน้ำ)'
                : 'ไม่สามารถวางถนนข้ามทะเลหรือพื้นที่ปิดได้'
            );
            return;
          }
          onAddRoad(path.hexes);
          setAutoRoadStart(null);
        }
        return;
      }
      // Manual road mode with strict validation
      if (!validateRoadStep(map, h, roadType, true)) {
        warnOnce(
          roadType === 'sea'
            ? 'ไม่สามารถวางเส้นทางเดินเรือบนแผ่นดินลึกได้'
            : 'ไม่สามารถวางถนนทางบกบนทะเลได้'
        );
        return;
      }
      isPaintingRef.current = true;
      draftPathRef.current = [h];
      setDraftPath([h]);
    } else if (tool === 'city') {
      onPlaceOrSelectCityAt(h.q, h.r);
    } else if (tool === 'trade') {
      onTradeClickAt(h.q, h.r);
    } else if (tool === 'measure') {
      onAddMeasurePoint(h);
    } else if (tool === 'poi') {
      if (poiSubTool === 'poi') {
        onPlacePoi(h.q, h.r);
      } else {
        const text = window.prompt('ใส่ชื่อสถานที่ / ชื่อภูมิภาคบนแผนที่:');
        if (text && text.trim()) onPlaceLabel(h.q, h.r, text.trim());
      }
    } else if (tool === 'climate') {
      const nearCity = map.cities.find((c) => hexDistance(c, h) <= 1);
      if (nearCity) onPlaceOrSelectCityAt(h.q, h.r);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      const dx = (e.clientX - panStartRef.current.mx) / cam.zoom;
      const dy = (e.clientY - panStartRef.current.my) / cam.zoom;
      setCam((c) => ({
        ...c,
        x: panStartRef.current.cx - dx,
        y: panStartRef.current.cy - dy,
      }));
      return;
    }

    const h = screenToHex(e.clientX, e.clientY);
    setHoverHex(h);
    if (!h || !isPaintingRef.current) return;

    if (tool === 'terrain' && (terrainSubTool === 'brush' || activeFeature !== null)) {
      const res = onPaintTerrainAt(h.q, h.r);
      if (res.warning) warnOnce(res.warning);
    } else if (tool === 'biome' && terrainSubTool === 'brush') {
      const res = onPaintBiomeAt(h.q, h.r);
      if (res.warning) warnOnce(res.warning);
    } else if (tool === 'territory' && territorySubTool !== 'fill') {
      onPaintTerritoryAt(h.q, h.r, territorySubTool === 'erase');
    } else if (tool === 'religion' && religionSubTool !== 'fill') {
      onPaintReligionAt(h.q, h.r, religionSubTool === 'erase');
    } else if (tool === 'culture' && cultureSubTool !== 'fill') {
      onPaintCultureAt(h.q, h.r, cultureSubTool === 'erase');
    } else if (tool === 'river' && riverSubTool === 'draw') {
      const cur = draftPathRef.current;
      const last = cur[cur.length - 1];
      if (!last || last.q !== h.q || last.r !== h.r) {
        const next = [...cur, h];
        draftPathRef.current = next;
        setDraftPath(next);
      }
    } else if (tool === 'road' && roadSubTool === 'manual') {
      const cur = draftPathRef.current;
      const last = cur[cur.length - 1];
      if (!last || last.q !== h.q || last.r !== h.r) {
        if (!validateRoadStep(map, h, roadType, false)) {
          warnOnce(
            roadType === 'sea'
              ? 'เส้นทางเดินเรือไม่สามารถลากผ่านบนบกได้'
              : 'ถนนทางบกไม่สามารถลากผ่านทะเลได้'
          );
          return;
        }
        const next = [...cur, h];
        draftPathRef.current = next;
        setDraftPath(next);
      }
    }
  };

  const handlePointerUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
    }
    if (isPaintingRef.current) {
      isPaintingRef.current = false;
      if (
        tool === 'terrain' ||
        tool === 'biome' ||
        tool === 'territory' ||
        tool === 'religion' ||
        tool === 'culture'
      ) {
        onEndStroke();
      } else if (tool === 'river' && riverSubTool === 'draw') {
        const pts = draftPathRef.current;
        if (pts.length >= 2) {
          onAddManualRiver(
            pts.map((p, i) => ({
              q: p.q,
              r: p.r,
              flux: 12 + i * 3,
            }))
          );
        }
        draftPathRef.current = [];
        setDraftPath([]);
      } else if (tool === 'road' && roadSubTool === 'manual') {
        const pts = draftPathRef.current;
        if (pts.length >= 2) {
          onAddRoad(pts);
        }
        draftPathRef.current = [];
        setDraftPath([]);
      }
    }
  };

  const scaleBar = useMemo(() => {
    const pxPerHex = SQRT3 * BASE_HEX_RADIUS * cam.zoom;
    const kmPerPx = map.hexSizeKm / Math.max(0.001, pxPerHex);
    const targetKm = 120 * kmPerPx;
    const niceSteps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    let bestKm = niceSteps[0];
    for (const s of niceSteps) {
      if (s <= targetKm * 1.35) bestKm = s;
    }
    return {
      km: bestKm,
      px: Math.max(44, Math.min(220, bestKm / kmPerPx)),
    };
  }, [cam.zoom, map.hexSizeKm]);

  const hoverInfo = useMemo(() => {
    if (!hoverHex) return null;
    const idx = hexIndex(hoverHex.q, hoverHex.r, map.width);
    const terrain = getTerrainMeta(getHexTerrain(map, idx));
    const biome = getBiomeMetaWithCustom(map.biomes[idx], map.customBiomes);
    const feat = map.features?.[idx] ? getFeatureMeta(map.features[idx]) : null;
    const kingdomId = map.territories?.[idx] ?? '';
    const kingdom = kingdomId ? map.kingdoms.find((k) => k.id === kingdomId) : null;
    const govLabel = kingdom
      ? getAllGovernmentTypes(map.customGovernmentTypes).find((g) => g.id === kingdom.government)
          ?.label ?? kingdom.government
      : null;
    const relId = map.religions?.[idx] ?? '';
    const religion = relId ? map.religionList.find((r) => r.id === relId) : null;
    const cultId = map.cultures?.[idx] ?? '';
    const culture = cultId ? (map.cultureList ?? []).find((c) => c.id === cultId) : null;
    const elevM = Math.round((map.elevation[idx] ?? 0) * 5200);
    const temp = map.temperature[idx] ?? 15;
    const moist = Math.round((map.moisture[idx] ?? 0.5) * 2400);
    const city = map.cities.find((c) => c.q === hoverHex.q && c.r === hoverHex.r);
    return { terrain, biome, feat, kingdom, govLabel, religion, culture, elevM, temp, moist, city };
  }, [hoverHex, map]);

  const activeTerrainMeta = getTerrainMeta(activeTerrain);
  const activeBiomeMeta = getBiomeMetaWithCustom(activeBiome, map.customBiomes);
  const activeFeatureMeta = activeFeature ? getFeatureMeta(activeFeature) : null;
  const allPoiTypes = useMemo(() => getAllPoiTypes(map.customPoiTypes), [map.customPoiTypes]);

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden bg-[#0e1926] ${
        tool === 'view' || spacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
      }`}
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block touch-none"
      />

      {/* Contextual Floating Tool Bar */}
      {tool !== 'view' && (
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-[#111720]/92 backdrop-blur-sm border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs shadow-xl max-w-[calc(100%-70px)]">
          {tool === 'terrain' && (
            <>
              {activeFeature !== null ? (
                <span className="flex items-center gap-1.5 text-amber-200 font-medium">
                  <span
                    className="w-3 h-3 rounded-xs border border-white/25"
                    style={{ backgroundColor: activeFeatureMeta?.color ?? '#64748b' }}
                  />
                  {activeFeature === ''
                    ? 'โหมด: ลบลักษณะพิเศษ'
                    : `ลักษณะพิเศษ: ${activeFeatureMeta?.nameTh}`}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                  <span
                    className="w-3.5 h-3.5 rounded-sm border border-white/25"
                    style={{ backgroundColor: activeTerrainMeta.color }}
                  />
                  ภูมิประเทศ: {activeTerrainMeta.nameTh}
                </span>
              )}
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onChangeTerrainSubTool('brush')}
                  className={`p-1 rounded cursor-pointer ${
                    terrainSubTool === 'brush' ? 'bg-amber-500/25 text-amber-300' : 'text-slate-400'
                  }`}
                  title="พู่กัน"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    onClearActiveFeature();
                    onChangeTerrainSubTool('fill');
                  }}
                  className={`p-1 rounded cursor-pointer ${
                    terrainSubTool === 'fill' && activeFeature === null
                      ? 'bg-amber-500/25 text-amber-300'
                      : 'text-slate-400'
                  }`}
                  title="เทสีพื้นที่ต่อเนื่อง"
                >
                  <PaintBucket className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onChangeTerrainSubTool('eyedropper')}
                  className={`p-1 rounded cursor-pointer ${
                    terrainSubTool === 'eyedropper'
                      ? 'bg-amber-500/25 text-amber-300'
                      : 'text-slate-400'
                  }`}
                  title="ดูดสีภูมิประเทศ"
                >
                  <Pipette className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <span className="text-slate-400">ขนาดพู่กัน: {brushSize}</span>
              <input
                type="range"
                min={1}
                max={6}
                value={brushSize}
                onChange={(e) => onChangeBrushSize(Number(e.target.value))}
                className="w-20"
              />
              <div className="h-4 w-px bg-slate-700" />
              <button
                onClick={onToggleCliffBrush}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition cursor-pointer ${
                  activeFeature === 'cliff'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-medium'
                    : 'bg-[#17202b] border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
                title="สลับพู่กันวาดหน้าผา (บริเวณหน้าผาจะไม่เกิดทะเลน้ำตื้น)"
              >
                <Mountain className="w-3.5 h-3.5" />
                <span>หน้าผา</span>
              </button>
              <button
                onClick={onToggleAutoShallowWater}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition cursor-pointer ${
                  autoShallowWater
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-200 font-medium'
                    : 'bg-[#17202b] border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="เปลี่ยนมหาสมุทรใกล้แผ่นดินเป็นทะเลน้ำตื้นอัตโนมัติ (ยกเว้นบริเวณหน้าผา)"
              >
                <Waves className="w-3.5 h-3.5" />
                <span>น้ำตื้นอัตโนมัติ</span>
              </button>
            </>
          )}

          {tool === 'biome' && (
            <>
              <span className="flex items-center gap-1.5 text-emerald-200 font-medium">
                <span
                  className="w-3.5 h-3.5 rounded-sm border border-white/25"
                  style={{ backgroundColor: activeBiomeMeta.color }}
                />
                ไบโอม: {activeBiomeMeta.nameTh}
              </span>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onChangeTerrainSubTool('brush')}
                  className={`p-1 rounded cursor-pointer ${
                    terrainSubTool === 'brush'
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : 'text-slate-400'
                  }`}
                  title="พู่กันระบายไบโอม"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onChangeTerrainSubTool('fill')}
                  className={`p-1 rounded cursor-pointer ${
                    terrainSubTool === 'fill'
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : 'text-slate-400'
                  }`}
                  title="เทสีไบโอมต่อเนื่อง"
                >
                  <PaintBucket className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onChangeTerrainSubTool('eyedropper')}
                  className={`p-1 rounded cursor-pointer ${
                    terrainSubTool === 'eyedropper'
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : 'text-slate-400'
                  }`}
                  title="ดูดสีไบโอม"
                >
                  <Pipette className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <span className="text-slate-400">ขนาดพู่กัน: {brushSize}</span>
              <input
                type="range"
                min={1}
                max={6}
                value={brushSize}
                onChange={(e) => onChangeBrushSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                ระบายเฉพาะบนพื้นดิน (คงรูปทรงภูมิประเทศเดิม)
              </span>
            </>
          )}

          {tool === 'territory' && (
            <span className="text-amber-200">
              คลิกหรือลากบนแผ่นดินเพื่อกำหนดเขตปกครอง (ปรับอาณาจักรได้ในแถบขวา)
            </span>
          )}

          {tool === 'religion' && (
            <span className="text-purple-200">
              คลิกหรือลากบนแผ่นดินเพื่อกำหนดเขตศาสนา (เลือกศาสนาได้ในแถบขวา)
            </span>
          )}

          {tool === 'culture' && (
            <span className="text-teal-200">
              คลิกหรือลากบนแผ่นดินเพื่อกำหนดเขตวัฒนธรรม (เลือก/ปรับแต่งวัฒนธรรมได้ในแถบขวา)
            </span>
          )}

          {tool === 'river' && (
            <>
              <button
                onClick={() => onChangeRiverSubTool('draw')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer ${
                  riverSubTool === 'draw' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400'
                }`}
              >
                <Droplets className="w-3.5 h-3.5" /> วาดสายน้ำเอง
              </button>
              <button
                onClick={() => onChangeRiverSubTool('erase')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer ${
                  riverSubTool === 'erase' ? 'bg-rose-500/25 text-rose-200' : 'text-slate-400'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> ลบแม่น้ำ
              </button>
              <div className="h-4 w-px bg-slate-700" />
              <button
                onClick={onAutoRivers}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-200 cursor-pointer"
              >
                <Waves className="w-3.5 h-3.5" />
                วางแม่น้ำอัตโนมัติ (อิงความสูงสู่ทะเล)
              </button>
            </>
          )}

          {tool === 'city' && (
            <span className="text-slate-300">
              คลิกบนพื้นดินเพื่อวางเมืองใหม่ หรือคลิกเมืองเดิมเพื่อแก้ไขสินค้า/ศาสนา/ประชากร
            </span>
          )}

          {tool === 'road' && (
            <>
              <span className="text-slate-400">ชนิด:</span>
              {[
                { id: 'dirt', label: 'ทางเกวียน' },
                { id: 'stone', label: 'ถนนหินหลวง' },
                { id: 'sea', label: 'ทางเดินเรือ' },
              ].map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => onChangeRoadType(rt.id as RoadType)}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    roadType === rt.id
                      ? 'bg-amber-500/25 border-amber-500/60 text-amber-200'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {rt.label}
                </button>
              ))}
              <div className="h-4 w-px bg-slate-700" />
              {[
                { id: 'auto', label: 'อ้อมเขาอัตโนมัติ', icon: <Route className="w-3 h-3" /> },
                { id: 'manual', label: 'ลากเอง', icon: <Paintbrush className="w-3 h-3" /> },
                { id: 'erase', label: 'ลบเส้นทาง', icon: <Eraser className="w-3 h-3" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => onChangeRoadSubTool(m.id as typeof roadSubTool)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer ${
                    roadSubTool === m.id
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
              {roadSubTool === 'auto' && (
                <span className="text-[11px] text-emerald-300">
                  {autoRoadStart
                    ? 'คลิกปลายทาง (กด Esc เพื่อยกเลิก)'
                    : 'คลิกจุดเริ่มต้นเพื่อหาเส้นทางที่สมจริง'}
                </span>
              )}
            </>
          )}

          {tool === 'poi' && (
            <>
              <button
                onClick={() => onChangePoiSubTool('poi')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  poiSubTool === 'poi' ? 'bg-amber-500/25 text-amber-200' : 'text-slate-400'
                }`}
              >
                วางจุดสำคัญ
              </button>
              <button
                onClick={() => onChangePoiSubTool('label')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  poiSubTool === 'label' ? 'bg-amber-500/25 text-amber-200' : 'text-slate-400'
                }`}
              >
                วางป้ายชื่อภูมิภาค
              </button>
              {poiSubTool === 'poi' ? (
                <select
                  value={poiType}
                  onChange={(e) => onChangePoiType(e.target.value)}
                  className="bg-[#17202c] border border-slate-700 rounded px-2 py-0.5 text-slate-200 outline-none"
                >
                  {allPoiTypes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.symbol} {p.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={labelStyle}
                  onChange={(e) => onChangeLabelStyle(e.target.value as LabelStyle)}
                  className="bg-[#17202c] border border-slate-700 rounded px-2 py-0.5 text-slate-200 outline-none"
                >
                  <option value="region">ชื่อแคว้น / ภูมิภาค</option>
                  <option value="water">ชื่อทะเล / มหาสมุทร</option>
                  <option value="mountain">ชื่อเทือกเขา</option>
                </select>
              )}
            </>
          )}

          {tool === 'trade' && (
            <span className="text-amber-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {tradeStartCityId
                ? 'คลิกเมืองปลายทางเพื่อเชื่อมเส้นทางการค้า'
                : 'คลิกเมืองต้นทางเพื่อเริ่มเชื่อมเส้นทางการค้า'}
            </span>
          )}

          {tool === 'measure' && (
            <span className="text-sky-200">คลิกเพื่อปักหมุดวัดระยะทางจริง (กม.)</span>
          )}

          {tool === 'climate' && (
            <span className="text-amber-200">
              ปรับพารามิเตอร์ภูมิศาสตร์และลมประจำถิ่นได้ในแถบด้านขวา
            </span>
          )}
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 bg-[#111720]/90 border border-slate-700/80 rounded-lg p-1 shadow-lg">
        <button
          onClick={() => setCam((c) => ({ ...c, zoom: Math.min(4, c.zoom * 1.25) }))}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
          title="ซูมเข้า"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCam((c) => ({ ...c, zoom: Math.max(0.12, c.zoom * 0.8) }))}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
          title="ซูมออก"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={fitToView}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
          title="พอดีหน้าจอ"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom-Left Scale Bar */}
      <div className="absolute bottom-3 left-3 bg-[#111720]/88 border border-slate-700/70 rounded px-2.5 py-1.5 pointer-events-none">
        <div className="text-[11px] font-medium text-slate-200 mb-1">
          {scaleBar.km.toLocaleString()} กม.
        </div>
        <div
          className="h-1.5 border-x-2 border-b-2 border-slate-200"
          style={{ width: `${scaleBar.px}px` }}
        />
      </div>

      {/* Bottom-Center Telemetry */}
      {hoverHex && hoverInfo && (
        <div className="hidden md:flex absolute bottom-3 left-1/2 -translate-x-1/2 items-center gap-2.5 bg-[#111720]/92 border border-slate-700/75 rounded-full px-4 py-1 text-[11px] text-slate-200 pointer-events-none shadow-lg whitespace-nowrap max-w-[75vw] overflow-hidden">
          <span className="text-slate-400">
            ({hoverHex.q}, {hoverHex.r})
          </span>
          <span className="flex items-center gap-1 font-medium text-amber-200">
            <span
              className="w-2.5 h-2.5 rounded-xs"
              style={{ backgroundColor: hoverInfo.terrain.color }}
            />
            {hoverInfo.terrain.nameTh}
          </span>
          {(!isWaterTerrain(hoverInfo.terrain.id) || hoverInfo.biome.isCustom) && (
            <span className="flex items-center gap-1 font-medium text-emerald-300">
              <span className="text-slate-500">·</span>
              <span
                className="w-2.5 h-2.5 rounded-xs"
                style={{ backgroundColor: hoverInfo.biome.color }}
              />
              {hoverInfo.biome.nameTh}
            </span>
          )}
          {hoverInfo.feat && (
            <span className="flex items-center gap-1 text-emerald-300">
              <span
                className="w-2 h-2 rounded-xs"
                style={{ backgroundColor: hoverInfo.feat.color }}
              />
              {hoverInfo.feat.nameTh}
            </span>
          )}
          {hoverInfo.kingdom && (
            <span className="text-amber-300">
              👑 {hoverInfo.kingdom.name} ({hoverInfo.govLabel})
            </span>
          )}
          {hoverInfo.religion && (
            <span className="text-purple-300">
              {hoverInfo.religion.symbol} {hoverInfo.religion.name}
            </span>
          )}
          {hoverInfo.culture && (
            <span className="text-teal-300">
              {hoverInfo.culture.symbol} {hoverInfo.culture.name}
            </span>
          )}
          <span className="text-slate-300">
            {hoverInfo.elevM >= 0 ? `${hoverInfo.elevM.toLocaleString()} ม.` : 'ทะเล'}
          </span>
          <span className="text-sky-300">{hoverInfo.temp.toFixed(1)}°C</span>
          {hoverInfo.city && (
            <span className="text-amber-300 font-semibold">★ {hoverInfo.city.name}</span>
          )}
        </div>
      )}

      {/* Bottom-Right Minimap */}
      {showMinimap && (
        <div className="hidden sm:block absolute bottom-3 right-3 bg-[#111720]/92 border border-slate-700/80 rounded-lg p-1.5 shadow-xl">
          <canvas
            ref={minimapRef}
            width={168}
            height={112}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const nx = (e.clientX - rect.left) / rect.width;
              const ny = (e.clientY - rect.top) / rect.height;
              setCam((c) => ({ ...c, x: nx * mapWorldW, y: ny * mapWorldH }));
            }}
            className="rounded cursor-pointer block"
            title="คลิกเพื่อเลื่อนมุมมอง"
          />
        </div>
      )}
    </div>
  );
};
