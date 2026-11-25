import {
  HexMapData,
  RleStringRuns,
  TimelineEraSnapshot,
  WorldTimeline,
} from '../types/map';

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

/** Run-length encode a grid string array so multi-era snapshots fit comfortably in JSON/localStorage. */
export function encodeRle(arr: string[]): RleStringRuns {
  if (arr.length === 0) return [];
  const runs: RleStringRuns = [];
  let cur = arr[0] ?? '';
  let count = 1;
  for (let i = 1; i < arr.length; i++) {
    const val = arr[i] ?? '';
    if (val === cur) {
      count++;
    } else {
      runs.push([cur, count]);
      cur = val;
      count = 1;
    }
  }
  runs.push([cur, count]);
  return runs;
}

/** Decode a run-length encoded grid back to exact length. */
export function decodeRle(runs: RleStringRuns | undefined, expectedLength: number): string[] {
  const out = new Array<string>(expectedLength).fill('');
  if (!runs || runs.length === 0) return out;
  let pos = 0;
  for (const [val, count] of runs) {
    const safeVal = typeof val === 'string' ? val : '';
    const end = Math.min(expectedLength, pos + Math.max(0, Math.floor(count)));
    for (let i = pos; i < end; i++) {
      out[i] = safeVal;
    }
    pos = end;
    if (pos >= expectedLength) break;
  }
  return out;
}

/** Build a deep-cloned Era Snapshot from the current HexMapData state. */
export function createSnapshotFromMap(
  map: HexMapData,
  id: string,
  name: string,
  year: number,
  summary = ''
): TimelineEraSnapshot {
  const expectedLen = map.width * map.height;
  const territories =
    map.territories.length === expectedLen
      ? map.territories
      : new Array<string>(expectedLen).fill('');
  const religions =
    map.religions.length === expectedLen
      ? map.religions
      : new Array<string>(expectedLen).fill('');
  const cultures =
    (map.cultures ?? []).length === expectedLen
      ? map.cultures
      : new Array<string>(expectedLen).fill('');

  return {
    id,
    name,
    year,
    summary,
    territoriesRle: encodeRle(territories),
    religionsRle: encodeRle(religions),
    culturesRle: encodeRle(cultures),
    cities: deepClone(map.cities),
    tradeRoutes: deepClone(map.tradeRoutes),
    kingdoms: deepClone(map.kingdoms),
    religionList: deepClone(map.religionList),
    cultureList: deepClone(map.cultureList ?? []),
  };
}

/** Initialize a fresh WorldTimeline containing one starting era from the current map. */
export function createInitialTimeline(map: HexMapData): WorldTimeline {
  const startId = 'era_1';
  return {
    calendarUnit: 'ปีศักราช',
    activeEraId: startId,
    eras: [
      createSnapshotFromMap(
        map,
        startId,
        'ยุคปฐมกาล',
        1,
        'จุดเริ่มต้นของอาณาจักร ศาสนา วัฒนธรรม และนครรัฐทั้งปวง'
      ),
    ],
    events: [],
  };
}

/** Ensure timeline exists and persist the live map state into the currently active era snapshot. */
export function saveCurrentMapIntoActiveEra(map: HexMapData): HexMapData {
  const timeline = map.timeline ?? createInitialTimeline(map);
  const activeIdx = timeline.eras.findIndex((e) => e.id === timeline.activeEraId);
  if (activeIdx === -1) {
    const first = timeline.eras[0];
    if (!first) {
      return { ...map, timeline: createInitialTimeline(map) };
    }
    const updatedSnap = createSnapshotFromMap(map, first.id, first.name, first.year, first.summary);
    const nextEras = [...timeline.eras];
    nextEras[0] = updatedSnap;
    return {
      ...map,
      timeline: { ...timeline, activeEraId: first.id, eras: nextEras },
    };
  }

  const curMeta = timeline.eras[activeIdx];
  const updatedSnap = createSnapshotFromMap(
    map,
    curMeta.id,
    curMeta.name,
    curMeta.year,
    curMeta.summary
  );
  const nextEras = [...timeline.eras];
  nextEras[activeIdx] = updatedSnap;

  return {
    ...map,
    timeline: {
      ...timeline,
      eras: nextEras,
    },
  };
}

/**
 * Switch the live map to another era snapshot:
 * 1) Persists current edits back into the currently active era so nothing is lost.
 * 2) Applies target era's RLE territories/religions/cultures, cities, tradeRoutes, and factions.
 */
export function switchMapToEra(map: HexMapData, targetEraId: string): HexMapData {
  const saved = saveCurrentMapIntoActiveEra(map);
  const timeline = saved.timeline!;
  if (timeline.activeEraId === targetEraId) return saved;

  const target = timeline.eras.find((e) => e.id === targetEraId);
  if (!target) return saved;

  const expectedLen = saved.width * saved.height;
  return {
    ...saved,
    updatedAt: new Date().toISOString(),
    territories: decodeRle(target.territoriesRle, expectedLen),
    religions: decodeRle(target.religionsRle, expectedLen),
    cultures: decodeRle(target.culturesRle, expectedLen),
    cities: deepClone(target.cities),
    tradeRoutes: deepClone(target.tradeRoutes),
    kingdoms: deepClone(target.kingdoms),
    religionList: deepClone(target.religionList),
    cultureList: deepClone(target.cultureList),
    timeline: {
      ...timeline,
      activeEraId: target.id,
    },
  };
}

/** Clone the current map state into a brand-new era sorted chronologically by year and activate it. */
export function createNewEraFromCurrent(
  map: HexMapData,
  name: string,
  year: number,
  summary = ''
): HexMapData {
  const saved = saveCurrentMapIntoActiveEra(map);
  const timeline = saved.timeline!;
  const newId = `era_${Date.now().toString(36)}`;
  const newSnap = createSnapshotFromMap(saved, newId, name.trim() || `ยุคที่ ${timeline.eras.length + 1}`, year, summary);
  const eras = [...timeline.eras, newSnap].sort((a, b) => a.year - b.year);

  return {
    ...saved,
    updatedAt: new Date().toISOString(),
    timeline: {
      ...timeline,
      activeEraId: newId,
      eras,
    },
  };
}
