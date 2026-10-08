import React from 'react';
import {WC04_ADAPTIVE_STYLE, type EngravedPieceSpec} from './production-contracts';

export const ENGRAVED_PATHS = {
  pawn: 'M100 48C85 48 73 60 73 75C73 86 79 95 88 101C79 109 75 120 75 131C75 140 77 148 82 155H118C123 148 125 140 125 131C125 120 121 109 112 101C121 95 127 86 127 75C127 60 115 48 100 48Z',
  knight: 'M66 138C72 122 84 111 97 102C105 96 109 88 107 82C102 84 98 88 94 93C88 100 81 106 74 109C67 112 61 112 55 111L44 109C38 108 34 105 32 101C30 96 31 91 34 86L52 64C57 56 63 47 68 39C72 34 75 28 76 23L87 17L100 31C104 36 109 39 116 40C130 43 143 48 153 57C160 64 163 73 163 84C163 96 161 108 159 119C157 127 156 134 156 138Z M50 138H156C163 138 167 143 167 150V172H41V150C41 143 45 138 50 138Z M75 61C78 65 83 67 88 66C93 65 96 61 95 58C91 54 86 53 82 55C79 56 77 58 75 61Z',
  rook: 'M42 31h27v22h20V31h22v22h20V31h27v45h-13l-8 67h18c9 0 16 7 16 16v12H29v-12c0-9 7-16 16-16h18l-8-67H42V31Z',
  bishop: 'M100 18L132 47L118 78C116 84 116 90 121 97C127 105 137 112 142 122C148 133 150 149 155 172H45C50 155 52 138 58 126C63 115 73 106 79 98C84 91 84 84 82 78L68 47Z',
  queen: 'M100 14L109 41L123 27L121 51L138 40L129 68C125 77 117 84 116 95C115 103 121 109 130 116C141 126 147 143 153 172H47C53 149 57 131 69 117C78 107 85 102 84 94C83 84 75 78 71 68L62 40L79 51L77 27L92 41Z',
  king: 'M92 45V25H79V14H92V1H108V14H121V25H108V45C111 53 118 59 122 67C127 76 126 86 121 95C117 102 117 108 123 115C134 126 143 142 148 157L154 172H46L52 157C57 142 66 126 77 115C83 108 83 102 79 95C74 86 73 76 78 67C82 59 89 53 92 45Z',
} as const;

const PAWN_BASE_PATH = 'M54 155H146C154 155 160 161 160 169V172H40V169C40 161 46 155 54 155Z';
const pawnBodyTransform = `translate(100 0) scale(${WC04_ADAPTIVE_STYLE.pawnShape.bodyWidthFactor} 1) translate(-100 0)`;
const pawnBaseTransform = `translate(100 0) scale(${WC04_ADAPTIVE_STYLE.pawnShape.baseWidthFactor} 1) translate(-100 0)`;

const fillFor = (side: EngravedPieceSpec['side']): string => side === 'black' ? '#171717' : '#F6F1E8';
const contourFor = (side: EngravedPieceSpec['side']): string => side === 'black' ? '#F6F1E8' : '#171717';
const contourWidthFor = (side: EngravedPieceSpec['side']): number => WC04_ADAPTIVE_STYLE.contourWidth[side];
const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '-');

export type WarChessEngravedPieceProps = {
  piece: EngravedPieceSpec;
  position: readonly [number, number];
};

/** Locked six-kind silhouette set.  The only presentation colors are black and white. */
export const WarChessEngravedPiece: React.FC<WarChessEngravedPieceProps> = ({piece, position}) => {
  const d = ENGRAVED_PATHS[piece.pieceType];
  const id = `engraving-${safeId(piece.id)}`;
  const fill = fillFor(piece.side);
  const contour = contourFor(piece.side);
  const contourWidth = contourWidthFor(piece.side);
  const width = 200 * piece.scale;
  const height = 180 * piece.scale;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 180"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${position[0] * 100}%`,
        top: `${position[1] * 100}%`,
        transform: 'translate(-50%, -50%)',
        overflow: 'visible',
        filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.38))',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <clipPath id={id}>
          {piece.pieceType === 'pawn' ? (
            <>
              <path d={d} transform={pawnBodyTransform} />
              <path d={PAWN_BASE_PATH} transform={pawnBaseTransform} />
            </>
          ) : <path d={d} />}
        </clipPath>
        <pattern id={`${id}-hatch`} width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <path d="M0 0V11" stroke={contour} strokeWidth="2" opacity=".22" />
        </pattern>
      </defs>
      {piece.pieceType === 'pawn' ? (
        <>
          <path d={d} transform={pawnBodyTransform} fill={fill} stroke={contour} strokeWidth={contourWidth} strokeLinejoin="round" />
          <path d={PAWN_BASE_PATH} transform={pawnBaseTransform} fill={fill} stroke={contour} strokeWidth={contourWidth} strokeLinejoin="round" />
        </>
      ) : <path d={d} fill={fill} stroke={contour} strokeWidth={contourWidth} strokeLinejoin="round" />}
      <rect x="20" y="8" width="160" height="166" fill={`url(#${id}-hatch)`} clipPath={`url(#${id})`} />
    </svg>
  );
};
