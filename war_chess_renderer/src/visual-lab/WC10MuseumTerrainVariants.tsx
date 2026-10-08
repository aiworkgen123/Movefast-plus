import React from 'react';
import {AbsoluteFill} from 'remotion';

export const WC10_MUSEUM_TERRAIN_DURATION = 1;

const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";

const Heading: React.FC<{left?: number; top?: number; width?: number; color?: string}> = ({left = 94, top = 68, width = 590, color = '#252725'}) => (
  <div style={{position: 'absolute', left, top, width, color, fontFamily: serif, fontSize: 68, fontWeight: 600, lineHeight: .96, letterSpacing: -.5}}>
    Choose the approach
  </div>
);

const Meta: React.FC<{x: number; y: number; color?: string; children: React.ReactNode}> = ({x, y, color = '#6a6962', children}) => (
  <div style={{position: 'absolute', left: x, top: y, color, fontFamily: sans, fontSize: 16, fontWeight: 600, letterSpacing: 2.5, lineHeight: 1, textTransform: 'uppercase'}}>{children}</div>
);

const RouteLabel: React.FC<{x: number; y: number; color?: string; children: React.ReactNode; selected?: boolean}> = ({x, y, color = '#4f534f', children, selected = false}) => (
  <div style={{position: 'absolute', left: x, top: y, color, fontFamily: serif, fontSize: selected ? 35 : 30, fontWeight: 600, lineHeight: 1}}>
    {children}
    {selected ? <div style={{marginTop: 9, color: '#a9382b', fontFamily: sans, fontSize: 15, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase'}}>Selected route</div> : null}
  </div>
);

const Paper: React.FC = () => (
  <>
    <rect width="1920" height="1080" fill="#ded4c0"/>
    <defs><pattern id="paper-speck" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".55" fill="#3a3b37" opacity=".09"/><circle cx="7" cy="6" r=".42" fill="#3a3b37" opacity=".06"/></pattern></defs>
    <rect width="1920" height="1080" fill="url(#paper-speck)"/>
  </>
);

const contour = (d: string, heavy = false) => <path d={d} fill="none" stroke="#6d716a" strokeWidth={heavy ? 3 : 1.35} opacity={heavy ? .58 : .42}/>;

export const WC10MuseumSurveyContour: React.FC = () => (
  <AbsoluteFill style={{overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <Paper/>
      <g stroke="#81857d" strokeWidth="1" opacity=".16"><path d="M120 0V1080M360 0V1080M600 0V1080M840 0V1080M1080 0V1080M1320 0V1080M1560 0V1080M1800 0V1080"/><path d="M0 180H1920M0 420H1920M0 660H1920M0 900H1920"/></g>
      <g>
        {contour('M735 180 C850 76 1080 82 1195 190 C1305 294 1236 414 1085 438 C916 466 742 394 692 294 C672 252 687 221 735 180Z', true)}
        {contour('M788 199 C874 125 1044 128 1132 202 C1215 271 1165 356 1051 376 C923 399 797 349 758 282 C740 250 754 224 788 199Z')}
        {contour('M840 215 C907 169 1015 171 1075 218 C1130 261 1098 315 1021 330 C934 347 851 316 824 272 C810 249 817 230 840 215Z')}
        {contour('M898 227 C942 201 995 204 1031 230 C1063 253 1044 284 1002 292 C954 301 910 284 894 259 C886 246 888 237 898 227Z', true)}
        {contour('M1280 565 C1410 454 1648 481 1760 608 C1870 732 1774 888 1598 907 C1416 927 1241 827 1217 702 C1205 644 1226 610 1280 565Z', true)}
        {contour('M1331 590 C1425 516 1604 533 1687 620 C1764 702 1694 815 1570 830 C1441 845 1316 777 1297 693 C1288 651 1302 620 1331 590Z')}
        {contour('M1388 616 C1456 568 1570 580 1629 637 C1681 688 1636 758 1553 770 C1468 781 1383 737 1369 684 C1362 654 1369 634 1388 616Z')}
        {contour('M1450 640 C1490 617 1552 624 1584 653 C1611 679 1588 716 1545 721 C1500 727 1457 705 1449 676 C1445 660 1446 650 1450 640Z', true)}
        {contour('M188 575 C285 470 485 476 574 585 C656 684 571 797 430 814 C286 831 155 745 147 646 C143 618 157 595 188 575Z', true)}
        {contour('M236 590 C308 519 452 521 516 594 C575 660 516 739 416 751 C315 763 222 706 215 639 C211 620 220 603 236 590Z')}
        {contour('M292 608 C340 568 424 570 466 610 C503 648 467 693 407 700 C347 707 291 674 286 636 C284 625 286 615 292 608Z')}
        {contour('M346 621 C372 606 412 607 434 623 C453 638 436 657 408 660 C379 663 351 651 347 636Z', true)}
      </g>
      <g fill="none" stroke="#65746f"><path d="M912 970 C830 860 856 746 975 672 C1075 610 1160 566 1218 464" strokeWidth="8" opacity=".24"/><path d="M912 970 C830 860 856 746 975 672 C1075 610 1160 566 1218 464" stroke="#6e8990" strokeWidth="3.5"/></g>
      <g stroke="#5e625d" strokeWidth="2" strokeDasharray="8 9" opacity=".55"><path d="M470 570 C650 480 810 395 985 288"/><path d="M1042 336 C1195 446 1348 552 1530 674"/></g>
      <g fill="#565b55" fontFamily={sans} fontSize="14"><text x="944" y="260">△ 684</text><text x="1494" y="675">△ 512</text><text x="355" y="638">△ 431</text><text x="1085" y="553">SADDLE 286</text><text x="1010" y="716">VALLEY</text></g>
      <g fill="none" strokeLinecap="round"><path d="M280 846 C600 870 915 742 1190 610 C1350 533 1470 506 1560 498" stroke="#f3ead9" strokeWidth="25"/><path d="M280 846 C600 870 915 742 1190 610 C1350 533 1470 506 1560 498" stroke="#c43f30" strokeWidth="15"/><path d="M280 846 C700 730 1040 390 1490 300" stroke="#626b68" strokeWidth="4" opacity=".5"/><path d="M280 846 C680 965 1080 942 1510 835" stroke="#626b68" strokeWidth="4" opacity=".45"/></g>
      <path d="M1556 482 L1622 498 L1556 514 L1572 498Z" fill="#c43f30"/>
    </svg>
    <Heading/><Meta x={97} y={215}>Survey contour plate · index 20m</Meta>
    <RouteLabel x={1640} y={470} selected>Turn the flank</RouteLabel><RouteLabel x={1518} y={270}>Direct assault</RouteLabel><RouteLabel x={1535} y={811}>Wide envelopment</RouteLabel>
  </AbsoluteFill>
);

export const WC10MuseumHillshadeRelief: React.FC = () => (
  <AbsoluteFill style={{background: '#d8cdb8', overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="relief-light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2ead9"/><stop offset=".48" stopColor="#c7bba5"/><stop offset="1" stopColor="#756e62"/></linearGradient>
        <linearGradient id="relief-facet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff8e8" stopOpacity=".7"/><stop offset=".55" stopColor="#c8bba4" stopOpacity=".12"/><stop offset="1" stopColor="#4f4d48" stopOpacity=".5"/></linearGradient>
        <pattern id="relief-grain" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".55" fill="#2b2c29" opacity=".08"/></pattern>
      </defs>
      <rect width="1920" height="1080" fill="#ded4c1"/><path d="M0 0H1920V1080H0Z" fill="url(#relief-grain)"/>
      <path d="M74 918 C118 725 258 617 424 571 C570 530 631 447 608 326 C579 171 752 71 952 92 C1105 108 1172 193 1186 326 C1196 423 1265 458 1396 432 C1570 397 1743 482 1814 639 C1882 788 1758 947 1552 975 C1377 999 1258 925 1138 828 C1035 744 938 751 816 845 C643 978 417 1030 220 991 C133 974 84 950 74 918Z" fill="url(#relief-light)"/>
      <path d="M105 850 C195 673 355 638 494 576 C647 509 686 418 668 311 C650 207 770 135 925 142 C1055 149 1110 218 1128 334 C1145 444 1248 515 1382 487 C1515 459 1651 520 1719 641 C1770 731 1712 847 1593 893 C1452 948 1321 878 1208 792 C1070 687 948 693 787 815 C622 940 410 976 245 937 C168 919 118 889 105 850Z" fill="url(#relief-facet)" opacity=".78"/>
      <path d="M263 631 C418 574 566 533 647 415 C718 312 714 218 838 182 C960 147 1072 216 1080 335 C1088 441 1178 532 1294 528 C1434 523 1573 574 1635 684 C1680 764 1617 844 1524 850 C1407 858 1317 771 1216 709 C1088 631 972 628 850 708 C691 812 548 874 374 840 C250 816 176 720 263 631Z" fill="#7e786c" opacity=".35"/>
      <path d="M388 596 C526 535 596 477 631 371 C661 278 729 211 831 205 C931 200 1028 264 1038 357 C1051 473 1144 576 1263 575 C1392 574 1502 618 1544 704 C1575 767 1513 806 1438 789 C1345 768 1273 686 1174 651 C1057 610 953 638 830 733 C681 848 494 840 379 767 C303 719 307 632 388 596Z" fill="#595950" opacity=".28"/>
      <path d="M653 347 C701 251 785 220 869 241 C952 262 1001 332 994 407 C986 493 1041 557 1118 581 C1047 577 974 601 895 664 C826 719 760 750 697 741 C755 650 757 558 706 489 C661 429 631 392 653 347Z" fill="#f4ead7" opacity=".34"/>
      <g fill="none" stroke="#4f554f" opacity=".52">
        <path d="M74 918 C118 725 258 617 424 571 C570 530 631 447 608 326 C579 171 752 71 952 92 C1105 108 1172 193 1186 326 C1196 423 1265 458 1396 432 C1570 397 1743 482 1814 639 C1882 788 1758 947 1552 975 C1377 999 1258 925 1138 828 C1035 744 938 751 816 845 C643 978 417 1030 220 991" strokeWidth="3"/>
        <path d="M105 850 C195 673 355 638 494 576 C647 509 686 418 668 311 C650 207 770 135 925 142 C1055 149 1110 218 1128 334 C1145 444 1248 515 1382 487 C1515 459 1651 520 1719 641 C1770 731 1712 847 1593 893 C1452 948 1321 878 1208 792 C1070 687 948 693 787 815 C622 940 410 976 245 937" strokeWidth="1.4"/>
        <path d="M263 631 C418 574 566 533 647 415 C718 312 714 218 838 182 C960 147 1072 216 1080 335 C1088 441 1178 532 1294 528 C1434 523 1573 574 1635 684 C1680 764 1617 844 1524 850 C1407 858 1317 771 1216 709 C1088 631 972 628 850 708 C691 812 548 874 374 840" strokeWidth="1.8"/>
        <path d="M388 596 C526 535 596 477 631 371 C661 278 729 211 831 205 C931 200 1028 264 1038 357 C1051 473 1144 576 1263 575 C1392 574 1502 618 1544 704 C1575 767 1513 806 1438 789 C1345 768 1273 686 1174 651 C1057 610 953 638 830 733 C681 848 494 840 379 767" strokeWidth="1.3"/>
        <path d="M720 300 C782 242 876 237 943 288 C1000 332 1008 398 978 451" strokeWidth="2.7"/><path d="M1283 584 C1378 545 1485 588 1520 679 C1544 741 1500 778 1432 755" strokeWidth="2.7"/>
      </g>
      <path d="M883 1080 C846 914 865 788 941 697 C1007 618 1060 565 1085 488 C1102 437 1092 385 1070 343" fill="none" stroke="#6b8588" strokeWidth="16" opacity=".2"/><path d="M883 1080 C846 914 865 788 941 697 C1007 618 1060 565 1085 488 C1102 437 1092 385 1070 343" fill="none" stroke="#4f7278" strokeWidth="4"/>
      <path d="M1031 595 C1084 541 1141 509 1200 497" fill="none" stroke="#5f665f" strokeWidth="5" strokeDasharray="12 10" opacity=".65"/>
      <g fill="none" strokeLinecap="round"><path d="M286 852 C600 835 840 736 1070 585 C1260 460 1415 470 1548 510" stroke="#f2e8d6" strokeWidth="23"/><path d="M286 852 C600 835 840 736 1070 585 C1260 460 1415 470 1548 510" stroke="#b93434" strokeWidth="18"/><path d="M286 852 C600 620 816 360 1000 244 C1180 132 1370 180 1510 250" stroke="#5f6662" strokeWidth="4" opacity=".46"/><path d="M286 852 C630 960 1030 976 1510 830" stroke="#5f6662" strokeWidth="4" opacity=".43"/></g>
      <path d="M1544 497 L1618 510 L1544 523 L1560 510Z" fill="#b93434"/><path d="M1551 501 L1585 507 L1551 512Z" fill="#efc1ad" opacity=".75"/>
      <g fontFamily={sans} fill="#4f554f" fontSize="14"><text x="808" y="286">RIDGE 760</text><text x="1370" y="654">RIDGE 610</text><text x="894" y="748">LOW VALLEY</text><text x="1112" y="492">SADDLE 382</text></g>
    </svg>
    <Heading left={90} top={65}/><Meta x={94} y={211}>Oblique relief · northwest light</Meta>
    <RouteLabel x={1632} y={482} selected>Turn the flank</RouteLabel><RouteLabel x={1535} y={220}>Direct assault</RouteLabel><RouteLabel x={1535} y={802}>Wide envelopment</RouteLabel>
  </AbsoluteFill>
);

export const WC10MuseumEngineerTopographic: React.FC = () => (
  <AbsoluteFill style={{background: '#dcd2bf', overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <defs><pattern id="engineer-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#68706c" strokeWidth="1" opacity=".18"/></pattern><pattern id="eng-paper" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="3" cy="2" r=".5" fill="#30332f" opacity=".07"/></pattern></defs>
      <rect width="1920" height="1080" fill="url(#eng-paper)"/><rect x="610" y="72" width="1218" height="936" fill="#d2c7b2" stroke="#3e4541" strokeWidth="2"/><rect x="610" y="72" width="1218" height="936" fill="url(#engineer-grid)"/>
      <g fill="none" stroke="#555c56">
        <path d="M750 245 C850 132 1055 138 1147 255 C1233 363 1137 472 985 482 C836 492 702 402 700 312 C699 285 718 260 750 245Z" strokeWidth="3"/>
        <path d="M808 263 C881 190 1017 193 1080 268 C1138 337 1074 409 975 416 C877 423 788 366 787 308 C786 288 795 275 808 263Z" strokeWidth="1.5"/>
        <path d="M866 279 C912 241 986 244 1022 282 C1055 316 1020 353 968 357 C916 361 870 332 869 302Z" strokeWidth="1.5"/>
        <path d="M1340 250 C1440 174 1620 204 1688 322 C1750 431 1641 520 1500 500 C1360 481 1266 378 1290 307 C1298 281 1315 263 1340 250Z" strokeWidth="3"/>
        <path d="M1388 275 C1455 228 1575 248 1618 324 C1656 391 1586 447 1495 434 C1405 422 1345 357 1361 313 C1367 294 1376 285 1388 275Z" strokeWidth="1.5"/>
        <path d="M1418 299 C1460 273 1531 286 1555 327 C1577 364 1537 395 1485 387 C1434 379 1401 345 1409 321Z" strokeWidth="1.5"/>
        <path d="M1145 675 C1230 590 1400 594 1478 686 C1550 772 1464 862 1334 868 C1207 874 1098 799 1095 730 C1093 710 1114 691 1145 675Z" strokeWidth="3"/>
        <path d="M1196 694 C1255 640 1360 643 1410 699 C1455 751 1402 807 1323 812 C1246 816 1179 770 1178 729Z" strokeWidth="1.5"/>
        <path d="M1244 713 C1280 687 1340 689 1368 718 C1393 745 1363 773 1319 776 C1275 778 1237 754 1237 733Z" strokeWidth="1.5"/>
      </g>
      <g stroke="#555c56" strokeWidth="2"><path d="M1490 320 l-10 10 m10-10 l10 10 M1480 338 l10 10 m10-10 l-10 10"/><path d="M1515 346 l-8 8 m8-8 l8 8"/><path d="M1470 294 l-8 8 m8-8 l8 8"/></g>
      <g stroke="#8b493e" strokeWidth="2" fill="none"><path d="M812 735 l22-38 l22 38Z"/><path d="M834 697V755"/><circle cx="834" cy="716" r="5" fill="#8b493e"/></g>
      <path d="M680 870 C880 760 910 650 1020 585 C1120 526 1170 488 1238 433" fill="none" stroke="#7a7468" strokeWidth="7" opacity=".48"/>
      <path d="M1765 918 C1590 816 1540 704 1450 624 C1360 545 1278 532 1187 516" fill="none" stroke="#57757b" strokeWidth="4"/>
      <g fill="none" stroke="#646a65" strokeWidth="2" strokeDasharray="14 12" opacity=".6"><path d="M720 842 C965 632 1180 410 1510 272"/><path d="M720 842 C995 920 1300 902 1608 785"/></g>
      <path d="M720 842 C890 824 1045 716 1194 628 C1335 544 1444 530 1540 540" fill="none" stroke="#eee4d1" strokeWidth="21" strokeLinecap="round"/><path d="M720 842 C890 824 1045 716 1194 628 C1335 544 1444 530 1540 540" fill="none" stroke="#1f2826" strokeWidth="13" strokeLinecap="round"/><path d="M720 842 C890 824 1045 716 1194 628 C1335 544 1444 530 1540 540" fill="none" stroke="#bd3b2d" strokeWidth="9" strokeLinecap="round"/>
      <path d="M1537 522 L1595 540 L1537 558 L1550 540Z" fill="#bd3b2d"/>
      <g fill="#4e554f" fontFamily={sans} fontSize="13"><text x="1680" y="965">1 : 25 000</text><text x="655" y="112">N ↑</text><text x="792" y="773">BM 412.6</text><text x="1195" y="468">PASS 338</text><text x="1460" y="354">DEPRESSION</text></g>
    </svg>
    <Heading left={76} top={100} width={420}/><Meta x={80} y={288}>Engineer's topographic plate</Meta><Meta x={80} y={330}>Sheet 10 · interval 20m</Meta>
    <div style={{position: 'absolute', left: 80, top: 620, width: 390, color: '#555a55', fontFamily: serif, fontSize: 24, lineHeight: 1.32}}>Three surveyed approaches converge on the same objective. The middle pass is selected.</div>
    <RouteLabel x={1615} y={512} selected>Turn the flank</RouteLabel><RouteLabel x={1510} y={240}>Direct assault</RouteLabel><RouteLabel x={1618} y={758}>Wide envelopment</RouteLabel>
  </AbsoluteFill>
);

export const WC10MuseumHypsometricAtlas: React.FC = () => (
  <AbsoluteFill style={{background: '#d9cfbc', overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <defs><linearGradient id="hypso-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff8e8" stopOpacity=".58"/><stop offset=".47" stopColor="#fff" stopOpacity="0"/><stop offset="1" stopColor="#272b28" stopOpacity=".38"/></linearGradient><pattern id="hypso-grain" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".5" fill="#30322e" opacity=".08"/></pattern></defs>
      <rect width="1920" height="1080" fill="url(#hypso-grain)"/>
      <path d="M0 1034 C92 847 231 713 392 649 C530 594 581 505 554 395 C522 269 660 134 849 130 C1019 126 1094 235 1125 349 C1150 442 1217 465 1329 421 C1385 399 1423 401 1442 412 V1048 C1251 1005 1109 934 960 879 C803 821 703 846 565 935 C404 1038 204 1080 0 1034Z" fill="#b8b49b"/>
      <path d="M80 954 C165 798 292 705 438 653 C577 603 633 511 612 410 C589 302 698 196 846 190 C980 184 1043 271 1070 366 C1099 468 1191 525 1296 483 C1363 457 1405 459 1442 486 V961 C1278 926 1146 860 1012 815 C855 763 745 790 619 873 C468 973 272 1026 80 954Z" fill="#a6a68c"/>
      <path d="M191 880 C266 759 372 700 493 660 C612 620 680 531 663 432 C646 341 732 257 851 248 C962 240 1017 313 1041 394 C1070 493 1162 565 1266 532 C1341 508 1395 520 1442 552 V873 C1295 844 1184 788 1065 750 C907 700 794 733 679 811 C543 904 358 960 191 880Z" fill="#93977e"/>
      <path d="M330 801 C397 718 480 687 573 658 C674 626 732 548 719 464 C707 389 774 320 866 309 C955 299 1000 356 1018 426 C1044 523 1129 600 1229 581 C1312 565 1380 592 1442 626 V801 C1315 779 1212 733 1102 702 C955 660 845 690 741 760 C619 842 467 881 330 801Z" fill="#808a74"/>
      <path d="M475 731 C533 683 595 677 657 656 C741 628 785 569 777 500 C770 438 820 384 889 373 C958 362 992 403 1006 460 C1029 550 1101 620 1186 619 C1278 618 1360 649 1442 688 V746 C1324 724 1228 696 1130 671 C1006 640 906 664 817 720 C713 786 579 805 475 731Z" fill="#6d7b69"/>
      <path d="M614 675 C659 652 702 652 742 632 C799 604 827 559 825 518 C823 472 858 433 908 422 C958 412 982 442 991 486 C1008 565 1066 620 1130 635 C1052 631 976 645 905 684 C820 730 705 739 614 675Z" fill="#586d61"/>
      <path d="M746 622 C780 603 803 579 810 548 C819 509 851 478 891 470 C931 462 953 482 960 516 C972 569 1007 606 1053 623 C983 614 934 623 879 650 C829 675 781 661 746 622Z" fill="#455d55"/>
      <g fill="none" stroke="#48534b" opacity=".55">
        <path d="M0 1034 C92 847 231 713 392 649 C530 594 581 505 554 395 C522 269 660 134 849 130 C1019 126 1094 235 1125 349 C1150 442 1217 465 1329 421" strokeWidth="2.8"/>
        <path d="M80 954 C165 798 292 705 438 653 C577 603 633 511 612 410 C589 302 698 196 846 190 C980 184 1043 271 1070 366 C1099 468 1191 525 1296 483" strokeWidth="1.2"/>
        <path d="M191 880 C266 759 372 700 493 660 C612 620 680 531 663 432 C646 341 732 257 851 248 C962 240 1017 313 1041 394 C1070 493 1162 565 1266 532" strokeWidth="1.7"/>
        <path d="M330 801 C397 718 480 687 573 658 C674 626 732 548 719 464 C707 389 774 320 866 309 C955 299 1000 356 1018 426 C1044 523 1129 600 1229 581" strokeWidth="1.1"/>
        <path d="M475 731 C533 683 595 677 657 656 C741 628 785 569 777 500 C770 438 820 384 889 373 C958 362 992 403 1006 460 C1029 550 1101 620 1186 619" strokeWidth="1.8"/>
        <path d="M614 675 C659 652 702 652 742 632 C799 604 827 559 825 518 C823 472 858 433 908 422 C958 412 982 442 991 486 C1008 565 1066 620 1130 635" strokeWidth="1.1"/>
        <path d="M746 622 C780 603 803 579 810 548 C819 509 851 478 891 470 C931 462 953 482 960 516 C972 569 1007 606 1053 623" strokeWidth="2.4"/>
      </g>
      <path d="M0 1080 C138 961 276 891 415 837 C565 780 658 723 729 653 C785 598 820 546 854 491" fill="#759295" opacity=".68"/><path d="M0 1080 C138 961 276 891 415 837 C565 780 658 723 729 653 C785 598 820 546 854 491" fill="none" stroke="#4e747a" strokeWidth="5"/>
      <path d="M0 0H1442V1080H0Z" fill="url(#hypso-shade)"/>
      <path d="M686 628 C735 576 777 519 814 456" fill="none" stroke="#3f4943" strokeWidth="3" strokeDasharray="9 8" opacity=".7"/><path d="M1002 612 C1060 579 1115 559 1174 557" fill="none" stroke="#3f4943" strokeWidth="3" strokeDasharray="9 8" opacity=".7"/>
      <g fill="#3f4943" fontFamily={sans} fontSize="14"><text x="884" y="522">▲ 842</text><text x="1050" y="596">▲ 715</text><text x="788" y="426">SUMMIT RIDGE</text><text x="602" y="721">LOW VALLEY 180</text><text x="1090" y="545">SADDLE 460</text><text x="250" y="890">LOWLAND 100</text></g>
      <g fill="none" strokeLinecap="round"><path d="M244 883 C520 842 702 718 868 620 C1030 525 1152 496 1248 502" stroke="#eee5d3" strokeWidth="22"/><path d="M244 883 C520 842 702 718 868 620 C1030 525 1152 496 1248 502" stroke="#8f2f29" strokeWidth="16"/><path d="M244 883 C550 642 850 405 1212 297" stroke="#565f58" strokeWidth="4" opacity=".46"/><path d="M244 883 C560 975 890 945 1195 830" stroke="#565f58" strokeWidth="4" opacity=".42"/></g>
      <path d="M1245 482 L1307 502 L1245 522 L1261 502Z" fill="#8f2f29"/>
      <path d="M1442 0V1080" stroke="#65675f" strokeWidth="2"/>
    </svg>
    <Heading left={1500} top={94} width={340}/><Meta x={1503} y={294}>Hypsometric atlas · 100m bands</Meta>
    <RouteLabel x={1502} y={474} selected>Turn the flank</RouteLabel><RouteLabel x={1503} y={655}>Direct assault</RouteLabel><RouteLabel x={1503} y={794}>Wide envelopment</RouteLabel>
  </AbsoluteFill>
);

export const WC10MuseumCartographicMap: React.FC = () => (
  <AbsoluteFill style={{background: '#d9cfbc', overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <defs>
        <pattern id="map-grid" width="160" height="160" patternUnits="userSpaceOnUse"><path d="M160 0H0V160" fill="none" stroke="#5d6966" strokeWidth="1" opacity=".13"/></pattern>
        <pattern id="map-grain" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".55" fill="#30332f" opacity=".07"/></pattern>
        <linearGradient id="map-land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6dcc8"/><stop offset=".56" stopColor="#cec4ae"/><stop offset="1" stopColor="#aaa490"/></linearGradient>
        <linearGradient id="map-relief" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff8e8" stopOpacity=".48"/><stop offset=".5" stopColor="#8f927e" stopOpacity=".16"/><stop offset="1" stopColor="#4f554d" stopOpacity=".28"/></linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="#728b90"/>
      <path d="M0 0 H1678 C1644 82 1685 151 1633 221 C1588 282 1637 356 1585 428 C1540 491 1585 563 1535 626 C1481 695 1533 757 1474 828 C1423 889 1451 978 1385 1080 H0Z" fill="url(#map-land)"/>
      <path d="M1678 0 C1644 82 1685 151 1633 221 C1588 282 1637 356 1585 428 C1540 491 1585 563 1535 626 C1481 695 1533 757 1474 828 C1423 889 1451 978 1385 1080" fill="none" stroke="#475b5f" strokeWidth="5"/>
      <path d="M1720 0 C1691 89 1725 170 1680 235 C1647 284 1688 359 1644 430 M1592 682 C1544 752 1578 824 1532 892 C1498 943 1512 1010 1472 1080" fill="none" stroke="#c2d1cf" strokeWidth="2" opacity=".45"/>
      <path d="M0 0 H1678 C1644 82 1685 151 1633 221 C1588 282 1637 356 1585 428 C1540 491 1585 563 1535 626 C1481 695 1533 757 1474 828 C1423 889 1451 978 1385 1080 H0Z" fill="url(#map-relief)"/>
      <path d="M0 0H1920V1080H0Z" fill="url(#map-grain)"/><path d="M0 0H1920V1080H0Z" fill="url(#map-grid)"/>

      <g fill="none" stroke="#667063" opacity=".42">
        <path d="M392 312 C485 221 676 205 788 294 C893 377 827 470 694 482 C563 494 424 433 379 361Z" strokeWidth="2.6"/>
        <path d="M451 322 C521 260 646 254 720 310 C786 361 745 421 665 429 C583 437 496 400 463 359Z" strokeWidth="1.2"/>
        <path d="M1028 184 C1134 98 1325 132 1400 250 C1471 361 1369 450 1234 430 C1107 411 1004 318 995 241Z" strokeWidth="2.6"/>
        <path d="M1087 207 C1160 155 1281 176 1330 249 C1372 312 1310 367 1229 354 C1150 342 1084 288 1073 241Z" strokeWidth="1.2"/>
        <path d="M936 696 C1045 614 1247 638 1328 762 C1402 876 1295 971 1142 956 C997 942 891 837 897 753Z" strokeWidth="2.6"/>
        <path d="M1000 717 C1073 670 1204 686 1254 762 C1299 831 1231 893 1139 884 C1050 875 987 814 980 763Z" strokeWidth="1.2"/>
      </g>
      <g fill="none" stroke="#536f76" strokeLinecap="round">
        <path d="M735 0 C722 123 772 217 748 329 C724 440 649 501 683 615 C719 735 835 780 812 916 C802 980 768 1025 744 1080" strokeWidth="6"/>
        <path d="M747 331 C864 338 932 391 1000 476" strokeWidth="3"/><path d="M684 615 C571 631 503 680 437 755" strokeWidth="3"/>
        <path d="M1290 0 C1268 113 1303 197 1268 290 C1236 375 1148 443 1168 541 C1185 627 1260 682 1238 787 C1225 848 1191 895 1178 948" strokeWidth="5"/>
        <path d="M1267 289 C1376 307 1450 356 1572 421" strokeWidth="2.8"/><path d="M1169 542 C1085 555 1034 594 984 651" strokeWidth="2.8"/>
      </g>
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d="M263 827 C430 773 589 744 744 687 C917 624 1047 542 1217 519 C1360 499 1463 532 1542 564" stroke="#eee4d1" strokeWidth="13"/><path d="M263 827 C430 773 589 744 744 687 C917 624 1047 542 1217 519 C1360 499 1463 532 1542 564" stroke="#8d806d" strokeWidth="5"/>
        <path d="M263 827 C448 641 631 506 829 400 C1015 300 1212 230 1465 248" stroke="#eee4d1" strokeWidth="11"/><path d="M263 827 C448 641 631 506 829 400 C1015 300 1212 230 1465 248" stroke="#8d806d" strokeWidth="4"/>
        <path d="M263 827 C506 903 749 919 961 881 C1140 849 1287 793 1460 792" stroke="#eee4d1" strokeWidth="11"/><path d="M263 827 C506 903 749 919 961 881 C1140 849 1287 793 1460 792" stroke="#8d806d" strokeWidth="4"/>
      </g>
      <path d="M846 82 C901 174 940 266 1005 349 C1067 429 1139 463 1206 549 C1276 639 1313 715 1378 803" fill="none" stroke="#6d716b" strokeWidth="3" strokeDasharray="14 12" opacity=".7"/>

      <g fill="#4d5550" fontFamily={sans} fontSize="15" letterSpacing="1"><circle cx="263" cy="827" r="7"/><text x="278" y="851">Westfield</text><circle cx="742" cy="688" r="5"/><text x="754" y="710">Fordham</text><circle cx="1218" cy="519" r="5"/><text x="1229" y="501">Eastmere</text><circle cx="1465" cy="248" r="5"/><text x="1478" y="232">High Gate</text><circle cx="1460" cy="792" r="5"/><text x="1473" y="817">Lower Ferry</text></g>
      <g fill="#515a54" fontFamily={sans} fontSize="15" letterSpacing="1.6"><text x="512" y="292">NORTH RIDGE</text><text x="760" y="770">RIVER PLAIN</text><text x="1260" y="465">EASTERN PASS</text><text x="1712" y="612" fill="#d6e1df">GREY SEA</text></g>
      <g fill="none" stroke="#666e68" strokeWidth="2"><path d="M390 989V921"/><path d="M390 921 l-11 22 h22Z" fill="#666e68"/><path d="M110 972H310"/><path d="M110 965V979M210 965V979M310 965V979"/></g>
      <g fill="#59615c" fontFamily={sans} fontSize="13"><text x="365" y="1012">NORTH</text><text x="110" y="1005">0</text><text x="198" y="1005">10</text><text x="293" y="1005">20 KM</text><text x="1590" y="1010">FICTIONAL CARTOGRAPHY · REVIEW ONLY</text></g>

      <g fill="none" strokeLinecap="round"><path d="M263 827 C430 773 589 744 744 687 C917 624 1047 542 1217 519 C1360 499 1463 532 1542 564" stroke="#f2e7d4" strokeWidth="24"/><path d="M263 827 C430 773 589 744 744 687 C917 624 1047 542 1217 519 C1360 499 1463 532 1542 564" stroke="#9c332b" strokeWidth="15"/><path d="M263 827 C448 641 631 506 829 400 C1015 300 1212 230 1465 248" stroke="#596765" strokeWidth="4" opacity=".62"/><path d="M263 827 C506 903 749 919 961 881 C1140 849 1287 793 1460 792" stroke="#596765" strokeWidth="4" strokeDasharray="15 12" opacity=".6"/></g>
      <path d="M1539 548 L1604 564 L1539 580 L1555 564Z" fill="#9c332b"/>
    </svg>
    <Heading left={90} top={62} width={590}/><Meta x={94} y={207}>Museum cartographic study · illustrative geography</Meta>
    <RouteLabel x={1618} y={536} selected>Turn the flank</RouteLabel><RouteLabel x={1460} y={150}>Direct assault</RouteLabel><RouteLabel x={1491} y={764}>Wide envelopment</RouteLabel>
  </AbsoluteFill>
);
