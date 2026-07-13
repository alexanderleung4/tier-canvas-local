import { useEffect, useRef } from 'react'
import type { RuntimeAsset } from '../types'

interface ImagePreviewProps {
  asset: RuntimeAsset
  closing: boolean
  onClose: () => void
  onClosed: () => void
}

export function ImagePreview({ asset, closing, onClose, onClosed }: ImagePreviewProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    overlayRef.current?.focus()
    return () => previousFocus?.focus()
  }, [])

  return (
    <div
      ref={overlayRef}
      className={`image-zoom-overlay ${closing ? 'is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`预览图片：${asset.name}`}
      tabIndex={-1}
      data-testid="image-zoom-overlay"
      onClick={onClose}
    >
      <div className="image-zoom-stage" onAnimationEnd={(event) => { if (closing && event.animationName === 'image-zoom-out') onClosed() }}>
        <img src={asset.originalUrl} alt={asset.name} draggable={false} />
      </div>
    </div>
  )
}
