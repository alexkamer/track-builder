import type { TrackSurfaces } from '../domain/generation/generateTrack'
import { RibbonMesh3D, RoadMesh3D, useCurbTexture } from './RoadMesh3D'

/**
 * Every track surface, rendered as one unit. Shared by the race view and the editor's live
 * preview so the preview cannot drift from what the player actually drives - the materials and
 * draw order live here rather than being spelled out again per screen.
 *
 * Order matters: the verge is drawn first and sits outermost, so the road's and curbs' edges
 * read on top of it rather than fighting it where they meet.
 */
export function TrackSurfaceMeshes({ surfaces }: { surfaces: TrackSurfaces }) {
  const curbTexture = useCurbTexture()

  return (
    <>
      <RibbonMesh3D mesh={surfaces.vergeLeft} color="#6b6054" testId="verge-left" surface="verge" />
      <RibbonMesh3D mesh={surfaces.vergeRight} color="#6b6054" testId="verge-right" surface="verge" />
      <RoadMesh3D roadMesh={surfaces.roadMesh} />
      {/* Painted on the tarmac, so offset in depth rather than lifted - see RibbonMesh3D. */}
      <RibbonMesh3D mesh={surfaces.edgeLineLeft} color="#eef2f0" roughness={0.75} testId="edge-line-left" depthOffset />
      <RibbonMesh3D mesh={surfaces.edgeLineRight} color="#eef2f0" roughness={0.75} testId="edge-line-right" depthOffset />
      <RibbonMesh3D mesh={surfaces.curbLeft} color="#d62828" testId="curb-left" surface="curb" fallbackMap={curbTexture} />
      <RibbonMesh3D mesh={surfaces.curbRight} color="#d62828" testId="curb-right" surface="curb" fallbackMap={curbTexture} />
      <RibbonMesh3D mesh={surfaces.barrierLeft} color="#495057" roughness={0.6} testId="barrier-left" surface="barrier" castShadow />
      <RibbonMesh3D mesh={surfaces.barrierRight} color="#495057" roughness={0.6} testId="barrier-right" surface="barrier" castShadow />
    </>
  )
}
