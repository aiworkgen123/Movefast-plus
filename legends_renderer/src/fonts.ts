import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

let loading: Promise<void> | undefined;
/** Only Documentary needs bundled fonts. Fail visibly instead of silently substituting. */
export const loadDocumentaryFonts = (): Promise<void> => {
  if (loading) return loading;
  const handle = delayRender('Load local Documentary fonts');
  loading = Promise.all([
    new FontFace('Template EB Garamond', `url(${staticFile('fonts/EB-Garamond.ttf')})`, {weight: '400 800'}),
    new FontFace('Template Roboto Condensed', `url(${staticFile('fonts/Roboto-Condensed.ttf')})`, {weight: '100 900'}),
  ].map(async (face) => {document.fonts.add(await face.load());})).then(() => {
    continueRender(handle);
  }).catch((error: Error) => {cancelRender(error); throw error;});
  return loading;
};

let stageLoading: Promise<void> | undefined;
/** Construction Legends reference look: Open Sans, Montserrat, Poppins, Space Grotesk, Noto Serif Italic, Anton, Inter, Lobster, Noto Sans Italic and Saira (all SIL OFL, licences in public/fonts). */
export const loadStageFonts = (): Promise<void> => {
  if (stageLoading) return stageLoading;
  const handle = delayRender('Load local stage fonts');
  stageLoading = Promise.all([
    new FontFace('Template Open Sans', `url(${staticFile('fonts/OpenSans.ttf')})`, {weight: '300 800'}),
    new FontFace('Template Montserrat', `url(${staticFile('fonts/Montserrat.ttf')})`, {weight: '100 900'}),
    new FontFace('Template Poppins', `url(${staticFile('fonts/Poppins-Bold.ttf')})`, {weight: '700'}),
    new FontFace('Template Poppins', `url(${staticFile('fonts/Poppins-ExtraBold.ttf')})`, {weight: '800'}),
    new FontFace('Template Noto Serif', `url(${staticFile('fonts/NotoSerif-Italic.ttf')})`, {weight: '100 900', style: 'italic'}),
    new FontFace('Template Lobster', `url(${staticFile('fonts/Lobster.ttf')})`, {weight: '400'}),
    new FontFace('Template Noto Sans', `url(${staticFile('fonts/NotoSans-Italic.ttf')})`, {weight: '100 900', style: 'italic'}),
    new FontFace('Template Inter', `url(${staticFile('fonts/Inter-Italic.ttf')})`, {weight: '100 900', style: 'italic'}),
    new FontFace('Template Saira', `url(${staticFile('fonts/Saira.ttf')})`, {weight: '100 900', stretch: '50% 125%'}),
    new FontFace('Template Anton', `url(${staticFile('fonts/Anton-Regular.ttf')})`, {weight: '400'}),
    new FontFace('Template Inter', `url(${staticFile('fonts/Inter.ttf')})`, {weight: '100 900'}),
    new FontFace('Template Space Grotesk', `url(${staticFile('fonts/SpaceGrotesk.ttf')})`, {weight: '300 700'}),
  ].map(async (face) => {document.fonts.add(await face.load());})).then(() => {
    continueRender(handle);
  }).catch((error: Error) => {cancelRender(error); throw error;});
  return stageLoading;
};
