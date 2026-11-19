"""Extract one rigged car from a multi-car OBJ pack, for local development only.

The packs this reads (LowPoly_Cars/, Ferrari_Concept/) are CGTrader royalty-free downloads:
usable inside an end product, NOT redistributable as files. Everything this script writes is
therefore gitignored and loaded only behind the app's dev-only `?car=` flag. Never commit its
output. See docs/dev-cars.md.

Why this exists: the pack is one flat list of ~212 meshes with non-semantic names
(`Object546_Mesh.168`), every mesh shares a single material, and each car's four wheels are
merged into its body mesh. So a car has to be found, split, and classified geometrically:

  1. cluster `o` groups by bounding-box adjacency  -> one cluster per vehicle
  2. union-find over shared vertex indices        -> ~100 connected components per car
  3. classify components by shape                 -> exactly 4 wheel discs + body remainder
  4. group body faces by fractional-UV atlas tile -> paint / glass / trim / light groups

Step 4 works because the pack encodes colour as a position in a 5x4 grid of shading ramps
rather than as distinct materials: two cars that differ only in paint are the same geometry
with UVs shifted to another tile. Grouping by tile is what lets the renderer assign real
materials and keep driving paint colour from a prop.

Usage:
    python3 -I scripts/extract_car.py list <pack.obj>
    python3 -I scripts/extract_car.py extract <pack.obj> <cluster-index> <out-dir> [--name NAME]

`list` prints the cluster inventory. `extract` writes <out-dir>/<name>.obj and
<out-dir>/<name>.json. Output is deterministic: the same inputs produce byte-identical files.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from collections import defaultdict

# --- Tunables -----------------------------------------------------------------------------
# Bounding boxes within this distance of each other are treated as the same vehicle. Small
# relative to the gaps between vehicles in the pack's layout, so vehicles stay separate.
CLUSTER_PAD = 0.35
# A wheel is a thin disc: two near-equal large dimensions, one much smaller (the tread width).
WHEEL_ROUNDNESS_TOL = 0.12   # max relative difference between the two disc dimensions
WHEEL_MAX_WIDTH_RATIO = 0.6  # tread width must be at most this fraction of the disc diameter
WHEEL_GROUND_TOL = 0.02      # a wheel's base must sit this close to the car's lowest point
WHEEL_MIRROR_TOL = 0.08      # a wheel's mirror twin must match this closely across x
# The colour atlas is a 5-across, 4-down grid of shading ramps.
ATLAS_COLS = 5
ATLAS_ROWS = 4


# --- Parsing ------------------------------------------------------------------------------
class Pack:
    """An OBJ pack: shared vertex/uv/normal pools plus the `o` groups that index into them."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.verts: list[tuple[float, float, float]] = []
        self.uvs: list[tuple[float, float]] = []
        self.normals: list[tuple[float, float, float]] = []
        self.objects: list[dict] = []
        current: dict | None = None

        with open(path, "r", errors="replace") as fh:
            for line in fh:
                if line.startswith("v "):
                    p = line.split()
                    self.verts.append((float(p[1]), float(p[2]), float(p[3])))
                elif line.startswith("vt "):
                    p = line.split()
                    self.uvs.append((float(p[1]), float(p[2])))
                elif line.startswith("vn "):
                    p = line.split()
                    self.normals.append((float(p[1]), float(p[2]), float(p[3])))
                elif line.startswith("o "):
                    current = {"name": line[2:].strip(), "faces": []}
                    self.objects.append(current)
                elif line.startswith("f ") and current is not None:
                    current["faces"].append(self._parse_face(line))

        for obj in self.objects:
            obj["bbox"] = self._bbox(v for face in obj["faces"] for (v, _, _) in face)

    def _resolve(self, token: str, pool_len: int) -> int | None:
        """OBJ indices are 1-based, or negative to count back from the end of the pool."""
        if not token:
            return None
        idx = int(token)
        return idx - 1 if idx > 0 else pool_len + idx

    def _parse_face(self, line: str) -> list[tuple[int, int | None, int | None]]:
        face = []
        for token in line.split()[1:]:
            parts = token.split("/")
            v = self._resolve(parts[0], len(self.verts))
            vt = self._resolve(parts[1], len(self.uvs)) if len(parts) > 1 else None
            vn = self._resolve(parts[2], len(self.normals)) if len(parts) > 2 else None
            face.append((v, vt, vn))
        return face

    def _bbox(self, vertex_indices) -> tuple[float, ...]:
        xs, ys, zs = [], [], []
        for i in vertex_indices:
            x, y, z = self.verts[i]
            xs.append(x)
            ys.append(y)
            zs.append(z)
        return (min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))


def union_find(count: int):
    parent = list(range(count))

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    return find, union


def cluster_vehicles(pack: Pack) -> list[list[int]]:
    """Group `o` objects into vehicles by bounding-box adjacency, largest vehicle first."""
    find, union = union_find(len(pack.objects))

    def near(a, b) -> bool:
        return all(
            a[i] - CLUSTER_PAD <= b[i + 3] and b[i] - CLUSTER_PAD <= a[i + 3] for i in range(3)
        )

    for i in range(len(pack.objects)):
        for j in range(i + 1, len(pack.objects)):
            if near(pack.objects[i]["bbox"], pack.objects[j]["bbox"]):
                union(i, j)

    groups = defaultdict(list)
    for i in range(len(pack.objects)):
        groups[find(i)].append(i)

    # Sort by face count so indices are stable across runs, with ties broken by name.
    def key(members):
        faces = sum(len(pack.objects[i]["faces"]) for i in members)
        return (-faces, pack.objects[min(members)]["name"])

    return sorted((sorted(m) for m in groups.values()), key=key)


# --- Component splitting ------------------------------------------------------------------
def split_components(pack: Pack, faces: list) -> list[dict]:
    """Split faces into connected components by shared vertex index.

    This is what separates a car's wheels from its body: the pack merges them into one mesh,
    but they share no vertices, so connectivity recovers them exactly.
    """
    vertex_ids = sorted({v for face in faces for (v, _, _) in face})
    slot = {v: i for i, v in enumerate(vertex_ids)}
    find, union = union_find(len(vertex_ids))

    for face in faces:
        first = slot[face[0][0]]
        for (v, _, _) in face[1:]:
            union(first, slot[v])

    by_root = defaultdict(list)
    for face in faces:
        by_root[find(slot[face[0][0]])].append(face)

    components = []
    for component_faces in by_root.values():
        verts = {v for face in component_faces for (v, _, _) in face}
        components.append(
            {
                "faces": component_faces,
                "bbox": pack._bbox(verts),
                "vert_count": len(verts),
            }
        )
    # Deterministic order: biggest first, ties broken by position.
    components.sort(key=lambda c: (-len(c["faces"]), c["bbox"]))
    return components


def classify_wheels(components: list[dict], car_bbox: tuple[float, ...]) -> list[int]:
    """Return indices of the four wheel components, or raise if there aren't exactly four.

    A wheel is a thin disc resting on the ground with a mirror twin across the car's
    centreline. Requiring exactly four makes a mis-detection loud rather than shipping a
    three-wheeled car.
    """
    ground = car_bbox[1]
    centre_x = (car_bbox[0] + car_bbox[3]) / 2

    candidates = []
    for i, comp in enumerate(components):
        x0, y0, z0, x1, y1, z1 = comp["bbox"]
        if abs(y0 - ground) > WHEEL_GROUND_TOL:
            continue
        width, height, depth = x1 - x0, y1 - y0, z1 - z0
        # The two largest dimensions form the disc face; the smallest is the tread width.
        dims = sorted((width, height, depth))
        tread, disc_a, disc_b = dims
        if disc_b <= 0:
            continue
        if abs(disc_a - disc_b) / disc_b > WHEEL_ROUNDNESS_TOL:
            continue
        if tread / disc_b > WHEEL_MAX_WIDTH_RATIO:
            continue
        candidates.append(i)

    # Keep only candidates that have a mirror twin across the centreline, which rules out
    # centred ground-level parts such as an exhaust or a chassis floor.
    def centre(i):
        x0, y0, z0, x1, y1, z1 = components[i]["bbox"]
        return ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)

    mirrored = []
    for i in candidates:
        cx, cy, cz = centre(i)
        for j in candidates:
            if i == j:
                continue
            ox, oy, oz = centre(j)
            if (
                abs((cx - centre_x) + (ox - centre_x)) < WHEEL_MIRROR_TOL
                and abs(cy - oy) < WHEEL_MIRROR_TOL
                and abs(cz - oz) < WHEEL_MIRROR_TOL
            ):
                mirrored.append(i)
                break

    if len(mirrored) != 4:
        raise WheelDetectionError(mirrored, candidates, components)
    return mirrored


class WheelDetectionError(RuntimeError):
    def __init__(self, mirrored, candidates, components) -> None:
        self.mirrored = mirrored
        self.candidates = candidates
        self.components = components
        super().__init__(
            f"expected exactly 4 wheel components, found {len(mirrored)} "
            f"(from {len(candidates)} disc-shaped candidates)"
        )


# --- Atlas tiles --------------------------------------------------------------------------
def tile_of_face(pack: Pack, face) -> tuple[int, int] | None:
    """Which atlas tile a face samples, from the fractional part of its mean UV.

    The pack's UVs run far outside 0..1 (the atlas is tiled), so only the fraction matters.
    """
    us = [pack.uvs[vt][0] for (_, vt, _) in face if vt is not None]
    vs = [pack.uvs[vt][1] for (_, vt, _) in face if vt is not None]
    if not us:
        return None
    u = sum(us) / len(us)
    v = sum(vs) / len(vs)
    col = min(ATLAS_COLS - 1, int((u - math.floor(u)) * ATLAS_COLS))
    row = min(ATLAS_ROWS - 1, int((v - math.floor(v)) * ATLAS_ROWS))
    return (row, col)


def tile_name(tile: tuple[int, int] | None) -> str:
    return "tile_none" if tile is None else f"tile_{tile[0]}_{tile[1]}"


# A group holding less than this fraction of the body's faces is detail (a badge, a roof vent),
# not a candidate for the car's paint or its glass.
MINOR_GROUP_FRACTION = 0.05
# A group this thin front-to-back, sitting at one end of the car, is a light cluster.
LIGHT_MAX_Z_SPAN = 0.25
LIGHT_END_FRACTION = 0.8


def propose_roles(group_stats: dict[str, dict]) -> dict[str, str]:
    """Propose a tile -> material role mapping from each group's shape and atlas tile.

    Still only a proposal recorded in the manifest for correction by eye - which tile is glass
    versus trim is a judgement about one particular car. But shape carries most of the answer:

    - Atlas row 0 is the grey/white ramp; rows 1-3 are colour ramps. So a substantial group on a
      colour row is the car's paint. Cars that are genuinely grey or white (the pack has several)
      have no colour-row group, and fall back to their largest group.
    - A group that is a thin slab at one end of the car is a light cluster. Rear lights sit on
      the red atlas row, which is why tile row alone cannot identify paint.
    - Glass is the highest-sitting substantial group: windows are the top of the body once the
      roof panel itself is accounted for by paint.

    Picking paint by face count alone gets this wrong: on a typical car the single largest group
    is the dark lower cladding that wraps the whole footprint, not the bodywork.
    """
    total = sum(stats["faces"] for stats in group_stats.values())
    if total == 0:
        return {}

    roles: dict[str, str] = {}
    remaining: list[str] = []

    for name, stats in group_stats.items():
        at_an_end = abs(stats["centre_z"]) > LIGHT_END_FRACTION * stats["car_half_length"]
        if stats["span_z"] < LIGHT_MAX_Z_SPAN and at_an_end:
            roles[name] = "light"
        else:
            remaining.append(name)

    substantial = [
        name for name in remaining if group_stats[name]["faces"] >= MINOR_GROUP_FRACTION * total
    ]

    def tile_row(name: str) -> int:
        return -1 if name == "tile_none" else int(name.split("_")[1])

    # Paint: the biggest substantial group on a colour row, else the biggest group overall.
    coloured = [name for name in substantial if tile_row(name) > 0]
    paint_pool = coloured or substantial or remaining
    paint = max(paint_pool, key=lambda name: (group_stats[name]["faces"], name))
    roles[paint] = "paint"

    # Glass: the highest-sitting substantial group that is not the paint.
    glass_pool = [name for name in substantial if name != paint]
    if glass_pool:
        glass = max(glass_pool, key=lambda name: (group_stats[name]["mean_y"], name))
        roles[glass] = "glass"

    for name in remaining:
        roles.setdefault(name, "trim")
    return roles


# --- Emitting -----------------------------------------------------------------------------
def fmt(value: float) -> str:
    """Fixed precision keeps output byte-identical between runs, and -0 from printing."""
    text = f"{value:.6f}"
    return "0.000000" if text == "-0.000000" else text


class ObjWriter:
    """Collects re-indexed vertex/uv/normal pools and emits groups in insertion order."""

    def __init__(self, pack: Pack, offset: tuple[float, float, float]) -> None:
        self.pack = pack
        self.offset = offset
        self.verts: list[tuple[float, float, float]] = []
        self.uvs: list[tuple[float, float]] = []
        self.normals: list[tuple[float, float, float]] = []
        self._vert_map: dict[int, int] = {}
        self._uv_map: dict[int, int] = {}
        self._normal_map: dict[int, int] = {}
        self.groups: list[tuple[str, list[list[tuple[int, int | None, int | None]]]]] = []

    def _vert(self, index: int) -> int:
        if index not in self._vert_map:
            x, y, z = self.pack.verts[index]
            ox, oy, oz = self.offset
            self.verts.append((x - ox, y - oy, z - oz))
            self._vert_map[index] = len(self.verts)
        return self._vert_map[index]

    def _uv(self, index: int) -> int:
        if index not in self._uv_map:
            self.uvs.append(self.pack.uvs[index])
            self._uv_map[index] = len(self.uvs)
        return self._uv_map[index]

    def _normal(self, index: int) -> int:
        if index not in self._normal_map:
            self.normals.append(self.pack.normals[index])
            self._normal_map[index] = len(self.normals)
        return self._normal_map[index]

    def add_group(self, name: str, faces: list) -> None:
        rebuilt = []
        for face in faces:
            rebuilt.append(
                [
                    (
                        self._vert(v),
                        self._uv(vt) if vt is not None else None,
                        self._normal(vn) if vn is not None else None,
                    )
                    for (v, vt, vn) in face
                ]
            )
        self.groups.append((name, rebuilt))

    def write(self, path: str, header: list[str]) -> None:
        with open(path, "w") as fh:
            for line in header:
                fh.write(f"# {line}\n")
            for x, y, z in self.verts:
                fh.write(f"v {fmt(x)} {fmt(y)} {fmt(z)}\n")
            for u, v in self.uvs:
                fh.write(f"vt {fmt(u)} {fmt(v)}\n")
            for x, y, z in self.normals:
                fh.write(f"vn {fmt(x)} {fmt(y)} {fmt(z)}\n")
            for name, faces in self.groups:
                fh.write(f"g {name}\nusemtl {name}\n")
                for face in faces:
                    tokens = []
                    for (v, vt, vn) in face:
                        if vn is not None:
                            tokens.append(f"{v}/{vt if vt else ''}/{vn}")
                        elif vt is not None:
                            tokens.append(f"{v}/{vt}")
                        else:
                            tokens.append(str(v))
                    fh.write("f " + " ".join(tokens) + "\n")


# --- Commands -----------------------------------------------------------------------------
def cmd_list(pack: Pack) -> int:
    clusters = cluster_vehicles(pack)
    print(
        f"{len(pack.verts)} verts, {len(pack.objects)} objects, {len(clusters)} clusters "
        f"in {pack.path}\n"
    )
    for index, members in enumerate(clusters):
        faces = sum(len(pack.objects[i]["faces"]) for i in members)
        boxes = [pack.objects[i]["bbox"] for i in members]
        dims = tuple(
            max(b[i + 3] for b in boxes) - min(b[i] for b in boxes) for i in range(3)
        )
        print(
            f"[{index:2}] parts={len(members):3} faces={faces:6} "
            f"dims={dims[0]:7.2f} x {dims[1]:6.2f} x {dims[2]:7.2f}"
        )
    return 0


def cmd_extract(pack: Pack, cluster_index: int, out_dir: str, name: str | None) -> int:
    clusters = cluster_vehicles(pack)
    if not 0 <= cluster_index < len(clusters):
        print(
            f"error: cluster {cluster_index} out of range (0..{len(clusters) - 1})",
            file=sys.stderr,
        )
        return 2

    members = clusters[cluster_index]
    faces = [face for i in members for face in pack.objects[i]["faces"]]
    boxes = [pack.objects[i]["bbox"] for i in members]
    car_bbox = (
        *(min(b[i] for b in boxes) for i in range(3)),
        *(max(b[i + 3] for b in boxes) for i in range(3)),
    )

    components = split_components(pack, faces)
    try:
        wheel_indices = classify_wheels(components, car_bbox)
    except WheelDetectionError as err:
        print(f"error: cluster {cluster_index}: {err}", file=sys.stderr)
        print("\ncomponent table (largest first):", file=sys.stderr)
        for i, comp in enumerate(components[:20]):
            x0, y0, z0, x1, y1, z1 = comp["bbox"]
            flag = "candidate" if i in err.candidates else ""
            print(
                f"  [{i:3}] faces={len(comp['faces']):5} "
                f"dims={x1 - x0:5.2f} x {y1 - y0:5.2f} x {z1 - z0:5.2f} "
                f"base_y={y0 - car_bbox[1]:5.2f} "
                f"centre=({(x0 + x1) / 2:6.2f},{(z0 + z1) / 2:6.2f}) {flag}",
                file=sys.stderr,
            )
        print(
            "\nNo car was written. Pick a different cluster, or adjust the WHEEL_* "
            "tolerances if this vehicle is genuinely shaped differently.",
            file=sys.stderr,
        )
        return 1

    # Origin: centred on the car's footprint in x/z, with the wheels resting at y=0.
    offset = (
        (car_bbox[0] + car_bbox[3]) / 2,
        car_bbox[1],
        (car_bbox[2] + car_bbox[5]) / 2,
    )

    wheels = [components[i] for i in wheel_indices]
    # Reference wheel: the first in deterministic order. All four are the same disc, so one
    # mesh is emitted and the runtime instances it at the four axle positions.
    reference = wheels[0]
    rx0, ry0, rz0, rx1, ry1, rz1 = reference["bbox"]
    wheel_dims = sorted((rx1 - rx0, ry1 - ry0, rz1 - rz0))
    wheel_radius = (wheel_dims[1] + wheel_dims[2]) / 4  # mean of the two disc diameters, halved
    wheel_centre = ((rx0 + rx1) / 2, (ry0 + ry1) / 2, (rz0 + rz1) / 2)

    axles = []
    for wheel in wheels:
        x0, y0, z0, x1, y1, z1 = wheel["bbox"]
        axles.append(
            {
                "x": round((x0 + x1) / 2 - offset[0], 6),
                "y": round((y0 + y1) / 2 - offset[1], 6),
                "z": round((z0 + z1) / 2 - offset[2], 6),
            }
        )
    axles.sort(key=lambda a: (a["z"], a["x"]))

    body_components = [c for i, c in enumerate(components) if i not in set(wheel_indices)]
    body_faces = [face for comp in body_components for face in comp["faces"]]

    tile_groups: dict[str, list] = defaultdict(list)
    for face in body_faces:
        tile_groups[tile_name(tile_of_face(pack, face))].append(face)

    stem = name or f"car{cluster_index:02d}"
    # Created on demand: on a fresh checkout the output directory is gitignored and absent, so
    # requiring it to exist first would make the documented setup steps fail.
    os.makedirs(out_dir, exist_ok=True)
    obj_path = f"{out_dir.rstrip('/')}/{stem}.obj"
    json_path = f"{out_dir.rstrip('/')}/{stem}.json"

    writer = ObjWriter(pack, offset)
    for group_name in sorted(tile_groups, key=lambda n: (-len(tile_groups[n]), n)):
        writer.add_group(group_name, tile_groups[group_name])
    # The wheel is recentred on its own axle so the runtime can rotate it about its origin.
    wheel_writer = ObjWriter(pack, wheel_centre)
    wheel_writer.add_group("wheel", reference["faces"])

    # Both meshes share one file: append the wheel's pools after the body's.
    base_v, base_vt, base_vn = len(writer.verts), len(writer.uvs), len(writer.normals)
    writer.verts.extend(wheel_writer.verts)
    writer.uvs.extend(wheel_writer.uvs)
    writer.normals.extend(wheel_writer.normals)
    writer.groups.append(
        (
            "wheel",
            [
                [
                    (
                        v + base_v,
                        vt + base_vt if vt is not None else None,
                        vn + base_vn if vn is not None else None,
                    )
                    for (v, vt, vn) in face
                ]
                for face in wheel_writer.groups[0][1]
            ],
        )
    )

    body_bbox = pack._bbox({v for face in body_faces for (v, _, _) in face})
    car_half_length = (car_bbox[5] - car_bbox[2]) / 2

    # Per-group shape, measured in the output's own coordinates, for role inference.
    group_stats: dict[str, dict] = {}
    for group_name, group_faces in tile_groups.items():
        ys, zs = [], []
        for face in group_faces:
            for (v, _, _) in face:
                ys.append(pack.verts[v][1] - offset[1])
                zs.append(pack.verts[v][2] - offset[2])
        group_stats[group_name] = {
            "faces": len(group_faces),
            "mean_y": sum(ys) / len(ys),
            "span_z": max(zs) - min(zs),
            "centre_z": (max(zs) + min(zs)) / 2,
            "car_half_length": car_half_length,
        }

    roles = propose_roles(group_stats)
    roles["wheel"] = "tyre"

    writer.write(
        obj_path,
        header=[
            f"car extracted from {pack.path} cluster {cluster_index}",
            "GENERATED - do not commit. Source pack is not redistributable.",
            "See docs/dev-cars.md",
        ],
    )

    manifest = {
        "name": stem,
        "source": {"pack": pack.path, "cluster": cluster_index, "parts": len(members)},
        "mesh": f"{stem}.obj",
        "wheelRadius": round(wheel_radius, 6),
        "wheelWidth": round(wheel_dims[0], 6),
        "axles": axles,
        "body": {
            "width": round(body_bbox[3] - body_bbox[0], 6),
            "height": round(body_bbox[4] - body_bbox[1], 6),
            "length": round(body_bbox[5] - body_bbox[2], 6),
        },
        "wheelbase": round(max(a["z"] for a in axles) - min(a["z"] for a in axles), 6),
        "halfTrack": round(max(abs(a["x"]) for a in axles), 6),
        "roles": {key: roles[key] for key in sorted(roles)},
        "groupFaceCounts": {
            key: len(tile_groups[key]) for key in sorted(tile_groups)
        } | {"wheel": len(reference["faces"])},
    }
    with open(json_path, "w") as fh:
        json.dump(manifest, fh, indent=2, sort_keys=False)
        fh.write("\n")

    print(f"wrote {obj_path}")
    print(f"wrote {json_path}")
    print(
        f"  body {manifest['body']['width']:.2f} x {manifest['body']['height']:.2f} x "
        f"{manifest['body']['length']:.2f}, {len(body_faces)} faces in "
        f"{len(tile_groups)} tile groups"
    )
    print(
        f"  wheel radius {manifest['wheelRadius']:.2f}, wheelbase {manifest['wheelbase']:.2f}, "
        f"half-track {manifest['halfTrack']:.2f}"
    )
    print("  roles: " + ", ".join(f"{k}={v}" for k, v in manifest["roles"].items()))
    print("  Check the roles by eye in the app and correct them in the manifest if wrong.")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Extract one rigged car from a multi-car OBJ pack (local dev only)."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    list_cmd = sub.add_parser("list", help="print the pack's vehicle clusters")
    list_cmd.add_argument("pack")

    extract_cmd = sub.add_parser("extract", help="write one car as OBJ + JSON manifest")
    extract_cmd.add_argument("pack")
    extract_cmd.add_argument("cluster", type=int)
    extract_cmd.add_argument("out_dir")
    extract_cmd.add_argument("--name", default=None, help="output file stem (default carNN)")

    args = parser.parse_args(argv)
    pack = Pack(args.pack)
    if args.command == "list":
        return cmd_list(pack)
    return cmd_extract(pack, args.cluster, args.out_dir, args.name)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
