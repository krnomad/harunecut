import { ScreenHeader } from '../components/ScreenHeader'
import { ToneChip } from '../components/ToneChip'
import { useApp } from '../providers/AppProvider'
import { TONE_OPTIONS } from '../types'

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className="toggle-row">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <button
        className={`switch${checked ? ' on' : ''}`}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
      >
        <span />
      </button>
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings, clearEntries } = useApp()

  return (
    <section className="screen">
      <ScreenHeader
        eyebrow="설정"
        title="비공개 기본값과 저장 옵션을 먼저"
        description="민감한 일기 데이터를 다루는 앱인 만큼 프라이버시, 기본 톤, 로컬 보관 방식부터 명확하게 만질 수 있게 두었습니다."
      />

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">데이터 / 프라이버시</p>
            <h2>기록 보관 방식</h2>
          </div>
        </div>

        <ToggleRow
          label="비공개 기본값"
          description="공유보다 개인 기록 관점을 먼저 두는 기본 설정입니다."
          checked={settings.privateMode}
          onToggle={() => updateSettings({ privateMode: !settings.privateMode })}
        />
        <ToggleRow
          label="생성 후 자동 저장"
          description="결과 화면에서 저장 버튼을 누르기 전에도 보관함에 자동으로 넣습니다."
          checked={settings.autoSave}
          onToggle={() => updateSettings({ autoSave: !settings.autoSave })}
        />
        <ToggleRow
          label="로컬 히스토리 유지"
          description="끄면 새로고침 이후 보관함을 남기지 않고 일회성 체험에 가깝게 사용합니다."
          checked={settings.keepHistory}
          onToggle={() => updateSettings({ keepHistory: !settings.keepHistory })}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">기본 톤</p>
            <h2>새 기록의 기본 감정 설정</h2>
          </div>
        </div>
        <div className="tone-row">
          {TONE_OPTIONS.map((tone) => {
            return (
              <ToneChip
                key={tone}
                tone={tone}
                active={settings.defaultTone === tone}
                onClick={() => updateSettings({ defaultTone: tone })}
              />
            )
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">관리</p>
            <h2>보관함 정리</h2>
          </div>
        </div>
        <p className="inline-note">
          삭제 기능은 명확하고 즉시 접근 가능해야 한다는 PRD 원칙에 맞춰 상세 화면과 설정 둘 다에서 접근할 수
          있게 두었습니다.
        </p>
        <button
          className="ghost-button danger"
          type="button"
          onClick={() => {
            const shouldClear = window.confirm('보관함을 모두 비울까요? 이 작업은 되돌릴 수 없어요.')

            if (shouldClear) {
              clearEntries()
            }
          }}
        >
          보관함 전체 비우기
        </button>
      </section>
    </section>
  )
}
