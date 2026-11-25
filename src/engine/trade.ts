import { City, HexMapData, TradeGood, TradeMode, TradeRoute } from '../types/map';
import { isLandingCoastHex, realDistanceKm } from './hexMath';

export interface CityRouteSummary {
  route: TradeRoute;
  partnerCity: City | null;
  direction: 'export' | 'import' | 'mutual';
  tradedGoods: TradeGood[];
  estimatedValue: number;
}

export interface TradePartnerSuggestion {
  partner: City;
  exportMatches: TradeGood[];
  importMatches: TradeGood[];
  totalMatches: number;
  straightDistanceKm: number;
  recommendedMode: TradeMode;
}

export interface CityTradeOverview {
  city: City;
  routes: CityRouteSummary[];
  fulfilledDemandIds: string[];
  unfulfilledDemandIds: string[];
  totalEstimatedValue: number;
  suggestions: TradePartnerSuggestion[];
}

/** Estimate trade route gold value from traded goods base prices and city populations. */
export function estimateRouteTradeValue(
  route: TradeRoute,
  map: Pick<HexMapData, 'goods' | 'cities'>
): number {
  const goodsMap = new Map(map.goods.map((g) => [g.id, g]));
  const from = map.cities.find((c) => c.id === route.fromCityId);
  const to = map.cities.find((c) => c.id === route.toCityId);

  let goodIds = route.goodIds;
  if (goodIds.length === 0 && from) {
    if (to) {
      const matched = from.producedGoods.filter((id) => to.demandedGoods.includes(id));
      goodIds = matched.length > 0 ? matched : from.producedGoods.slice(0, 2);
    } else {
      goodIds = from.producedGoods.slice(0, 2);
    }
  }

  const baseSum = goodIds.reduce((sum, gid) => sum + (goodsMap.get(gid)?.basePrice ?? 25), 0);
  const fromPop = from?.population ?? 8000;
  const toPop = to?.population ?? 8000;
  const popScale = Math.max(1, Math.min(12, Math.round((fromPop + toPop) / 20000)));
  return Math.round(baseSum * popScale);
}

/** Compute full trade overview, route breakdown, demand status, and partner suggestions for a city. */
export function computeCityTradeOverview(
  map: HexMapData,
  cityId: string
): CityTradeOverview | null {
  const city = map.cities.find((c) => c.id === cityId);
  if (!city) return null;

  const goodsMap = new Map(map.goods.map((g) => [g.id, g]));
  const cityMap = new Map(map.cities.map((c) => [c.id, c]));

  const relevantRoutes = map.tradeRoutes.filter(
    (tr) => tr.fromCityId === cityId || tr.toCityId === cityId
  );

  const connectedPartnerIds = new Set<string>();
  const fulfilledSet = new Set<string>();
  let totalEstimatedValue = 0;

  const routes: CityRouteSummary[] = relevantRoutes.map((route) => {
    const isFrom = route.fromCityId === cityId;
    const partnerId = isFrom ? route.toCityId : route.fromCityId;
    connectedPartnerIds.add(partnerId);
    const partnerCity = cityMap.get(partnerId) ?? null;

    let direction: CityRouteSummary['direction'] = isFrom ? 'export' : 'import';
    if (partnerCity) {
      if (isFrom) {
        const partnerFeedsCity = partnerCity.producedGoods.some((gid) =>
          city.demandedGoods.includes(gid)
        );
        if (partnerFeedsCity) direction = 'mutual';
      } else {
        const cityFeedsPartner = city.producedGoods.some((gid) =>
          partnerCity.demandedGoods.includes(gid)
        );
        if (cityFeedsPartner) direction = 'mutual';
      }
    }

    const resolvedIds =
      route.goodIds.length > 0
        ? route.goodIds
        : isFrom
        ? city.producedGoods.slice(0, 2)
        : partnerCity?.producedGoods.slice(0, 2) ?? [];

    const tradedGoods = resolvedIds
      .map((gid) => goodsMap.get(gid))
      .filter((g): g is TradeGood => Boolean(g));

    for (const gid of route.goodIds) {
      if (city.demandedGoods.includes(gid)) fulfilledSet.add(gid);
    }
    if (partnerCity) {
      for (const gid of partnerCity.producedGoods) {
        if (city.demandedGoods.includes(gid)) fulfilledSet.add(gid);
      }
    }

    const estimatedValue = estimateRouteTradeValue(route, map);
    totalEstimatedValue += estimatedValue;

    return {
      route,
      partnerCity,
      direction,
      tradedGoods,
      estimatedValue,
    };
  });

  const fulfilledDemandIds = city.demandedGoods.filter((gid) => fulfilledSet.has(gid));
  const unfulfilledDemandIds = city.demandedGoods.filter((gid) => !fulfilledSet.has(gid));

  const cityIsCoast = city.tier === 'port' || isLandingCoastHex(map, city.q, city.r);

  const suggestions: TradePartnerSuggestion[] = map.cities
    .filter((other) => other.id !== cityId && !connectedPartnerIds.has(other.id))
    .map((partner) => {
      const exportMatches = city.producedGoods
        .filter((gid) => partner.demandedGoods.includes(gid))
        .map((gid) => goodsMap.get(gid))
        .filter((g): g is TradeGood => Boolean(g));
      const importMatches = partner.producedGoods
        .filter((gid) => city.demandedGoods.includes(gid))
        .map((gid) => goodsMap.get(gid))
        .filter((g): g is TradeGood => Boolean(g));

      const partnerIsCoast = partner.tier === 'port' || isLandingCoastHex(map, partner.q, partner.r);
      const recommendedMode: TradeMode = cityIsCoast || partnerIsCoast ? 'mixed' : 'land';

      return {
        partner,
        exportMatches,
        importMatches,
        totalMatches: exportMatches.length + importMatches.length,
        straightDistanceKm: Math.round(realDistanceKm(city, partner, map.hexSizeKm)),
        recommendedMode,
      };
    })
    .sort((a, b) => {
      if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
      return a.straightDistanceKm - b.straightDistanceKm;
    });

  return {
    city,
    routes,
    fulfilledDemandIds,
    unfulfilledDemandIds,
    totalEstimatedValue,
    suggestions,
  };
}
