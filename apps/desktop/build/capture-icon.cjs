// Renders an icon source HTML offscreen and saves it as a 512x512 PNG.
// Usage: electron build/capture-icon.cjs [input.html] [output.png]
//   defaults: icon-src.html -> icon.png
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SIZE = 512
const INPUT = process.argv[2] || 'icon-src.html'
const OUTPUT = process.argv[3] || 'icon.png'
app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  })
  await win.loadFile(join(__dirname, INPUT))
  await new Promise((r) => setTimeout(r, 3000))
  const rect = await win.webContents.executeJavaScript(`(() => {
    const r = document.querySelector('.tile').getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
  })()`)
  const image = await win.webContents.capturePage(rect)
  const resized = image.resize({ width: 512, height: 512 })
  const out = join(__dirname, OUTPUT)
  writeFileSync(out, resized.toPNG())
  const bmp = resized.toBitmap()
  const { width, height } = resized.getSize()
  let solid = 0
  let total = 0
  for (let i = 3; i < bmp.length; i += 4) {
    total++
    if (bmp[i] > 10) solid++
  }
  console.log(`saved ${out} (${width}x${height}) opaque=${(100 * solid / total).toFixed(1)}%`)
  app.quit()
})
