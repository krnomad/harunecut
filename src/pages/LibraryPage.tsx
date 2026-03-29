import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { EntryCard } from '../components/EntryCard'
import { ScreenHeader } from '../components/ScreenHeader'
import { ToneChip } from '../components/ToneChip'
import { useApp } from '../providers/AppProvider'
import { TONE_OPTIONS, type ToneOption } from '../types'

type FilterTone = ToneOption | 'all'

export function LibraryPage() {
  const { entries } = useApp()
  const [query, setQuery] = useState('')
  const [toneFilter, setToneFilter] = useState<FilterTone>('all')
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const filteredEntries = entries.filter((entry) => {
    const matchesQuery =
      !normalizedQuery ||
      `${entry.title} ${entry.summary} ${entry.diaryText}`.toLowerCase().includes(normalizedQuery)
    const matchesTone =
      toneFilter === 'all' ||
      entry.toneSelection === toneFilter ||
      entry.resolvedTone === toneFilter

    return matchesQuery && matchesTone
  })

  return (
    <section className="screen">
      <ScreenHeader
        eyebrow="보관함"
        title="날짜와 제목 기준으로 지난 네 컷을 돌아보기"
        description="검색과 톤 필터는 기본만 먼저 붙였습니다. 감정 캘린더나 통계 대시보드는 후속 확장 포인트로 열어둘 수 있습니다."
      />

      <section className="section">
        <div className="field-group">
          <span className="field-label">검색</span>
          <input
            className="text-input"
            placeholder="제목, 요약, 원문에서 찾기"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="tone-row">
          <button
            type="button"
            className={`tone-chip${toneFilter === 'all' ? ' active' : ''}`}
            onClick={() => setToneFilter('all')}
          >
            전체
          </button>
          {TONE_OPTIONS.map((tone) => {
            return (
              <ToneChip
                key={tone}
                tone={tone}
                active={toneFilter === tone}
                onClick={() => setToneFilter(tone)}
              />
            )
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">썸네일 목록</p>
            <h2>{filteredEntries.length}개의 기록</h2>
          </div>
          <Link className="ghost-link" to="/create">
            새로 만들기
          </Link>
        </div>

        {filteredEntries.length ? (
          <div className="entry-list">
            {filteredEntries.map((entry) => {
              return <EntryCard entry={entry} key={entry.id} to={`/library/${entry.id}`} />
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>조건에 맞는 기록이 없어요</h3>
            <p>검색어를 줄이거나 다른 톤으로 필터를 바꿔보세요.</p>
          </div>
        )}
      </section>
    </section>
  )
}
