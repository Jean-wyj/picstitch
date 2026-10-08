// 画布引擎：图层模型 + 拼接布局 + 编辑交互 + 导出。与 React 无关，通过 onChange 通知界面。
const tc = document.createElement('canvas').getContext('2d')!

export function box(it: any) {
  if (it.t == 'text') {
    tc.font = `bold ${it.size}px sans-serif`
    const L = it.text.split('\n')
    it.w = Math.max(10, ...L.map((l: string) => tc.measureText(l).width))
    it.h = L.length * it.size * 1.25
  }
  return it
}
export function drawItem(c: CanvasRenderingContext2D, it: any) {
  if (it.t == 'img') c.drawImage(it.im, it.cx, it.cy, it.cw, it.ch, it.x, it.y, it.w, it.h)
  else if (it.t == 'rect') { c.strokeStyle = it.color; c.lineWidth = it.lw; c.strokeRect(it.x, it.y, it.w, it.h) }
  else { c.fillStyle = it.color; c.font = `bold ${it.size}px sans-serif`; c.textBaseline = 'top'
    it.text.split('\n').forEach((l: string, i: number) => c.fillText(l, it.x, it.y + i * it.size * 1.25)) }
}

export class Engine {
  items: any[] = []; sel = -1; tool = 'select'; V = { z: 1, ox: 0, oy: 0 }
  bg = '#ffffff'; gap = 8; layout = ''; col = '#ef4444'; lw = 6; fs = 48
  drag: any = null; hist: any[][] = []; ctx: CanvasRenderingContext2D
  onChange = () => {}; toast = (_: string) => {}; onNewText = () => {}

  constructor(public cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d')!
    cv.onpointerdown = this.down; cv.onpointermove = this.move; cv.onpointerup = this.up
    cv.addEventListener('wheel', this.wheel, { passive: false })
  }
  destroy() { this.cv.removeEventListener('wheel', this.wheel) }
  changed() { this.render(); this.onChange() }
  save() { this.hist.push(this.items.map(i => ({ ...i }))); if (this.hist.length > 50) this.hist.shift() }
  undo() { const h = this.hist.pop(); if (h) { this.items = h; this.sel = -1; this.changed() } }
  resize() {
    const r = this.cv.parentElement!.getBoundingClientRect(), d = devicePixelRatio || 1
    this.cv.width = r.width * d; this.cv.height = r.height * d
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px'; this.render()
  }
  bounds() {
    if (!this.items.length) return null
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9
    this.items.forEach(i => { box(i); a = Math.min(a, i.x); b = Math.min(b, i.y); c = Math.max(c, i.x + i.w); d = Math.max(d, i.y + i.h) })
    return { x: a, y: b, w: c - a, h: d - b }
  }
  fit() {
    const B = this.bounds(); if (!B) return
    const r = this.cv.parentElement!.getBoundingClientRect(), V = this.V
    V.z = Math.min((r.width - 60) / B.w, (r.height - 60) / B.h, 2)
    V.ox = (r.width - B.w * V.z) / 2 - B.x * V.z; V.oy = (r.height - B.h * V.z) / 2 - B.y * V.z
  }
  H(it: any) {
    const { x, y, w, h } = it, a: any[] = [['nw', x, y], ['ne', x + w, y], ['sw', x, y + h], ['se', x + w, y + h]]
    if (it.t == 'img') a.push(['n', x + w / 2, y], ['s', x + w / 2, y + h], ['w', x, y + h / 2], ['e', x + w, y + h / 2])
    return a
  }
  render() {
    const { ctx, V } = this, d = devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--cv').trim() || '#e6e1d6'
    ctx.fillRect(0, 0, this.cv.width, this.cv.height)
    ctx.setTransform(d * V.z, 0, 0, d * V.z, d * V.ox, d * V.oy); ctx.imageSmoothingQuality = 'high'
    const B = this.bounds()
    if (B) { ctx.fillStyle = this.bg; ctx.fillRect(B.x, B.y, B.w, B.h) }
    this.items.forEach(i => drawItem(ctx, i))
    const it = this.items[this.sel]
    if (it) {
      box(it); ctx.save(); ctx.strokeStyle = '#d9573b'; ctx.lineWidth = 1.5 / V.z
      ctx.setLineDash([6 / V.z, 4 / V.z]); ctx.strokeRect(it.x, it.y, it.w, it.h); ctx.setLineDash([])
      const s = 9 / V.z
      this.H(it).forEach(h => { ctx.fillStyle = h[0].length == 1 ? '#d9573b' : '#fff'; ctx.fillRect(h[1] - s / 2, h[2] - s / 2, s, s); ctx.strokeRect(h[1] - s / 2, h[2] - s / 2, s, s) })
      ctx.restore()
    }
  }
  pt(e: { clientX: number; clientY: number }) {
    const r = this.cv.getBoundingClientRect()
    return { x: (e.clientX - r.left - this.V.ox) / this.V.z, y: (e.clientY - r.top - this.V.oy) / this.V.z }
  }
  hitH(p: any) {
    const r = 10 / this.V.z, it = box(this.items[this.sel])
    return (this.H(it).find(a => Math.abs(p.x - a[1]) < r && Math.abs(p.y - a[2]) < r) || [])[0] as string
  }
  hit(p: any) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = box(this.items[i])
      if (p.x < it.x || p.y < it.y || p.x > it.x + it.w || p.y > it.y + it.h) continue
      if (it.t == 'rect') { const m = it.lw + 8 / this.V.z; if (p.x > it.x + m && p.y > it.y + m && p.x < it.x + it.w - m && p.y < it.y + it.h - m) continue }
      return i
    }
    return -1
  }
  snap(it: any, x: number, y: number) {
    const t = 7 / this.V.z; let bx = t, by = t, rx = x, ry = y
    this.items.forEach(o => {
      if (o == it) return
      ;[o.x, o.x + o.w].forEach(v => [[x, 0], [x + it.w, -it.w]].forEach(([c, f]) => { const q = Math.abs(c - v); if (q < bx) { bx = q; rx = v + f } }))
      ;[o.y, o.y + o.h].forEach(v => [[y, 0], [y + it.h, -it.h]].forEach(([c, f]) => { const q = Math.abs(c - v); if (q < by) { by = q; ry = v + f } }))
    })
    return [rx, ry]
  }
  setTool(t: string) { this.tool = t; this.cv.style.cursor = t == 'select' ? 'default' : 'crosshair'; this.onChange() }

  down = (e: PointerEvent) => {
    this.cv.setPointerCapture(e.pointerId); const p = this.pt(e)
    if (this.tool == 'rect') {
      this.save(); this.items.push({ t: 'rect', x: p.x, y: p.y, w: 0, h: 0, color: this.col, lw: this.lw })
      this.sel = this.items.length - 1; this.drag = { m: 'draw', p0: p, o: {} }; return
    }
    if (this.tool == 'text') {
      this.save(); this.items.push({ t: 'text', x: p.x, y: p.y, text: '在这里输入文字', size: this.fs, color: this.col })
      this.sel = this.items.length - 1; this.setTool('select'); this.changed(); this.onNewText(); return
    }
    if (this.items[this.sel]) {
      const k = this.hitH(p)
      if (k) { this.save(); this.drag = { m: k.length == 2 ? 'rs' : 'crop', k, p0: p, o: { ...this.items[this.sel] } }; return }
    }
    const i = this.hit(p)
    if (i >= 0) { this.sel = i; this.save(); this.drag = { m: 'move', p0: p, o: { ...this.items[i] } } }
    else { this.sel = -1; this.drag = { m: 'pan', s: { x: e.clientX, y: e.clientY }, o: { ...this.V } } }
    this.changed()
  }
  move = (e: PointerEvent) => {
    const g = this.drag; if (!g) return
    const p = this.pt(e), it = this.items[this.sel], o = g.o, k = g.k, V = this.V
    if (g.m == 'pan') { V.ox = o.ox + e.clientX - g.s.x; V.oy = o.oy + e.clientY - g.s.y }
    else if (g.m == 'draw') { it.x = Math.min(p.x, g.p0.x); it.y = Math.min(p.y, g.p0.y); it.w = Math.abs(p.x - g.p0.x); it.h = Math.abs(p.y - g.p0.y) }
    else if (g.m == 'move') { const [x, y] = this.snap(it, o.x + p.x - g.p0.x, o.y + p.y - g.p0.y); it.x = x; it.y = y }
    else if (g.m == 'rs') {
      const ax = k.includes('w') ? o.x + o.w : o.x, ay = k.includes('n') ? o.y + o.h : o.y
      if (it.t == 'text') {
        it.size = Math.max(8, o.size * Math.max(.1, (k.includes('w') ? ax - p.x : p.x - ax) / o.w)); box(it)
        it.x = k.includes('w') ? ax - it.w : ax; it.y = k.includes('n') ? ay - it.h : ay
      } else {
        const w = Math.max(10, k.includes('w') ? ax - p.x : p.x - ax)
        const h = it.t == 'img' && !e.shiftKey ? w * o.h / o.w : Math.max(10, k.includes('n') ? ay - p.y : p.y - ay)
        it.w = w; it.h = h; it.x = k.includes('w') ? ax - w : ax; it.y = k.includes('n') ? ay - h : ay
      }
    } else if (g.m == 'crop') {
      let dx = p.x - g.p0.x, dy = p.y - g.p0.y
      const sx = o.cw / o.w, sy = o.ch / o.h, W = it.im.naturalWidth, Hh = it.im.naturalHeight
      const cl = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)
      if (k == 'w') { dx = cl(dx, -o.cx / sx, o.w - 10); it.x = o.x + dx; it.w = o.w - dx; it.cx = o.cx + dx * sx; it.cw = o.cw - dx * sx }
      if (k == 'e') { dx = cl(dx, 10 - o.w, (W - o.cx - o.cw) / sx); it.w = o.w + dx; it.cw = o.cw + dx * sx }
      if (k == 'n') { dy = cl(dy, -o.cy / sy, o.h - 10); it.y = o.y + dy; it.h = o.h - dy; it.cy = o.cy + dy * sy; it.ch = o.ch - dy * sy }
      if (k == 's') { dy = cl(dy, 10 - o.h, (Hh - o.cy - o.ch) / sy); it.h = o.h + dy; it.ch = o.ch + dy * sy }
    }
    this.render()
  }
  up = () => {
    if (this.drag?.m == 'draw') { const it = this.items[this.sel]; if (it.w < 4 || it.h < 4) { this.items.pop(); this.sel = -1 } }
    this.drag = null; this.changed()
  }
  wheel = (e: WheelEvent) => {
    e.preventDefault(); const p = this.pt(e), r = this.cv.getBoundingClientRect(), V = this.V
    V.z = Math.min(8, Math.max(.03, V.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
    V.ox = e.clientX - r.left - p.x * V.z; V.oy = e.clientY - r.top - p.y * V.z; this.render()
  }

  arrange(m: string) {
    this.layout = m
    const L = this.items.filter(i => i.t == 'img'), g = +this.gap
    if (!L.length) return this.toast('请先添加图片')
    this.save()
    if (m == 'h') { let x = 0; L.forEach(i => { i.h = 600; i.w = i.cw * 600 / i.ch; i.x = x; i.y = 0; x += i.w + g }) }
    if (m == 'v') { let y = 0; L.forEach(i => { i.w = 800; i.h = i.ch * 800 / i.cw; i.x = 0; i.y = y; y += i.h + g }) }
    if (m == 'g') {
      const c = L.length <= 4 ? 2 : Math.ceil(Math.sqrt(L.length)), S = 600
      L.forEach((i, k) => { const s = Math.min(S / i.cw, S / i.ch); i.w = i.cw * s; i.h = i.ch * s
        i.x = (k % c) * (S + g) + (S - i.w) / 2; i.y = Math.floor(k / c) * (S + g) + (S - i.h) / 2 })
    }
    this.fit(); this.changed()
  }
  async addFiles(fs: FileList | File[]) {
    const L = [...fs].filter(f => f.type.startsWith('image/')); if (!L.length) return
    const ims = await Promise.all(L.map(f => new Promise<HTMLImageElement>(r => { const im = new Image(); im.onload = () => r(im); im.src = URL.createObjectURL(f) })))
    this.save()
    ims.forEach(im => {
      const B = this.bounds(), h = 500
      this.items.push({ t: 'img', im, x: B ? B.x + B.w + this.gap : 0, y: B ? B.y : 0, w: im.naturalWidth * h / im.naturalHeight, h, cx: 0, cy: 0, cw: im.naturalWidth, ch: im.naturalHeight })
    })
    this.sel = this.items.length - 1
    if (this.layout) this.arrange(this.layout); else { this.fit(); this.changed() }
  }
  del() { if (this.sel < 0) return; this.save(); this.items.splice(this.sel, 1); this.sel = -1; this.changed() }
  layer(d: number) {
    const j = this.sel + d, a = this.items; if (this.sel < 0 || j < 0 || j >= a.length) return
    this.save(); [a[this.sel], a[j]] = [a[j], a[this.sel]]; this.sel = j; this.changed()
  }
  resetCrop() {
    const it = this.items[this.sel]; if (!it || it.t != 'img') return
    this.save(); const s = it.w / it.cw
    it.cx = 0; it.cy = 0; it.cw = it.im.naturalWidth; it.ch = it.im.naturalHeight; it.w = it.cw * s; it.h = it.ch * s; this.changed()
  }
  setColor(v: string) { this.col = v; const it = this.items[this.sel]; if (it && it.t != 'img') it.color = v; this.changed() }
  setSize(v: number) { const it = this.items[this.sel]; if (it?.t == 'rect') it.lw = this.lw = v; else if (it?.t == 'text') it.size = this.fs = v; this.changed() }
  setText(v: string) { const it = this.items[this.sel]; if (it?.t == 'text') { it.text = v || ' '; this.changed() } }

  out(q: string) {
    const B = this.bounds(); if (!B) { this.toast('请先添加图片'); return null }
    let m = 1; this.items.forEach(i => { if (i.t == 'img') m = Math.max(m, i.cw / i.w) })
    const s = Math.min(q == 'auto' ? m : +q, 8192 / Math.max(B.w, B.h))
    const c = document.createElement('canvas'); c.width = Math.round(B.w * s); c.height = Math.round(B.h * s)
    const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.fillStyle = this.bg; x.fillRect(0, 0, c.width, c.height)
    x.scale(s, s); x.translate(-B.x, -B.y); this.items.forEach(i => drawItem(x, i)); return c
  }
  async copy(q: string) {
    const c = this.out(q); if (!c) return
    try {
      const b: any = await new Promise(r => c.toBlob(r, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); this.toast(`已复制（${c.width}×${c.height}）`)
    } catch { this.toast('当前环境不支持直接复制，请使用下载') }
  }
  download(q: string, type: string) {
    const c = this.out(q); if (!c) return
    c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b!); a.download = '拼图.' + (type == 'image/png' ? 'png' : 'jpg'); a.click(); this.toast(`已导出 ${c.width}×${c.height}`) }, type, .95)
  }
}
