export const TONE_OPTIONS = [
  'auto',
  'cute',
  'comic',
  'warm',
  'plain',
  'comfort',
] as const

export type ToneOption = (typeof TONE_OPTIONS)[number]
export type ResolvedTone = Exclude<ToneOption, 'auto'>
export type MediaBackend =
  | 'codex-scene'
  | 'codex-svg'
  | 'mock'
  | 'openai-image'
  | 'gemini-image'
  | 'sora'
export type MediaAssetKind = 'illustration' | 'video-thumbnail'

export const MEDIA_BACKEND_LABELS: Record<MediaBackend, string> = {
  'codex-scene': 'Codex PNG 합성',
  'codex-svg': 'Codex SVG',
  mock: '모의 렌더',
  'openai-image': 'OpenAI 이미지',
  'gemini-image': 'Gemini 이미지',
  sora: 'Sora 썸네일',
}

export const TONE_LABELS: Record<ToneOption, string> = {
  auto: '자동 분석',
  cute: '귀엽게',
  comic: '코믹하게',
  warm: '따뜻하게',
  plain: '담담하게',
  comfort: '위로되게',
}

export const QUICK_ACTIONS = ['funny', 'emotional', 'shorter'] as const

export type QuickAction = (typeof QUICK_ACTIONS)[number]

export const QUICK_ACTION_LABELS: Record<QuickAction, string> = {
  funny: '더 웃기게',
  emotional: '더 감성적으로',
  shorter: '더 짧게',
}

export type StoryBeat = 'setup' | 'build' | 'twist' | 'ending'
export type EmotionKey =
  | 'joy'
  | 'tired'
  | 'awkward'
  | 'calm'
  | 'comfort'
  | 'proud'
export type PanelProp =
  | 'coffee'
  | 'phone'
  | 'laptop'
  | 'train'
  | 'bed'
  | 'food'
  | 'rain'
  | 'spark'
  | 'cat'

export interface ComicPanel {
  id: string
  beat: StoryBeat
  beatLabel: string
  caption: string
  dialogue: string
  emotion: string
  emotionKey: EmotionKey
  scene: string
  artPrompt: string
  imageUrl: string
  sourceBackend: MediaBackend
  sourceAssetKind: MediaAssetKind
  videoUrl?: string
  palette: [string, string, string]
  prop: PanelProp
}

export interface ComicBase {
  diaryText: string
  title: string
  summary: string
  moodLine: string
  toneSelection: ToneOption
  resolvedTone: ResolvedTone
  panels: ComicPanel[]
  createdAt: string
  updatedAt: string
}

export interface ComicDraft extends ComicBase {
  sourceEntryId?: string
  lastQuickAction: QuickAction | null
}

export interface ComicEntry extends ComicBase {
  id: string
  savedAt: string
}

export interface DraftInput {
  diaryText: string
  toneSelection: ToneOption
}

export interface UserSettings {
  autoSave: boolean
  privateMode: boolean
  keepHistory: boolean
  defaultTone: ToneOption
}

export type GenerationStepId = 'script' | 'prompts' | 'images' | 'layout'

export interface GenerationSession {
  runId: string
  jobId?: string
  request: DraftInput
  status: 'running' | 'done' | 'failed'
  step: GenerationStepId
  message: string
  startedAt: string
  mediaBackend?: MediaBackend
  error?: string
}

export const GENERATION_STEPS: Array<{
  id: GenerationStepId
  label: string
  description: string
}> = [
  {
    id: 'script',
    label: '스토리 정리',
    description: '일기를 사건 흐름이 있는 네 컷 스크립트로 다듬고 있어요.',
  },
  {
    id: 'prompts',
    label: '컷 설계',
    description: '컷마다 장면과 감정, 대사 길이를 정리하고 있어요.',
  },
  {
    id: 'images',
    label: '장면 생성',
    description: '각 컷에 맞는 만화 장면을 그리고 있어요.',
  },
  {
    id: 'layout',
    label: '네 컷 합성',
    description: '공유하기 좋은 한 장의 네 컷 시트로 묶고 있어요.',
  },
]
