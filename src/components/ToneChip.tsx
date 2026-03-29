import { TONE_LABELS, type ToneOption } from '../types'

export function ToneChip({
  tone,
  active,
  disabled = false,
  onClick,
}: {
  tone: ToneOption
  active: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className={`tone-chip${active ? ' active' : ''}`}
      data-tone={tone}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {TONE_LABELS[tone]}
    </button>
  )
}
