/**
 * Гео-данные мира через Natural Earth (public domain) + d3-geo.
 *
 * world-atlas/countries-110m.json — топология ~96KB (gzipped ~30KB) с
 * границами всех ~180 стран. Лицензия MIT, источник Natural Earth — public domain.
 * d3-geo проецирует лат/лнг в SVG-координаты equirectangular.
 */
import { feature } from "topojson-client";
import { geoEquirectangular, geoPath } from "d3-geo";
import topology from "world-atlas/countries-110m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export const MAP_W = 1000;
export const MAP_H = 500;

const fc = feature(
  topology as any,
  (topology as any).objects.countries
) as unknown as FeatureCollection<Geometry, { name: string }>;

export const countries = fc.features;

// Equirectangular: горизонталь -180..180 → 0..MAP_W, вертикаль 90..-90 → 0..MAP_H.
const projection = geoEquirectangular()
  .scale(MAP_W / (2 * Math.PI))
  .translate([MAP_W / 2, MAP_H / 2]);

const pathGen = geoPath(projection);

export function countryPath(f: Feature): string | null {
  return pathGen(f);
}

export function project(lat: number, lng: number): { x: number; y: number } {
  const r = projection([lng, lat]);
  return r ? { x: r[0], y: r[1] } : { x: 0, y: 0 };
}

// ISO 3166-1 numeric — для метчинга country features в topojson (id поле).
// Покрывает страны из countryCenter в world-data.ts.
export const ISO2_TO_NUMERIC: Record<string, string> = {
  US: "840", CA: "124", MX: "484", BR: "076", AR: "032", CL: "152",
  GB: "826", IE: "372", FR: "250", DE: "276", NL: "528", BE: "056",
  IT: "380", ES: "724", PT: "620", CH: "756", AT: "040", CZ: "203",
  PL: "616", SE: "752", NO: "578", FI: "246", DK: "208", EE: "233",
  LV: "428", LT: "440", RU: "643", UA: "804", TR: "792", IL: "376",
  AE: "784", IN: "356", CN: "156", HK: "344", TW: "158", JP: "392",
  KR: "410", SG: "702", TH: "764", MY: "458", ID: "360", PH: "608",
  VN: "704", AU: "036", NZ: "554", ZA: "710", EG: "818",
};

export function iso2ToNumeric(iso2: string): string | undefined {
  return ISO2_TO_NUMERIC[iso2.toUpperCase()];
}
