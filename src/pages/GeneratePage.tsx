import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProgressSteps } from '../components/ProgressSteps'
import { ScreenHeader } from '../components/ScreenHeader'
import { useApp } from '../providers/AppProvider'
import { MEDIA_BACKEND_LABELS } from '../types'

export function GeneratePage() {
  const navigate = useNavigate()
  const { activeDraft, generation, cancelGeneration } = useApp()

  useEffect(() => {
    if (activeDraft && generation?.status === 'done') {
      navigate('/result', { replace: true })
    }
  }, [activeDraft, generation?.status, navigate])

  if (!generation) {
    return (
      <section className="screen">
        <div className="empty-state">
          <h2>진행 중인 생성이 없어요</h2>
          <p>일기를 먼저 입력하면 단계별 진행 상태와 함께 결과 보기 화면으로 이동합니다.</p>
          <Link className="primary-button" to="/create">
            생성하러 가기
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="screen">
      <ScreenHeader
        eyebrow="생성 진행"
        title="현재 백엔드가 컷 설계와 이미지 생성 단계를 이어가고 있습니다"
        description="서버가 현재 단계를 직접 내려주고, 생성 중에는 로딩 오버레이와 이탈 방지까지 함께 동작합니다."
      />

      {generation.status === 'failed' ? (
        <section className="section">
          <div className="empty-state">
            <h2>생성 중 문제가 생겼어요</h2>
            <p>{generation.error ?? generation.message}</p>
            <div className="button-row">
              <Link className="primary-button" to="/create">
                다시 시도하기
              </Link>
              <button
                className="ghost-button"
                type="button"
                onClick={async () => {
                  await cancelGeneration()
                  navigate('/create', { replace: true })
                }}
              >
                입력으로 돌아가기
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="progress-stage">
        <div className="progress-bubble">
          <span>NOW</span>
          <strong>{generation.message}</strong>
        </div>
        <p className="progress-diary">{generation.request.diaryText}</p>
        {generation.mediaBackend ? (
          <p className="inline-note">현재 생성 백엔드: {MEDIA_BACKEND_LABELS[generation.mediaBackend]}</p>
        ) : null}
        {generation.jobId ? <p className="inline-note">백그라운드 작업 ID: {generation.jobId}</p> : null}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">단계 상태</p>
            <h2>현재 생성 파이프라인</h2>
          </div>
        </div>
        <ProgressSteps currentStep={generation.step} />
      </section>

      <section className="section">
        <div className="callout-row">
          <p>완성 전에는 다른 화면 이동과 브라우저 이탈이 막혀 있어요. 원문 텍스트는 그대로 보존됩니다.</p>
          <div className="button-row compact">
            <button
              className="ghost-button"
              type="button"
              onClick={async () => {
                await cancelGeneration()
                navigate('/create', { replace: true })
              }}
            >
              취소
            </button>
          </div>
        </div>
      </section>
    </section>
  )
}
