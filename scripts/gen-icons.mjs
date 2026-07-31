// 生成 PWA 图标（纯 Node，手写 PNG 编码，无外部依赖）
// 图案：深蓝圆角背景 + 白色对话气泡
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ---- PNG 编码 ----
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // filter type 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y)
      const off = y * (size * 3 + 1) + 1 + x * 3
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- 图案 ----
function makePixel(size) {
  const bg = [87, 107, 149] // #576B95
  const fg = [255, 255, 255]
  const bubble = { x: size * 0.16, y: size * 0.18, w: size * 0.68, h: size * 0.5, r: size * 0.14 }
  const tail = { x: size * 0.2, y: size * 0.62, w: size * 0.3, h: size * 0.16 }

  const inRoundRect = (px, py, b) => {
    if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) return false
    const cx = Math.max(b.x + b.r, Math.min(px, b.x + b.w - b.r))
    const cy = Math.max(b.y + b.r, Math.min(py, b.y + b.h - b.r))
    const dx = px - cx
    const dy = py - cy
    return dx * dx + dy * dy <= b.r * b.r
  }
  const inTail = (px, py) => {
    const tx = (px - tail.x) / tail.w
    const ty = (tail.y + tail.h - py) / tail.h
    return tx >= 0 && tx <= 1 && ty >= 0 && ty <= 1 && tx + ty <= 1.2
  }

  return (x, y) => {
    if (inRoundRect(x, y, bubble)) return fg
    if (inTail(x, y)) return fg
    return bg
  }
}

for (const size of [192, 512]) {
  const png = encodePNG(size, makePixel(size))
  writeFileSync(path.join(outDir, `icon-${size}.png`), png)
  console.log(`icon-${size}.png generated (${png.length} bytes)`)
}
