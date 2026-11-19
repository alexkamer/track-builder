# Asset credits

Every visual asset shipped with TrackForge is listed here with its source and licence.

All of them are **CC0 1.0 Universal** (public domain dedication): free to use, modify, and
redistribute, with no attribution required. Attribution is recorded anyway so the provenance of
each file stays checkable.

Only CC0 sources are used, so that shipping these files inside this repository is unambiguously
permitted. Notably excluded for that reason: Quaternius (its licence forbids redistributing the
raw assets, even modified) and marketplace "free" downloads such as CGTrader's royalty-free
models, which generally permit use inside an end product but not redistribution of the asset
file itself.

## Environment map

| File | Source | Licence |
| --- | --- | --- |
| `env/kloofendal_43d_clear_puresky_1k.hdr` | [Poly Haven — Kloofendal 43d Clear (Pure Sky)](https://polyhaven.com/a/kloofendal_43d_clear_puresky) | CC0 |

Shipped at 1k (1024×512, ~1.2 MB). Self-hosted rather than loaded through drei's `Environment
preset`, which fetches HDRIs from a third-party CDN at runtime.

## Surface textures

All from [ambientCG](https://ambientcg.com/), all CC0. Each set is the source material's Color,
Roughness, and NormalGL maps, re-encoded as WebP — colour and roughness lossy, normals lossless
so the vectors stay exact. Displacement and ambient-occlusion maps are not shipped.

| Surface | File prefix | Source | Licence |
| --- | --- | --- | --- |
| Road | `textures/road/` | [ambientCG Asphalt026A](https://ambientcg.com/view?id=Asphalt026A) | CC0 |
| Barrier | `textures/barrier/` | [ambientCG Metal032](https://ambientcg.com/view?id=Metal032) | CC0 |
| Runoff verge | `textures/verge/` | [ambientCG Gravel023](https://ambientcg.com/view?id=Gravel023) | CC0 |
| Terrain | `textures/terrain/` | [ambientCG Grass004](https://ambientcg.com/view?id=Grass004) | CC0 |

The curb's red/white rumble strip is not listed because it is not a downloaded asset: it is
generated in code, so its block length can be tied to the track's arc length.
