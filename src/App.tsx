import { useEffect, useState } from 'react';
import { CustomAssetsModal } from './components/CustomAssetsModal';
import { EconomyModal } from './components/EconomyModal';
import { ExportImportModal } from './components/ExportImportModal';
import { MapCanvas } from './components/MapCanvas';
import { MapSizeModal } from './components/MapSizeModal';
import { RightSidebar } from './components/RightSidebar';
import { SubBar } from './components/SubBar';
import { TopBar } from './components/TopBar';
import { getAllPoiTypes } from './data/goods';
import { hexDistance } from './engine/hexMath';
import { exportMapToPng } from './engine/renderer';
import { useMapEditor } from './hooks/useMapEditor';
import { ToolMode } from './types/map';

export function App() {
  const editor = useMapEditor();
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [showEconomyModal, setShowEconomyModal] = useState(false);
  const [customModalTab, setCustomModalTab] = useState<'biomes' | 'pois' | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
        onQuickGenerateWorld={handleQuickGenerate}
      />

      <SubBar
        map={editor.map}
        overlay={editor.climateOverlay}
        onChangeOverlay={editor.setClimateOverlay}
        layers={editor.layers}
        onToggleLayer={editor.toggleLayer}
        onOpenSizeModal={() => setShowSizeModal(true)}
        onOpenEconomyModal={() => setShowEconomyModal(true)}
        onOpenCustomModal={() => setCustomModalTab('biomes')}
        onOpenExportModal={() => setShowExportModal(true)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <MapCanvas
          map={editor.map}
          tool={editor.tool}
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
          terrainSubTool={editor.terrainSubTool}
          onChangeTerrainSubTool={editor.setTerrainSubTool}
          riverSubTool={editor.riverSubTool}
          onChangeRiverSubTool={editor.setRiverSubTool}
          roadType={editor.roadType}
          onChangeRoadType={editor.setRoadType}
          roadSubTool={editor.roadSubTool}
          onChangeRoadSubTool={editor.setRoadSubTool}
          territorySubTool={editor.territorySubTool}
          religionSubTool={editor.religionSubTool}
          poiSubTool={editor.poiSubTool}
          onChangePoiSubTool={editor.setPoiSubTool}
          poiType={editor.poiType}
          onChangePoiType={editor.setPoiType}
          labelStyle={editor.labelStyle}
          onChangeLabelStyle={editor.setLabelStyle}
          climateOverlay={editor.climateOverlay}
          layers={editor.layers}
          selectedCityId={editor.selectedCityId}
          tradeStartCityId={editor.tradeStartCityId}
          measurePoints={editor.measurePoints}
          onAddMeasurePoint={(h) => editor.setMeasurePoints((pts) => [...pts, h])}
          showMinimap={editor.showMinimap}
          renderVersion={editor.renderVersion}
          dirtyHexQueue={editor.dirtyHexQueue}
          onBeginStroke={editor.beginStroke}
          onPaintTerrainAt={editor.paintTerrainAt}
          onPaintTerritoryAt={editor.paintTerritoryAt}
          onFloodFillTerritoryAt={editor.floodFillTerritoryAt}
          onPaintReligionAt={editor.paintReligionAt}
          onFloodFillReligionAt={editor.floodFillReligionAt}
          onEndStroke={editor.endStroke}
          onFloodFillAt={editor.floodFillAt}
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
                    size: 'md',
                    style: editor.labelStyle,
                  },
                ],
              }),
              []
            );
          }}
          onNotify={showToast}
        />

        <RightSidebar
          map={editor.map}
          tool={editor.tool}
          activeBiome={editor.activeBiome}
          onSelectBiome={(b) => {
            editor.setActiveBiome(b);
            if (editor.tool === 'view') editor.setTool('terrain');
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
          onUpdateKingdoms={(kingdoms) =>
            editor.commitMapChange((prev) => ({ ...prev, kingdoms }))
          }
          onUpdateReligions={(religionList) =>
            editor.commitMapChange((prev) => ({ ...prev, religionList }))
          }
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
          onClose={() => setShowEconomyModal(false)}
        />
      )}

      {customModalTab && (
        <CustomAssetsModal
          customBiomes={editor.map.customBiomes}
          customPoiTypes={editor.map.customPoiTypes}
          initialTab={customModalTab}
          onAddBiome={(b) => {
            const created = editor.addCustomBiome(b);
            showToast(`เพิ่มไบโอม "${created.nameTh}" และเลือกใช้งานแล้ว`);
          }}
          onDeleteBiome={editor.deleteCustomBiome}
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
          onImportMap={(m) => {
            editor.loadImportedMap(m);
            showToast(`โหลดแผนที่ "${m.name}" เรียบร้อยแล้ว`);
          }}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

export default App;
