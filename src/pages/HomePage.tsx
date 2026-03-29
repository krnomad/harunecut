import { Link } from 'react-router-dom'
import { EntryCard } from '../components/EntryCard'
import { ScreenHeader } from '../components/ScreenHeader'
import { useApp } from '../providers/AppProvider'

function weekCount(savedDates: string[]) {
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  return savedDates.filter((savedAt) => now - Date.parse(savedAt) <= weekMs).length
}

export function HomePage() {
  const { entries } = useApp()
  const recentEntries = entries.slice(0, 3)
  const weeklyCreations = weekCount(entries.map((entry) => entry.savedAt))

  return (
    <section className="screen">
      <ScreenHeader
        eyebrow="오늘의 CTA"
        title="짧게 적어도, 하루는 네 컷이 됩니다"
        description="일기의 사건 흐름과 감정을 묶어 한 장의 만화로 남겨보세요. 저장과 회고까지 이어지는 모바일 우선 MVP를 먼저 붙였습니다."
      />

      <section className="hero-poster">
        <div className="poster-copy">
          <p className="eyebrow">HOME</p>
          <h2>오늘 하루를 한 번에 만화로 번역하기</h2>
          <p>
            글은 가볍게, 결과는 확실하게. 감정 톤을 고르면 4컷 스크립트와 컷 이미지, 보관함 저장
            플로우가 바로 이어집니다.
          </p>
          <div className="button-row">
            <Link className="primary-button" to="/create">
              오늘의 네 컷 만들기
            </Link>
            <Link className="secondary-button" to="/library">
              보관함 보기
            </Link>
          </div>
        </div>

        <div className="poster-art" aria-hidden="true">
          <div className="poster-grid">
            <div className="poster-frame frame-a" />
            <div className="poster-frame frame-b" />
            <div className="poster-frame frame-c" />
            <div className="poster-frame frame-d" />
          </div>
          <div className="poster-sticker">
            <strong>{entries.length}</strong>
            <span>누적 생성</span>
          </div>
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <strong>{entries.length}</strong>
          <span>저장된 만화</span>
        </div>
        <div>
          <strong>{weeklyCreations}</strong>
          <span>최근 7일 생성</span>
        </div>
        <div>
          <strong>{recentEntries.length ? 'ON' : 'READY'}</strong>
          <span>회고 흐름</span>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">최근 기록</p>
            <h2>보관함으로 이어지는 최신 네 컷</h2>
          </div>
          <Link className="ghost-link" to="/library">
            전체 보기
          </Link>
        </div>

        {recentEntries.length ? (
          <div className="entry-list">
            {recentEntries.map((entry) => {
              return <EntryCard entry={entry} key={entry.id} to={`/library/${entry.id}`} />
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>첫 기록이 아직 없어요</h3>
            <p>오늘 있었던 일을 두세 문장으로 적으면 바로 첫 네 컷을 만들 수 있어요.</p>
            <Link className="primary-button" to="/create">
              첫 만화 만들기
            </Link>
          </div>
        )}
      </section>
    </section>
  )
}
