// MoveFast-owned (Mr Truth). The repo's own compositions plus `Direct`, which mounts a switched-off template for previews.
import { AbsoluteFill, Composition, registerRoot } from 'remotion'
import type { CalculateMetadataFunction } from 'remotion'
import type { ReactNode } from 'react'
import { RemotionRoot } from '../src/remotion/Root.js'
import { useDocumentaryFont } from '../src/remotion/fonts.js'
import { PointerLabel } from '../src/remotion/animations/PointerLabel.js'
import { NameCard } from '../src/remotion/animations/NameCard.js'
import { NamePlate } from '../src/remotion/animations/NamePlate.js'
import { P13 } from '../src/remotion/templates/P13.js'
import { P16 } from '../src/remotion/templates/P16.js'

type DirectProps = { kind: string; durationFrames: number; props: Record<string, unknown> }

function Direct({ kind, props }: DirectProps): ReactNode {
  useDocumentaryFont()
  const p = props as never
  let body: ReactNode = null
  if (kind === 'pointer-label') body = <PointerLabel {...p} />
  if (kind === 'name-card') body = <NameCard {...p} />
  if (kind === 'name-plate') body = <NamePlate {...p} />
  if (kind === 'P13') body = <P13 {...p} />
  if (kind === 'P16') body = <P16 {...p} />
  return <AbsoluteFill style={{ backgroundColor: '#000' }}>{body}</AbsoluteFill>
}

const directMeta: CalculateMetadataFunction<DirectProps> = ({ props }) => ({
  durationInFrames: props.durationFrames,
  fps: 30,
  width: 1920,
  height: 1080,
  props,
})

function DemoRoot(): ReactNode {
  return (
    <>
      <RemotionRoot />
      <Composition
        id="Direct"
        component={Direct}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ kind: 'P13', durationFrames: 150, props: {} }}
        calculateMetadata={directMeta}
      />
    </>
  )
}

registerRoot(DemoRoot)
