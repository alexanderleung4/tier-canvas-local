import { useEffect, useRef } from 'react'
import { ImagePlus, Layers3, RotateCcw, Trash2, Undo2, Redo2, Download, Presentation, MonitorUp, Palette } from 'lucide-react'
import { useAppStore } from '../store'
import type { AspectRatio } from '../types'
import { DEFAULT_RANKING_COLOR } from '../core/project'

interface ToolbarProps {
  onClear: () => void
  onExport: () => void
  onPresentation: () => void
}

export function Toolbar({ onClear, onExport, onPresentation }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const { project, past, future, addTier, uploadFiles, reset, undo, redo, setAspectRatio, setRankingColor, previewRankingColor, commitRankingColorEdit } = useAppStore()
  useEffect(() => {
    const input = colorInputRef.current
    if (!input) return
    const commitColor = () => commitRankingColorEdit(input.value)
    input.addEventListener('change', commitColor)
    return () => input.removeEventListener('change', commitColor)
  }, [commitRankingColorEdit])
  const button = (label: string, icon: React.ReactNode, onClick: () => void, disabled = false, className = '') => (
    <button type="button" className={`tool-button ${className}`} onClick={onClick} disabled={disabled} aria-label={label}>{icon}<span>{label}</span></button>
  )
  return (
    <header className="app-toolbar">
      <div className="brand"><span className="brand-mark">排</span><div><h1>从夯到拉</h1><p>排版生成器</p></div></div>
      <div className="toolbar-actions">
        <div className="tool-group">
          {button('添加层级', <Layers3 />, addTier)}
          {button('上传图片', <ImagePlus />, () => inputRef.current?.click(), false, 'primary')}
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(event) => { void uploadFiles([...event.target.files ?? []]); event.currentTarget.value = '' }}
            data-testid="file-input"
          />
          {button('清空图片', <Trash2 />, onClear)}
          {button('恢复初始设定', <RotateCcw />, reset)}
        </div>
        <div className="tool-group compact">
          {button('撤销', <Undo2 />, undo, !past.length)}
          {button('重做', <Redo2 />, redo, !future.length)}
        </div>
        <div className="tool-group compact">
          {button('导出 PNG', <Download />, onExport, false, 'accent')}
          {button('演示模式', <Presentation />, onPresentation)}
        </div>
        <div className="color-control">
          <label className="color-select" title="调整排行内容区域的底色">
            <Palette /><span>排行底色</span>
            <input ref={colorInputRef} type="color" value={project.rankingColor} onInput={(event) => previewRankingColor(event.currentTarget.value)} onChange={() => undefined} aria-label="排行底色" data-testid="ranking-color-input" />
          </label>
          <button type="button" className="color-reset" onClick={() => setRankingColor(DEFAULT_RANKING_COLOR)} disabled={project.rankingColor === DEFAULT_RANKING_COLOR} aria-label="恢复默认排行底色" title="恢复默认灰色"><RotateCcw /></button>
        </div>
        <label className="ratio-select"><MonitorUp /><span>画布比例</span>
          <select value={project.aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)} aria-label="画布比例">
            <option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option>
          </select>
        </label>
      </div>
    </header>
  )
}
