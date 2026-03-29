import { startTransition, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '../components/ScreenHeader'
import { ToneChip } from '../components/ToneChip'
import { useApp } from '../providers/AppProvider'
import { TONE_OPTIONS } from '../types'

const MIN_DIARY_LENGTH = 12

export function CreatePage() {
  const navigate = useNavigate()
  const { draftInput, settings, generation, updateDraftInput, beginGeneration } = useApp()
  const [error, setError] = useState('')
  const length = draftInput.diaryText.trim().length
  const isGenerating = generation?.status === 'running'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (length < MIN_DIARY_LENGTH) {
      setError(`최소 ${MIN_DIARY_LENGTH}자 이상 적어주세요.`)
      return
    }

    setError('')
    void beginGeneration(draftInput)
    startTransition(() => {
      navigate('/generate')
    })
  }

  return (
    <section className="screen">
      <ScreenHeader
        eyebrow="생성하기"
        title="오늘 있었던 일을 짧게 남겨보세요"
        description="짧은 메모부터 긴 문단까지 괜찮아요. 감정 톤을 고르면 네 컷 스크립트와 장면 생성 흐름이 바로 시작됩니다."
      />

      <form className="editor-stack" onSubmit={handleSubmit}>
        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">일기 입력</p>
              <h2>오늘 무슨 일이 있었나요?</h2>
            </div>
            <span className="inline-badge">{length}자</span>
          </div>

          <label className="field-group">
            <span className="field-label">짧게 적어도 괜찮아요. 네 컷으로 바꿔드릴게요.</span>
            <textarea
              className="textarea-field diary-textarea"
              placeholder="예: 아침에 늦잠을 자서 허둥지둥 나갔는데, 점심엔 친구가 커피를 사줘서 마음이 풀렸어요. 저녁에는 비까지 와서 좀 지쳤지만 집에 와서 씻고 누우니 그래도 오늘 잘 버텼다는 생각이 들었어요."
              value={draftInput.diaryText}
              onChange={(event) => updateDraftInput({ diaryText: event.target.value })}
            />
          </label>

          <div className="helper-list">
            <p>입력 팁</p>
            <ul>
              <li>사건 순서가 있으면 결과가 더 자연스럽습니다.</li>
              <li>감정을 직접 쓰지 않아도 자동 분석이 기본으로 들어갑니다.</li>
              <li>원문은 생성 실패가 나도 그대로 남도록 로컬에 보존됩니다.</li>
            </ul>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">감정 / 톤</p>
              <h2>어떤 분위기로 만화화할까요?</h2>
            </div>
          </div>

          <div className="tone-row">
            {TONE_OPTIONS.map((tone) => {
              return (
                <ToneChip
                  key={tone}
                  tone={tone}
                  active={draftInput.toneSelection === tone}
                  onClick={() => updateDraftInput({ toneSelection: tone })}
                />
              )
            })}
          </div>

          <p className="inline-note">
            기본 톤은 현재 {settings.defaultTone === 'auto' ? '자동 분석' : '사용자 설정'} 으로 준비돼
            있어요. 바뀐 결과가 보고 싶다면 생성 후에도 전체 톤을 다시 돌릴 수 있습니다.
          </p>
        </section>

        <section className="sticky-action">
          <div>
            <p className="eyebrow">1분 안에 첫 결과 목표</p>
            <strong>{isGenerating ? '생성 준비 중' : '일기 → 4컷 스크립트 → 네 컷 시트'}</strong>
          </div>
          <button className="primary-button" type="submit" disabled={isGenerating}>
            {isGenerating ? '생성 중...' : '네 컷 만들기'}
          </button>
        </section>
      </form>
    </section>
  )
}
