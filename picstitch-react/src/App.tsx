import { useEffect, useReducer, useRef, useState } from 'react'
import { Engine } from './engine'

const TOOLS: [string, string][] = [['select', '选择'], ['rect', '▢ 方框'], ['text', 'T 文字']]

export default function App() {
  const cvRef = useRef<HTMLCanvasElement>(null), fiRef = useRef<HTMLInputElement>(null), txtRef = useRef<HTMLTextAreaElement>(null)
  const eng = useRef<Engine>(), [, tick] = useReducer((x: number) => x + 1, 0)
  const [msg, setMsg] = useState(''), [q, setQ] = useState('auto'), [fm, setFm] = useState('image/png')

  useEffect(() => {
    const en = new Engine(cvRef.current!); eng.current = en
    en.onChange = tick
    en.toast = m => { setMsg(m); setTimeout(() => setMsg(''), 2200) }
    en.onNewText = () => setTimeout(() => { txtRef.current?.focus(); txtRef.current?.select() }, 0)
    const rs = () => en.resize()
    const paste = (e: ClipboardEvent) => en.addFiles(e.clipboardData!.files)
    const key = (e: KeyboardEvent) => {
      if (['TEXTAREA', 'INPUT'].includes((document.activeElement as HTMLElement).tagName)) return
      if (e.key == 'Delete' || e.key == 'Backspace') { e.preventDefault(); en.del() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'z') { e.preventDefault(); en.undo() }
    }
    addEventListener('resize', rs); document.addEventListener('paste', paste); document.addEventListener('keydown', key)
    en.resize(); tick()
    return () => { en.destroy(); removeEventListener('resize', rs); document.removeEventListener('paste', paste); document.removeEventListener('keydown', key) }
  }, [])

  const E = () => eng.current!
  const en = eng.current, it = en?.items[en.sel], T = it?.t
  const hasItems = !!en?.items.length

  return (<>
    <div className="bar">
      <h1>拼图<b>工坊</b></h1>
      <div className="g"><button className="p" onClick={() => fiRef.current?.click()}>＋ 添加图片</button>
        <input ref={fiRef} type="file" accept="image/*" multiple hidden onChange={e => { E().addFiles(e.target.files!); e.target.value = '' }} /></div>
      <div className="g"><span className="mut">拼接</span>
        <button onClick={() => E().arrange('h')}>横拼</button><button onClick={() => E().arrange('v')}>竖拼</button>
        <button onClick={() => E().arrange('g')}>田字/网格</button><button onClick={() => { E().fit(); E().changed() }}>适应窗口</button>
        <button onClick={() => E().undo()}>↶ 撤销</button></div>
      <div className="g">
        <label>间距<input type="range" min={0} max={60} defaultValue={8} onChange={e => { const v = E(); v.gap = +e.target.value; if (v.layout) v.arrange(v.layout) }} /></label>
        <label>底色<input type="color" defaultValue="#ffffff" onChange={e => { E().bg = e.target.value; E().changed() }} /></label></div>
      <div className="g"><span className="mut">工具</span>
        {TOOLS.map(([k, n]) => <button key={k} className={en?.tool == k ? 'on' : ''} onClick={() => E().setTool(k)}>{n}</button>)}</div>
      <div className="g" style={{ marginLeft: 'auto' }}>
        <select value={q} onChange={e => setQ(e.target.value)}><option value="auto">原图清晰度</option><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select>
        <select value={fm} onChange={e => setFm(e.target.value)}><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select>
        <button onClick={() => E().copy(q)}>复制</button><button className="p" onClick={() => E().download(q, fm)}>下载</button></div>
    </div>
    <div className="bar">
      <span className="mut">{it ? { img: '图片', rect: '方框', text: '文字' }[T as 'img'] : '未选中对象'}</span>
      {it && T != 'img' && <>
        <label>颜色<input type="color" value={it.color} onChange={e => E().setColor(e.target.value)} /></label>
        <label>{T == 'rect' ? '线宽' : '字号'}<input type="range" min={1} max={T == 'rect' ? 40 : 240} value={T == 'rect' ? it.lw : it.size} onChange={e => E().setSize(+e.target.value)} /></label></>}
      {T == 'text' && <textarea ref={txtRef} value={it.text} placeholder="输入文字" onChange={e => E().setText(e.target.value)} />}
      {it && <div className="g"><button onClick={() => E().layer(1)}>上移一层</button><button onClick={() => E().layer(-1)}>下移一层</button>
        {T == 'img' && <button onClick={() => E().resetCrop()}>重置裁剪</button>}<button onClick={() => E().del()}>删除</button></div>}
    </div>
    <div id="w" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); E().addFiles(e.dataTransfer.files) }}>
      <canvas id="cv" ref={cvRef} />
      {!hasItems && <div id="em">拖入 / 粘贴 / 点击「添加图片」<br />然后选择横拼、竖拼、田字，或直接拖动自由摆放</div>}
    </div>
    <div id="hint">拖动图片自由摆放（自动吸附）· 四角缩放 · 四边中点裁剪 · 滚轮缩放 · 空白处拖动平移 · Delete 删除 · Ctrl/Cmd+Z 撤销</div>
    {msg && <div id="tt">{msg}</div>}
  </>)
}
