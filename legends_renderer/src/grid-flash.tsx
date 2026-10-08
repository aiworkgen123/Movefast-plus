import React from 'react';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GridStage} from './grid-stage.tsx';
/** T07: a hard cut to the empty bowed grid for one or a few frames (Diesel 18:51.9: exactly one frame) before the next shot or
 * a graphic that builds on the grid. Grid identical to E14's (measured to the pixel). */
export type GridFlashProps = Readonly<Record<string, never>>;
export const gridFlashDuration = {minSeconds: 1 / 30, maxSeconds: 1};
export const GridFlash: React.FC<ComponentRenderProps<GridFlashProps>> = ({skin, context}) =>
  validContext(context, gridFlashDuration) ? <GridStage skin={skin} context={context} variant="bowed" /> : null;
export const gridFlash: VisualComponent<GridFlashProps> = {id: 'grid-flash', layer: 'fullscreen', duration: gridFlashDuration, textLimits: {},
  repair: (input: unknown) => (input && typeof input === 'object' ? {} : null), render: GridFlash};
