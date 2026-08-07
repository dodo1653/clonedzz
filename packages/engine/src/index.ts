export type * from './types.ts' 
export { staticAnalysis } from './staticAnalysis.ts' 
export { renderedAnalysis } from './renderedAnalysis.ts' 
export { extractCanvasFromJs } from './canvasExtract.ts' 
export { buildRecipe } from './autoMap.ts' 
export { generateProject } from './generate.ts' 
export { verifyReplica } from './verify.ts' 
export { buildGatekiller, detectGateFns, buildGatekillerScript, injectGatekiller } from './gatekiller.ts' 

import { staticAnalysis } from './staticAnalysis.ts' 
import { renderedAnalysis } from './renderedAnalysis.ts' 
import { extractCanvasFromJs } from './canvasExtract.ts' 
import { buildRecipe } from './autoMap.ts' 
import type { Recipe } from './types.ts' 
import { fetchText } from './util.ts' 

export async function analyzeUrl(url: string, name?: string): Promise<Recipe> {
  const static_ = await staticAnalysis(url)
  const rendered = await renderedAnalysis(url)

  let canvasAlgo = null
  if (rendered.canvases.some((c) => c.present)) {
    const html = await fetchText(url)
    canvasAlgo = await extractCanvasFromJs(html, url)
  }
  if (canvasAlgo && rendered.canvases[0]) rendered.canvases[0].algorithm = canvasAlgo

  return buildRecipe(static_, rendered, name)
}
