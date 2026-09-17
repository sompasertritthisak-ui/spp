import type { Billboard, BillboardStatus } from "../types";

/**
 * Locations, coordinates, sizes and monthly guide prices are carried over from
 * the previous SPP site's dataset. Tenant names from that dataset are NOT
 * published (commercially sensitive, and unconfirmed). Traffic counts are left
 * null rather than invented. Every record is `verified: false` until SPP
 * confirms it on site via Command Center → Billboards.
 */

type Row = [
  name: string,
  province: string,
  district: string,
  lat: number,
  lng: number,
  w: number,
  h: number,
  usd: number,
  status: BillboardStatus,
  availableFrom: string | null,
  facing: string,
  lit: boolean,
  faces: 1 | 2,
  description: string,
];

const rows: Row[] = [
  ["Patuxai Roundabout", "Vientiane Capital", "Chanthabouly", 17.9645, 102.6178, 10, 5, 1500, "reserved", "2027-01-01", "Lane Xang Avenue, both directions", true, 2, "Double-sided site on the capital's ceremonial avenue, at the monument roundabout."],
  ["Talat Sao Morning Market", "Vientiane Capital", "Chanthabouly", 17.9558, 102.6286, 8, 4, 1200, "available", null, "Khouvieng Road, westbound", true, 1, "High foot-traffic position beside the central market and bus station."],
  ["That Luang Road", "Vientiane Capital", "Xaysetha", 17.9742, 102.6334, 12, 6, 1800, "available", null, "That Luang Road, toward the stupa", true, 1, "Large-format face on the approach to the national monument and its festival grounds."],
  ["Wattay Airport Highway", "Vientiane Capital", "Sikhottabong", 17.9883, 102.5633, 14, 7, 2200, "reserved", "2026-12-01", "Souphanouvong Avenue, toward the city", true, 1, "Gateway site seen by airport arrivals travelling into the city centre."],
  ["Dongdok University Road", "Vientiane Capital", "Xaythany", 18.03, 102.71, 8, 4, 1000, "available", null, "Route 13 South, northbound", false, 1, "Youth-facing site on the main road serving the National University campus."],
  ["Night Market Strip", "Luang Prabang", "Luang Prabang", 19.8851, 102.1355, 6, 3, 800, "available", null, "Sisavangvong Road", false, 1, "Tourist-facing position near the night market in the heritage town."],
  ["Luang Prabang Main Junction", "Luang Prabang", "Luang Prabang", 19.89, 102.14, 10, 5, 1100, "reserved", "2026-11-15", "Phothisalath Road, both directions", true, 2, "Busy junction with clear sight-lines from both approaches."],
  ["Savannakhet City Centre", "Savannakhet", "Kaysone Phomvihane", 16.5569, 104.7502, 10, 5, 900, "available", null, "Ratsavongseuk Road", true, 1, "Central position near the provincial market and bus terminal."],
  ["Mekong Riverside", "Savannakhet", "Kaysone Phomvihane", 16.552, 104.745, 8, 4, 1000, "reserved", "2027-02-01", "Riverside promenade", true, 1, "Promenade site close to the second Friendship Bridge crossing."],
  ["Pakse City Gate", "Champasak", "Pakse", 15.1204, 105.7993, 12, 6, 1050, "available", null, "Route 13 South, inbound", true, 1, "Entrance site at the northern gateway to Pakse."],
  ["Pakse Airport Road", "Champasak", "Pakse", 15.132, 105.781, 8, 4, 950, "maintenance", "2026-10-15", "Airport access road", false, 1, "Airport access road with steady daily traffic. Structure repaint in progress."],
  ["Oudomxay Market Road", "Oudomxay", "Xay", 20.6921, 101.9942, 8, 4, 700, "available", null, "Route 13 North", false, 1, "Strategic position in the northern logistics hub, near the railway station road."],
  ["Border Trade Zone", "Luang Namtha", "Namtha", 20.9273, 101.4189, 10, 5, 750, "available", null, "Route 3, toward Boten", false, 1, "High-exposure site on the road to the China border crossing."],
  ["Phongsali Town Centre", "Phongsali", "Phongsali", 21.6821, 102.1024, 6, 3, 500, "available", null, "Town centre", false, 1, "Northern-province coverage in the town centre."],
  ["Huay Xai Mekong Crossing", "Bokeo", "Houayxay", 20.2792, 100.675, 8, 4, 850, "reserved", "2026-11-01", "Route 3, toward the Friendship Bridge", false, 1, "Border-crossing site at the fourth Friendship Bridge approach."],
  ["Plain of Jars Road", "Xiengkhouang", "Pek", 19.45, 103.38, 10, 5, 800, "available", null, "Route 7, toward Phonsavan", false, 1, "Tourist-route site on the approach to the Plain of Jars."],
  ["Thakhek Centre", "Khammouane", "Thakhek", 17.39, 104.8, 8, 4, 900, "unavailable", null, "Kouvoravong Road", true, 1, "Town-square site. Currently withdrawn pending lease renewal."],
  ["Salavan Provincial Highway", "Salavan", "Salavan", 15.72, 106.43, 8, 4, 650, "available", null, "Route 20, inbound", false, 1, "Highway entrance site covering Bolaven plateau traffic."],
  ["Attapeu Highway Junction", "Attapeu", "Samakkhixay", 14.8, 107.0, 6, 3, 550, "available", null, "Route 18 junction", false, 1, "Junction site in the southernmost province."],
  ["Paksan Main Street", "Bolikhamxay", "Paksan", 18.4, 103.65, 8, 4, 750, "available", null, "Route 13 South", false, 1, "Commercial-street site in the provincial capital on the national highway."],
];

export const billboards: Billboard[] = rows.map((r, i) => {
  const [name, province, district, lat, lng, w, h, usd, status, availableFrom, facing, lit, faces, description] = r;
  return {
    code: `SPP-BB-${String(i + 1).padStart(3, "0")}`,
    name,
    province,
    district,
    address: `${district} District, ${province}`,
    lat,
    lng,
    widthM: w,
    heightM: h,
    orientation: "landscape",
    faces,
    facing,
    lit,
    visibility: lit ? "Illuminated — visible day and night" : "Daylight visibility",
    traffic: null,
    status,
    availableFrom,
    pricingMode: "estimated",
    priceFromUsdMonth: usd,
    minMonths: 3,
    installation: "Print and installation quoted separately. Typical install 5–7 working days after artwork approval.",
    description,
    verified: false,
  };
});
