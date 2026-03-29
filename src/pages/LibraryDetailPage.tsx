import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ComicSheet } from '../components/ComicSheet'
import { ScreenHeader } from '../components/ScreenHeader'
import { downloadNodeImage, shareNodeImage } from '../lib/export'
import { formatDateTimeLabel } from '../lib/format'
import { useApp } from '../providers/AppProvider'

export function LibraryDetailPage() {
  const navigate = useNavigate()
  const { entryId } = useParams()
  const { entries, openEntryForEditing, removeEntry } = useApp()
  const [notice, setNotice] = useState('')
  const [busyAction, setBusyAction] = useState<'share' | 'save' | null>(null)
  const shareRef = useRef<HTMLDivElement | null>(null)
  const entry = entries.find((item) => item.id === entryId)

  if (!entry) {
    return (
      <section className="screen">
        <div className="empty-state">
          <h2>기록을 찾지 못했어요</h2>
          <p>이미 삭제되었거나 다른 기기 기록일 수 있어요.</p>
          <Link className="primary-button" to="/library">
            보관함으로 돌아가기
          </Link>
        </div>
      </section>
    )
  }

  const detailEntry = entry

  async function handleShare() {
    if (!shareRef.current) {
      return
    }

    setBusyAction('share')

    try {
      const outcome = await shareNodeImage(shareRef.current, {
        title: detailEntry.title,
        text: detailEntry.summary,
        fileStem: detailEntry.title,
      })
      setNotice(outcome === 'shared' ? '공유 시트를 열었어요.' : '공유용 PNG를 저장했어요.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDownload() {
    if (!shareRef.current) {
      return
    }

    setBusyAction('save')
    await downloadNodeImage(shareRef.current, detailEntry.title)
    setBusyAction(null)
    setNotice('PNG 파일로 저장했어요.')
  }

  return (
    <section className="screen">
      <ScreenHeader
        eyebrow="상세 보기"
        title={detailEntry.title}
        description="날짜별로 보관된 기록을 다시 열어보고, 필요하면 수정 흐름으로 이어갈 수 있습니다."
      />

      {notice ? <p className="notice-banner">{notice}</p> : null}

      <div className="share-sheet" ref={shareRef}>
        <div className="share-sheet-head">
          <p className="eyebrow">{formatDateTimeLabel(detailEntry.savedAt)}</p>
          <h2 className="detail-title">{detailEntry.title}</h2>
          <p className="detail-summary">{detailEntry.summary}</p>
        </div>
        <ComicSheet panels={detailEntry.panels} />
      </div>

      <section className="section">
        <div className="button-row">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              const opened = openEntryForEditing(detailEntry.id)

              if (opened) {
                navigate('/result')
              }
            }}
          >
            수정 이어서 하기
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busyAction === 'share'}
            onClick={() => void handleShare()}
          >
            {busyAction === 'share' ? '준비 중...' : '공유'}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busyAction === 'save'}
            onClick={() => void handleDownload()}
          >
            {busyAction === 'save' ? '저장 중...' : 'PNG 저장'}
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              const shouldDelete = window.confirm('이 기록을 보관함에서 삭제할까요?')

              if (shouldDelete) {
                removeEntry(detailEntry.id)
                navigate('/library', { replace: true })
              }
            }}
          >
            삭제
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">원문</p>
            <h2>당시 일기</h2>
          </div>
        </div>
        <p className="detail-summary">{detailEntry.diaryText}</p>
      </section>
    </section>
  )
}
