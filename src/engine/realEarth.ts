import { GeographyConfig } from '../types/map';
import { hexIndex } from './hexMath';
import { createNoise2D } from './noise';

type LonLat = [number, number]; // [lon, lat]

interface PolyBox {
  pts: LonLat[];
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

interface MountainRange {
  pts: LonLat[];
  widthDeg: number;
  peakHeight: number;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

function buildPolyBox(pts: LonLat[]): PolyBox {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of pts) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { pts, minLon, maxLon, minLat, maxLat };
}

function buildMountainRange(
  pts: LonLat[],
  widthDeg: number,
  peakHeight: number
): MountainRange {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of pts) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const pad = widthDeg * 1.4;
  return {
    pts,
    widthDeg,
    peakHeight,
    minLon: minLon - pad,
    maxLon: maxLon + pad,
    minLat: minLat - pad,
    maxLat: maxLat + pad,
  };
}

/** Real-world continents and major islands defined in (lon, lat) degrees. */
const LAND_POLYGONS: PolyBox[] = [
  // North America + Central America
  buildPolyBox([
    [-168, 66], [-162, 70], [-148, 70], [-135, 69], [-122, 71], [-102, 69],
    [-92, 67], [-95, 60], [-88, 56], [-80, 52], [-77, 56], [-78, 62],
    [-64, 60], [-55, 52], [-60, 46], [-70, 42], [-75, 36], [-81, 31],
    [-80, 25], [-82, 26], [-84, 30], [-90, 29], [-97, 27], [-96, 19],
    [-90, 21], [-87, 21], [-88, 16], [-83, 14], [-83, 10], [-78, 8],
    [-80, 7], [-85, 10], [-92, 14], [-104, 19], [-110, 24], [-114, 31],
    [-112, 27], [-115, 29], [-118, 33], [-122, 37], [-124, 42], [-124, 48],
    [-130, 54], [-138, 59], [-150, 60], [-162, 55], [-166, 60],
  ]),
  // Greenland
  buildPolyBox([
    [-54, 60], [-42, 60], [-36, 66], [-22, 71], [-18, 77], [-24, 82],
    [-46, 83], [-64, 81], [-72, 77], [-58, 73], [-52, 68],
  ]),
  // Baffin Island
  buildPolyBox([
    [-78, 73], [-66, 70], [-62, 66], [-66, 62], [-76, 64], [-85, 70],
  ]),
  // Victoria & Ellesmere Arctic Islands
  buildPolyBox([
    [-118, 72], [-102, 73], [-100, 69], [-114, 69],
  ]),
  buildPolyBox([
    [-88, 82], [-64, 82], [-74, 76], [-88, 77],
  ]),
  // Cuba & Hispaniola
  buildPolyBox([
    [-85, 22], [-79, 23], [-74, 20], [-77, 19.8], [-83, 21.5],
  ]),
  buildPolyBox([
    [-74, 20], [-68.5, 19.5], [-68.5, 18], [-73, 18],
  ]),
  // South America
  buildPolyBox([
    [-78, 9], [-72, 12], [-64, 10], [-56, 6], [-50, 1], [-42, -3],
    [-35, -6], [-35, -10], [-39, -18], [-42, -23], [-48, -26], [-53, -34],
    [-58, -38], [-65, -42], [-67, -48], [-69, -54], [-73, -55], [-75, -46],
    [-72, -36], [-71, -24], [-75, -15], [-81, -5], [-79, 2],
  ]),
  // Eurasia (Iberia -> Western/Northern Europe -> Russia -> Kamchatka -> East & SE Asia -> India -> Arabia -> Levant)
  buildPolyBox([
    [-9.5, 37], [-9, 43], [-2, 43.5], [-4.5, 48], [2, 51], [8, 54],
    [8.5, 57], [11, 56], [12, 58], [5, 60], [6, 63], [14, 68], [25, 71],
    [32, 69], [42, 67], [56, 69], [68, 73], [88, 74], [105, 77], [124, 73],
    [144, 72], [168, 69], [178, 66], [164, 61], [162, 54], [156, 51],
    [154, 57], [142, 59], [137, 54], [141, 49], [135, 44], [129, 39],
    [129, 35], [126, 35], [126, 39], [122, 40], [119, 38], [122, 37],
    [120, 34], [122, 31], [120, 26], [114, 22], [108, 21], [106, 17],
    [109, 12], [105, 8.6], [101, 13.5], [100, 12], [103.5, 4], [104, 1.3],
    [101, 3], [98.5, 9], [97, 16], [94, 16], [91, 22], [85, 19],
    [80, 13], [77.5, 8], [73, 18], [69, 22], [62, 25], [56, 26.5],
    [49, 29.5], [56, 24], [59.8, 22], [54, 17], [44, 12.6], [40, 18],
    [34.5, 28], [32.5, 31], [36, 36], [27, 37], [26, 41], [23, 38],
    [22, 40], [19, 41], [14, 45], [18, 40], [15, 38], [12, 42],
    [9, 44], [3, 43], [-1, 38], [-6, 36],
  ]),
  // Africa
  buildPolyBox([
    [-6, 35.8], [10, 37], [12, 33], [24, 32], [32.5, 31], [34, 28],
    [39, 20], [43.5, 12.5], [51, 11.8], [46, 3], [40, -5], [40, -15],
    [35, -24], [28, -33], [18.4, -34.4], [15, -26], [12, -16], [12, -6],
    [9, 4], [2, 6], [-8, 4.5], [-17, 14.7], [-16, 23], [-10, 30],
  ]),
  // Great Britain & Ireland
  buildPolyBox([
    [-5.5, 50], [1.6, 51.2], [1.7, 53], [-1.5, 55.5], [-2, 57.7],
    [-5.5, 58.6], [-6.2, 55], [-4.5, 51.5],
  ]),
  buildPolyBox([
    [-10, 51.6], [-6, 52.2], [-5.8, 55], [-9.8, 54.4],
  ]),
  // Iceland
  buildPolyBox([
    [-24, 65], [-18, 66.4], [-13.5, 65], [-15, 63.8], [-22.5, 63.8],
  ]),
  // Madagascar
  buildPolyBox([
    [49.5, -12], [50.3, -16], [47, -25], [44, -25], [43.5, -20], [46, -15],
  ]),
  // Sri Lanka
  buildPolyBox([
    [80, 9.8], [81.8, 7.6], [80.6, 6.0], [79.7, 7.8],
  ]),
  // Japan (Honshu+Kyushu, Hokkaido)
  buildPolyBox([
    [130, 31.5], [132, 34], [136, 35], [140.8, 36], [141.8, 41],
    [139.5, 41], [137, 37], [132, 35], [130, 33.5],
  ]),
  buildPolyBox([
    [140, 42], [142, 45.4], [145.5, 43.3], [143, 42],
  ]),
  // Taiwan
  buildPolyBox([
    [120.2, 22], [121.6, 25.1], [121.9, 24], [120.9, 22],
  ]),
  // Philippines (Luzon, Mindanao)
  buildPolyBox([
    [119.8, 14], [120.5, 18.4], [122.4, 18], [122.4, 13.8],
  ]),
  buildPolyBox([
    [122, 6.5], [124.5, 9.6], [126.5, 8.2], [125.5, 5.7],
  ]),
  // Indonesia: Sumatra, Java, Borneo, Sulawesi
  buildPolyBox([
    [95.3, 5.5], [99, 3], [105.8, -5.8], [104, -5.9], [97, 1.5],
  ]),
  buildPolyBox([
    [105.4, -6.2], [114.4, -7.8], [114.2, -8.7], [106, -7.2],
  ]),
  buildPolyBox([
    [109, 1.5], [117, 6.8], [118.8, 1], [116, -3.5], [110, -3],
  ]),
  buildPolyBox([
    [119, -5.3], [125, 1.5], [122.5, 1.2], [122, -4.5],
  ]),
  // New Guinea
  buildPolyBox([
    [131, -1.5], [141, -2.5], [150.5, -10.2], [146, -9.2], [137, -5.5], [132, -4],
  ]),
  // Australia & Tasmania
  buildPolyBox([
    [114, -22], [122, -17], [130, -12], [136, -12], [136, -15], [141, -16],
    [142.5, -11], [146, -18], [153.5, -26], [150, -37], [140, -38],
    [131, -32], [122, -34], [115, -34], [113.5, -26],
  ]),
  buildPolyBox([
    [144.8, -40.8], [148.2, -41], [147.8, -43.4], [145.2, -42.6],
  ]),
  // New Zealand (North & South Islands)
  buildPolyBox([
    [172.8, -34.5], [178.4, -37.7], [175.4, -41.4], [173.8, -38.8],
  ]),
  buildPolyBox([
    [172.6, -40.6], [174.2, -42], [168.5, -46.6], [166.6, -45.6],
  ]),
  // Antarctica
  buildPolyBox([
    [-180, -72], [-120, -73], [-80, -73], [-62, -63.5], [-56, -64],
    [-46, -77], [-20, -71], [20, -69], [65, -67.5], [110, -66.5],
    [155, -69], [170, -73], [180, -72], [180, -90], [-180, -90],
  ]),
];

/** Major enclosed / inland sea basins carved out of Eurasia / North America. */
const SEA_CUTOUT_POLYGONS: PolyBox[] = [
  // Black Sea
  buildPolyBox([
    [27.8, 42], [31, 46.5], [38.5, 45.2], [41.5, 41.8], [35, 41.2],
  ]),
  // Caspian Sea
  buildPolyBox([
    [47.5, 46.5], [53, 46], [54, 37.5], [49.5, 37], [48, 42],
  ]),
  // Hudson / Great Lakes basin
  buildPolyBox([
    [-92, 48.2], [-84, 46.5], [-77, 44], [-82, 41.8], [-88, 42.2], [-91, 46.5],
  ]),
];

/** Real-world mountain belts & plateaus scaled by mountainScale. */
const MOUNTAIN_RANGES: MountainRange[] = [
  // Himalayas
  buildMountainRange([[73, 35.5], [78, 32], [84, 28.5], [90, 27.8], [96, 29]], 4.0, 0.78),
  // Tibetan Plateau
  buildMountainRange([[79, 34.5], [87, 33.5], [94, 33]], 6.8, 0.48),
  // Tian Shan & Altai & Kunlun
  buildMountainRange([[72, 41], [82, 43], [92, 45], [100, 48]], 3.6, 0.56),
  // Hindu Kush & Karakoram
  buildMountainRange([[66, 34.5], [72, 36.2], [77, 35.5]], 3.5, 0.68),
  // Zagros & Caucasus
  buildMountainRange([[44, 36], [49, 32.5], [55, 28]], 3.2, 0.50),
  buildMountainRange([[40, 43.2], [45, 42.2], [49, 41]], 2.8, 0.58),
  // Alps, Pyrenees & Carpathians
  buildMountainRange([[5.8, 44.8], [9.5, 46.5], [14.5, 47.1]], 2.6, 0.56),
  buildMountainRange([[-2, 42.9], [2.8, 42.5]], 2.0, 0.44),
  buildMountainRange([[20, 49.2], [25, 47.5], [26, 45.2]], 2.4, 0.40),
  // Scandinavian & Ural Mountains
  buildMountainRange([[6.5, 60.5], [12, 64.5], [19, 69]], 3.2, 0.42),
  buildMountainRange([[58, 52], [59.5, 60], [64, 67]], 3.2, 0.38),
  // Atlas & Ethiopian Highlands & East African Rift
  buildMountainRange([[-8, 31.5], [0, 34.5], [7, 36]], 2.8, 0.42),
  buildMountainRange([[36, 13], [40, 9], [36, 1], [34, -6]], 4.0, 0.48),
  // Andes
  buildMountainRange(
    [[-76, 8], [-78, -2], [-75, -11], [-69, -18], [-69, -30], [-71.5, -42], [-72, -52]],
    3.8,
    0.72
  ),
  // Rocky Mountains & Sierra Madre
  buildMountainRange(
    [[-150, 62], [-132, 58], [-120, 52], [-114, 46], [-108, 40], [-105, 34], [-102, 23], [-96, 17]],
    4.6,
    0.62
  ),
  // Appalachians
  buildMountainRange([[-84, 34], [-79, 38], [-73, 43], [-67, 46]], 3.0, 0.34),
  // SE Asia (Tenasserim / Shan / Annamite)
  buildMountainRange([[98.5, 22], [99, 17], [104, 19], [107.5, 14]], 2.6, 0.34),
  // Great Dividing Range (Australia) & Southern Alps (NZ)
  buildMountainRange([[145, -17], [151, -28], [148, -36.5]], 2.6, 0.34),
  buildMountainRange([[168, -45.5], [172.5, -42]], 1.8, 0.46),
  // Japanese Alps & New Guinea Highlands
  buildMountainRange([[137.5, 35.8], [139.5, 38]], 1.8, 0.42),
  buildMountainRange([[136, -4], [145, -6.5]], 2.2, 0.48),
];

function distToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-9) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

function pointInPoly(lon: number, lat: number, poly: PolyBox): boolean {
  if (lon < poly.minLon || lon > poly.maxLon || lat < poly.minLat || lat > poly.maxLat) {
    return false;
  }
  const pts = poly.pts;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function minEdgeDistToPoly(lon: number, lat: number, poly: PolyBox, cutoff: number): number {
  if (
    lon < poly.minLon - cutoff ||
    lon > poly.maxLon + cutoff ||
    lat < poly.minLat - cutoff ||
    lat > poly.maxLat + cutoff
  ) {
    return Infinity;
  }
  const pts = poly.pts;
  let bestSq = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const dSq = distToSegmentSq(lon, lat, pts[j][0], pts[j][1], pts[i][0], pts[i][1]);
    if (dSq < bestSq) bestSq = dSq;
  }
  return Math.sqrt(bestSq);
}

/** Sample normalized elevation (-1..1) on Real Earth coordinates. */
export function sampleRealEarthElevation(
  latDeg: number,
  lonDeg: number,
  mountainScale: number,
  seaLevel: number,
  noiseVal: number,
  ridgeVal: number
): number {
  let insideLand = false;
  let minEdgeDist = Infinity;

  for (const poly of LAND_POLYGONS) {
    if (pointInPoly(lonDeg, latDeg, poly)) {
      insideLand = true;
    }
    const d = minEdgeDistToPoly(lonDeg, latDeg, poly, 12);
    if (d < minEdgeDist) minEdgeDist = d;
  }

  let insideSeaCutout = false;
  let seaEdgeDist = Infinity;
  if (insideLand) {
    for (const sea of SEA_CUTOUT_POLYGONS) {
      if (pointInPoly(lonDeg, latDeg, sea)) {
        insideSeaCutout = true;
      }
      const d = minEdgeDistToPoly(lonDeg, latDeg, sea, 6);
      if (d < seaEdgeDist) seaEdgeDist = d;
    }
  }

  let baseElev: number;
  if (insideSeaCutout) {
    const sd = Math.min(seaEdgeDist, 6);
    baseElev = -0.05 - 0.38 * (1 - Math.exp(-sd / 2.2)) + noiseVal * 0.03;
  } else if (insideLand) {
    const sd = Math.min(minEdgeDist, seaEdgeDist, 14);
    baseElev = 0.055 + 0.19 * (1 - Math.exp(-sd / 3.8)) + noiseVal * 0.055;

    // Greenland & Antarctica ice sheets sit at higher elevation
    if (latDeg < -66 || (latDeg > 62 && lonDeg < -20 && lonDeg > -70)) {
      baseElev += 0.14;
    }

    // Major real mountain chains
    let mtnBoost = 0;
    for (const rng of MOUNTAIN_RANGES) {
      if (
        lonDeg < rng.minLon ||
        lonDeg > rng.maxLon ||
        latDeg < rng.minLat ||
        latDeg > rng.maxLat
      ) {
        continue;
      }
      let bestSq = Infinity;
      for (let i = 0; i < rng.pts.length - 1; i++) {
        const dSq = distToSegmentSq(
          lonDeg,
          latDeg,
          rng.pts[i][0],
          rng.pts[i][1],
          rng.pts[i + 1][0],
          rng.pts[i + 1][1]
        );
        if (dSq < bestSq) bestSq = dSq;
      }
      const d = Math.sqrt(bestSq);
      if (d < rng.widthDeg) {
        const falloff = Math.pow(1 - d / rng.widthDeg, 1.45);
        const crest = rng.peakHeight * falloff * (0.76 + 0.34 * ridgeVal) * mountainScale;
        if (crest > mtnBoost) mtnBoost = crest;
      }
    }
    baseElev += mtnBoost;
  } else {
    const sd = Math.min(minEdgeDist, 14);
    baseElev = -0.045 - 0.66 * (1 - Math.exp(-sd / 4.4)) + noiseVal * 0.04;
  }

  return Math.max(-1, Math.min(1, baseElev - seaLevel));
}

/** Generate Real Earth tectonic elevation (-1..1) mapped across configured lat/lon bounds. */
export function generateRealEarthElevationField(
  width: number,
  height: number,
  config: GeographyConfig
): number[] {
  const nCoast = createNoise2D(config.seed + 191);
  const nRidge = createNoise2D(config.seed + 3037);
  const lonWest = config.lonWest ?? -180;
  const lonEast = config.lonEast ?? 180;
  const elev = new Array<number>(width * height);

  for (let r = 0; r < height; r++) {
    const tLat = height <= 1 ? 0.5 : r / (height - 1);
    const latDeg = config.latNorth + (config.latSouth - config.latNorth) * tLat;
    for (let q = 0; q < width; q++) {
      const tLon = width <= 1 ? 0.5 : q / (width - 1);
      const lonDeg = lonWest + (lonEast - lonWest) * tLon;

      const noiseVal = nCoast.fbm(lonDeg * 0.08, latDeg * 0.08, 4);
      const ridgeVal = nRidge.ridged(lonDeg * 0.12 + 4.2, latDeg * 0.12 + 11.7, 3);
      // Slight coastline organic warp so coastlines look natural at high zoom
      const warpLon = lonDeg + nCoast.fbm(lonDeg * 0.16 + 7.1, latDeg * 0.16, 2) * 1.1;
      const warpLat = latDeg + nCoast.fbm(lonDeg * 0.16, latDeg * 0.16 + 13.4, 2) * 0.9;

      elev[hexIndex(q, r, width)] = sampleRealEarthElevation(
        warpLat,
        warpLon,
        config.mountainScale,
        config.seaLevel,
        noiseVal,
        ridgeVal
      );
    }
  }

  return elev;
}
