import React from 'react';
import {AbsoluteFill} from 'remotion';

export const WC10_PREMIUM_OPTION_DURATION = 1;

const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";

const Title: React.FC<{color: string; left?: number; top?: number; width?: number}> = ({
  color,
  left = 104,
  top = 88,
  width = 700,
}) => (
  <div style={{position: 'absolute', left, top, width, color, fontFamily: serif, fontSize: 74, fontWeight: 600, lineHeight: .98, letterSpacing: -.8}}>
    Choose the approach
  </div>
);

const Label: React.FC<{x: number; y: number; color: string; children: React.ReactNode; align?: 'left' | 'right'}> = ({x, y, color, children, align = 'left'}) => (
  <div style={{position: 'absolute', left: align === 'right' ? undefined : x, right: align === 'right' ? 1920 - x : undefined, top: y, color, fontFamily: serif, fontSize: 32, fontWeight: 600, lineHeight: 1, textAlign: align}}>
    {children}
  </div>
);

const Small: React.FC<{x: number; y: number; color: string; children: React.ReactNode; align?: 'left' | 'right'}> = ({x, y, color, children, align = 'left'}) => (
  <div style={{position: 'absolute', left: align === 'right' ? undefined : x, right: align === 'right' ? 1920 - x : undefined, top: y, color, fontFamily: sans, fontSize: 17, fontWeight: 600, letterSpacing: 2.7, lineHeight: 1, textTransform: 'uppercase', textAlign: align}}>
    {children}
  </div>
);

export const WC10PremiumEngravedAtlas: React.FC = () => (
  <AbsoluteFill style={{background: '#0E1418', overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="atlas-vignette" cx="48%" cy="46%" r="72%"><stop offset="0" stopColor="#223039"/><stop offset=".66" stopColor="#111a20"/><stop offset="1" stopColor="#070b0e"/></radialGradient>
        <pattern id="atlas-grain" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".65" fill="#e8d6ad" opacity=".12"/><circle cx="8" cy="7" r=".5" fill="#e8d6ad" opacity=".08"/></pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#atlas-vignette)"/>
      <rect width="1920" height="1080" fill="url(#atlas-grain)"/>
      <g fill="none" stroke="#8d9ca2" strokeWidth="1.2" opacity=".16">
        <path d="M-90 285 C180 120 340 365 596 206 S1040 280 1290 152 S1680 204 2020 40"/>
        <path d="M-90 350 C200 180 362 424 620 270 S1072 342 1324 216 S1695 266 2025 108"/>
        <path d="M-40 850 C270 676 460 920 730 750 S1220 850 1490 678 S1820 730 2010 622"/>
        <path d="M-30 916 C286 744 478 982 752 814 S1246 912 1518 742 S1840 790 2020 686"/>
      </g>
      <rect x="72" y="58" width="1776" height="964" fill="none" stroke="#aa8b54" strokeWidth="1.5" opacity=".72"/>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M310 790 C560 700 770 430 1125 310 C1290 255 1410 252 1535 278" stroke="#89959a" strokeWidth="3" opacity=".28"/>
        <path d="M310 790 C650 820 990 834 1436 806" stroke="#89959a" strokeWidth="3" opacity=".22"/>
        <path d="M310 790 C610 742 830 626 1095 570 C1285 530 1397 510 1518 500" stroke="#050708" strokeWidth="34"/>
        <path d="M310 790 C610 742 830 626 1095 570 C1285 530 1397 510 1518 500" stroke="#9b7536" strokeWidth="24"/>
        <path d="M310 790 C610 742 830 626 1095 570 C1285 530 1397 510 1518 500" stroke="#d2ad63" strokeWidth="14"/>
        <path d="M310 790 C610 742 830 626 1095 570 C1285 530 1397 510 1518 500" stroke="#fae8bd" strokeWidth="3.5" opacity=".92"/>
      </g>
      <path d="M1510 466 Q1550 482 1596 500 Q1550 518 1510 534 Q1528 500 1510 466 Z" fill="#050708" stroke="#050708" strokeWidth="11" strokeLinejoin="round"/>
      <path d="M1516 474 Q1552 486 1587 500 Q1552 514 1516 526 Q1530 500 1516 474 Z" fill="#d2ad63"/>
      <path d="M1523 483 Q1550 491 1572 500 Q1550 509 1523 517 Q1534 500 1523 483 Z" fill="#fae8bd"/>
      <circle cx="310" cy="790" r="20" fill="#0E1418" stroke="#d2ad63" strokeWidth="4"/><circle cx="310" cy="790" r="5" fill="#fae8bd"/>
      <circle cx="1596" cy="500" r="8" fill="#fae8bd"/>
      <circle cx="1535" cy="278" r="7" fill="#718087"/><circle cx="1436" cy="806" r="7" fill="#718087"/>
    </svg>
    <Title color="#f2e8d4"/>
    <Small x={106} y={278} color="#a99061">Strategic choice · selected route</Small>
    <Small x={262} y={838} color="#a5afb2">Origin</Small>
    <Label x={1626} y={474} color="#f2e8d4">Turn the flank</Label>
    <Small x={1627} y={518} color="#d2ad63">Chosen approach</Small>
    <Label x={1582} y={252} color="#77868c">Direct assault</Label>
    <Label x={1492} y={784} color="#6f7d82">Wide envelopment</Label>
  </AbsoluteFill>
);

export const WC10PremiumArchitecturalBlueprint: React.FC = () => (
  <AbsoluteFill style={{background: '#E7E1D5', color: '#25292b', overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <defs>
        <pattern id="blueprint-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#556067" strokeWidth="1" opacity=".12"/></pattern>
        <pattern id="blueprint-grid-major" width="160" height="160" patternUnits="userSpaceOnUse"><path d="M160 0H0V160" fill="none" stroke="#556067" strokeWidth="1.3" opacity=".18"/></pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#blueprint-grid)"/><rect width="1920" height="1080" fill="url(#blueprint-grid-major)"/>
      <path d="M1140 110 H1770 V430 H1535 V720 H1818 V978 H1070 V850 H920 V605 H1100 Z" fill="#cfc8bc" opacity=".72"/>
      <path d="M1140 110 H1770 V430 H1535 V720 H1818 V978 H1070" fill="none" stroke="#444b4f" strokeWidth="3" opacity=".72"/>
      <g fill="none" stroke="#596166" strokeWidth="4" strokeDasharray="14 17" opacity=".48">
        <path d="M250 794 H705 V356 H1475"/><path d="M250 794 H660 V914 H1500"/>
      </g>
      <g fill="none" strokeLinejoin="miter" strokeLinecap="square">
        <path d="M250 794 H612 V610 H1042 V550 H1485" stroke="#E7E1D5" strokeWidth="40"/>
        <path d="M250 794 H612 V610 H1042 V550 H1485" stroke="#70291e" strokeWidth="28"/>
        <path d="M250 794 H612 V610 H1042 V550 H1485" stroke="#d94a33" strokeWidth="18"/>
      </g>
      <path d="M1473 510 H1524 L1568 550 L1524 590 H1473 L1490 566 H1450 V534 H1490 Z" fill="#E7E1D5" stroke="#70291e" strokeWidth="12" strokeLinejoin="miter"/>
      <path d="M1482 520 H1518 L1551 550 L1518 580 H1482 L1498 560 H1462 V540 H1498 Z" fill="#d94a33"/>
      <rect x="224" y="768" width="52" height="52" fill="#E7E1D5" stroke="#303639" strokeWidth="5"/><rect x="238" y="782" width="24" height="24" fill="#d94a33"/>
      <path d="M1568 550 H1745" stroke="#303639" strokeWidth="2"/><path d="M1475 356 H1745" stroke="#596166" strokeWidth="2" opacity=".5"/><path d="M1500 914 H1745" stroke="#596166" strokeWidth="2" opacity=".5"/>
    </svg>
    <Title color="#202426" left={104} top={88} width={690}/>
    <Small x={106} y={278} color="#656c70">Decision plan · 03 routes</Small>
    <Small x={223} y={846} color="#555d61">Start point</Small>
    <Label x={1585} y={518} color="#282d30">Turn the flank</Label>
    <Small x={1587} y={561} color="#b33b29">Selected</Small>
    <Label x={1510} y={327} color="#686f73">Direct assault</Label>
    <Label x={1470} y={885} color="#686f73">Wide envelopment</Label>
  </AbsoluteFill>
);

export const WC10PremiumVelvetGlass: React.FC = () => (
  <AbsoluteFill style={{background: '#080912', overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="velvet-field" cx="48%" cy="50%" r="70%"><stop offset="0" stopColor="#18233a"/><stop offset=".52" stopColor="#0e1222"/><stop offset="1" stopColor="#04050b"/></radialGradient>
        <linearGradient id="glass-plane" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c5e9ed" stopOpacity=".11"/><stop offset=".55" stopColor="#567383" stopOpacity=".025"/><stop offset="1" stopColor="#91d9dd" stopOpacity=".08"/></linearGradient>
        <filter id="teal-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="15" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="1920" height="1080" fill="url(#velvet-field)"/>
      <path d="M-130 920 C300 640 560 1010 930 770 C1240 570 1470 650 2070 240 L2070 1080 H-130Z" fill="#5a3c75" opacity=".07"/>
      <path d="M-100 160 C370 430 590 50 1000 260 C1330 430 1640 235 2040 80" fill="none" stroke="#9a7fbd" strokeWidth="68" opacity=".035"/>
      <path d="M510 215 L1575 150 L1710 834 L640 916 Z" fill="url(#glass-plane)" stroke="#c5e9ed" strokeWidth="1.2" opacity=".7"/>
      <g fill="none" stroke="#8ca2aa" strokeWidth="2.5" opacity=".12"><path d="M430 676 C750 230 1190 180 1580 285"/><path d="M430 676 C770 930 1220 930 1605 790"/></g>
      <path d="M430 676 C730 680 905 462 1130 452 C1340 442 1435 518 1563 538" fill="none" stroke="#15363d" strokeWidth="46" strokeLinecap="round" filter="url(#teal-glow)" opacity=".95"/>
      <path d="M430 676 C730 680 905 462 1130 452 C1340 442 1435 518 1563 538" fill="none" stroke="#061215" strokeWidth="34" strokeLinecap="round"/>
      <path d="M430 676 C730 680 905 462 1130 452 C1340 442 1435 518 1563 538" fill="none" stroke="#58bfc4" strokeWidth="20" strokeLinecap="round"/>
      <path d="M430 676 C730 680 905 462 1130 452 C1340 442 1435 518 1563 538" fill="none" stroke="#c9f3f0" strokeWidth="3" strokeLinecap="round"/>
      <path d="M1548 502 L1616 538 L1548 574 L1570 538 Z" fill="#061215" stroke="#58bfc4" strokeWidth="10" strokeLinejoin="round"/>
      <path d="M1564 515 L1603 538 L1564 561 L1578 538 Z" fill="#c9f3f0"/>
      <circle cx="430" cy="676" r="25" fill="#071015" stroke="#58bfc4" strokeWidth="3"/><circle cx="430" cy="676" r="7" fill="#c9f3f0"/>
      <circle cx="1580" cy="285" r="6" fill="#7b9098" opacity=".5"/><circle cx="1605" cy="790" r="6" fill="#7b9098" opacity=".5"/>
    </svg>
    <Title color="#f0eee9" left={112} top={84} width={680}/>
    <Small x={115} y={278} color="#759fa5">Three paths · one decision</Small>
    <Label x={1640} y={510} color="#d9f4f0">Turn the flank</Label>
    <Small x={1641} y={554} color="#58bfc4">Chosen</Small>
    <Label x={1515} y={235} color="#5e6c78" align="right">Direct assault</Label>
    <Label x={1540} y={817} color="#56636f" align="right">Wide envelopment</Label>
  </AbsoluteFill>
);

export const WC10PremiumMuseumCatalogue: React.FC = () => (
  <AbsoluteFill style={{background: '#D9CEB9', color: '#202222', overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <defs>
        <pattern id="museum-grain" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".7" fill="#252827" opacity=".12"/><circle cx="6" cy="5" r=".55" fill="#252827" opacity=".09"/></pattern>
        <pattern id="museum-halftone" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.2" fill="#4a4c48" opacity=".17"/></pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#museum-grain)"/>
      <path d="M0 0 H625 L930 260 L720 1080 H0Z" fill="#222523"/>
      <path d="M1010 0 H1920 V380 L1610 525 L1325 350Z" fill="url(#museum-halftone)"/>
      <path d="M870 1080 C960 740 1160 545 1460 396 C1600 326 1770 278 1970 258 L1970 1080Z" fill="#c5b9a4" opacity=".64"/>
      <g fill="none" stroke="#454947" strokeWidth="3" opacity=".38">
        <path d="M455 760 C730 510 1110 270 1530 250" strokeDasharray="11 18"/>
        <path d="M455 760 C780 940 1185 932 1558 836" strokeDasharray="11 18"/>
      </g>
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d="M455 760 C650 744 810 660 972 570 C1170 460 1350 502 1522 544" stroke="#f1e7d5" strokeWidth="40"/>
        <path d="M449 766 C644 750 804 666 966 576 C1164 466 1344 508 1516 550" stroke="#8f281e" strokeWidth="27" opacity=".36"/>
        <path d="M455 760 C650 744 810 660 972 570 C1170 460 1350 502 1522 544" stroke="#c64131" strokeWidth="20"/>
      </g>
      <path d="M1504 504 L1544 514 L1591 544 L1545 574 L1504 584 L1523 556 L1486 548 L1486 532 L1523 524 Z" fill="#f1e7d5" stroke="#8f281e" strokeWidth="12" strokeLinejoin="round"/>
      <path d="M1515 514 L1540 522 L1573 544 L1540 566 L1515 574 L1532 552 L1500 545 L1500 537 L1532 530 Z" fill="#c64131"/>
      <path d="M1521 519 L1546 529 L1579 550" fill="none" stroke="#d66a58" strokeWidth="4" opacity=".8"/>
      <circle cx="455" cy="760" r="21" fill="#222523" stroke="#f1e7d5" strokeWidth="5"/><circle cx="455" cy="760" r="6" fill="#c64131"/>
      <g fill="#454947" opacity=".65"><path d="M1508 240 l12 10 -12 10 4-10z"/><path d="M1532 240 l12 10 -12 10 4-10z"/><path d="M1536 826 l12 10 -12 10 4-10z"/><path d="M1560 826 l12 10 -12 10 4-10z"/></g>
    </svg>
    <Title color="#f0e6d3" left={104} top={92} width={480}/>
    <Small x={108} y={272} color="#b8aa90">Catalogue study · choice 10</Small>
    <Small x={401} y={806} color="#aaa395">Point of departure</Small>
    <Label x={1615} y={520} color="#252726">Turn the flank</Label>
    <Small x={1617} y={564} color="#a53227">Selected route</Small>
    <Label x={1570} y={219} color="#555955">Direct assault</Label>
    <Label x={1594} y={810} color="#555955">Wide envelopment</Label>
  </AbsoluteFill>
);
