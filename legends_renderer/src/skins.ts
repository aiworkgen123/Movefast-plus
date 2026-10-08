export type MotionCurve = 'out-cubic' | 'in-out-cubic' | readonly [number, number, number, number];
export type FontToken = Readonly<{family: string; weight: number; letterSpacing: number}>;
/** Construction Legends edits: colours and fonts only. Geometry and timing are fixed in each component. */
export type StageLook = Readonly<{
  sans: FontToken; heavy: FontToken; display: FontToken; impact: FontToken; italic: FontToken; condensed: FontToken; news: FontToken; script: FontToken; quote: FontToken; measure: FontToken;
  bowed: Readonly<{background: string; line: string}>;
  navy: Readonly<{background: string; line: string}>;
  faint: Readonly<{background: string; line: string}>;
  text: string; onMedia: string; title: string; caption: string; shadow: string;
  accent: string; outline: string; disc: string; leader: string;
  burn: readonly [string, string, string]; scratch: string; gradeRed: string; washRed: string; yellow: string; blue: string; red: string; redDisc: string; stageDark: string; stageBlack: string; gridLine: string; paperWhite: string; paperText: string; onMediaRgb: string; chip: string; chipText: string; cyan: string; dotCyan: string; newsText: string; newsSource: string; violet: string; scriptInk: string; pill: string; quoteText: string; quoteBlue: string; quoteMuted: string; stageNavy: string; tagWhite: string; redLine: string; chipDark: string; labelInk: string; measureGreen: string; radarFill: string; tapeWhite: string; tapeInk: string; mapRed: string;
  map: Readonly<{worldSea: string; worldLand: string; worldBorder: string; atlasSea: string; atlasLand: string; atlasBorder: string;
    red: string; blue: string; fill: string; caption: string; tag: string; tagInk: string; route: string}>;
  chart: Readonly<{bgInner: string; bgOuter: string; flat: string; night: string; ink: string; soft: string; axis: string; grid: string; bar: string; highlight: string; point: string; slices: readonly string[];
    dark: string; darkGrid: string; wire: string; glowBlue: string; glowViolet: string; tag: string; tagInk: string}>;
}>;
export type Skin = Readonly<{
  id: 'documentary' | 'war-chess';
  stage: StageLook;
  fonts: Readonly<{title: FontToken; label: FontToken; body: FontToken}>;
  palette: Readonly<{paper:string; paperInk:string; screen:string; shadow:string; softShadow:string; crtVignette:string; crtScanRgb:string; background: string; hardware: string; hardwareText: string; board: string; chalk: string; wood: string; text: string; muted: string; accent: string; secondary: string; warn: string; good: string}>;
  grade: Readonly<{contrast: number; saturation: number; gamma: number; brightness: number; sepia: number}>;
  overlays: readonly Readonly<{kind: 'film-dust'; asset: string; scope: 'archive' | 'all'; opacity: number; blend: 'screen' | 'multiply'}>[];
  surface: Readonly<{paperAsset:string; paperOpacity:number; paperBlend:'soft-light'|'multiply'; accentWidth:number; accentInset:number; accentLength:number; dustTravel:number}>;
  label: Readonly<{
    style: 'boxed'|'cut-corner'; cornerSize:number; background: string; accentWidth: number; padding: readonly [number, number];
    lowerThird: Readonly<{nameFont: 'title' | 'label' | 'body'; roleFont: 'title' | 'label' | 'body'; nameSize: number; roleSize: number; roleGap: number; maxWidth: number; inset: number; bottom: number; slideDistance: number}>;
  }>;
  motion: Readonly<{entrance: MotionCurve; camera: MotionCurve; entranceSeconds: number; exitSeconds: number; roleDelaySeconds: number; roleEntranceSeconds: number}>;
  statistic: Readonly<{valueSize: number; labelSize: number; sourceSize: number; inset: number; gap: number; countStartSeconds: number; countEndFraction: number}>;
  date: Readonly<{titleSize: number; contextSize: number; inset: number; gap: number; riseDistance: number}>;
  emphasis: Readonly<{fontSize: number; maxWidth: number; inset: number; bottom: number; riseDistance: number}>;
  photoSpotlight: Readonly<{startZoom: number; endZoom: number; vignetteOpacity: number; radiusXFraction: number; radiusYFraction: number; clearFraction: number; dimEndFraction: number; inset: number; creditTopFraction: number; creditSize: number; creditPadding: number}>;
  headlineArticle: Readonly<{inset: number; pageTopFraction: number; pageHeightFraction: number; creditTopFraction: number; creditSize: number; creditPadding: number; contextPadding: number; maxZoom: number; focusStartFraction: number; focusEndFraction: number; markerStartFraction: number; markerEndFraction: number; markerOpacity: number}>;
  documentReveal: Readonly<{titleSize: number; labelSize: number; inset: number; borderWidth: number; contextPadding: number; maxZoom: number; titleTopFraction: number; mediaTopFraction: number; mediaHeightFraction: number; labelTopFraction: number; overviewWidthFraction: number; detailLeftFraction: number; focusStartFraction: number; focusEndFraction: number; detailStartFraction: number}>;
  chapterCard: Readonly<{numberSize: number; titleSize: number; subtitleSize: number; inset: number; numberWidth: number; gap: number; subtitleGap: number; slideDistance: number; riseDistance: number; numberEndFraction: number; titleStartFraction: number; titleEndFraction: number; subtitleStartFraction: number; subtitleEndFraction: number}>;
  quote: Readonly<{fontSize: number; attributionSize: number; contextSize: number; maxWidth: number; inset: number; gap: number; riseDistance: number; wordStartFraction: number; wordSpanFraction: number; wordRevealFraction: number; attributionStartFraction: number; contextStartFraction: number}>;
  comparison: Readonly<{titleSize: number; nameSize: number; valueSize: number; descriptionSize: number; versusSize: number; inset: number; padding: number; centerWidth: number; gap: number; borderWidth: number; slideDistance: number; versusDelaySeconds: number}>;
  timeline: Readonly<{titleSize: number; dateSize: number; labelSize: number; inset: number; gap: number; lineWidth: number; nodeSize: number; riseDistance: number; startFraction: number; revealFraction: number}>;
  map: Readonly<{inset:number; top:number; height:number; titleSize:number; border:number; routeWidth:number; arrowSize:number; landOpacity:number; start:number; end:number; stagger:number}>;
  matchCut: Readonly<{eyeTop:number; eyeDistance:number; sequenceEnd:number; inset:number; padding:number; titleSize:number}>;
  contactStrip: Readonly<{numberFont:'title'|'label'|'body'; numberSize:number; numberTop:number; perforationHeight:number; perforationWidth:number; perforationPitch:number; mediaReserve:number; inset:number; titleSize:number; border:number; gap:number; tilt:number; travel:number; start:number; end:number; stagger:number}>;
  objectFlyIn: Readonly<{inset:number; titleSize:number; width:number; height:number; travel:number; rotation:number; startScale:number; shadow:number; start:number; settle:number}>;
  chart: Readonly<{lineWidth:number; dotRadius:number; textInset:number; inset:number; axisWidth:number; titleSize:number; labelSize:number; tickSize:number; valueSize:number; plotTop:number; plotBottom:number; baselineWidth:number; barInset:number; start:number; end:number; stagger:number}>;
  scorecard: Readonly<{inset:number; titleSize:number; labelSize:number; valueSize:number; gap:number; padding:number; border:number; travel:number; start:number; stagger:number; reveal:number}>;
  checklist: Readonly<{inset:number; titleSize:number; itemSize:number; gap:number; rowGap:number; box:number; border:number; checkWidth:number; travel:number; start:number; stagger:number; reveal:number; checkDelay:number}>;
  questionPivot: Readonly<{inset:number; questionSize:number; pivotSize:number; travel:number; start:number; end:number}>;
  socialPost: Readonly<{width:number; padding:number; border:number; radius:number; gap:number; avatar:number; authorSize:number; copySize:number; metricSize:number; travel:number; cardEnd:number; copyStart:number; copyEnd:number; metricsStart:number; metricsEnd:number}>;
  stamp: Readonly<{fontSize:number; tracking:number; padding:number; border:number; innerBorder:number; outlineInset:number; startScale:number; angle:number; twist:number; impactSeconds:number}>;
  newsTicker: Readonly<{bottom:number; height:number; labelWidth:number; padding:number; gap:number; border:number; labelSize:number; textSize:number}>;
  frameBlurFill: Readonly<{inset:number; top:number; height:number; padding:number; angle:number; travelAngle:number; travel:number; settle:number; labelSize:number; border:number; shadow:number; radius:number; blur:number; fillOpacity:number; bottom:number; bandHeight:number; scanOpacity:number}>;
  frameTiltedPrint: Readonly<{inset:number; top:number; height:number; padding:number; angle:number; travelAngle:number; travel:number; settle:number; labelSize:number; border:number; shadow:number; radius:number; blur:number; fillOpacity:number; bottom:number; bandHeight:number; scanOpacity:number}>;
  framePaper: Readonly<{inset:number; top:number; height:number; padding:number; angle:number; travelAngle:number; travel:number; settle:number; labelSize:number; border:number; shadow:number; radius:number; blur:number; fillOpacity:number; bottom:number; bandHeight:number; scanOpacity:number}>;
  frameMonitor: Readonly<{inset:number; top:number; height:number; padding:number; angle:number; travelAngle:number; travel:number; settle:number; labelSize:number; border:number; shadow:number; radius:number; blur:number; fillOpacity:number; bottom:number; bandHeight:number; scanOpacity:number}>;
  frameCrt: Readonly<{inset:number; top:number; height:number; padding:number; angle:number; travelAngle:number; travel:number; settle:number; labelSize:number; border:number; shadow:number; radius:number; blur:number; fillOpacity:number; bottom:number; bandHeight:number; scanOpacity:number}>;
  frameNewsBand: Readonly<{inset:number; top:number; height:number; padding:number; angle:number; travelAngle:number; travel:number; settle:number; labelSize:number; border:number; shadow:number; radius:number; blur:number; fillOpacity:number; bottom:number; bandHeight:number; scanOpacity:number}>;
  frameVideoPlayer: Readonly<{inset:number; top:number; height:number; padding:number; angle:number; travelAngle:number; travel:number; settle:number; labelSize:number; border:number; shadow:number; radius:number; blur:number; fillOpacity:number; bottom:number; bandHeight:number; scanOpacity:number}>;
  frameChalkboard: Readonly<{inset:number; top:number; height:number; padding:number; angle:number; travelAngle:number; travel:number; settle:number; labelSize:number; border:number; shadow:number; radius:number; blur:number; fillOpacity:number; bottom:number; bandHeight:number; scanOpacity:number}>;
  highlight: Readonly<{font: 'title' | 'label' | 'body'; fontSize: number; maxWidth: number; inset: number; riseDistance: number; markerOpacity: number; markerStartSeconds: number; markerDurationSeconds: number}>;
}>;

export const documentary: Skin = {
  id: 'documentary',
  fonts: {
    title: {family: "'Template EB Garamond', Georgia, serif", weight: 500, letterSpacing: -1},
    label: {family: "'Template Roboto Condensed', sans-serif", weight: 600, letterSpacing: 2},
    body: {family: "'Template Roboto Condensed', sans-serif", weight: 400, letterSpacing: 0.7},
  },
  palette: {paper:'#efe9d9',paperInk:'#29251f',screen:'#000000',shadow:'rgba(0,0,0,.5)',softShadow:'rgba(0,0,0,.4)',crtVignette:'rgba(0,0,0,.6)',crtScanRgb:'0,0,0',hardware:'#24262a',hardwareText:'#f2eee5',board:'#1a3029',chalk:'#eee8d4',wood:'#765a3d',background: '#0D0C0A', text: '#F3EEE4', muted: '#9DB1BA', accent: '#E3B25B', secondary: '#9DB1BA', warn: '#C4553F', good: '#7FA58F'},
  grade: {contrast: 1.04, saturation: 0.94, gamma: 0.99, brightness: 1, sepia: 0},
  overlays: [{kind: 'film-dust', asset:'textures/film-dust-light.svg', scope: 'archive', opacity: 0.08, blend: 'screen'}],
  surface: {paperAsset:'textures/paper-grain.svg',paperOpacity:0.1,paperBlend:'soft-light',accentWidth:0,accentInset:44,accentLength:140,dustTravel:18},
  label: {style: 'boxed', cornerSize:0, background: 'rgba(13,12,10,.88)', accentWidth: 0, padding: [24, 32],
    lowerThird: {nameFont: 'label', roleFont: 'title', nameSize: 64, roleSize: 42, roleGap: 16, maxWidth: 1100, inset: 120, bottom: 100, slideDistance: 24}},
  motion: {entrance: 'out-cubic', camera: 'in-out-cubic', entranceSeconds: 0.7, exitSeconds: 0.5, roleDelaySeconds: 0.25, roleEntranceSeconds: 0.4},
  statistic: {valueSize: 250, labelSize: 52, sourceSize: 28, inset: 132, gap: 26, countStartSeconds: 0.3, countEndFraction: 0.6},
  date: {titleSize: 236, contextSize: 42, inset: 132, gap: 30, riseDistance: 16},
  emphasis: {fontSize: 124, maxWidth: 1440, inset: 138, bottom: 150, riseDistance: 30},
  photoSpotlight: {startZoom: 1.03, endZoom: 1.16, vignetteOpacity: 0.22, radiusXFraction: 0.64, radiusYFraction: 0.7, clearFraction: 0.35, dimEndFraction: 0.4, inset: 132, creditTopFraction: 0.85, creditSize: 32, creditPadding: 16},
  headlineArticle: {inset: 132, pageTopFraction: 0.07, pageHeightFraction: 0.74, creditTopFraction: 0.86, creditSize: 32, creditPadding: 16, contextPadding: 0.08, maxZoom: 4, focusStartFraction: 0.18, focusEndFraction: 0.48, markerStartFraction: 0.5, markerEndFraction: 0.67, markerOpacity: 0.28},
  documentReveal: {titleSize: 64, labelSize: 32, inset: 132, borderWidth: 2, contextPadding: 0.12, maxZoom: 4, titleTopFraction: 0.08, mediaTopFraction: 0.25, mediaHeightFraction: 0.55, labelTopFraction: 0.85, overviewWidthFraction: 0.29, detailLeftFraction: 0.43, focusStartFraction: 0.25, focusEndFraction: 0.6, detailStartFraction: 0.3},
  chapterCard: {numberSize: 260, titleSize: 112, subtitleSize: 40, inset: 150, numberWidth: 340, gap: 80, subtitleGap: 24, slideDistance: 64, riseDistance: 20, numberEndFraction: 0.2, titleStartFraction: 0.16, titleEndFraction: 0.4, subtitleStartFraction: 0.42, subtitleEndFraction: 0.56},
  quote: {fontSize: 112, attributionSize: 38, contextSize: 30, maxWidth: 1440, inset: 150, gap: 32, riseDistance: 16, wordStartFraction: 0.08, wordSpanFraction: 0.25, wordRevealFraction: 0.06, attributionStartFraction: 0.43, contextStartFraction: 0.52},
  comparison: {titleSize: 74, nameSize: 64, valueSize: 120, descriptionSize: 34, versusSize: 42, inset: 132, padding: 42, centerWidth: 170, gap: 28, borderWidth: 3, slideDistance: 80, versusDelaySeconds: 0.25},
  timeline: {titleSize: 76, dateSize: 38, labelSize: 34, inset: 132, gap: 20, lineWidth: 3, nodeSize: 18, riseDistance: 18, startFraction: 0.12, revealFraction: 0.43},
  map: {inset:150,top:0.26,height:0.62,titleSize:76,border:3,routeWidth:8,arrowSize:30,landOpacity:0.18,start:0.05,end:0.68,stagger:0.04},
  matchCut: {eyeTop:0.38,eyeDistance:210,sequenceEnd:0.9,inset:110,padding:28,titleSize:64},
  contactStrip: {numberFont:'label',numberSize:20,numberTop:8,perforationHeight:12,perforationWidth:14,perforationPitch:28,mediaReserve:44,inset:130,titleSize:76,border:20,gap:30,tilt:8,travel:80,start:0.05,end:0.28,stagger:0.1},
  objectFlyIn: {inset:132,titleSize:76,width:0.55,height:0.62,travel:-1200,rotation:-24,startScale:0.75,shadow:20,start:0.04,settle:0.5},
  chart: {lineWidth:6,dotRadius:9,textInset:16,inset:140,axisWidth:130,titleSize:76,labelSize:34,tickSize:28,valueSize:36,plotTop:290,plotBottom:830,baselineWidth:3,barInset:0.2,start:0.08,end:0.5,stagger:0.025},
  scorecard: {inset:140,titleSize:76,labelSize:44,valueSize:48,gap:44,padding:26,border:2,travel:42,start:0.08,stagger:0.12,reveal:0.12},
  checklist: {inset:150,titleSize:76,itemSize:48,gap:40,rowGap:36,box:68,border:3,checkWidth:6,travel:24,start:0.05,stagger:0.12,reveal:0.09,checkDelay:0.08},
  questionPivot: {inset:200,questionSize:116,pivotSize:132,travel:40,start:0.33,end:0.58},
  socialPost: {width:1320,padding:60,border:2,radius:22,gap:36,avatar:86,authorSize:42,copySize:56,metricSize:30,travel:70,cardEnd:0.2,copyStart:0.2,copyEnd:0.4,metricsStart:0.4,metricsEnd:0.6},
  stamp: {fontSize:124,tracking:6,padding:56,border:8,innerBorder:2,outlineInset:16,startScale:1.4,angle:-8,twist:12,impactSeconds:0.5},
  newsTicker: {bottom:80,height:140,labelWidth:320,padding:26,gap:50,border:3,labelSize:36,textSize:48},
  frameBlurFill: {inset:120,top:0.08,height:0.78,padding:30,angle:0,travelAngle:3,travel:30,settle:0.35,labelSize:38,border:5,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameTiltedPrint: {inset:300,top:0.12,height:0.74,padding:42,angle:-4,travelAngle:3,travel:30,settle:0.35,labelSize:38,border:5,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  framePaper: {inset:290,top:0.08,height:0.86,padding:52,angle:0,travelAngle:3,travel:30,settle:0.35,labelSize:38,border:5,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameMonitor: {inset:200,top:0.1,height:0.64,padding:36,angle:0,travelAngle:3,travel:30,settle:0.35,labelSize:38,border:5,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameCrt: {inset:350,top:0.09,height:0.82,padding:64,angle:0,travelAngle:3,travel:30,settle:0.35,labelSize:30,border:5,shadow:24,radius:80,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0.2},
  frameNewsBand: {inset:100,top:0.08,height:0.86,padding:24,angle:0,travelAngle:3,travel:30,settle:0.35,labelSize:38,border:5,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameVideoPlayer: {inset:190,top:0.08,height:0.8,padding:24,angle:0,travelAngle:3,travel:30,settle:0.35,labelSize:38,border:5,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameChalkboard: {inset:150,top:0.08,height:0.83,padding:52,angle:0,travelAngle:3,travel:30,settle:0.35,labelSize:38,border:5,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  highlight: {font: 'title', fontSize: 96, maxWidth: 1440, inset: 138, riseDistance: 24, markerOpacity: 0.35, markerStartSeconds: 1, markerDurationSeconds: 0.48},
  stage: {
    // Owner rule (3 Oct): Documentary is 1:1 with the Construction Legends reference.
    sans: {family: "'Template Open Sans', sans-serif", weight: 400, letterSpacing: 0},
    heavy: {family: "'Template Montserrat', sans-serif", weight: 800, letterSpacing: 0},
    display: {family: "'Template Poppins', sans-serif", weight: 700, letterSpacing: 0},
    impact: {family: "'Template Space Grotesk', sans-serif", weight: 700, letterSpacing: 0},
    italic: {family: "'Template Noto Serif', Georgia, serif", weight: 500, letterSpacing: 0},
    condensed: {family: "'Template Anton', sans-serif", weight: 400, letterSpacing: 0},
    news: {family: "'Template Inter', sans-serif", weight: 600, letterSpacing: 0},
    script: {family: "'Template Lobster', cursive", weight: 400, letterSpacing: 0},
    quote: {family: "'Template Noto Sans', sans-serif", weight: 400, letterSpacing: 0},
    measure: {family: "'Template Saira', sans-serif", weight: 600, letterSpacing: 0},
    bowed: {background: '#000000', line: '#6C6C6C'}, navy: {background: '#0B131C', line: '#262A36'}, faint: {background: '#000000', line: '#171717'},
    text: '#FBFBFB', onMedia: '#FFFFFF', title: '#CED1D4', caption: '#B2BAC1', shadow: 'rgba(0,0,0,.55)',
    accent: '#77A2FE', outline: '#FDFDFD', disc: '#2F2F2F', leader: '#F1F1F1',
    burn: ['#F7E08A', '#EC7A2C', '#D2DC86'], scratch: '#C0392B', gradeRed: '#DC1917', washRed: '#FF0000', yellow: '#FDD600', blue: '#0592D0', red: '#F90234', redDisc: '#B80628', stageDark: '#101010', stageBlack: '#000000', gridLine: '#2A2A2A', paperWhite: '#E8EFF5', paperText: '#080B0E', onMediaRgb: '255,255,255', chip: '#111111', chipText: '#FDFDFD', cyan: '#00FFFF', dotCyan: '#0CDBEE', newsText: '#F5F5F3', newsSource: '#CAC9C6', violet: '#625BD1', scriptInk: '#1C1B26', pill: '#15171C', quoteText: '#D3D7DA', quoteBlue: '#3CAFDF', quoteMuted: '#9CA1A7', stageNavy: '#0E1317', tagWhite: '#FFFFFF', redLine: '#DF0E39', chipDark: '#101010', labelInk: '#FFF6F5', measureGreen: '#23AD60', radarFill: '#1A1A1A', tapeWhite: '#F2F2F2', tapeInk: '#0A0A0A', mapRed: '#C40630',
    map: {worldSea: '#A0A9AE', worldLand: '#DDDDDD', worldBorder: '#D2D2D2', atlasSea: '#90A6A4', atlasLand: '#D4D4D4', atlasBorder: '#8F8F8F',
      red: '#CE555E', blue: '#6E95D0', fill: '#C36A6A', caption: '#333435', tag: 'rgba(16,18,17,0.9)', tagInk: '#F2F2F2', route: '#D50648'},
    chart: {bgInner: '#1E293B', bgOuter: '#171F2A', flat: '#1F282F', night: '#0C1117', ink: '#EFF6FF', soft: '#E5ECF2', axis: '#DBEAFE', grid: '#475569', bar: '#38BDF8', highlight: '#FBBF24', point: '#EAC236',
      slices: ['#FD0130', '#4072AD', '#FB5384', '#FBBF24', '#38BDF8'],
      dark: '#060606', darkGrid: '#151515', wire: '#A9A4C6', glowBlue: '#529DF6', glowViolet: '#773EE7', tag: '#FFFFFF', tagInk: '#080B0E'},
  },
};

export const warChess: Skin = {
  id: 'war-chess',
  fonts: {
    title: {family: "Georgia, 'Times New Roman', serif", weight: 700, letterSpacing: -1.2},
    label: {family: "'Arial Narrow', Arial, sans-serif", weight: 700, letterSpacing: 4},
    body: {family: "'Arial Narrow', Arial, sans-serif", weight: 500, letterSpacing: 0.7},
  },
  palette: {paper:'#efe9d9',paperInk:'#29251f',screen:'#000000',shadow:'rgba(38,26,12,.45)',softShadow:'rgba(38,26,12,.34)',crtVignette:'rgba(18,12,8,.65)',crtScanRgb:'24,17,11',hardware:'#24262a',hardwareText:'#f2eee5',board:'#1a3029',chalk:'#eee8d4',wood:'#765a3d',background: '#e8dbc2', text: '#242019', muted: '#6d6253', accent: '#8e641f', secondary: '#846d47', warn: '#9e3d30', good: '#536c5f'},
  grade: {contrast: 1.04, saturation: 0.82, gamma: 1, brightness: 0.88, sepia: 0.12},
  overlays: [{kind: 'film-dust', asset:'textures/film-dust-ink.svg', scope: 'all', opacity: 0.22, blend: 'multiply'}],
  surface: {paperAsset:'textures/paper-grain.svg',paperOpacity:0.3,paperBlend:'multiply',accentWidth:8,accentInset:44,accentLength:140,dustTravel:32},
  label: {style: 'cut-corner', cornerSize:28, background: 'rgba(241,228,198,.95)', accentWidth: 6, padding: [24, 32],
    lowerThird: {nameFont: 'title', roleFont: 'label', nameSize: 80, roleSize: 60, roleGap: 16, maxWidth: 1100, inset: 96, bottom: 130, slideDistance: 42}},
  motion: {entrance: [0.16, 1, 0.3, 1], camera: [0.16, 1, 0.3, 1], entranceSeconds: 0.38, exitSeconds: 0.6, roleDelaySeconds: 0.25, roleEntranceSeconds: 0.4},
  statistic: {valueSize: 230, labelSize: 60, sourceSize: 30, inset: 138, gap: 26, countStartSeconds: 0.3, countEndFraction: 0.6},
  date: {titleSize: 220, contextSize: 54, inset: 138, gap: 30, riseDistance: 24},
  emphasis: {fontSize: 112, maxWidth: 1440, inset: 138, bottom: 150, riseDistance: 22},
  photoSpotlight: {startZoom: 1.03, endZoom: 1.18, vignetteOpacity: 0.28, radiusXFraction: 0.64, radiusYFraction: 0.7, clearFraction: 0.35, dimEndFraction: 0.4, inset: 138, creditTopFraction: 0.85, creditSize: 32, creditPadding: 16},
  headlineArticle: {inset: 138, pageTopFraction: 0.07, pageHeightFraction: 0.74, creditTopFraction: 0.86, creditSize: 32, creditPadding: 16, contextPadding: 0.1, maxZoom: 4, focusStartFraction: 0.18, focusEndFraction: 0.48, markerStartFraction: 0.5, markerEndFraction: 0.67, markerOpacity: 0.3},
  documentReveal: {titleSize: 62, labelSize: 32, inset: 138, borderWidth: 3, contextPadding: 0.16, maxZoom: 4, titleTopFraction: 0.08, mediaTopFraction: 0.25, mediaHeightFraction: 0.55, labelTopFraction: 0.85, overviewWidthFraction: 0.29, detailLeftFraction: 0.43, focusStartFraction: 0.25, focusEndFraction: 0.6, detailStartFraction: 0.3},
  chapterCard: {numberSize: 250, titleSize: 104, subtitleSize: 42, inset: 150, numberWidth: 340, gap: 80, subtitleGap: 24, slideDistance: 80, riseDistance: 24, numberEndFraction: 0.2, titleStartFraction: 0.16, titleEndFraction: 0.4, subtitleStartFraction: 0.42, subtitleEndFraction: 0.56},
  quote: {fontSize: 104, attributionSize: 40, contextSize: 32, maxWidth: 1440, inset: 150, gap: 32, riseDistance: 20, wordStartFraction: 0.08, wordSpanFraction: 0.25, wordRevealFraction: 0.06, attributionStartFraction: 0.43, contextStartFraction: 0.52},
  comparison: {titleSize: 70, nameSize: 62, valueSize: 112, descriptionSize: 34, versusSize: 44, inset: 138, padding: 42, centerWidth: 170, gap: 28, borderWidth: 5, slideDistance: 96, versusDelaySeconds: 0.25},
  timeline: {titleSize: 72, dateSize: 36, labelSize: 34, inset: 138, gap: 20, lineWidth: 5, nodeSize: 22, riseDistance: 24, startFraction: 0.12, revealFraction: 0.43},
  map: {inset:150,top:0.26,height:0.62,titleSize:76,border:5,routeWidth:12,arrowSize:40,landOpacity:0.3,start:0.05,end:0.68,stagger:0.04},
  matchCut: {eyeTop:0.38,eyeDistance:225,sequenceEnd:0.9,inset:110,padding:28,titleSize:64},
  contactStrip: {numberFont:'label',numberSize:20,numberTop:8,perforationHeight:12,perforationWidth:14,perforationPitch:28,mediaReserve:44,inset:130,titleSize:76,border:26,gap:36,tilt:12,travel:100,start:0.05,end:0.28,stagger:0.1},
  objectFlyIn: {inset:132,titleSize:76,width:0.55,height:0.62,travel:-1400,rotation:-36,startScale:0.65,shadow:28,start:0.04,settle:0.5},
  chart: {lineWidth:6,dotRadius:9,textInset:16,inset:140,axisWidth:130,titleSize:76,labelSize:34,tickSize:28,valueSize:40,plotTop:290,plotBottom:830,baselineWidth:5,barInset:0.17,start:0.08,end:0.5,stagger:0.025},
  scorecard: {inset:140,titleSize:76,labelSize:44,valueSize:52,gap:44,padding:26,border:4,travel:60,start:0.08,stagger:0.12,reveal:0.12},
  checklist: {inset:150,titleSize:76,itemSize:48,gap:40,rowGap:36,box:68,border:5,checkWidth:8,travel:32,start:0.05,stagger:0.12,reveal:0.09,checkDelay:0.08},
  questionPivot: {inset:200,questionSize:108,pivotSize:124,travel:56,start:0.33,end:0.58},
  socialPost: {width:1320,padding:60,border:4,radius:4,gap:36,avatar:86,authorSize:46,copySize:56,metricSize:30,travel:90,cardEnd:0.2,copyStart:0.2,copyEnd:0.4,metricsStart:0.4,metricsEnd:0.6},
  stamp: {fontSize:136,tracking:8,padding:56,border:12,innerBorder:3,outlineInset:20,startScale:1.65,angle:-12,twist:18,impactSeconds:0.4},
  newsTicker: {bottom:80,height:140,labelWidth:320,padding:26,gap:50,border:6,labelSize:36,textSize:48},
  frameBlurFill: {inset:120,top:0.08,height:0.78,padding:30,angle:0,travelAngle:5,travel:50,settle:0.35,labelSize:38,border:8,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameTiltedPrint: {inset:300,top:0.12,height:0.74,padding:42,angle:-4,travelAngle:5,travel:50,settle:0.35,labelSize:38,border:8,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  framePaper: {inset:290,top:0.08,height:0.86,padding:52,angle:0,travelAngle:5,travel:50,settle:0.35,labelSize:38,border:8,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameMonitor: {inset:200,top:0.1,height:0.64,padding:36,angle:0,travelAngle:5,travel:50,settle:0.35,labelSize:38,border:8,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameCrt: {inset:350,top:0.09,height:0.82,padding:64,angle:0,travelAngle:5,travel:50,settle:0.35,labelSize:30,border:8,shadow:24,radius:80,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0.2},
  frameNewsBand: {inset:100,top:0.08,height:0.86,padding:24,angle:0,travelAngle:5,travel:50,settle:0.35,labelSize:38,border:8,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameVideoPlayer: {inset:190,top:0.08,height:0.8,padding:24,angle:0,travelAngle:5,travel:50,settle:0.35,labelSize:38,border:8,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  frameChalkboard: {inset:150,top:0.08,height:0.83,padding:52,angle:0,travelAngle:5,travel:50,settle:0.35,labelSize:38,border:8,shadow:24,radius:12,blur:32,fillOpacity:0.5,bottom:50,bandHeight:160,scanOpacity:0},
  highlight: {font: 'label', fontSize: 92, maxWidth: 1440, inset: 138, riseDistance: 22, markerOpacity: 0.65, markerStartSeconds: 1, markerDurationSeconds: 0.48},
  stage: {
    sans: {family: "Georgia, 'Times New Roman', serif", weight: 400, letterSpacing: 0},
    heavy: {family: "'Arial Narrow', Arial, sans-serif", weight: 700, letterSpacing: 2},
    display: {family: "'Arial Narrow', Arial, sans-serif", weight: 700, letterSpacing: 2},
    impact: {family: "'Arial Narrow', Arial, sans-serif", weight: 700, letterSpacing: 0},
    italic: {family: "Georgia, 'Times New Roman', serif", weight: 400, letterSpacing: 0},
    condensed: {family: "'Arial Narrow', Arial, sans-serif", weight: 700, letterSpacing: 0},
    news: {family: "Georgia, 'Times New Roman', serif", weight: 600, letterSpacing: 0},
    script: {family: "Georgia, 'Times New Roman', serif", weight: 700, letterSpacing: 0},
    quote: {family: "Georgia, 'Times New Roman', serif", weight: 400, letterSpacing: 0},
    measure: {family: "'Arial Narrow', Arial, sans-serif", weight: 700, letterSpacing: 0},
    bowed: {background: '#e8dbc2', line: '#9c8a6c'}, navy: {background: '#e2d3b6', line: '#b9a582'}, faint: {background: '#e8dbc2', line: '#d3c3a5'},
    text: '#242019', onMedia: '#F4EAD5', title: '#3a3226', caption: '#6d6253', shadow: 'rgba(232,219,194,.7)',
    accent: '#9e3d30', outline: '#242019', disc: '#d6c6a6', leader: '#242019',
    burn: ['#F2CF7E', '#D9792E', '#C7C47A'], scratch: '#9e3d30', gradeRed: '#9E3D30', washRed: '#B0412F', yellow: '#C9962E', blue: '#5A7A8C', red: '#9E3D30', redDisc: '#B0412F', stageDark: '#E8DBC2', stageBlack: '#E8DBC2', gridLine: '#C9B896', paperWhite: '#F4EAD5', paperText: '#242019', onMediaRgb: '244,234,213', chip: '#2B241B', chipText: '#F4EAD5', cyan: '#C9962E', dotCyan: '#C9962E', newsText: '#F4EAD5', newsSource: '#D6C6A6', violet: '#8F769E', scriptInk: '#F4EAD5', pill: '#2B241B', quoteText: '#3A3226', quoteBlue: '#846D47', quoteMuted: '#6D6253', stageNavy: '#E8DBC2', tagWhite: '#F4EAD5', redLine: '#9E3D30', chipDark: '#2B241B', labelInk: '#F4EAD5', measureGreen: '#536C5F', radarFill: '#DDCBA9', tapeWhite: '#F4EAD5', tapeInk: '#242019', mapRed: '#9E3D30',
    map: {worldSea: '#CDBB98', worldLand: '#EFE5D0', worldBorder: '#D2C3A5', atlasSea: '#CDBB98', atlasLand: '#EFE5D0', atlasBorder: '#9C8A6C',
      red: '#9E3D30', blue: '#5A7A8C', fill: '#B0412F', caption: '#242019', tag: 'rgba(43,36,27,0.92)', tagInk: '#F4EAD5', route: '#9E3D30'},
    chart: {bgInner: '#E8DBC2', bgOuter: '#D9C7A4', flat: '#E8DBC2', night: '#E8DBC2', ink: '#242019', soft: '#3A3226', axis: '#3A3226', grid: '#B9A582', bar: '#5A7A8C', highlight: '#9E3D30', point: '#9E3D30',
      slices: ['#9E3D30', '#5A7A8C', '#C9962E', '#536C5F', '#8F769E'],
      dark: '#E8DBC2', darkGrid: '#C9B896', wire: '#3A3226', glowBlue: '#5A7A8C', glowViolet: '#8F769E', tag: '#2B241B', tagInk: '#F4EAD5'},
  },
};

export const skins = {documentary, 'war-chess': warChess} as const;

export const activeSkinOverlays=(skin:Skin,archive:boolean)=>skin.overlays.filter(o=>o.scope==='all'||archive);

export const skinLabelClipPath=(skin:Skin,scale=1):string|undefined=>{
 if(skin.label.style==='boxed')return undefined;
 const corner=skin.label.cornerSize*scale;
 return `polygon(0 0, calc(100% - ${corner}px) 0, 100% ${corner}px, 100% 100%, ${corner}px 100%, 0 calc(100% - ${corner}px))`;
};
