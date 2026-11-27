import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
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
  Swords,
  Waves,
  Wind,
} from 'lucide-react';
import { getBiomeMetaWithCustom } from '../data/biomes';
import { getFeatureMetaWithCustom } from '../data/features';
import { getAllGovernmentTypes, getAllPoiTypes } from '../data/goods';
import { getTerrainMetaWithCustom, isWaterTerrainWithCustom } from '../data/terrains';
import { computeSeasonalField } from '../engine/calendar';
import {
  computeOceanCurrents,
  getCurrentCompassLabel,
  getCurrentKind,
} from '../engine/currents';
import {
  computeWindField,
  getWindBeltLabelTh,
  getWindCompassLabel,
  windSpeedKnots,
} from '../engine/winds';
import { formatElevationMeters, SculptMode } from '../engine/elevation';
import {
  findHexPath,
  getHexTerrain,
  hexDistance,
  hexIndex,
  hexToPixel,
  inBounds,
  isWaterBiome,
  pixelToHex,
  SQRT3,
  validateRoadStep,
} from '../engine/hexMath';
import { BASE_HEX_RADIUS, ChunkedMapRenderer } from '../engine/renderer';
import {
  formatLatitude,
  formatLongitude,
  getColLongitude,
  getRowLatitude,
} from '../engine/worldGenerator';
import {
  ClimateOverlay,
  HexCoord,
  HexMapData,
  LabelSize,
  LabelStyle,
  LayerVisibility,
  ManualWindKind,
  PoiType,
  ReferenceOverlayConfig,
  RoadType,
  SeasonId,
  SubMapBounds,
  TerrainId,
  ToolMode,
} from '../types/map';

interface MapCanvasProps {
  map: HexMapData;
  tool: ToolMode;
  activeTerrain: number;
  onSelectTerrain: (t: number) => void;
  terrainEditMode: 'paint' | 'sculpt';
  onChangeTerrainEditMode: (m: 'paint' | 'sculpt') => void;
  sculptMode: SculptMode;
  onChangeSculptMode: (m: SculptMode) => void;
  sculptIntensity: number;
  onChangeSculptIntensity: (n: number) => void;
  onSculptElevationAt: (q: number, r: number) => void;
  activeBiome: number;
  onSelectBiome: (b: number) => void;
  activeFeature: string | null;
  onClearActiveFeature: () => void;
  brushSize: number;
  onChangeBrushSize: (n: number) => void;
  autoShallowWater: boolean;
  onToggleAutoShallowWater: () => void;
  onToggleCliffBrush: () => void;
  onToggleLakeBrush: () => void;
  terrainSubTool: 'brush' | 'fill' | 'eyedropper';
  onChangeTerrainSubTool: (t: 'brush' | 'fill' | 'eyedropper') => void;
  riverSubTool: 'draw' | 'erase';
  onChangeRiverSubTool: (t: 'draw' | 'erase') => void;
  currentSubTool: 'draw' | 'erase';
  onChangeCurrentSubTool: (t: 'draw' | 'erase') => void;
  currentKind: 'warm' | 'cold' | 'neutral';
  onChangeCurrentKind: (k: 'warm' | 'cold' | 'neutral') => void;
  currentDrawStrength: number;
  onChangeCurrentDrawStrength: (n: number) => void;
  onAddManualCurrent: (points: HexCoord[]) => void;
  onEraseCurrentNear: (q: number, r: number) => void;
  windSubTool: 'draw' | 'erase';
  onChangeWindSubTool: (t: 'draw' | 'erase') => void;
  windKind: ManualWindKind;
  onChangeWindKind: (k: ManualWindKind) => void;
  windDrawStrength: number;
  onChangeWindDrawStrength: (n: number) => void;
  onAddManualWind: (points: HexCoord[]) => void;
  onEraseWindNear: (q: number, r: number) => void;
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
  labelSize: LabelSize;
  onChangeLabelSize: (s: LabelSize) => void;
  labelRotation: number;
  onChangeLabelRotation: (deg: number) => void;
  labelCurve: number;
  onChangeLabelCurve: (c: number) => void;
  campaignSubTool: 'draw' | 'erase';
  onChangeCampaignSubTool: (t: 'draw' | 'erase') => void;
  campaignKingdomId: string;
  onChangeCampaignKingdomId: (id: string) => void;
  onAddCampaignPath: (hexes: HexCoord[]) => void;
  onEraseCampaignNear: (q: number, r: number) => void;
  referenceOverlay: ReferenceOverlayConfig | null;
  onChangeReferenceOverlay: (cfg: ReferenceOverlayConfig | null) => void;
  focusTarget: { q: number; r: number; zoom?: number; nonce: number } | null;
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
  activeSeason?: SeasonId | null;
  onSelectSubMapZone?: (bounds: SubMapBounds) => void;
  tectonicEditPlateId?: string | null;
  onCancelTectonicPlace?: () => void;
  onClickTectonicPlateAt?: (q: number, r: number) => void;
  onNotify: (msg: string) => void;
}

export const MapCanvas: React.FC<MapCanvasProps> = (props) => {
  const {
    map,
    tool,
    activeTerrain,
    onSelectTerrain,
    terrainEditMode,
    onChangeTerrainEditMode,
    sculptMode,
    onChangeSculptMode,
    sculptIntensity,
    onChangeSculptIntensity,
    onSculptElevationAt,
    activeBiome,
    onSelectBiome,
    activeFeature,
    onClearActiveFeature,
    brushSize,
    onChangeBrushSize,
    autoShallowWater,
    onToggleAutoShallowWater,
    onToggleCliffBrush,
    onToggleLakeBrush,
    terrainSubTool,
    onChangeTerrainSubTool,
    riverSubTool,
    onChangeRiverSubTool,
    currentSubTool,
    onChangeCurrentSubTool,
    currentKind,
    onChangeCurrentKind,
    currentDrawStrength,
    onChangeCurrentDrawStrength,
    onAddManualCurrent,
    onEraseCurrentNear,
    windSubTool,
    onChangeWindSubTool,
    windKind,
    onChangeWindKind,
    windDrawStrength,
    onChangeWindDrawStrength,
    onAddManualWind,
    onEraseWindNear,
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
    labelSize,
    onChangeLabelSize,
    labelRotation,
    onChangeLabelRotation,
    labelCurve,
    onChangeLabelCurve,
    campaignSubTool,
    onChangeCampaignSubTool,
    campaignKingdomId,
    onChangeCampaignKingdomId,
    onAddCampaignPath,
    onEraseCampaignNear,
    referenceOverlay,
    onChangeReferenceOverlay,
    focusTarget,
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
    activeSeason = null,
    onSelectSubMapZone,
    tectonicEditPlateId = null,
    onCancelTectonicPlace,
    onClickTectonicPlateAt,
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
  const submapStartRef = useRef<HexCoord | null>(null);
  const [submapDraftBox, setSubmapDraftBox] = useState<SubMapBounds | null>(null);
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

  const [refImgEl, setRefImgEl] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!referenceOverlay?.imageDataUrl || !referenceOverlay.visible) {
      setRefImgEl(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setRefImgEl(img);
    img.src = referenceOverlay.imageDataUrl;
  }, [referenceOverlay?.imageDataUrl, referenceOverlay?.visible]);

  useEffect(() => {
    if (!focusTarget) return;
    const pt = hexToPixel(focusTarget.q, focusTarget.r, BASE_HEX_RADIUS);
    setCam((c) => ({
      x: pt.x,
      y: pt.y,
      zoom: focusTarget.zoom ? Math.max(0.25, Math.min(3.5, focusTarget.zoom)) : c.zoom,
    }));
  }, [focusTarget]);

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
      mapTheme: map.mapTheme ?? 'standard',
      refImage: refImgEl,
      refOpacity: referenceOverlay?.visible ? referenceOverlay.opacity : 0,
      activeSeason,
      submapDraftBox,
      selectedTectonicPlateId: tectonicEditPlateId,
    });
    ctx.restore();
  }, [
    activeSeason,
    brushSize,
    cam,
    climateOverlay,
    draftPath,
    hoverHex,
    layers,
    map,
    measurePoints,
    previewPath,
    refImgEl,
    referenceOverlay,
    renderVersion,
    selectedCityId,
    submapDraftBox,
    tectonicEditPlateId,
    tool,
    tradeStartCityId,
    viewSize,
  ]);

  const oceanCurrentField = useMemo(
    () =>
      computeOceanCurrents(
        map.width,
        map.height,
        map.elevation,
        map.geography,
        map.terrains,
        map.manualCurrents
      ),
    [map.elevation, map.geography, map.height, map.manualCurrents, map.terrains, map.width]
  );

  const windField = useMemo(
    () =>
      computeWindField(
        map.width,
        map.height,
        map.elevation,
        map.geography,
        map.manualWinds,
        activeSeason
      ),
    [activeSeason, map.elevation, map.geography, map.height, map.manualWinds, map.width]
  );

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
        const tMeta = getTerrainMetaWithCustom(tId, map.customTerrains, map.terrainOverrides);
        const bMeta = getBiomeMetaWithCustom(map.biomes[idx], map.customBiomes);
        let color =
          climateOverlay === 'terrain'
            ? tMeta.color
            : climateOverlay === 'currents'
            ? tId === TerrainId.LAKE
              ? '#3b8ec2'
              : bMeta.isWater || isWaterTerrainWithCustom(tId, map.customTerrains, map.terrainOverrides)
              ? oceanCurrentField.thermal[idx] >= 0.2
                ? '#e06346'
                : oceanCurrentField.thermal[idx] <= -0.2
                ? '#38bdf8'
                : '#1b496e'
              : '#364152'
            : bMeta.isWater && !bMeta.isCustom
            ? tMeta.color
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

    if (tectonicEditPlateId) {
      onClickTectonicPlateAt?.(h.q, h.r);
      return;
    }

    if (tool === 'terrain') {
      if (terrainEditMode === 'sculpt' && activeFeature === null) {
        isPaintingRef.current = true;
        onBeginStroke();
        onSculptElevationAt(h.q, h.r);
      } else if (terrainSubTool === 'eyedropper') {
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
    } else if (tool === 'current') {
      if (currentSubTool === 'erase') {
        onEraseCurrentNear(h.q, h.r);
      } else {
        const idx = hexIndex(h.q, h.r, map.width);
        const tId = getHexTerrain(map, idx);
        if (!isWaterTerrainWithCustom(tId, map.customTerrains, map.terrainOverrides)) {
          warnOnce('วาดกระแสน้ำได้เฉพาะบนทะเลหรือมหาสมุทรเท่านั้น');
          return;
        }
        isPaintingRef.current = true;
        draftPathRef.current = [h];
        setDraftPath([h]);
      }
    } else if (tool === 'wind') {
      if (windSubTool === 'erase') {
        onEraseWindNear(h.q, h.r);
      } else {
        isPaintingRef.current = true;
        draftPathRef.current = [h];
        setDraftPath([h]);
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
    } else if (tool === 'campaign') {
      if (campaignSubTool === 'erase') {
        onEraseCampaignNear(h.q, h.r);
      } else {
        isPaintingRef.current = true;
        draftPathRef.current = [h];
        setDraftPath([h]);
      }
    } else if (tool === 'climate') {
      const nearCity = map.cities.find((c) => hexDistance(c, h) <= 1);
      if (nearCity) onPlaceOrSelectCityAt(h.q, h.r);
    } else if (tool === 'submap') {
      isPaintingRef.current = true;
      submapStartRef.current = h;
      setSubmapDraftBox({ minQ: h.q, maxQ: h.q, minR: h.r, maxR: h.r });
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

    if (tool === 'terrain') {
      if (terrainEditMode === 'sculpt' && activeFeature === null) {
        onSculptElevationAt(h.q, h.r);
      } else if (terrainSubTool === 'brush' || activeFeature !== null) {
        const res = onPaintTerrainAt(h.q, h.r);
        if (res.warning) warnOnce(res.warning);
      }
    } else if (tool === 'current' && currentSubTool === 'draw') {
      const cur = draftPathRef.current;
      const last = cur[cur.length - 1];
      if (!last || last.q !== h.q || last.r !== h.r) {
        const idx = hexIndex(h.q, h.r, map.width);
        const tId = getHexTerrain(map, idx);
        if (!isWaterTerrainWithCustom(tId, map.customTerrains, map.terrainOverrides)) {
          return;
        }
        const next = [...cur, h];
        draftPathRef.current = next;
        setDraftPath(next);
      }
    } else if (tool === 'wind' && windSubTool === 'draw') {
      const cur = draftPathRef.current;
      const last = cur[cur.length - 1];
      if (!last || last.q !== h.q || last.r !== h.r) {
        const next = [...cur, h];
        draftPathRef.current = next;
        setDraftPath(next);
      }
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
    } else if (tool === 'campaign' && campaignSubTool === 'draw') {
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
    } else if (tool === 'submap' && submapStartRef.current) {
      const s = submapStartRef.current;
      setSubmapDraftBox({
        minQ: Math.min(s.q, h.q),
        maxQ: Math.max(s.q, h.q),
        minR: Math.min(s.r, h.r),
        maxR: Math.max(s.r, h.r),
      });
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
      } else if (tool === 'current' && currentSubTool === 'draw') {
        const pts = draftPathRef.current;
        if (pts.length >= 2) {
          onAddManualCurrent(pts);
        }
        draftPathRef.current = [];
        setDraftPath([]);
      } else if (tool === 'wind' && windSubTool === 'draw') {
        const pts = draftPathRef.current;
        if (pts.length >= 2) {
          onAddManualWind(pts);
        }
        draftPathRef.current = [];
        setDraftPath([]);
      } else if (tool === 'campaign' && campaignSubTool === 'draw') {
        const pts = draftPathRef.current;
        if (pts.length >= 2) {
          onAddCampaignPath(pts);
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
      } else if (tool === 'submap') {
        const s = submapStartRef.current;
        submapStartRef.current = null;
        if (s && submapDraftBox) {
          const spanW = Math.max(6, submapDraftBox.maxQ - submapDraftBox.minQ);
          const spanH = Math.max(6, submapDraftBox.maxR - submapDraftBox.minR);
          const minQ = Math.max(0, Math.min(map.width - 7, submapDraftBox.minQ));
          const minR = Math.max(0, Math.min(map.height - 7, submapDraftBox.minR));
          const bounds: SubMapBounds = {
            minQ,
            maxQ: Math.min(map.width - 1, minQ + spanW),
            minR,
            maxR: Math.min(map.height - 1, minR + spanH),
          };
          setSubmapDraftBox(null);
          onSelectSubMapZone?.(bounds);
        }
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

  const seasonalField = useMemo(
    () => (activeSeason ? computeSeasonalField(map, activeSeason) : null),
    [activeSeason, map]
  );

  const hoverInfo = useMemo(() => {
    if (!hoverHex) return null;
    const idx = hexIndex(hoverHex.q, hoverHex.r, map.width);
    const terrain = getTerrainMetaWithCustom(
      getHexTerrain(map, idx),
      map.customTerrains,
      map.terrainOverrides
    );
    const biome = getBiomeMetaWithCustom(map.biomes[idx], map.customBiomes);
    const feat = map.features?.[idx]
      ? getFeatureMetaWithCustom(map.features[idx], map.customFeatures, map.featureOverrides)
      : null;
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
    const elevLabel = formatElevationMeters(map.elevation[idx] ?? 0);
    const temp = seasonalField ? seasonalField.temperature[idx] : (map.temperature[idx] ?? 15);
    const moist = Math.round((map.moisture[idx] ?? 0.5) * 2400);
    const latStr = formatLatitude(getRowLatitude(hoverHex.r, map.height, map.geography));
    const lonStr = formatLongitude(getColLongitude(hoverHex.q, map.width, map.geography));
    const isOceanHex =
      terrain.id === TerrainId.DEEP_OCEAN || terrain.id === TerrainId.SHALLOW_WATER;
    const curKind = isOceanHex
      ? getCurrentKind(oceanCurrentField.thermal[idx], oceanCurrentField.speed[idx])
      : 'none';
    const curDir = isOceanHex
      ? getCurrentCompassLabel(oceanCurrentField.dx[idx], oceanCurrentField.dy[idx])
      : '';
    const wSpd = windField.speed[idx] ?? 0.5;
    const wBelt = windField.belt[idx] ?? 2;
    const windDir = getWindCompassLabel(windField.dx[idx], windField.dy[idx]);
    const windKnots = windSpeedKnots(wSpd);
    const windLabel = getWindBeltLabelTh(wBelt, wSpd);
    const city = map.cities.find((c) => c.q === hoverHex.q && c.r === hoverHex.r);
    return {
      terrain,
      biome,
      feat,
      kingdom,
      govLabel,
      religion,
      culture,
      elevLabel,
      temp,
      moist,
      latStr,
      lonStr,
      curKind,
      curDir,
      windDir,
      windKnots,
      windLabel,
      city,
    };
  }, [hoverHex, map, oceanCurrentField, seasonalField, windField]);

  const activeTerrainMeta = getTerrainMetaWithCustom(
    activeTerrain,
    map.customTerrains,
    map.terrainOverrides
  );
  const activeBiomeMeta = getBiomeMetaWithCustom(activeBiome, map.customBiomes);
  const activeFeatureMeta = activeFeature
    ? getFeatureMetaWithCustom(activeFeature, map.customFeatures, map.featureOverrides)
    : null;
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

      {/* Tectonic Plate Picker Floating Banner */}
      {tectonicEditPlateId && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#141d2b]/95 border border-amber-400/70 rounded-full px-3.5 py-1.5 text-xs text-amber-200 shadow-2xl">
          <span>
            {tectonicEditPlateId === '__new__'
              ? 'คลิกบนแผนที่เพื่อวางจุดศูนย์กลางแผ่นเปลือกโลกใหม่'
              : 'คลิกบนแผนที่เพื่อย้ายจุดศูนย์กลางแผ่นเปลือกโลกที่เลือก'}
          </span>
          {onCancelTectonicPlace && (
            <button
              onClick={onCancelTectonicPlace}
              className="px-2 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 text-[11px] cursor-pointer"
            >
              ยกเลิก
            </button>
          )}
        </div>
      )}

      {/* Contextual Floating Tool Bar */}
      {tool !== 'view' && (
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-[#111720]/92 backdrop-blur-sm border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs shadow-xl max-w-[calc(100%-70px)]">
          {tool === 'terrain' && (
            <>
              {/* 2-mode switch: Paint Landform vs Continuous Elevation Sculpt */}
              {activeFeature === null && (
                <div className="flex items-center bg-[#0c1118] border border-slate-700/80 rounded p-0.5 gap-0.5">
                  <button
                    onClick={() => onChangeTerrainEditMode('paint')}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                      terrainEditMode === 'paint'
                        ? 'bg-amber-500/25 text-amber-200 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ระบายภูมิประเทศ
                  </button>
                  <button
                    onClick={() => onChangeTerrainEditMode('sculpt')}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                      terrainEditMode === 'sculpt'
                        ? 'bg-emerald-500/25 text-emerald-200 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ปั้นความสูง
                  </button>
                </div>
              )}

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
              ) : terrainEditMode === 'sculpt' ? (
                <>
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'raise' as const, label: 'ยกสูง', icon: <ArrowUp className="w-3 h-3" /> },
                      { id: 'lower' as const, label: 'ขุดลึก', icon: <ArrowDown className="w-3 h-3" /> },
                      { id: 'smooth' as const, label: 'เกลี่ยเรียบ', icon: <Waves className="w-3 h-3" /> },
                      { id: 'flatten' as const, label: 'เสมอระดับ', icon: <Minus className="w-3 h-3" /> },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => onChangeSculptMode(m.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer ${
                          sculptMode === m.id
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-medium'
                            : 'bg-[#17202b] border-slate-700 text-slate-300'
                        }`}
                      >
                        {m.icon}
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="h-4 w-px bg-slate-700" />
                  <span className="text-slate-400">ความแรง:</span>
                  <div className="flex gap-1">
                    {[
                      { val: 0.04, label: 'เบา' },
                      { val: 0.08, label: 'กลาง' },
                      { val: 0.14, label: 'แรง' },
                    ].map((s) => (
                      <button
                        key={s.val}
                        onClick={() => onChangeSculptIntensity(s.val)}
                        className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer ${
                          Math.abs(sculptIntensity - s.val) < 0.01
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'border-slate-700 text-slate-400'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-white/25"
                      style={{ backgroundColor: activeTerrainMeta.color }}
                    />
                    {activeTerrainMeta.nameTh}
                  </span>
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
                </>
              )}
              <div className="h-4 w-px bg-slate-700" />
              <span className="text-slate-400">พู่กัน: {brushSize}</span>
              <input
                type="range"
                min={1}
                max={6}
                value={brushSize}
                onChange={(e) => onChangeBrushSize(Number(e.target.value))}
                className="w-16"
              />
              {terrainEditMode === 'paint' && (
                <>
                  <div className="h-4 w-px bg-slate-700" />
                  <button
                    onClick={onToggleLakeBrush}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition cursor-pointer ${
                      activeFeature === null && activeTerrain === TerrainId.LAKE
                        ? 'bg-sky-500/25 border-sky-400 text-sky-100 font-medium'
                        : 'bg-[#17202b] border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                    title="ระบายทะเลสาบน้ำจืด"
                  >
                    <Droplets className="w-3.5 h-3.5 text-sky-400" />
                    <span>ทะเลสาบ</span>
                  </button>
                  <button
                    onClick={onToggleCliffBrush}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition cursor-pointer ${
                      activeFeature === 'cliff'
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-medium'
                        : 'bg-[#17202b] border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                    title="สลับพู่กันวาดหน้าผา"
                  >
                    <Mountain className="w-3.5 h-3.5" />
                    <span>หน้าผา</span>
                  </button>
                </>
              )}
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

          {tool === 'current' && (
            <>
              <button
                onClick={() => onChangeCurrentSubTool('draw')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer ${
                  currentSubTool === 'draw' ? 'bg-amber-500/25 text-amber-200' : 'text-slate-400'
                }`}
              >
                <Wind className="w-3.5 h-3.5" /> วาดกระแสน้ำ
              </button>
              <button
                onClick={() => onChangeCurrentSubTool('erase')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer ${
                  currentSubTool === 'erase' ? 'bg-rose-500/25 text-rose-200' : 'text-slate-400'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> ลบกระแสน้ำ
              </button>
              {currentSubTool === 'draw' && (
                <>
                  <div className="h-4 w-px bg-slate-700" />
                  {[
                    { id: 'warm' as const, label: 'น้ำอุ่น (+°C)', cls: 'bg-orange-500/25 border-orange-400 text-orange-200' },
                    { id: 'cold' as const, label: 'น้ำเย็น (-°C)', cls: 'bg-sky-500/25 border-sky-400 text-sky-200' },
                    { id: 'neutral' as const, label: 'กระแสกลาง', cls: 'bg-teal-500/25 border-teal-400 text-teal-200' },
                  ].map((k) => (
                    <button
                      key={k.id}
                      onClick={() => onChangeCurrentKind(k.id)}
                      className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${
                        currentKind === k.id
                          ? k.cls
                          : 'bg-[#17202b] border-slate-700 text-slate-400'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                  <span className="text-slate-400">แรง: {currentDrawStrength.toFixed(1)}x</span>
                  <input
                    type="range"
                    min={0.4}
                    max={2.0}
                    step={0.1}
                    value={currentDrawStrength}
                    onChange={(e) => onChangeCurrentDrawStrength(Number(e.target.value))}
                    className="w-16"
                  />
                </>
              )}
              <span className="text-slate-400 hidden sm:inline">
                ลากบนทะเลเพื่อกำหนดทิศไหล
              </span>
            </>
          )}

          {tool === 'wind' && (
            <>
              <button
                onClick={() => onChangeWindSubTool('draw')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer ${
                  windSubTool === 'draw' ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400'
                }`}
              >
                <Wind className="w-3.5 h-3.5" /> วาดแนวลม
              </button>
              <button
                onClick={() => onChangeWindSubTool('erase')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer ${
                  windSubTool === 'erase' ? 'bg-rose-500/25 text-rose-200' : 'text-slate-400'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> ลบแนวลม
              </button>
              {windSubTool === 'draw' && (
                <>
                  <div className="h-4 w-px bg-slate-700" />
                  {(
                    [
                      ['trade', 'ลมค้า'],
                      ['westerlies', 'ตะวันตก'],
                      ['monsoon', 'มรสุม'],
                      ['gale', 'พายุแรง'],
                      ['calm', 'ลมสงบ'],
                    ] as [ManualWindKind, string][]
                  ).map(([id, lbl]) => (
                    <button
                      key={id}
                      onClick={() => onChangeWindKind(id)}
                      className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${
                        windKind === id
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                          : 'bg-[#17202b] border-slate-700 text-slate-400'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                  <span className="text-slate-400">แรง: {windDrawStrength.toFixed(1)}x</span>
                  <input
                    type="range"
                    min={0.4}
                    max={1.8}
                    step={0.1}
                    value={windDrawStrength}
                    onChange={(e) => onChangeWindDrawStrength(Number(e.target.value))}
                    className="w-16"
                  />
                </>
              )}
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
                <>
                  <select
                    value={labelStyle}
                    onChange={(e) => onChangeLabelStyle(e.target.value as LabelStyle)}
                    className="bg-[#17202c] border border-slate-700 rounded px-2 py-0.5 text-slate-200 outline-none"
                  >
                    <option value="region">ชื่อแคว้น / ภูมิภาค</option>
                    <option value="water">ชื่อทะเล / มหาสมุทร</option>
                    <option value="mountain">ชื่อเทือกเขา</option>
                  </select>
                  <select
                    value={labelSize}
                    onChange={(e) => onChangeLabelSize(e.target.value as LabelSize)}
                    className="bg-[#17202c] border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 outline-none"
                    title="ขนาดตัวอักษร"
                  >
                    <option value="sm">เล็ก</option>
                    <option value="md">กลาง</option>
                    <option value="lg">ใหญ่</option>
                  </select>
                  <span className="text-slate-400">เอียง: {labelRotation}°</span>
                  <input
                    type="range"
                    min={-75}
                    max={75}
                    step={5}
                    value={labelRotation}
                    onChange={(e) => onChangeLabelRotation(Number(e.target.value))}
                    className="w-14"
                  />
                  <span className="text-slate-400">โค้ง: {labelCurve.toFixed(1)}</span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={labelCurve}
                    onChange={(e) => onChangeLabelCurve(Number(e.target.value))}
                    className="w-14"
                  />
                </>
              )}
            </>
          )}

          {tool === 'campaign' && (
            <>
              <button
                onClick={() => onChangeCampaignSubTool('draw')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer ${
                  campaignSubTool === 'draw' ? 'bg-rose-500/25 text-rose-200' : 'text-slate-400'
                }`}
              >
                <Swords className="w-3.5 h-3.5" /> ลากเส้นเดินทัพ
              </button>
              <button
                onClick={() => onChangeCampaignSubTool('erase')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer ${
                  campaignSubTool === 'erase' ? 'bg-rose-500/25 text-rose-200' : 'text-slate-400'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> ลบทัพ
              </button>
              <select
                value={campaignKingdomId}
                onChange={(e) => onChangeCampaignKingdomId(e.target.value)}
                className="bg-[#17202c] border border-slate-700 rounded px-2 py-0.5 text-slate-200 outline-none"
              >
                {map.kingdoms.map((k) => (
                  <option key={k.id} value={k.id}>
                    ฝ่าย: {k.name}
                  </option>
                ))}
              </select>
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

          {tool === 'submap' && (
            <span className="text-amber-200">
              คลิกลากกรอบสี่เหลี่ยมบนแผนที่เพื่อเลือกโซนเจาะแผนที่ภูมิภาค (Sub-Map)
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

      {referenceOverlay?.visible && (
        <div className="absolute top-14 left-3 bg-[#111720]/92 border border-sky-500/50 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px] text-slate-200 shadow-xl">
          <span className="text-sky-300 font-medium">ภาพลอกลาย:</span>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.05}
            value={referenceOverlay.opacity}
            onChange={(e) =>
              onChangeReferenceOverlay({
                ...referenceOverlay,
                opacity: Number(e.target.value),
              })
            }
            className="w-20"
          />
          <button
            onClick={() => onChangeReferenceOverlay(null)}
            className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/35 cursor-pointer"
          >
            ปิดภาพร่าง
          </button>
        </div>
      )}

      {/* Bottom-Left Scale Bar + Elevation Ramp Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 pointer-events-none">
        {climateOverlay === 'elevation' && (
          <div className="bg-[#111720]/90 border border-slate-700/70 rounded px-2.5 py-1.5 text-[10px] text-slate-200 shadow-lg">
            <div className="font-semibold text-amber-300 mb-1">สเกลความสูง/ความลึก (เมตร)</div>
            <div
              className="h-2.5 w-44 rounded-xs border border-slate-700"
              style={{
                background:
                  'linear-gradient(to right, #081830 0%, #205886 35%, #52a6c6 48%, #3e844a 52%, #b6be62 66%, #ba904e 76%, #9a663e 86%, #f6faff 100%)',
              }}
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 tabular-nums">
              <span>-6,000</span>
              <span>0 ม.</span>
              <span>+2,800</span>
              <span>+8,850</span>
            </div>
          </div>
        )}
        <div className="bg-[#111720]/88 border border-slate-700/70 rounded px-2.5 py-1.5 w-fit">
          <div className="text-[11px] font-medium text-slate-200 mb-1">
            {scaleBar.km.toLocaleString()} กม.
          </div>
          <div
            className="h-1.5 border-x-2 border-b-2 border-slate-200"
            style={{ width: `${scaleBar.px}px` }}
          />
        </div>
      </div>

      {/* Bottom-Center Telemetry */}
      {hoverHex && hoverInfo && (
        <div className="hidden md:flex absolute bottom-3 left-1/2 -translate-x-1/2 items-center gap-2.5 bg-[#111720]/92 border border-slate-700/75 rounded-full px-4 py-1 text-[11px] text-slate-200 pointer-events-none shadow-lg whitespace-nowrap max-w-[75vw] overflow-hidden">
          <span className="text-slate-400">
            ({hoverHex.q}, {hoverHex.r}) · {hoverInfo.latStr}, {hoverInfo.lonStr}
          </span>
          <span className="flex items-center gap-1 font-medium text-amber-200">
            <span
              className="w-2.5 h-2.5 rounded-xs"
              style={{ backgroundColor: hoverInfo.terrain.color }}
            />
            {hoverInfo.terrain.nameTh}
          </span>
          {(!isWaterTerrainWithCustom(hoverInfo.terrain.id, map.customTerrains, map.terrainOverrides) || hoverInfo.biome.isCustom) && (
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
            {hoverInfo.terrain.id === TerrainId.LAKE
              ? `ทะเลสาบ (${hoverInfo.elevLabel})`
              : hoverInfo.elevLabel}
          </span>
          {hoverInfo.curKind !== 'none' && (
            <span
              className={
                hoverInfo.curKind === 'warm'
                  ? 'text-rose-300 font-medium'
                  : hoverInfo.curKind === 'cold'
                  ? 'text-cyan-300 font-medium'
                  : 'text-teal-300'
              }
            >
              🌊{' '}
              {hoverInfo.curKind === 'warm'
                ? 'กระแสน้ำอุ่น'
                : hoverInfo.curKind === 'cold'
                ? 'กระแสน้ำเย็น'
                : 'กระแสน้ำกลาง'}{' '}
              ({hoverInfo.curDir})
            </span>
          )}
          <span className="text-sky-300">{hoverInfo.temp.toFixed(1)}°C</span>
          <span className="text-cyan-200" title={hoverInfo.windLabel}>
            💨 {hoverInfo.windDir} {hoverInfo.windKnots} kt
          </span>
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
