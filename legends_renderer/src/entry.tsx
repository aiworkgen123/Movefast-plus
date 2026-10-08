import {footageChalkboard} from './footage-chalkboard.tsx';
import {footageVideoPlayer} from './footage-video-player.tsx';
import {footageNewsBand} from './footage-news-band.tsx';
import {footageCrt} from './footage-crt.tsx';
import {footageMonitor} from './footage-monitor.tsx';
import {footagePaper} from './footage-paper.tsx';
import {footageTiltedPrint} from './footage-tilted-print.tsx';
import {footageBlurFill} from './footage-blur-fill.tsx';
import {newsTicker} from './news-ticker.tsx';
import {stamp} from './stamp.tsx';
import {socialPost} from './social-post.tsx';
import {questionPivot} from './question-pivot.tsx';
import {checklist} from './checklist.tsx';
import {tableScorecard} from './table-scorecard.tsx';
import {chart} from './chart.tsx';
import {objectFlyIn} from './object-fly-in.tsx';
import {contactStrip} from './contact-strip.tsx';
import {matchCut} from './match-cut.tsx';
import {mapWithArrows} from './map-with-arrows.tsx';
import React, {useEffect} from 'react';
import {AbsoluteFill, Composition, registerRoot, useCurrentFrame, useVideoConfig} from 'remotion';
import {foundationProof} from './foundation-proof.tsx';
import {nameLabel} from './name-label.tsx';
import {numberStatistic} from './number-statistic.tsx';
import {yearDate} from './year-date.tsx';
import {emphasis} from './emphasis.tsx';
import {photoSpotlight} from './photo-spotlight.tsx';
import {headlineArticle} from './headline-article.tsx';
import {documentReveal} from './document-reveal.tsx';
import {chapterCard} from './chapter-card.tsx';
import {quote} from './quote.tsx';
import {comparison} from './comparison.tsx';
import {timeline} from './timeline.tsx';
import {wordHighlight} from './word-highlight.tsx';
import {loadDocumentaryFonts} from './fonts.ts';
import {skins, type Skin} from './skins.ts';

const PreviewContent: React.FC<{skinId: Skin['id']; componentId: 'footage-chalkboard' | 'footage-video-player' | 'footage-news-band' | 'footage-crt' | 'footage-monitor' | 'footage-paper' | 'footage-tilted-print' | 'footage-blur-fill' | 'news-ticker' | 'stamp' | 'social-post' | 'question-pivot' | 'checklist' | 'table-scorecard' | 'chart' | 'object-fly-in' | 'contact-strip' | 'match-cut' | 'map-with-arrows' | 'foundation-proof' | 'name-label' | 'number-statistic' | 'year-date' | 'emphasis' | 'word-highlight' | 'timeline' | 'comparison' | 'quote' | 'chapter-card' | 'document-reveal' | 'headline-article' | 'photo-spotlight'}> = ({skinId, componentId}) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  useEffect(() => {if (skinId === 'documentary') void loadDocumentaryFonts();}, [skinId]);
  const context = {frame, fps, width, height, durationInFrames};
  if (componentId === 'map-with-arrows') {
    const Render = mapWithArrows.render;
    return <Render props={{title:'Synthetic route demonstration',map:{kind:'geometry',bounds:{west:0,south:0,east:10,north:10},geometry:{type:'Polygon',coordinates:[[[1,1],[8,1],[9,6],[6,9],[1,7],[1,1]]]}},routes:[[[2,2],[4,4],[7,7]],[[8,2],[6,4],[3,6]]]}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'match-cut') {
    const Render = matchCut.render;
    return <Render props={{"title": "Six manually aligned portraits", "photos": [{"source": {"path": "fixtures/portraits/liam.png", "width": 1672, "height": 940}, "leftEye": {"x": 0.412, "y": 0.327}, "rightEye": {"x": 0.508, "y": 0.332}}, {"source": {"path": "fixtures/portraits/freya.png", "width": 1672, "height": 940}, "leftEye": {"x": 0.432, "y": 0.299}, "rightEye": {"x": 0.537, "y": 0.327}}, {"source": {"path": "fixtures/portraits/ruth.png", "width": 1672, "height": 941}, "leftEye": {"x": 0.466, "y": 0.28}, "rightEye": {"x": 0.545, "y": 0.276}}, {"source": {"path": "fixtures/portraits/javier.png", "width": 1672, "height": 940}, "leftEye": {"x": 0.437, "y": 0.276}, "rightEye": {"x": 0.524, "y": 0.262}}, {"source": {"path": "fixtures/portraits/amara.png", "width": 1672, "height": 941}, "leftEye": {"x": 0.468, "y": 0.299}, "rightEye": {"x": 0.558, "y": 0.271}}, {"source": {"path": "fixtures/portraits/kenji.png", "width": 1672, "height": 941}, "leftEye": {"x": 0.458, "y": 0.313}, "rightEye": {"x": 0.555, "y": 0.341}}]}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'contact-strip') {
    const Render = contactStrip.render;
    return <Render props={{title:'Three supplied contact photographs',photos:[{path:'fixtures/portraits/liam.png',width:1672,height:940},{path:'fixtures/portraits/freya.png',width:1672,height:940},{path:'fixtures/portraits/ruth.png',width:1672,height:941}]}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'object-fly-in') {
    const Render = objectFlyIn.render;
    return <Render props={{title:'Supplied transparent object arrives',source:{path:'fixtures/vintage-key.png',width:729,height:851}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'chart') {
    const Render = chart.render;
    return <Render props={{title:'Supplied values on a zero baseline',unit:'Sample units',values:[{label:'A',value:12},{label:'B',value:-6},{label:'C',value:0},{label:'D',value:18}]}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'table-scorecard') {
    const Render = tableScorecard.render;
    return <Render props={{title:'Five supplied scorecard rows',rows:[{label:'Prototype A',value:'12 units'},{label:'Prototype B',value:'18 units'},{label:'Difference',value:'6 units'},{label:'Duration',value:'4 days'},{label:'Status',value:'Review pending'}]}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'checklist') {
    const Render = checklist.render;
    return <Render props={{title:'Supplied preparation checklist',items:['Inspect source material','Confirm supplied figures','Review visual framing','Check media coverage','Approve final edit']}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'question-pivot') {
    const Render = questionPivot.render;
    return <Render props={{question:'What changes when the source changes?',pivot:'The supplied evidence decides'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'social-post') {
    const Render = socialPost.render;
    return <Render props={{author:'Sample author',copy:'This supplied sample post demonstrates a readable card with caller-provided copy and optional metrics.',metrics:[{value:'12',label:'replies'},{value:'34',label:'reposts'}]}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'stamp') {
    const Render = stamp.render;
    return <Render props={{text:'Review pending'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'news-ticker') {
    const Render = newsTicker.render;
    return <Render props={{label:'Sample bulletin',text:'Caller-supplied ticker copy moves continuously across the band. No live feed or invented headline is attached.',speed:140}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'footage-blur-fill') {
    const Render = footageBlurFill.render;
    return <Render props={{label:'Self-authored moving sample',media:{kind:'clip',path:'fixtures/moving-sample.mp4',width:320,height:180,sourceFps:30,sourceDurationInFrames:180,startFrame:15}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'footage-tilted-print') {
    const Render = footageTiltedPrint.render;
    return <Render props={{label:'Self-authored moving sample',media:{kind:'clip',path:'fixtures/moving-sample.mp4',width:320,height:180,sourceFps:30,sourceDurationInFrames:180,startFrame:15}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'footage-paper') {
    const Render = footagePaper.render;
    return <Render props={{label:'Self-authored moving sample',media:{kind:'clip',path:'fixtures/moving-sample.mp4',width:320,height:180,sourceFps:30,sourceDurationInFrames:180,startFrame:15}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'footage-monitor') {
    const Render = footageMonitor.render;
    return <Render props={{label:'Self-authored moving sample',media:{kind:'clip',path:'fixtures/moving-sample.mp4',width:320,height:180,sourceFps:30,sourceDurationInFrames:180,startFrame:15}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'footage-crt') {
    const Render = footageCrt.render;
    return <Render props={{label:'Self-authored moving sample',media:{kind:'clip',path:'fixtures/moving-sample.mp4',width:320,height:180,sourceFps:30,sourceDurationInFrames:180,startFrame:15}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'footage-news-band') {
    const Render = footageNewsBand.render;
    return <Render props={{label:'Self-authored moving sample',media:{kind:'clip',path:'fixtures/moving-sample.mp4',width:320,height:180,sourceFps:30,sourceDurationInFrames:180,startFrame:15}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'footage-video-player') {
    const Render = footageVideoPlayer.render;
    return <Render props={{label:'Self-authored moving sample',media:{kind:'clip',path:'fixtures/moving-sample.mp4',width:320,height:180,sourceFps:30,sourceDurationInFrames:180,startFrame:15}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'footage-chalkboard') {
    const Render = footageChalkboard.render;
    return <Render props={{label:'Self-authored moving sample',media:{kind:'clip',path:'fixtures/moving-sample.mp4',width:320,height:180,sourceFps:30,sourceDurationInFrames:180,startFrame:15}}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'photo-spotlight') {
    const Render = photoSpotlight.render;
    return <Render props={{source: {path: 'fixtures/photo-style.jpg', width: 572, height: 396}, focus: {x: 0.48, y: 0.62}, sourceCredit: 'Existing Movefast photo test fixture'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'headline-article') {
    const Render = headlineArticle.render;
    return <Render props={{source: {path: 'fixtures/sample-article.svg', width: 1200, height: 1500}, line: {x: 0.08, y: 0.286, width: 0.84, height: 0.06}, sourceCredit: 'Self-authored SAMPLE ARTICLE test fixture'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'document-reveal') {
    const Render = documentReveal.render;
    return <Render props={{source: {path: 'fixtures/sample-document.svg', width: 800, height: 1000}, detail: {x: 0.12, y: 0.4, width: 0.76, height: 0.23}, title: 'Sample document camera demonstration', detailLabel: 'Selected test detail only'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'chapter-card') {
    const Render = chapterCard.render;
    return <Render props={{chapter: 12, title: 'A new chapter begins', subtitle: 'Supplied secondary heading appears afterward'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'quote') {
    const Render = quote.render;
    return <Render props={{quote: 'The  supplied words reveal in their original order', attribution: 'Synthetic preview attribution', context: 'Layout demonstration only'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'comparison') {
    const Render = comparison.render;
    return <Render props={{title: 'Two supplied alternatives', sides: [{name: 'Early prototype', value: '12 units', description: 'Original supplied measurement'}, {name: 'Revised design', value: '24 units', description: 'Later supplied measurement'}]}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'timeline') {
    const Render = timeline.render;
    return <Render props={{title: 'Five supplied milestones', events: [{date: 'May 1', label: 'Initial planning begins'}, {date: 'May 3', label: 'First prototype assembled'}, {date: 'May 8', label: 'Testing reveals changes'}, {date: 'May 12', label: 'Revised design reviewed'}, {date: 'May 20', label: 'Final demonstration completed'}]}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'word-highlight') {
    const Render = wordHighlight.render;
    return <Render props={{text: 'Only this whole word is marked', highlight: 'word'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'emphasis') {
    const Render = emphasis.render;
    return <Render props={{text: 'A short emphasis preview'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'year-date') {
    const Render = yearDate.render;
    return <Render props={{display: 'May 1, 1914', context: 'Synthetic date preview'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'number-statistic') {
    const Render = numberStatistic.render;
    return <Render props={{value: -1234.5, precision: 2, label: 'Preview units', source: 'Synthetic preview fixture'}} skin={skins[skinId]} context={context} />;
  }
  if (componentId === 'name-label') {
    const Render = nameLabel.render;
    return <Render props={{name: 'Name label preview', role: 'Optional role follows', position: 'left'}} skin={skins[skinId]} context={context} />;
  }
  const Render = foundationProof.render;
  return <Render props={{title: 'Foundation skin proof', label: 'B0 preview', archive: true}} skin={skins[skinId]} context={context} />;
};

const Preview:React.FC<React.ComponentProps<typeof PreviewContent>>=(props)=><AbsoluteFill style={{backgroundColor:skins[props.skinId].palette.background}}><PreviewContent {...props}/></AbsoluteFill>;

const Root: React.FC = () => <>{(['footage-chalkboard', 'footage-video-player', 'footage-news-band', 'footage-crt', 'footage-monitor', 'footage-paper', 'footage-tilted-print', 'footage-blur-fill', 'news-ticker', 'stamp', 'social-post', 'question-pivot', 'checklist', 'table-scorecard', 'chart', 'object-fly-in', 'contact-strip', 'match-cut', 'map-with-arrows', 'foundation-proof', 'name-label', 'number-statistic', 'year-date', 'emphasis', 'word-highlight', 'timeline', 'comparison', 'quote', 'chapter-card', 'document-reveal', 'headline-article', 'photo-spotlight'] as const).flatMap((componentId) =>
  Object.keys(skins).map((skinId) => <Composition key={`${componentId}-${skinId}`}
    id={`${componentId}-${skinId}`} component={Preview} defaultProps={{skinId: skinId as Skin['id'], componentId}}
    durationInFrames={120} fps={30} width={1920} height={1080} />))}</>;
registerRoot(Root);
