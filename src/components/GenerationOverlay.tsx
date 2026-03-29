import { ProgressSteps } from './ProgressSteps'
import {
  MEDIA_BACKEND_LABELS,
  type GenerationSession,
} from '../types'

function backendHint(generation: GenerationSession) {
  switch (generation.mediaBackend) {
    case 'codex-scene':
      return 'Codex CLI가 컷 설계 뒤에 장면 JSON을 만들고, 서버가 이를 바탕으로 PNG 컷을 합성하고 있어요.'
    case 'codex-svg':
      return 'Codex CLI가 컷 설계 뒤에 각 패널 SVG 이미지를 직접 만들고 있어요.'
    case 'sora':
      return 'Codex CLI가 컷 설계를 마친 뒤 Sora에서 장면을 만들고 썸네일을 가져오고 있어요.'
    case 'openai-image':
      return 'Codex CLI가 컷 설계를 마친 뒤 OpenAI 이미지 생성기로 각 컷을 그리고 있어요.'
    case 'gemini-image':
      return 'Codex CLI가 컷 설계를 마친 뒤 Gemini 이미지 모델로 각 컷을 그리고 있어요.'
    case 'mock':
      return '외부 이미지 API 키가 없어 현재는 모의 컷으로 렌더링 중입니다. OpenAI 또는 Gemini 설정 후 실제 생성으로 바꿀 수 있어요.'
    default:
      return '생성 파이프라인을 준비하고 있어요.'
  }
}

export function GenerationOverlay({
  generation,
  onCancel,
}: {
  generation: GenerationSession
  onCancel: () => void
}) {
  return (
    <div className="generation-overlay" role="alertdialog" aria-modal="true" aria-live="assertive">
      <div className="generation-overlay-card">
        <div className="generation-orb" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <p className="eyebrow">생성 중</p>
        <h2>완성 전에는 잠시 다른 화면으로 나갈 수 없어요</h2>
        <p className="generation-overlay-copy">{generation.message}</p>
        <p className="inline-note">{backendHint(generation)}</p>

        <div className="generation-overlay-meta">
          <span className="inline-badge">
            백엔드 · {generation.mediaBackend ? MEDIA_BACKEND_LABELS[generation.mediaBackend] : '준비 중'}
          </span>
          {generation.jobId ? <span className="inline-badge">작업 ID · {generation.jobId}</span> : null}
        </div>

        <ProgressSteps currentStep={generation.step} />

        <div className="generation-overlay-actions">
          <p className="inline-note">
            브라우저 닫기, 뒤로 가기, 다른 메뉴 이동은 생성이 끝날 때까지 막아두었습니다.
          </p>
          <button className="ghost-button" type="button" onClick={onCancel}>
            생성 취소
          </button>
        </div>
      </div>
    </div>
  )
}
