import React from 'react';
import {Composition} from 'remotion';
import {
  MapLibreGeographicPlate,
  MapLibreGeographicPlatePropsSchema,
} from './maplibre-geographic-plate';

export const INTERNAL_MAP_PLATE_COMPOSITION_ID =
  'WarChessInternalMapLibrePlate';

export const MapCaptureRoot: React.FC = () => (
  <Composition
    id={INTERNAL_MAP_PLATE_COMPOSITION_ID}
    component={MapLibreGeographicPlate}
    schema={MapLibreGeographicPlatePropsSchema}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={1}
    defaultProps={{bounds: [7.7, 43.7, 9.4, 45.1]}}
  />
);
