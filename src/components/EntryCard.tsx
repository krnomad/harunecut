import { Link } from 'react-router-dom'
import { formatDateLabel } from '../lib/format'
import { TONE_LABELS, type ComicEntry } from '../types'

export function EntryCard({
  entry,
  to,
}: {
  entry: ComicEntry
  to: string
}) {
  return (
    <Link className="entry-card" to={to}>
      <div className="entry-thumb-grid" aria-hidden="true">
        {entry.panels.map((panel) => {
          return (
            <div
              key={panel.id}
              className="thumbnail-cell"
              style={{
                backgroundImage: `url(${panel.imageUrl})`,
              }}
            />
          )
        })}
      </div>
      <div className="entry-meta">
        <div className="entry-heading">
          <h2 className="entry-title">{entry.title}</h2>
          <span className="entry-tone">{TONE_LABELS[entry.resolvedTone]}</span>
        </div>
        <p className="entry-summary">{entry.summary}</p>
        <p className="entry-date">{formatDateLabel(entry.savedAt)}</p>
      </div>
    </Link>
  )
}
