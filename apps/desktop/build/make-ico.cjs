// Generates a proper multi-size ICO (PNG-compressed entries, Vista+ format) from the
// 512x512 source PNG using pure Node (zlib). No external deps, no caching surprises.
// Usage: node build/make-ico.cjs <in.png> <out.ico>
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const [, , inArg, outArg] = process.argv
const input = path.resolve(__dirname, inArg || 'icon-light.png')
const output = path.resolve(__dirname, outArg || 'icon-light.ico')
const SIZES = [256, 128, 64, 48, 32, 16]

// --- decode PNG (RGBA) ---
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let w = 0, h = 0, bitDepth = 0, colorType = 0
  let idat = []
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i)
    const type = buf.toString('ascii', i + 4, i + 8)
    if (type === 'IHDR') {
      w = buf.readUInt32BE(i + 8); h = buf.readUInt32BE(i + 12)
      bitDepth = buf[i + 16]; colorType = buf[i + 17]
    } else if (type === 'IDAT') idat.push(buf.subarray(i + 8, i + 8 + len))
    i += 12 + len
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`unsupported png: depth=${bitDepth} type=${colorType}`)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * 4
  const px = Buffer.alloc(w * h * 4)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    for (let x = 0; x < stride; x++) {
      let a = line[x]
      if (f === 1) a += x >= 4 ? line[x - 4] : 0
      else if (f === 2) a += prev[x]
      else if (f === 3) a += ((x >= 4 ? line[x - 4] : 0) + prev[x]) >> 1
      else if (f === 4) {
        const left = x >= 4 ? line[x - 4] : 0, up = prev[x]
        const ul = x >= 4 ? prev[x - 4] : 0
        const p = left + up - ul
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - ul)
        a += pa <= pb && pa <= pc ? left : pb <= pc ? up : ul
      }
      px[y * w * 4 + x] = a & 255
    }
    prev = line
  }
  return { w, h, px }
}

// --- box-filter downscale (RGBA) ---
function downscale(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const sy0 = Math.floor((y * sh) / dh), sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const sx0 = Math.floor((x * sw) / dw), sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * sw) / dw))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
        const p = (sy * sw + sx) * 4
        r += src[p]; g += src[p + 1]; b += src[p + 2]; a += src[p + 3]; n++
      }
      const o = (y * dw + x) * 4
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(a / n)
    }
  }
  return out
}

// --- encode RGBA -> PNG ---
function encodePng(w, h, px) {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const chunks = []
  const deflate = zlib.deflateSync(raw, { level: 9 })
  chunks.push(chunk('IHDR', ihdr), chunk('IDAT', deflate), chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks])
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0)
  return Buffer.concat([len, t, data, crc])
}
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// --- build ICO ---
const { w, h, px } = decodePng(fs.readFileSync(input))
const images = SIZES.map((s) => {
  const data = s === w ? px : downscale(px, w, h, s, s)
  return { size: s, png: encodePng(s, s, data) }
})

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(images.length, 4)

const entries = []
let offset = 6 + images.length * 16
for (const img of images) {
  const e = Buffer.alloc(16)
  e[0] = img.size >= 256 ? 0 : img.size
  e[1] = img.size >= 256 ? 0 : img.size
  e[2] = 0 // palette
  e[3] = 0 // reserved
  e.writeUInt16LE(1, 4) // planes
  e.writeUInt16LE(32, 6) // bit count
  e.writeUInt32LE(img.png.length, 8)
  e.writeUInt32LE(offset, 12)
  entries.push(e)
  offset += img.png.length
}
fs.writeFileSync(output, Buffer.concat([header, ...entries, ...images.map((i) => i.png)]))
console.log(`wrote ${output}: ${images.map((i) => i.size).join(', ')} (${fs.statSync(output).size} bytes)`)
