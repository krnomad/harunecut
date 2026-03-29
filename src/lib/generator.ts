import type {
  ComicDraft,
  ComicPanel,
  DraftInput,
  EmotionKey,
  GenerationStepId,
  PanelProp,
  QuickAction,
  ResolvedTone,
  StoryBeat,
} from '../types'

const stageMessages: Record<GenerationStepId, string> = {
  script: '이야기를 네 컷 구조로 정리하는 중',
  prompts: '컷별 장면과 감정 프롬프트를 다듬는 중',
  images: '만화 장면을 그리는 중',
  layout: '네 컷 시트를 완성하는 중',
}

const stageDelays: Record<GenerationStepId, number> = {
  script: 850,
  prompts: 650,
  images: 1100,
  layout: 700,
}

const toneProfiles: Record<
  ResolvedTone,
  {
    palettes: Array<[string, string, string]>
    summary: string[]
    endings: string[]
    labels: string[]
    promptTone: string
  }
> = {
  cute: {
    palettes: [
      ['#fff2b7', '#ffdde5', '#ff8aa1'],
      ['#f8f0ff', '#d8d0ff', '#7f66ff'],
      ['#e7fbf2', '#b8efd9', '#39aa7f'],
      ['#fff3e2', '#ffd6ac', '#f07e4d'],
    ],
    summary: [
      '작은 사건도 몽글한 리듬으로 남기는 하루.',
      '평범한 장면이 귀엽고 선명하게 기억되는 하루.',
    ],
    endings: ['작지만 꽤 귀여운 결말이었다.', '생각보다 마음이 몽글하게 남았다.'],
    labels: ['말랑한 하루', '귀여운 결말', '몽글한 기록'],
    promptTone: 'soft, playful, rounded comic illustration',
  },
  comic: {
    palettes: [
      ['#ffe8ba', '#ffc466', '#f06f2d'],
      ['#fff4e5', '#ffdfae', '#fb5a41'],
      ['#f4f6ff', '#d5dcff', '#5a70ff'],
      ['#fff0ef', '#ffc0bb', '#e14335'],
    ],
    summary: [
      '조금 꼬였지만 오치가 살아 있는 하루.',
      '우당탕 지나가도 결국 웃음 포인트가 남는 하루.',
    ],
    endings: ['결국 오치가 제대로 찍혔다.', '오늘의 결말은 생각보다 웃겼다.'],
    labels: ['우당탕 모드', '오치 강한 날', '하이라이트 많은 날'],
    promptTone: 'dynamic, punchy, expressive comic illustration',
  },
  warm: {
    palettes: [
      ['#fff2df', '#ffd7b3', '#df714b'],
      ['#fff4e8', '#f8cfa6', '#ba7a50'],
      ['#f4f6ee', '#d9e6be', '#6f8d5a'],
      ['#eef4f7', '#bfd7df', '#538297'],
    ],
    summary: [
      '바빴던 장면 사이에도 따뜻한 여운이 남는 하루.',
      '사건보다 감정의 온도가 오래 남는 하루.',
    ],
    endings: ['천천히 마음이 놓이는 마무리였다.', '결국 오늘도 다정한 여운이 남았다.'],
    labels: ['따뜻한 여운', '온기 있는 기록', '차분한 햇살'],
    promptTone: 'warm paper comic, gentle light, cozy atmosphere',
  },
  plain: {
    palettes: [
      ['#f1ede5', '#ddd3c3', '#7b6f61'],
      ['#eff2f3', '#d5dde1', '#6a7c86'],
      ['#f6f4f0', '#ded7ce', '#837566'],
      ['#edeef7', '#cfd3e7', '#5f6783'],
    ],
    summary: [
      '크게 꾸미지 않고 오늘의 흐름을 또렷하게 남기는 기록.',
      '사건과 감정을 담백하게 정리한 하루.',
    ],
    endings: ['그렇게 오늘도 차분히 정리됐다.', '조용하지만 분명한 끝맺음이었다.'],
    labels: ['담담한 기록', '무심한 하루', '정리된 흐름'],
    promptTone: 'clean slice-of-life comic, simple framing, calm mood',
  },
  comfort: {
    palettes: [
      ['#fef1df', '#ffd4a8', '#de7b55'],
      ['#fff1f4', '#ffd6df', '#e46f89'],
      ['#eef7f2', '#c6ead2', '#529d77'],
      ['#f2effb', '#dbd2ff', '#7a69d8'],
    ],
    summary: [
      '쉽지 않았지만 스스로를 다독이며 버틴 하루.',
      '조금 흔들려도 끝내 마음을 토닥인 하루.',
    ],
    endings: ['그래도 오늘의 나를 잘 다독였다.', '조금 힘들어도 결국은 잘 버틴 하루였다.'],
    labels: ['토닥이는 결말', '위로가 필요한 날', '조용한 회복'],
    promptTone: 'comforting comic illustration, gentle color, reassuring mood',
  },
}

const beatLabels: Record<StoryBeat, string> = {
  setup: '상황 소개',
  build: '전개',
  twist: '감정 고조',
  ending: '결말',
}

function sleep(duration: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration)
  })
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function shorten(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function stripPunctuation(text: string) {
  return text.replace(/[.!?…~]+$/u, '').trim()
}

function hashString(text: string) {
  let total = 0

  for (let index = 0; index < text.length; index += 1) {
    total = (total << 5) - total + text.charCodeAt(index)
    total |= 0
  }

  return Math.abs(total)
}

function pickVariant(options: string[], seed: string) {
  return options[hashString(seed) % options.length]
}

function pickProp(text: string): PanelProp {
  const keywordGroups: Array<{ prop: PanelProp; keywords: string[] }> = [
    { prop: 'coffee', keywords: ['카페', '커피', '라떼', '카푸치노', '카공'] },
    { prop: 'phone', keywords: ['전화', '문자', '연락', '인스타', '휴대폰'] },
    { prop: 'laptop', keywords: ['회사', '업무', '회의', '노트북', '과제', '발표'] },
    { prop: 'train', keywords: ['지하철', '버스', '출근', '퇴근', '이동'] },
    { prop: 'bed', keywords: ['집', '침대', '잠', '누웠', '이불'] },
    { prop: 'food', keywords: ['밥', '점심', '저녁', '식당', '빵', '디저트'] },
    { prop: 'rain', keywords: ['비', '우산', '흐림', '젖었'] },
    { prop: 'cat', keywords: ['고양이', '강아지', '반려', '냥이'] },
  ]

  const matched = keywordGroups.find((group) => {
    return group.keywords.some((keyword) => text.includes(keyword))
  })

  return matched?.prop ?? 'spark'
}

function inferToneFromText(text: string): ResolvedTone {
  const comicScore = ['웃', '황당', '어이', '멘붕', '지각', '망했', '실수'].filter((word) =>
    text.includes(word),
  ).length
  const comfortScore = ['힘들', '지쳤', '속상', '불안', '울', '외롭'].filter((word) =>
    text.includes(word),
  ).length
  const warmScore = ['고마웠', '다정', '친구', '가족', '산책', '햇살'].filter((word) =>
    text.includes(word),
  ).length
  const cuteScore = ['귀엽', '빵', '고양이', '강아지', '카페', '디저트'].filter((word) =>
    text.includes(word),
  ).length

  if (comicScore >= 2) {
    return 'comic'
  }

  if (comfortScore >= 2) {
    return 'comfort'
  }

  if (warmScore >= 2) {
    return 'warm'
  }

  if (cuteScore >= 2) {
    return 'cute'
  }

  return 'plain'
}

function inferEmotion(text: string): { key: EmotionKey; label: string } {
  if (['뿌듯', '성공', '해냈', '완료', '칭찬'].some((word) => text.includes(word))) {
    return { key: 'proud', label: '뿌듯함' }
  }

  if (['속상', '불안', '지쳤', '피곤', '울', '힘들'].some((word) => text.includes(word))) {
    return { key: 'comfort', label: '지친 마음' }
  }

  if (['당황', '민망', '어색', '실수', '멘붕'].some((word) => text.includes(word))) {
    return { key: 'awkward', label: '당황스러움' }
  }

  if (['웃', '신났', '재밌', '좋았', '설렜'].some((word) => text.includes(word))) {
    return { key: 'joy', label: '들뜸' }
  }

  if (['차분', '산책', '정리', '천천히', '고요'].some((word) => text.includes(word))) {
    return { key: 'calm', label: '잔잔함' }
  }

  return { key: 'tired', label: '복합적인 하루' }
}

function focusLabelFromProp(prop: PanelProp) {
  const labels: Record<PanelProp, string> = {
    coffee: '카페 장면',
    phone: '연락의 순간',
    laptop: '일과 할 일',
    train: '이동 중인 하루',
    bed: '집에서의 마무리',
    food: '먹고 쉬는 장면',
    rain: '날씨가 끼어든 하루',
    spark: '예상 밖의 포인트',
    cat: '귀여운 순간',
  }

  return labels[prop]
}

function compressToFour(parts: string[]) {
  const buckets = ['', '', '', '']

  parts.forEach((part, index) => {
    const bucket = Math.min(3, Math.floor((index * 4) / parts.length))
    buckets[bucket] = [buckets[bucket], part].filter(Boolean).join(' ')
  })

  return buckets.map((bucket, index) => {
    return bucket || parts[Math.min(index, parts.length - 1)] || ''
  })
}

function splitIntoFourSegments(text: string) {
  const sentenceParts = text
    .split(/(?:[.!?]+|\n+)/u)
    .map((part) => normalizeText(part))
    .filter(Boolean)

  if (sentenceParts.length >= 4) {
    return compressToFour(sentenceParts)
  }

  const clauseParts = text
    .split(/[,\n]/u)
    .map((part) => normalizeText(part))
    .filter(Boolean)

  if (clauseParts.length >= 4) {
    return compressToFour(clauseParts)
  }

  const words = text.split(/\s+/u).filter(Boolean)

  if (words.length === 0) {
    return ['', '', '', '']
  }

  const groupSize = Math.max(1, Math.ceil(words.length / 4))
  const parts = Array.from({ length: 4 }, (_, index) => {
    return normalizeText(words.slice(index * groupSize, (index + 1) * groupSize).join(' '))
  }).filter(Boolean)

  return compressToFour(parts.length ? parts : [text])
}

function buildTitle(text: string, tone: ResolvedTone, prop: PanelProp) {
  const excerpt = shorten(stripPunctuation(text), 12)
  const toneLabel = pickVariant(toneProfiles[tone].labels, `${text}-${tone}`)

  return `${excerpt || focusLabelFromProp(prop)} · ${toneLabel}`
}

function buildSummary(text: string, tone: ResolvedTone, prop: PanelProp, emotion: string) {
  const base = pickVariant(toneProfiles[tone].summary, `${text}-${tone}-summary`)
  return `${focusLabelFromProp(prop)} 속 ${emotion}을 지나 ${base}`
}

function buildEndingLine(tone: ResolvedTone, seed: string) {
  return pickVariant(toneProfiles[tone].endings, `${seed}-${tone}-ending`)
}

function ensureSentence(line: string) {
  const cleaned = stripPunctuation(line)
  return cleaned.endsWith('다') || cleaned.endsWith('요') || cleaned.endsWith('어')
    ? cleaned
    : `${cleaned}.`
}

function buildDialogue(
  segment: string,
  beat: StoryBeat,
  tone: ResolvedTone,
  emotionLabel: string,
  focusLabel: string,
  seed: string,
) {
  const concise = shorten(stripPunctuation(segment), beat === 'ending' ? 18 : 22)

  if (beat === 'setup') {
    return shorten(`오늘의 시작은 ${concise}`, 24)
  }

  if (beat === 'build') {
    return shorten(`그러다 ${concise}`, 24)
  }

  if (beat === 'twist') {
    return shorten(`${concise}. ${emotionLabel}이 확 올라왔다`, 28)
  }

  return shorten(`${buildEndingLine(tone, seed)} ${focusLabel}이 남았다`, 28)
}

function buildSceneLabel(segment: string, prop: PanelProp) {
  const concise = shorten(stripPunctuation(segment), 14)
  return concise || focusLabelFromProp(prop)
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function propMarkup(prop: PanelProp, accent: string, ink: string) {
  switch (prop) {
    case 'coffee':
      return `<g opacity="0.95"><rect x="430" y="330" width="72" height="86" rx="18" fill="#fffaf1" stroke="${ink}" stroke-width="10"/><path d="M503 350C532 350 534 395 503 395" fill="none" stroke="${ink}" stroke-width="10"/><path d="M447 305C441 286 452 272 447 252" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><path d="M469 303C463 284 474 270 469 250" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/></g>`
    case 'phone':
      return `<g opacity="0.95"><rect x="444" y="314" width="92" height="154" rx="24" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><rect x="463" y="342" width="54" height="96" rx="10" fill="${accent}" opacity="0.3"/><circle cx="490" cy="447" r="7" fill="${ink}"/></g>`
    case 'laptop':
      return `<g opacity="0.95"><rect x="408" y="312" width="128" height="90" rx="14" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><path d="M392 424H552L524 462H420L392 424Z" fill="${accent}" opacity="0.35" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/></g>`
    case 'train':
      return `<g opacity="0.95"><rect x="394" y="320" width="150" height="120" rx="22" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><rect x="420" y="344" width="32" height="36" rx="6" fill="${accent}" opacity="0.35"/><rect x="462" y="344" width="32" height="36" rx="6" fill="${accent}" opacity="0.35"/><rect x="504" y="344" width="20" height="36" rx="6" fill="${accent}" opacity="0.35"/><circle cx="430" cy="440" r="10" fill="${ink}"/><circle cx="514" cy="440" r="10" fill="${ink}"/></g>`
    case 'bed':
      return `<g opacity="0.95"><rect x="390" y="350" width="166" height="72" rx="22" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><rect x="404" y="322" width="70" height="42" rx="18" fill="${accent}" opacity="0.35" stroke="${ink}" stroke-width="10"/><path d="M402 424V462" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M548 424V462" stroke="${ink}" stroke-width="10" stroke-linecap="round"/></g>`
    case 'food':
      return `<g opacity="0.95"><circle cx="484" cy="380" r="64" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><path d="M448 380C460 350 486 350 520 388" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/><path d="M544 324L560 288" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M565 330L588 284" stroke="${ink}" stroke-width="6" stroke-linecap="round"/></g>`
    case 'rain':
      return `<g opacity="0.95"><path d="M446 428C446 372 482 336 528 318C548 366 544 430 544 430H446Z" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><path d="M494 310V466" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M398 278L412 310" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><path d="M440 252L454 284" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><path d="M542 250L556 282" stroke="${accent}" stroke-width="8" stroke-linecap="round"/></g>`
    case 'cat':
      return `<g opacity="0.95"><circle cx="486" cy="376" r="66" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><path d="M432 340L450 286L470 336" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><path d="M502 336L526 286L540 344" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><circle cx="464" cy="374" r="6" fill="${ink}"/><circle cx="508" cy="374" r="6" fill="${ink}"/><path d="M476 392C484 402 492 402 500 392" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/></g>`
    case 'spark':
    default:
      return `<g opacity="0.95"><path d="M492 294L510 338L556 342L520 370L532 416L492 392L452 416L464 370L428 342L474 338L492 294Z" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><circle cx="548" cy="284" r="10" fill="${accent}"/><circle cx="582" cy="324" r="8" fill="${accent}" opacity="0.7"/></g>`
  }
}

function faceMarkup(emotionKey: EmotionKey, ink: string, accent: string) {
  const commonEyes = `<circle cx="286" cy="268" r="8" fill="${ink}"/><circle cx="350" cy="268" r="8" fill="${ink}"/>`

  switch (emotionKey) {
    case 'joy':
      return `${commonEyes}<path d="M274 314C296 340 340 340 362 314" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><circle cx="384" cy="248" r="8" fill="${accent}"/>`
    case 'proud':
      return `${commonEyes}<path d="M274 312C300 330 338 330 364 312" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M250 232L258 250L278 252L264 266L268 286L250 276L232 286L236 266L222 252L242 250Z" fill="${accent}" opacity="0.9"/>`
    case 'comfort':
      return `${commonEyes}<path d="M280 322C304 304 334 304 356 322" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M376 294C390 310 390 332 374 344" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`
    case 'awkward':
      return `${commonEyes}<path d="M278 314C296 304 326 324 358 314" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M248 246C252 232 260 222 270 218" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`
    case 'calm':
      return `${commonEyes}<path d="M284 316H356" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><circle cx="386" cy="228" r="6" fill="${accent}" opacity="0.7"/>`
    case 'tired':
    default:
      return `<path d="M270 268C278 264 290 264 298 268" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="M338 268C346 264 358 264 366 268" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="M292 320H350" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M380 248C394 258 396 280 384 296" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`
  }
}

function createArtworkDataUrl({
  panel,
  tone,
  variantSalt,
}: {
  panel: Omit<ComicPanel, 'imageUrl'>
  tone: ResolvedTone
  variantSalt: string
}) {
  const [from, to, accent] = panel.palette
  const ink = '#241b17'
  const offset = (hashString(`${panel.scene}-${variantSalt}-${tone}`) % 18) - 9
  const label = escapeXml(shorten(panel.scene, 12))

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${from}"/>
          <stop offset="100%" stop-color="${to}"/>
        </linearGradient>
        <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="2" fill="${accent}" opacity="0.22"/>
        </pattern>
      </defs>
      <rect width="640" height="640" rx="52" fill="url(#bg)"/>
      <rect x="0" y="0" width="640" height="640" fill="url(#dots)"/>
      <circle cx="${120 + offset}" cy="120" r="88" fill="${accent}" opacity="0.18"/>
      <circle cx="${530 - offset}" cy="162" r="104" fill="#fffaf1" opacity="0.34"/>
      <rect x="64" y="72" width="148" height="50" rx="16" fill="#fffaf1" opacity="0.92"/>
      <text x="138" y="104" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${ink}">${label}</text>
      <ellipse cx="320" cy="532" rx="184" ry="44" fill="#000" opacity="0.12"/>
      <rect x="150" y="184" width="256" height="248" rx="66" fill="#fff8ef" stroke="${ink}" stroke-width="10"/>
      <circle cx="${320 + offset}" cy="274" r="92" fill="#fff8ef" stroke="${ink}" stroke-width="10"/>
      <path d="M220 428C240 472 400 472 420 428" fill="${accent}" opacity="0.28"/>
      <rect x="244" y="390" width="152" height="110" rx="42" fill="#fff8ef" stroke="${ink}" stroke-width="10"/>
      ${faceMarkup(panel.emotionKey, ink, accent)}
      ${propMarkup(panel.prop, accent, ink)}
      <path d="M198 170C214 146 242 132 274 132" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
      <path d="M384 132C416 132 442 146 458 170" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function buildPanels(
  text: string,
  resolvedTone: ResolvedTone,
  emotion: { key: EmotionKey; label: string },
  prop: PanelProp,
  variantSalt: string,
) {
  const focusLabel = focusLabelFromProp(prop)
  const segments = splitIntoFourSegments(text)
  const beats: StoryBeat[] = ['setup', 'build', 'twist', 'ending']

  return segments.map((segment, index) => {
    const beat = beats[index]
    const palette = toneProfiles[resolvedTone].palettes[index]
    const scene = buildSceneLabel(segment, prop)
    const basePanel: Omit<ComicPanel, 'imageUrl'> = {
      id: crypto.randomUUID(),
      beat,
      beatLabel: beatLabels[beat],
      caption: shorten(stripPunctuation(segment), 28) || focusLabel,
      dialogue: ensureSentence(
        buildDialogue(segment, beat, resolvedTone, emotion.label, focusLabel, `${variantSalt}-${index}`),
      ),
      emotion: emotion.label,
      emotionKey: emotion.key,
      scene,
      artPrompt: `${toneProfiles[resolvedTone].promptTone}, single protagonist, ${scene}, ${emotion.label}, minimal background, simple composition for caption overlay`,
      sourceBackend: 'mock',
      sourceAssetKind: 'illustration',
      palette,
      prop,
    }

    return {
      ...basePanel,
      imageUrl: createArtworkDataUrl({
        panel: basePanel,
        tone: resolvedTone,
        variantSalt: `${variantSalt}-${index}`,
      }),
    }
  })
}

function buildDraft(request: DraftInput, variantSalt = 'base'): ComicDraft {
  const cleaned = normalizeText(request.diaryText)
  const resolvedTone = request.toneSelection === 'auto' ? inferToneFromText(cleaned) : request.toneSelection
  const prop = pickProp(cleaned)
  const emotion = inferEmotion(cleaned)
  const now = new Date().toISOString()

  return {
    diaryText: cleaned,
    toneSelection: request.toneSelection,
    resolvedTone,
    title: buildTitle(cleaned, resolvedTone, prop),
    summary: buildSummary(cleaned, resolvedTone, prop, emotion.label),
    moodLine: `${emotion.label}이 남은 ${focusLabelFromProp(prop)}`,
    panels: buildPanels(cleaned, resolvedTone, emotion, prop, variantSalt),
    createdAt: now,
    updatedAt: now,
    lastQuickAction: null,
  }
}

export async function generateComic(
  request: DraftInput,
  options?: {
    onStage?: (step: GenerationStepId, message: string) => boolean | void
  },
) {
  for (const step of ['script', 'prompts', 'images', 'layout'] as GenerationStepId[]) {
    const keepGoing = options?.onStage?.(step, stageMessages[step])

    if (keepGoing === false) {
      throw new Error('generation-cancelled')
    }

    await sleep(stageDelays[step])
  }

  return buildDraft(request)
}

export async function regenerateDraftPanel(draft: ComicDraft, panelId: string) {
  await sleep(500)

  const regeneratedDraft = buildDraft(
    {
      diaryText: draft.diaryText,
      toneSelection: draft.toneSelection,
    },
    `${panelId}-${Date.now()}`,
  )

  const currentIndex = draft.panels.findIndex((panel) => panel.id === panelId)
  const panels = draft.panels.map((panel, index) => {
    return index === currentIndex ? regeneratedDraft.panels[index] : panel
  })

  return {
    ...draft,
    panels,
    updatedAt: new Date().toISOString(),
  }
}

export async function regenerateDraftTone(draft: ComicDraft, toneSelection: DraftInput['toneSelection']) {
  await sleep(750)

  const regeneratedDraft = buildDraft(
    {
      diaryText: draft.diaryText,
      toneSelection,
    },
    `tone-${toneSelection}-${Date.now()}`,
  )

  return {
    ...regeneratedDraft,
    sourceEntryId: draft.sourceEntryId,
  }
}

function funnyLine(line: string, seed: string) {
  const suffixes = [' 오치가 제대로 왔다.', ' 생각보다 더 웃겼다.', ' 결국 한 컷이 더 필요했다.']
  return shorten(`${stripPunctuation(line)}${pickVariant(suffixes, seed)}`, 30)
}

function emotionalLine(line: string, seed: string) {
  const suffixes = [' 마음에 오래 남았다.', ' 감정이 조금 더 짙어졌다.', ' 묘하게 여운이 길었다.']
  return shorten(`${stripPunctuation(line)}${pickVariant(suffixes, seed)}`, 30)
}

function shorterLine(line: string) {
  return shorten(stripPunctuation(line), 16)
}

export function applyQuickActionToDraft(draft: ComicDraft, action: QuickAction) {
  const nextPanels = draft.panels.map((panel, index) => {
    if (action === 'funny') {
      return {
        ...panel,
        dialogue: funnyLine(panel.dialogue, `${panel.id}-${index}`),
      }
    }

    if (action === 'emotional') {
      return {
        ...panel,
        dialogue: emotionalLine(panel.dialogue, `${panel.id}-${index}`),
        caption: shorten(`${stripPunctuation(panel.caption)}의 감정이 더 선명해졌다`, 28),
      }
    }

    return {
      ...panel,
      caption: shorterLine(panel.caption),
      dialogue: shorterLine(panel.dialogue),
    }
  })

  const nextSummary =
    action === 'funny'
      ? shorten(`${stripPunctuation(draft.summary)} 예상보다 웃긴 결말이 붙었다.`, 46)
      : action === 'emotional'
        ? shorten(`${stripPunctuation(draft.summary)} 감정의 농도를 한 톤 올렸다.`, 46)
        : shorten(draft.summary, 28)

  return {
    ...draft,
    panels: nextPanels,
    summary: nextSummary,
    updatedAt: new Date().toISOString(),
    lastQuickAction: action,
  }
}
