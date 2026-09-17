# Attribution

## Map data — SPP Outdoor Network (`/billboards/`)

The Laos province map is a bespoke vector drawing generated at build time by
`scripts/build-map.ts` into `src/lib/geo/laos.generated.ts`. No tiles, map
libraries or third-party requests are used at runtime.

| | |
|---|---|
| Dataset | geoBoundaries **gbOpen · LAO · ADM1** (simplified release), boundary ID `LAO-ADM1-31783359`, year represented 2017 |
| Retrieved from | `https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1_simplified.geojson` |
| Cached copy | `scripts/data/lao-adm1.raw.geojson` (committed; `--refresh` re-downloads) |
| Database licence | geoBoundaries — Creative Commons Attribution 4.0 (CC BY 4.0) |
| Boundary source | OpenStreetMap contributors, via Wambacher's OSM Boundaries — Open Data Commons Open Database License 1.0 (ODbL) — <https://www.openstreetmap.org/copyright> |

Required credit:

> Boundaries: geoBoundaries (Runfola, D. et al., 2020. *geoBoundaries: A global
> database of political administrative boundaries.* PLoS ONE 15(4): e0231866),
> CC BY 4.0. Boundary data © OpenStreetMap contributors, ODbL 1.0.

Modifications by SPP: reprojected (fitted spherical Mercator), topology-aware
Douglas–Peucker simplification, coordinates rounded to 0.1 viewBox unit,
province names re-romanised to SPP's house spelling. The derived geometry in
`laos.generated.ts` remains available under ODbL 1.0. Boundaries are indicative
only and imply no position on any border.

## Build tooling

`d3-geo` (ISC) — used only by `scripts/build-map.ts`; not shipped to the browser.
