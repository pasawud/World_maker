import { useEffect, useState } from 'react';
import { CalendarModal } from './components/CalendarModal';
import { CityBlueprintModal } from './components/CityBlueprintModal';
import { CityTradeModal } from './components/CityTradeModal';
import { CustomAssetsModal, CustomStudioTab } from './components/CustomAssetsModal';
import { EconomyModal } from './components/EconomyModal';
import { EntityLoreModal } from './components/EntityLoreModal';
import { ExportImportModal } from './components/ExportImportModal';
import { HeightmapSubMapModal } from './components/HeightmapSubMapModal';
import { MapCanvas } from './components/MapCanvas';
import { MapSizeModal } from './components/MapSizeModal';
import { QuickSearchModal } from './components/QuickSearchModal';
import { RightSidebar } from './components/RightSidebar';
import { SubBar } from './components/SubBar';
import { TimelineBar } from './components/TimelineBar';
import { TimelineModal } from './components/TimelineModal';
import { TopBar } from './components/TopBar';
import { WorldbuildingModal } from './components/WorldbuildingModal';
import { WorldSimulateModal } from './components/WorldSimulateModal';
import { getAllPoiTypes } from './data/goods';
import { hexDistance } from './engine/hexMath';
import { exportMapToPng } from './engine/renderer';
import { createInitialTimeline } from './engine/timeline';
import { useMapEditor } from './hooks/useMapEditor';
import { TerrainId, ToolMode } from './types/map';

export function App() {
  const editor = useMapEditor();
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [showEconomyModal, setShowEconomyModal] = useState(false);
  const [customModalTab, setCustomModalTab] = useState<CustomStudioTab | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [tradeModalCityId, setTradeModalCityId] = useState<string | null>(null);
  const [blueprintCityId, setBlueprintCityId] = useState<string | null>(null);
  const [loreModal, setLoreModal] = useState<{
    kind: 'kingdom' | 'religion' | 'culture';
    id: string;
  } | null>(null);
  const [showTimelineBar, setShowTimelineBar] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showWorldbuildingModal, setShowWorldbuildingModal] = useState(false);
  const [showHeightmapModal, setShowHeightmapModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowQuickSearch((s) => !s);
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        editor.toggleLayer('grid');
        return;
      }
      if (e.key.toLowerCase() === 'b') {
        editor.setTool('biome');
        return;
      }
      if (e.key.toLowerCase() === 'c') {
        editor.setTool('current');
        return;
      }
      if (e.key === 'Escape') {
        editor.setTradeStartCityId(null);
        editor.setMeasurePoints([]);
        editor.setSelectedCityId(null);
        return;
      }
      const toolOrder: ToolMode[] = [
        'view',
        'terrain',
        'river',
        'city',
        'territory',
        'religion',
        'road',
        'trade',
        'measure',
        'poi',
      ];
      if (e.key === '0') {
        editor.setTool('poi');
        return;
      }
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < toolOrder.length) {
        editor.setTool(toolOrder[idx]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor]);

  const selectedCity = editor.selectedCityId
    ? editor.map.cities.find((c) => c.id === editor.selectedCityId) ?? null
    : null;

  const handleQuickGenerate = () => {
    const seed = Math.floor(10000 + Math.random() * 89999);
    editor.runGenerateWorld({ seed });
    showToast('สร้างโลกแฟนตาซีใหม่ตามหลักภูมิศาสตร์จริงแล้ว');
  };

  const handleQuickPngExport = () => {
    const url = exportMapToPng(editor.map, {
      overlay: editor.climateOverlay,
      layers: editor.layers,
      includeLegend: true,
      includeScale: true,
    });
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editor.map.name.replace(/\s+/g, '_')}.png`;
    a.click();
    showToast('ดาวน์โหลดภาพแผนที่ PNG แล้ว');
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0e141c] text-slate-100 overflow-hidden">
      <TopBar
        map={editor.map}
        tool={editor.tool}
        onSelectTool={editor.setTool}
        onRenameMap={(name) =>
          editor.commitMapChange((prev) => ({ ...prev, name }), [])
        }
        canUndo={editor.undoStack.length > 0}
        canRedo={editor.redoStack.length > 0}
        onUndo={editor.undo}
        onRedo={editor.redo}
        autosaveStatus={editor.autosaveStatus}
        showMinimap={editor.showMinimap}
        onToggleMinimap={() => editor.setShowMinimap((s) => !s)}
        onOpenLibrary={() => setShowExportModal(true)}
        onOpenSizeModal={() => setShowSizeModal(true)}
        onOpenQuickSearch={() => setShowQuickSearch(true)}
        onQuickGenerateWorld={handleQuickGenerate}
      />

      <SubBar
        map={editor.map}
        overlay={editor.climateOverlay}
        onChangeOverlay={editor.setClimateOverlay}
        mapTheme={editor.map.mapTheme ?? 'standard'}
        onChangeMapTheme={editor.setMapTheme}
        activeSeason={editor.activeSeason}
        onChangeActiveSeason={editor.setActiveSeason}
        layers={editor.layers}
        onToggleLayer={editor.toggleLayer}
        showTimelineBar={showTimelineBar}
        onToggleTimelineBar={() => {
          if (!showTimelineBar) editor.ensureTimeline();
          setShowTimelineBar((s) => !s);
        }}
        onOpenSizeModal={() => setShowSizeModal(true)}
        onOpenEconomyModal={() => setShowEconomyModal(true)}
        onOpenWorldbuildingModal={() => setShowWorldbuildingModal(true)}
        onOpenHeightmapModal={() => setShowHeightmapModal(true)}
        onOpenCalendarModal={() => setShowCalendarModal(true)}
        onOpenSimulateModal={() => setShowSimulateModal(true)}
        onOpenCustomModal={() => setCustomModalTab('terrains')}
        onOpenExportModal={() => setShowExportModal(true)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <MapCanvas
          map={editor.map}
          tool={editor.tool}
          activeTerrain={editor.activeTerrain}
          onSelectTerrain={editor.setActiveTerrain}
          terrainEditMode={editor.terrainEditMode}
          onChangeTerrainEditMode={editor.setTerrainEditMode}
          sculptMode={editor.sculptMode}
          onChangeSculptMode={editor.setSculptMode}
          sculptIntensity={editor.sculptIntensity}
          onChangeSculptIntensity={editor.setSculptIntensity}
          onSculptElevationAt={editor.sculptElevationAt}
          activeBiome={editor.activeBiome}
          onSelectBiome={editor.setActiveBiome}
          activeFeature={editor.activeFeature}
          onClearActiveFeature={() => editor.setActiveFeature(null)}
          brushSize={editor.brushSize}
          onChangeBrushSize={editor.setBrushSize}
          autoShallowWater={editor.autoShallowWater}
          onToggleAutoShallowWater={() => editor.setAutoShallowWater((v) => !v)}
          onToggleCliffBrush={() =>
            editor.setActiveFeature((cur) => (cur === 'cliff' ? null : 'cliff'))
          }
          onToggleLakeBrush={() => {
            editor.setActiveFeature(null);
            editor.setActiveTerrain((cur) =>
              cur === TerrainId.LAKE ? TerrainId.PLAINS : TerrainId.LAKE
            );
          }}
          terrainSubTool={editor.terrainSubTool}
          onChangeTerrainSubTool={editor.setTerrainSubTool}
          riverSubTool={editor.riverSubTool}
          onChangeRiverSubTool={editor.setRiverSubTool}
          currentSubTool={editor.currentSubTool}
          onChangeCurrentSubTool={editor.setCurrentSubTool}
          currentKind={editor.currentKind}
          onChangeCurrentKind={editor.setCurrentKind}
          currentDrawStrength={editor.currentDrawStrength}
          onChangeCurrentDrawStrength={editor.setCurrentDrawStrength}
          onAddManualCurrent={(points) => {
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                manualCurrents: [
                  ...(prev.manualCurrents ?? []),
                  {
                    id: `cur_${Date.now().toString(36)}`,
                    kind: editor.currentKind,
                    strength: editor.currentDrawStrength,
                    points,
                  },
                ],
              }),
              []
            );
            showToast('เพิ่มสายกระแสน้ำมหาสมุทรแล้ว');
          }}
          onEraseCurrentNear={(q, r) => {
            editor.eraseCurrentNear(q, r);
            showToast('ลบสายกระแสน้ำแล้ว');
          }}
          roadType={editor.roadType}
          onChangeRoadType={editor.setRoadType}
          roadSubTool={editor.roadSubTool}
          onChangeRoadSubTool={editor.setRoadSubTool}
          territorySubTool={editor.territorySubTool}
          religionSubTool={editor.religionSubTool}
          cultureSubTool={editor.cultureSubTool}
          poiSubTool={editor.poiSubTool}
          onChangePoiSubTool={editor.setPoiSubTool}
          poiType={editor.poiType}
          onChangePoiType={editor.setPoiType}
          labelStyle={editor.labelStyle}
          onChangeLabelStyle={editor.setLabelStyle}
          labelSize={editor.labelSize}
          onChangeLabelSize={editor.setLabelSize}
          labelRotation={editor.labelRotation}
          onChangeLabelRotation={editor.setLabelRotation}
          labelCurve={editor.labelCurve}
          onChangeLabelCurve={editor.setLabelCurve}
          campaignSubTool={editor.campaignSubTool}
          onChangeCampaignSubTool={editor.setCampaignSubTool}
          campaignKingdomId={editor.campaignKingdomId}
          onChangeCampaignKingdomId={editor.setCampaignKingdomId}
          onAddCampaignPath={(hexes) => {
            const count = (editor.map.campaigns ?? []).length + 1;
            const k = editor.map.kingdoms.find((kk) => kk.id === editor.campaignKingdomId);
            editor.addCampaign({
              name: `ยุทธการ ${k?.name ?? ''} #${count}`.trim(),
              kingdomId: editor.campaignKingdomId,
              status: 'active',
              points: hexes,
            });
            showToast('เพิ่มเส้นทางการเคลื่อนทัพแล้ว');
          }}
          onEraseCampaignNear={(q, r) => {
            editor.eraseCampaignNear(q, r);
            showToast('ลบเส้นทางเดินทัพแล้ว');
          }}
          referenceOverlay={editor.referenceOverlay}
          onChangeReferenceOverlay={editor.setReferenceOverlay}
          focusTarget={editor.focusTarget}
          climateOverlay={editor.climateOverlay}
          activeSeason={editor.activeSeason}
          layers={editor.layers}
          tectonicEditPlateId={editor.tectonicEditPlateId}
          onCancelTectonicPlace={() => editor.setTectonicEditPlateId(null)}
          onClickTectonicPlateAt={(q, r) => {
            editor.placeOrMoveTectonicPlateAt(q, r);
            if (editor.climateOverlay !== 'tectonics') editor.setClimateOverlay('tectonics');
            showToast(`กำหนดตำแหน่งแผ่นเปลือกโลกที่ (${q}, ${r}) แล้ว`);
          }}
          onSelectSubMapZone={(bounds) => {
            editor.setPendingSubMapBounds(bounds);
            setShowHeightmapModal(true);
            editor.setTool('view');
          }}
          selectedCityId={editor.selectedCityId}
          tradeStartCityId={editor.tradeStartCityId}
          measurePoints={editor.measurePoints}
          onAddMeasurePoint={(h) => editor.setMeasurePoints((pts) => [...pts, h])}
          showMinimap={editor.showMinimap}
          renderVersion={editor.renderVersion}
          dirtyHexQueue={editor.dirtyHexQueue}
          onBeginStroke={editor.beginStroke}
          onPaintTerrainAt={editor.paintTerrainAt}
          onPaintBiomeAt={editor.paintBiomeAt}
          onPaintTerritoryAt={editor.paintTerritoryAt}
          onFloodFillTerritoryAt={editor.floodFillTerritoryAt}
          onPaintReligionAt={editor.paintReligionAt}
          onFloodFillReligionAt={editor.floodFillReligionAt}
          onPaintCultureAt={editor.paintCultureAt}
          onFloodFillCultureAt={editor.floodFillCultureAt}
          onEndStroke={editor.endStroke}
          onFloodFillAt={editor.floodFillAt}
          onFloodFillBiomeAt={editor.floodFillBiomeAt}
          onPlaceOrSelectCityAt={editor.placeOrSelectCityAt}
          onTradeClickAt={(q, r) => {
            const res = editor.handleTradeCityClick(q, r);
            if (res.error) showToast(res.error);
          }}
          onAddManualRiver={(points) => {
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                rivers: [
                  ...prev.rivers,
                  { id: `river_man_${Date.now().toString(36)}`, source: 'manual', points },
                ],
              }),
              []
            );
          }}
          onEraseRiverNear={(q, r) => {
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                rivers: prev.rivers.filter(
                  (rv) => !rv.points.some((pt) => hexDistance(pt, { q, r }) <= 1)
                ),
              }),
              []
            );
          }}
          onAutoRivers={() => {
            editor.runAutoRivers(true);
            showToast('คำนวณและวางสายน้ำตามภูมิศาสตร์เรียบร้อยแล้ว');
          }}
          onAddRoad={(hexes) => {
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                roads: [
                  ...prev.roads,
                  { id: `road_${Date.now().toString(36)}`, type: editor.roadType, hexes },
                ],
              }),
              []
            );
          }}
          onEraseRoadNear={(q, r) => {
            editor.eraseRoadNear(q, r);
            showToast('ลบเส้นทางแล้ว');
          }}
          onPlacePoi={(q, r) => {
            const allPois = getAllPoiTypes(editor.map.customPoiTypes);
            const meta = allPois.find((p) => p.id === editor.poiType);
            const name = window.prompt('ตั้งชื่อจุดสำคัญ:', meta?.label ?? 'จุดสำคัญ');
            if (!name || !name.trim()) return;
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                pois: [
                  ...prev.pois,
                  {
                    id: `poi_${Date.now().toString(36)}`,
                    type: editor.poiType,
                    name: name.trim(),
                    q,
                    r,
                    notes: '',
                  },
                ],
              }),
              []
            );
          }}
          onPlaceLabel={(q, r, text) => {
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                labels: [
                  ...prev.labels,
                  {
                    id: `lbl_${Date.now().toString(36)}`,
                    text,
                    q,
                    r,
                    size: editor.labelSize,
                    style: editor.labelStyle,
                    rotationDeg: editor.labelRotation,
                    curveAmount: editor.labelCurve,
                  },
                ],
              }),
              []
            );
          }}
          onNotify={showToast}
        />
          {showTimelineBar && (
            <TimelineBar
              timeline={editor.map.timeline ?? createInitialTimeline(editor.map)}
              onSwitchEra={(eraId) => {
                editor.switchEra(eraId);
                showToast('สลับยุคสมัยบนแผนที่แล้ว');
              }}
              onSaveActiveEra={() => {
                editor.saveActiveEra();
                showToast('บันทึกสภาพแผนที่ลงในยุคปัจจุบันแล้ว');
              }}
              onCreateEra={(name, year) => {
                editor.createEraFromCurrent(name, year);
                showToast(`สร้างยุค "${name}" เรียบร้อยแล้ว`);
              }}
              onOpenTimelineModal={() => setShowTimelineModal(true)}
              onCloseBar={() => setShowTimelineBar(false)}
            />
          )}
        </div>

        <RightSidebar
          map={editor.map}
          tool={editor.tool}
          activeTerrain={editor.activeTerrain}
          onSelectTerrain={(t) => {
            editor.setActiveTerrain(t);
            if (editor.tool !== 'terrain') editor.setTool('terrain');
          }}
          terrainEditMode={editor.terrainEditMode}
          onChangeTerrainEditMode={editor.setTerrainEditMode}
          currentKind={editor.currentKind}
          onChangeCurrentKind={editor.setCurrentKind}
          currentDrawStrength={editor.currentDrawStrength}
          onChangeCurrentDrawStrength={editor.setCurrentDrawStrength}
          onUpdateGeography={(patch) =>
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                geography: { ...prev.geography, ...patch },
              }),
              []
            )
          }
          onDeleteManualCurrent={(id) =>
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                manualCurrents: (prev.manualCurrents ?? []).filter((c) => c.id !== id),
              }),
              []
            )
          }
          activeBiome={editor.activeBiome}
          onSelectBiome={(b) => {
            editor.setActiveBiome(b);
            if (editor.tool !== 'biome') editor.setTool('biome');
          }}
          activeFeature={editor.activeFeature}
          onSelectFeature={(f) => {
            editor.setActiveFeature(f);
            if (f !== null && editor.tool !== 'terrain') editor.setTool('terrain');
          }}
          autoShallowWater={editor.autoShallowWater}
          onToggleAutoShallowWater={() => editor.setAutoShallowWater((v) => !v)}
          onSyncShallowWater={() => {
            editor.runSyncShallowWater();
            showToast('อัปเดตน้ำตื้นใกล้แผ่นดิน (เว้นบริเวณหน้าผา) แล้ว');
          }}
          onAutoGenerateCliffs={() => {
            editor.runAutoGenerateCliffs();
            showToast('สร้างหน้าผาชายฝั่งและปรับระดับน้ำอัตโนมัติแล้ว');
          }}
          onAutoPlaceFeatures={() => {
            const count = editor.runAutoPlaceFeatures({ includeCliffs: true, useTectonics: true });
            showToast(`วางลักษณะพิเศษตามหลักภูมิศาสตร์แล้ว ${count} ตำแหน่ง`);
          }}
          tectonicEditPlateId={editor.tectonicEditPlateId}
          onInitCustomPlates={() => {
            editor.initCustomTectonicPlates();
            showToast('เปิดโหมดกำหนดแผ่นเปลือกโลกเองแล้ว');
          }}
          onUpdateCustomPlates={editor.updateCustomTectonicPlates}
          onStartPlacePlate={(plateId) => {
            editor.setTectonicEditPlateId(plateId);
            if (plateId && editor.climateOverlay !== 'tectonics') {
              editor.setClimateOverlay('tectonics');
            }
          }}
          onApplyTectonicsToCurrent={(strength) => {
            editor.runApplyTectonicsToCurrentMap(strength);
            showToast('ปรับความสูง แนวภูเขา ร่องลึก และภูเขาไฟตามแผ่นเปลือกโลกแล้ว');
          }}
          onOpenSimulateModal={() => setShowSimulateModal(true)}
          brushSize={editor.brushSize}
          onChangeBrushSize={editor.setBrushSize}
          activeKingdomId={editor.activeKingdomId}
          onSelectKingdomId={editor.setActiveKingdomId}
          territorySubTool={editor.territorySubTool}
          onChangeTerritorySubTool={editor.setTerritorySubTool}
          onAutoTerritories={() => {
            editor.runAutoTerritories();
            if (editor.climateOverlay !== 'political') editor.setClimateOverlay('political');
            showToast('คำนวณพรมแดนอาณาจักรตามเมืองและแนวภูเขาแล้ว');
          }}
          activeReligionId={editor.activeReligionId}
          onSelectReligionId={editor.setActiveReligionId}
          religionSubTool={editor.religionSubTool}
          onChangeReligionSubTool={editor.setReligionSubTool}
          onAutoReligions={() => {
            editor.runAutoReligions();
            if (editor.climateOverlay !== 'religion') editor.setClimateOverlay('religion');
            showToast('แพร่เขตศาสนาจากเมืองและเส้นทางคมนาคมแล้ว');
          }}
          activeCultureId={editor.activeCultureId}
          onSelectCultureId={editor.setActiveCultureId}
          cultureSubTool={editor.cultureSubTool}
          onChangeCultureSubTool={editor.setCultureSubTool}
          onAutoCultures={() => {
            editor.runAutoCultures();
            if (editor.climateOverlay !== 'culture') editor.setClimateOverlay('culture');
            showToast('แพร่วัฒนธรรมจากเมืองและเส้นทางคมนาคมแล้ว');
          }}
          onUpdateKingdoms={editor.updateKingdoms}
          onUpdateReligions={editor.updateReligions}
          onUpdateCultures={editor.updateCultures}
          onOpenCityTrade={(cityId) => setTradeModalCityId(cityId)}
          onOpenCityBlueprint={(cityId) => setBlueprintCityId(cityId)}
          onOpenLore={(kind, id) => setLoreModal({ kind, id })}
          selectedCity={selectedCity}
          onUpdateCity={editor.updateCity}
          onDeleteCity={editor.deleteCity}
          onCloseCity={() => editor.setSelectedCityId(null)}
          climateOverlay={editor.climateOverlay}
          onChangeOverlay={editor.setClimateOverlay}
          onGenerateWorld={(cfg) => {
            editor.runGenerateWorld(cfg);
            showToast('สร้างโลกใหม่ตามพารามิเตอร์ภูมิศาสตร์แล้ว');
          }}
          onAutoRivers={() => {
            editor.runAutoRivers(true);
            showToast('วางแม่น้ำอัตโนมัติตามระดับความสูงสู่ทะเลแล้ว');
          }}
          onRecomputeBiomes={(cfg) => {
            editor.commitMapChange((prev) => ({ ...prev, geography: cfg }), []);
            editor.runRecomputeClimateBiomes();
            showToast('คำนวณไบโอมใหม่ตามภูมิอากาศและเงาฝนแล้ว');
          }}
          measurePoints={editor.measurePoints}
          measureMode={editor.measureMode}
          onChangeMeasureMode={editor.setMeasureMode}
          travelSpeed={editor.travelSpeed}
          onChangeTravelSpeed={editor.setTravelSpeed}
          onClearMeasure={() => editor.setMeasurePoints([])}
          tradeMode={editor.tradeMode}
          onChangeTradeMode={editor.setTradeMode}
          tradeStartCityId={editor.tradeStartCityId}
          onCancelTradeStart={() => editor.setTradeStartCityId(null)}
          onOpenCustomModal={(tab) => setCustomModalTab(tab)}
          onOpenWorldbuildingModal={() => setShowWorldbuildingModal(true)}
          campaignKingdomId={editor.campaignKingdomId}
          onChangeCampaignKingdomId={editor.setCampaignKingdomId}
          onUpdateCampaign={editor.updateCampaign}
          onDeleteCampaign={editor.deleteCampaign}
          onUpdateMapLabel={editor.updateMapLabel}
          onDeleteMapLabel={editor.deleteMapLabel}
          onJumpToCoord={editor.jumpToHex}
          onOpenExportModal={() => setShowExportModal(true)}
          onQuickPngExport={handleQuickPngExport}
          onClearMap={() => {
            if (window.confirm('ต้องการล้างแผนที่ทั้งหมดเป็นมหาสมุทรว่างเปล่าหรือไม่?')) {
              editor.clearMapEdits();
            }
          }}
        />

        {toast && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 bg-[#1a2433] border border-amber-500/60 text-amber-100 px-4 py-2 rounded-lg text-xs shadow-2xl">
            {toast}
          </div>
        )}
      </div>

      {showSizeModal && (
        <MapSizeModal
          map={editor.map}
          onApply={(w, h, km, mode) => {
            editor.applyMapResize(w, h, km, mode);
            showToast(`ปรับขนาดแผนที่เป็น ${w} × ${h} ช่อง (ช่องละ ${km} กม.)`);
          }}
          onClose={() => setShowSizeModal(false)}
        />
      )}

      {showEconomyModal && (
        <EconomyModal
          map={editor.map}
          onUpdateGoods={(goods) =>
            editor.commitMapChange((prev) => ({ ...prev, goods }), [])
          }
          onUpdateKingdoms={editor.updateKingdoms}
          onUpdateReligions={editor.updateReligions}
          onUpdateCultures={editor.updateCultures}
          onAddCustomGovernmentType={editor.addCustomGovernmentType}
          onAddCustomReligionType={editor.addCustomReligionType}
          onAddCustomCultureType={editor.addCustomCultureType}
          onDeleteTradeRoute={(id) =>
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                tradeRoutes: prev.tradeRoutes.filter((r) => r.id !== id),
              }),
              []
            )
          }
          onSelectCity={(cityId) => {
            editor.setSelectedCityId(cityId);
            editor.setTool('city');
          }}
          onOpenCityTrade={(cityId) => setTradeModalCityId(cityId)}
          onOpenCityBlueprint={(cityId) => setBlueprintCityId(cityId)}
          onOpenLore={(kind, id) => setLoreModal({ kind, id })}
          onClose={() => setShowEconomyModal(false)}
        />
      )}

      {loreModal && (
        <EntityLoreModal
          kind={loreModal.kind}
          entityId={loreModal.id}
          map={editor.map}
          onUpdateKingdoms={editor.updateKingdoms}
          onUpdateReligions={editor.updateReligions}
          onUpdateCultures={editor.updateCultures}
          onAddCustomGovernmentType={editor.addCustomGovernmentType}
          onAddCustomReligionType={editor.addCustomReligionType}
          onAddCustomCultureType={editor.addCustomCultureType}
          onClose={() => setLoreModal(null)}
        />
      )}

      {showTimelineModal && (
        <TimelineModal
          map={editor.map}
          timeline={editor.map.timeline ?? createInitialTimeline(editor.map)}
          onSwitchEra={(eraId) => {
            editor.switchEra(eraId);
            showToast('สลับยุคสมัยบนแผนที่แล้ว');
          }}
          onCreateEra={(name, year, summary) => {
            editor.createEraFromCurrent(name, year, summary);
            showToast(`สร้างยุค "${name}" แล้ว`);
          }}
          onUpdateTimeline={editor.updateTimelineMeta}
          onClose={() => setShowTimelineModal(false)}
        />
      )}

      {blueprintCityId &&
        (() => {
          const bpCity = editor.map.cities.find((c) => c.id === blueprintCityId);
          if (!bpCity) return null;
          return (
            <CityBlueprintModal
              city={bpCity}
              map={editor.map}
              onUpdateCity={editor.updateCity}
              onNotify={showToast}
              onClose={() => setBlueprintCityId(null)}
            />
          );
        })()}

      {tradeModalCityId && editor.map.cities.some((c) => c.id === tradeModalCityId) && (
        <CityTradeModal
          cityId={tradeModalCityId}
          map={editor.map}
          onSelectCityId={(id) => setTradeModalCityId(id)}
          onCreateTradeRoute={editor.createTradeRouteBetweenCities}
          onDeleteTradeRoute={(id) =>
            editor.commitMapChange(
              (prev) => ({
                ...prev,
                tradeRoutes: prev.tradeRoutes.filter((r) => r.id !== id),
              }),
              []
            )
          }
          onNotify={showToast}
          onClose={() => setTradeModalCityId(null)}
        />
      )}

      {customModalTab && (
        <CustomAssetsModal
          customTerrains={editor.map.customTerrains ?? []}
          customBiomes={editor.map.customBiomes}
          customFeatures={editor.map.customFeatures ?? []}
          terrainOverrides={editor.map.terrainOverrides ?? {}}
          featureOverrides={editor.map.featureOverrides ?? {}}
          customPoiTypes={editor.map.customPoiTypes}
          goods={editor.map.goods}
          initialTab={customModalTab}
          onAddTerrain={(t) => {
            const created = editor.addCustomTerrain(t);
            showToast(`เพิ่มภูมิประเทศ "${created.nameTh}" และเลือกใช้งานแล้ว`);
          }}
          onUpdateTerrain={editor.updateCustomTerrain}
          onDeleteTerrain={editor.deleteCustomTerrain}
          onSetTerrainOverride={editor.setTerrainOverride}
          onResetTerrainOverride={editor.resetTerrainOverride}
          onAddBiome={(b) => {
            const created = editor.addCustomBiome(b);
            showToast(`เพิ่มไบโอม "${created.nameTh}" และเลือกใช้งานแล้ว`);
          }}
          onUpdateBiome={editor.updateCustomBiome}
          onDeleteBiome={editor.deleteCustomBiome}
          onAddFeature={(f) => {
            const created = editor.addCustomFeature(f);
            showToast(`เพิ่มลักษณะพิเศษ "${created.nameTh}" และเลือกใช้งานแล้ว`);
          }}
          onUpdateFeature={editor.updateCustomFeature}
          onDeleteFeature={editor.deleteCustomFeature}
          onSetFeatureOverride={editor.setFeatureOverride}
          onResetFeatureOverride={editor.resetFeatureOverride}
          onAddPoiType={(p) => {
            const created = editor.addCustomPoiType(p);
            showToast(`เพิ่มจุดสำคัญ "${created.label}" และเลือกใช้งานแล้ว`);
          }}
          onDeletePoiType={editor.deleteCustomPoiType}
          onClose={() => setCustomModalTab(null)}
        />
      )}

      {showExportModal && (
        <ExportImportModal
          map={editor.map}
          overlay={editor.climateOverlay}
          layers={editor.layers}
          activeSeason={editor.activeSeason}
          onImportMap={(m) => {
            editor.loadImportedMap(m);
            showToast(`โหลดแผนที่ "${m.name}" เรียบร้อยแล้ว`);
          }}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showWorldbuildingModal && (
        <WorldbuildingModal
          map={editor.map}
          onUpsertDiplomacy={editor.upsertDiplomacy}
          onAddCampaign={editor.addCampaign}
          onUpdateCampaign={editor.updateCampaign}
          onDeleteCampaign={editor.deleteCampaign}
          onAddWikiEntry={editor.addWikiEntry}
          onUpdateWikiEntry={editor.updateWikiEntry}
          onDeleteWikiEntry={editor.deleteWikiEntry}
          onJumpToCoord={editor.jumpToHex}
          onStartDrawCampaign={(kId) => {
            editor.setCampaignKingdomId(kId);
            editor.setTool('campaign');
          }}
          onClose={() => setShowWorldbuildingModal(false)}
        />
      )}

      {showHeightmapModal && (
        <HeightmapSubMapModal
          map={editor.map}
          initialTab={editor.pendingSubMapBounds ? 'submap' : 'heightmap'}
          initialBounds={editor.pendingSubMapBounds}
          referenceOverlay={editor.referenceOverlay}
          onChangeReferenceOverlay={editor.setReferenceOverlay}
          onReplaceMap={(nextMap) => editor.loadImportedMap(nextMap)}
          onStartCanvasSelectZone={() => {
            editor.setPendingSubMapBounds(null);
            editor.setTool('submap');
            showToast('ลากกรอบสี่เหลี่ยมบนแผนที่เพื่อเลือกโซนเจาะ Sub-Map');
          }}
          onNotify={showToast}
          onClose={() => {
            setShowHeightmapModal(false);
            editor.setPendingSubMapBounds(null);
          }}
        />
      )}

      {showCalendarModal && (
        <CalendarModal
          map={editor.map}
          activeSeason={editor.activeSeason}
          onChangeSeason={editor.setActiveSeason}
          onUpdateCalendar={editor.updateCalendar}
          onClose={() => setShowCalendarModal(false)}
        />
      )}

      {showSimulateModal && (
        <WorldSimulateModal
          map={editor.map}
          onSimulate={(opts) => {
            const sum = editor.runSimulateAllFromCurrentMap(opts);
            showToast(
              `จำลองครบทุกมิติแล้ว: เมือง ${sum.cities}, แม่น้ำ ${sum.rivers}, ลักษณะพิเศษ ${sum.features}, ถนน ${sum.roads}, การค้า ${sum.tradeRoutes}, ป้าย ${sum.labels}`
            );
          }}
          onClose={() => setShowSimulateModal(false)}
        />
      )}

      {showQuickSearch && (
        <QuickSearchModal
          map={editor.map}
          onJumpToCoord={editor.jumpToHex}
          onSelectCity={(cityId) => {
            editor.setSelectedCityId(cityId);
            editor.setTool('city');
          }}
          onAddBookmark={editor.addBookmark}
          onDeleteBookmark={editor.deleteBookmark}
          onClose={() => setShowQuickSearch(false)}
        />
      )}
    </div>
  );
}

export default App;
