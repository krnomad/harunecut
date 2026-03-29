import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ComicSheet } from '../components/ComicSheet'
import { ScreenHeader } from '../components/ScreenHeader'
import { ToneChip } from '../components/ToneChip'
import { downloadNodeImage, shareNodeImage } from '../lib/export'
import { formatDateTimeLabel } from '../lib/format'
import { useApp } from '../providers/AppProvider'
import { QUICK_ACTIONS, QUICK_ACTION_LABELS, TONE_OPTIONS } from '../types'

export function ResultPage() {
  const {
    activeDraft,
    updateDraftTitle,
    updateDraftDialogue,
    updateDraftCaption,
    regeneratePanel,
    regenerateTone,
    applyQuickAction,
    saveActiveDraft,
  } = useApp()
  const shareSheetRef = useRef<HTMLDivElement | null>(null)
  const [panelLoadingId, setPanelLoadingId] = useState<string | null>(null)
  const [toneLoading, setToneLoading] = useState<string | null>(null)
  const [exportState, setExportState] = useState<'share' | 'save' | null>(null)
  const [notice, setNotice] = useState('')

  if (!activeDraft) {
    return (
      <section className="screen">
        <div className="empty-state">
          <h2>아직 결과가 없어요</h2>
          <p>일기를 먼저 생성하면 이 화면에서 대사 편집, 컷 재생성, 저장과 공유까지 이어서 할 수 있어요.</p>
          <Link className="primary-button" to="/create">
            생성하러 가기
          </Link>
        </div>
      </section>
    )
  }

  const draft = activeDraft
  const supportsLocalRegenerate = draft.panels.every((panel) => panel.sourceBackend === 'mock')

  async function handlePanelRegenerate(panelId: string) {
    setPanelLoadingId(panelId)
    await regeneratePanel(panelId)
    setPanelLoadingId(null)
    setNotice('선택한 컷을 다시 만들었어요.')
  }

  async function handleToneRegenerate(tone: (typeof TONE_OPTIONS)[number]) {
    setToneLoading(tone)
    await regenerateTone(tone)
    setToneLoading(null)
    setNotice('전체 톤을 다시 돌려서 네 컷을 새로 정리했어요.')
  }

  async function handleSaveImage() {
    if (!shareSheetRef.current) {
      return
    }

    setExportState('save')
    await downloadNodeImage(shareSheetRef.current, draft.title)
    setExportState(null)
    setNotice('PNG 파일로 저장했어요.')
  }

  async function handleShareImage() {
    if (!shareSheetRef.current) {
      return
    }

    setExportState('share')

    try {
      const outcome = await shareNodeImage(shareSheetRef.current, {
        title: draft.title,
        text: draft.summary,
        fileStem: draft.title,
      })
      setNotice(outcome === 'shared' ? '공유 시트를 열었어요.' : '공유용 PNG를 저장했어요.')
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setNotice('공유를 취소했어요.')
      } else {
        setNotice('공유 중 문제가 생겨 PNG 저장으로 대체해 주세요.')
      }
    } finally {
      setExportState(null)
    }
  }

  return (
    <section className="screen">
      <ScreenHeader
        eyebrow="결과 보기"
        title="스크립트와 컷을 가볍게 다시 만질 수 있게"
        description="제목 수정, 빠른 톤 전환, 컷별 재생성까지 붙여서 생성 후 수정 UX를 MVP의 중심으로 잡았습니다."
      />

      {notice ? <p className="notice-banner">{notice}</p> : null}

      <section className="result-layout">
        <div className="share-sheet" ref={shareSheetRef}>
          <div className="share-sheet-head">
            <p className="eyebrow">{formatDateTimeLabel(draft.updatedAt)}</p>
            <input
              className="title-input"
              value={draft.title}
              onChange={(event) => updateDraftTitle(event.target.value)}
              aria-label="만화 제목"
            />
            <p className="detail-summary">{draft.summary}</p>
          </div>
          <ComicSheet panels={draft.panels} />
        </div>

        <aside className="result-sidebar">
          <section className="section compact">
            <div className="section-head">
              <div>
                <p className="eyebrow">저장 / 공유</p>
                <h2>한 장 이미지로 내보내기</h2>
              </div>
            </div>
            <div className="button-row">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  saveActiveDraft()
                  setNotice('보관함에 저장했어요.')
                }}
              >
                보관함 저장
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={exportState === 'save'}
                onClick={handleSaveImage}
              >
                {exportState === 'save' ? '저장 중...' : 'PNG 저장'}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={exportState === 'share'}
                onClick={handleShareImage}
              >
                {exportState === 'share' ? '준비 중...' : '공유'}
              </button>
            </div>
          </section>

          <section className="section compact">
            <div className="section-head">
              <div>
                <p className="eyebrow">빠른 액션</p>
                <h2>방향만 빠르게 바꾸기</h2>
              </div>
            </div>
            <div className="pill-actions">
              {QUICK_ACTIONS.map((action) => {
                return (
                  <button
                    className="ghost-button"
                    type="button"
                    key={action}
                    onClick={() => {
                      applyQuickAction(action)
                      setNotice(`${QUICK_ACTION_LABELS[action]} 방향으로 다듬었어요.`)
                    }}
                  >
                    {QUICK_ACTION_LABELS[action]}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="section compact">
            <div className="section-head">
              <div>
                <p className="eyebrow">전체 톤 재생성</p>
                <h2>같은 하루를 다른 감정으로 보기</h2>
              </div>
            </div>
            <div className="tone-row">
              {TONE_OPTIONS.map((tone) => {
                return (
                  <ToneChip
                    key={tone}
                    tone={tone}
                    active={draft.toneSelection === tone}
                    disabled={!supportsLocalRegenerate}
                    onClick={() => void handleToneRegenerate(tone)}
                  />
                )
              })}
            </div>
            {!supportsLocalRegenerate ? (
              <p className="inline-note">
                실제 AI 컷 재생성은 다음 단계에서 연결할 예정입니다. 지금은 초기 생성 결과를 기준으로 대사와 캡션만 바로 다듬을 수 있어요.
              </p>
            ) : toneLoading ? (
              <p className="inline-note">{toneLoading} 톤으로 다시 그리고 있어요.</p>
            ) : null}
          </section>
        </aside>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">컷별 편집</p>
            <h2>대사와 캡션을 바로 수정하기</h2>
          </div>
        </div>

        <div className="editor-list">
          {draft.panels.map((panel, index) => {
            const isLoading = panelLoadingId === panel.id

            return (
              <article className="editor-card" key={panel.id}>
                <div className="editor-card-head">
                  <div>
                    <span className="inline-badge">
                      {index + 1}컷 · {panel.beatLabel}
                    </span>
                    <h3>{panel.scene}</h3>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={isLoading || !supportsLocalRegenerate}
                    onClick={() => void handlePanelRegenerate(panel.id)}
                  >
                    {!supportsLocalRegenerate ? '곧 지원 예정' : isLoading ? '재생성 중...' : '컷 재생성'}
                  </button>
                </div>

                <label className="field-group">
                  <span className="field-label">캡션</span>
                  <input
                    className="text-input"
                    value={panel.caption}
                    onChange={(event) => updateDraftCaption(panel.id, event.target.value)}
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">대사</span>
                  <textarea
                    className="textarea-field panel-textarea"
                    value={panel.dialogue}
                    onChange={(event) => updateDraftDialogue(panel.id, event.target.value)}
                  />
                </label>

                <p className="inline-note">프롬프트: {panel.artPrompt}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">원문 기반</p>
            <h2>내 이야기 같지 않은 결과를 줄이기 위한 기준</h2>
          </div>
        </div>
        <p className="detail-summary">{draft.diaryText}</p>
      </section>
    </section>
  )
}
