import type { ComicPanel } from '../types'

export function ComicSheet({
  panels,
  compact = false,
}: {
  panels: ComicPanel[]
  compact?: boolean
}) {
  return (
    <div className={`comic-sheet${compact ? ' compact' : ''}`}>
      {panels.map((panel, index) => {
        return (
          <article className="comic-panel" key={panel.id}>
            <div
              className="comic-art"
              style={{
                backgroundImage: `url(${panel.imageUrl})`,
              }}
            />
            <div className="panel-overline">
              <span>{index + 1}컷</span>
              <span>{panel.beatLabel}</span>
            </div>
            <p className="panel-caption">{panel.caption}</p>
            <p className="panel-dialogue">{panel.dialogue}</p>
          </article>
        )
      })}
    </div>
  )
}
