// Correctly decode an ICO-embedded BMP (BITMAPINFOHEADER starts at offset 0 of the entry)
// and report center-band stats so we can tell which artwork version the ICO contains.
const fs = require('fs')
const path = require('node:path')

const ico = fs.readFileSync(path.join(__dirname, 'icon-light.ico'))
const count = ico.readUInt16LE(4)
console.log('entries:', count)
for (let i = 0; i < count; i++) {
  const o = 6 + i * 16
  const size = ico.readUInt32LE(o + 8)
  const off = ico.readUInt32LE(o + 12)
  const d = ico.subarray(off, off + size)
  const isPng = d[0] === 0x89 && d[1] === 0x50
  if (isPng) {
    console.log(`entry ${i}: PNG-encoded, skipping pixel decode`)
    continue
  }
  const biSize = d.readUInt32LE(0)
  const bw = d.readInt32LE(4)
  const bh = d.readInt32LE(8)
  const planes = d.readUInt16LE(12)
  const bpp = d.readUInt16LE(14)
  const comp = d.readUInt32LE(16)
  const dataSize = d.readUInt32LE(20)
  console.log(`entry ${i}: biSize=${biSize} ${bw}x${bh} planes=${planes} bpp=${bpp} compression=${comp} dataSize=${dataSize}`)
  if (bw > 0 && bh > 0 && bpp === 32 && comp === 0) {
    // pixels follow the 40-byte header; bottom-up BGRA rows; then an AND mask
    const rowSize = bw * 4
    const pxStart = biSize
    const maskStart = pxStart + bh * rowSize
    let bright = 0, dark = 0, minty = 0, total = 0
    const step = Math.max(1, Math.floor(bw / 128))
    for (let y = 0; y < bh; y += step) {
      const rowTop = bh - 1 - y
      for (let x = 0; x < bw; x += step) {
        const p = pxStart + rowTop * rowSize + x * 4
        if (p + 3 >= maskStart) continue
        const b = d[p], g = d[p + 1], r = d[p + 2], a = d[p + 3]
        if (a < 40) continue
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        if (lum > 200) bright++
        else if (lum < 90) dark++
        if (g > r + 25 && g > 150) minty++
        total++
      }
    }
    console.log(`  center stats: bright=${(100 * bright / total).toFixed(1)}% dark=${(100 * dark / total).toFixed(1)}% mint=${(100 * minty / total).toFixed(1)}%`)
    console.log('  reference (new art PNG): bright 21.5% dark 54.7% mint 16.7%')
    console.log('  reference (old light art): bright ~low on tile center, dark ~ink letters only')
  }
}
