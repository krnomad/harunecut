import sharp from 'sharp'
import type {
  EmotionKey,
  PanelProp,
  ResolvedTone,
} from '../src/types'

export type SceneSetting =
  | 'bedroom'
  | 'cafe'
  | 'office'
  | 'street'
  | 'transit'
  | 'bathroom'
  | 'home'
  | 'park'

export type SceneFraming = 'left' | 'center' | 'right'
export type SceneShot = 'close' | 'mid' | 'wide'
export type SceneAction =
  | 'running'
  | 'sitting'
  | 'walking'
  | 'standing'
  | 'slumping'
  | 'reaching'
  | 'resting'
  | 'celebrating'

export type SceneWeather = 'indoor' | 'clear' | 'rain' | 'cloudy'
export type SceneAccent = 'none' | 'speed' | 'steam' | 'sparkle' | 'glow'
export type SceneDetail =
  | 'window'
  | 'clock'
  | 'desk'
  | 'lamp'
  | 'plant'
  | 'shelf'
  | 'door'
  | 'sign'
  | 'cloud'
  | 'puddle'
  | 'curtain'
  | 'tile'

export interface SceneSpec {
  setting: SceneSetting
  framing: SceneFraming
  shot: SceneShot
  action: SceneAction
  weather: SceneWeather
  accent: SceneAccent
  backgroundDetails: SceneDetail[]
}

const shotScaleMap: Record<SceneShot, number> = {
  close: 1.22,
  mid: 1,
  wide: 0.82,
}

const framingXMap: Record<SceneFraming, number> = {
  left: 320,
  center: 480,
  right: 640,
}

const detailSlots = [
  { x: 158, y: 188, scale: 1 },
  { x: 784, y: 198, scale: 1 },
  { x: 182, y: 684, scale: 0.94 },
  { x: 784, y: 650, scale: 0.94 },
] as const

const toneLineWidth: Record<ResolvedTone, number> = {
  cute: 8,
  comic: 10,
  warm: 9,
  plain: 8,
  comfort: 8,
}

export async function renderScenePng({
  scene,
  emotionKey,
  palette,
  prop,
  resolvedTone,
  sceneSpec,
}: {
  scene: string
  emotionKey: EmotionKey
  palette: [string, string, string]
  prop: PanelProp
  resolvedTone: ResolvedTone
  sceneSpec: SceneSpec
}) {
  const svg = buildSceneSvg({
    scene,
    emotionKey,
    palette,
    prop,
    resolvedTone,
    sceneSpec,
  })

  return sharp(Buffer.from(svg))
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false,
    })
    .toBuffer()
}

function buildSceneSvg({
  scene,
  emotionKey,
  palette,
  prop,
  resolvedTone,
  sceneSpec,
}: {
  scene: string
  emotionKey: EmotionKey
  palette: [string, string, string]
  prop: PanelProp
  resolvedTone: ResolvedTone
  sceneSpec: SceneSpec
}) {
  const [base, support, accent] = palette
  const ink = '#241b17'
  const panelStroke = toneLineWidth[resolvedTone]
  const characterX = framingXMap[sceneSpec.framing]
  const characterScale = shotScaleMap[sceneSpec.shot]
  const propX = characterX + (sceneSpec.framing === 'left' ? 210 : sceneSpec.framing === 'right' ? -220 : 220)
  const propY = sceneSpec.setting === 'bathroom' ? 640 : 610
  const sceneHint = escapeXml(scene.slice(0, 42))

  const details = sceneSpec.backgroundDetails
    .slice(0, 3)
    .map((detail, index) => {
      const slot = detailSlots[index]
      return detailMarkup({
        detail,
        x: slot.x,
        y: slot.y,
        scale: slot.scale,
        support,
        accent,
        ink,
      })
    })
    .join('')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960" fill="none">
      <defs>
        <linearGradient id="bg" x1="60" y1="36" x2="900" y2="920" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${base}"/>
          <stop offset="100%" stop-color="${support}"/>
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="540" x2="960" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fff8ef" stop-opacity="0.88"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.22"/>
        </linearGradient>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(720 140) rotate(90) scale(220 280)">
          <stop stop-color="#fffdf8" stop-opacity="0.95"/>
          <stop offset="1" stop-color="#fffdf8" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="960" height="960" rx="64" fill="url(#bg)"/>
      <rect x="32" y="32" width="896" height="896" rx="52" fill="#fffdf8" fill-opacity="0.18"/>
      <circle cx="190" cy="140" r="120" fill="${accent}" opacity="0.18"/>
      <circle cx="790" cy="152" r="164" fill="url(#glow)"/>

      ${settingBackdropMarkup({
        setting: sceneSpec.setting,
        weather: sceneSpec.weather,
        ink,
        support,
        accent,
        panelStroke,
      })}

      ${details}
      ${weatherMarkup(sceneSpec.weather, accent)}
      ${accentMarkup(sceneSpec.accent, characterX, accent)}
      ${sceneTagMarkup(sceneHint, accent, ink)}

      ${focusPropMarkup({
        prop,
        x: propX,
        y: propY,
        scale: sceneSpec.shot === 'wide' ? 0.92 : 1.04,
        ink,
        accent,
        support,
      })}

      ${characterMarkup({
        x: characterX,
        y: sceneSpec.setting === 'bathroom' ? 610 : 626,
        scale: characterScale,
        action: sceneSpec.action,
        emotionKey,
        ink,
        accent,
        support,
      })}

      <rect x="20" y="20" width="920" height="920" rx="58" stroke="${ink}" stroke-width="${panelStroke}" opacity="0.18"/>
    </svg>
  `.trim()
}

function sceneTagMarkup(sceneHint: string, accent: string, ink: string) {
  return `
    <g opacity="0.8">
      <rect x="74" y="74" width="188" height="52" rx="18" fill="#fffaf2" stroke="${ink}" stroke-width="5"/>
      <circle cx="106" cy="100" r="10" fill="${accent}" opacity="0.9"/>
      <rect x="126" y="92" width="${Math.max(44, Math.min(sceneHint.length * 8, 110))}" height="16" rx="8" fill="${ink}" opacity="0.16"/>
    </g>
  `
}

function settingBackdropMarkup({
  setting,
  weather,
  ink,
  support,
  accent,
  panelStroke,
}: {
  setting: SceneSetting
  weather: SceneWeather
  ink: string
  support: string
  accent: string
  panelStroke: number
}) {
  const outdoorSky = `
    <rect x="54" y="70" width="852" height="510" rx="42" fill="#eef7ff" opacity="${weather === 'rain' ? '0.72' : '0.92'}"/>
    <path d="M54 612C180 548 292 566 432 602C592 642 738 618 906 544V886H54V612Z" fill="url(#floor)"/>
  `

  switch (setting) {
    case 'bedroom':
      return `
        <rect x="54" y="78" width="852" height="808" rx="42" fill="#fff9f0" opacity="0.82"/>
        <rect x="54" y="512" width="852" height="374" rx="0" fill="url(#floor)"/>
        <path d="M54 512H906" stroke="${ink}" stroke-width="${panelStroke}" opacity="0.2"/>
        <rect x="86" y="166" width="206" height="186" rx="28" fill="#f3fbff" stroke="${ink}" stroke-width="${panelStroke - 2}" opacity="0.82"/>
        <path d="M188 166V352" stroke="${ink}" stroke-width="${panelStroke - 3}" opacity="0.18"/>
      `
    case 'cafe':
      return `
        <rect x="54" y="78" width="852" height="808" rx="42" fill="#fff8ef" opacity="0.86"/>
        <rect x="54" y="544" width="852" height="342" fill="url(#floor)"/>
        <rect x="116" y="138" width="726" height="208" rx="34" fill="#f7fbff" stroke="${ink}" stroke-width="${panelStroke - 2}" opacity="0.88"/>
        <path d="M358 138V346M602 138V346" stroke="${ink}" stroke-width="${panelStroke - 4}" opacity="0.18"/>
        <rect x="82" y="420" width="796" height="38" rx="16" fill="${accent}" opacity="0.18"/>
      `
    case 'office':
      return `
        <rect x="54" y="78" width="852" height="808" rx="42" fill="#f7f9fb" opacity="0.88"/>
        <rect x="54" y="530" width="852" height="356" fill="url(#floor)"/>
        <rect x="94" y="128" width="772" height="164" rx="28" fill="#f2f7fb" stroke="${ink}" stroke-width="${panelStroke - 2}" opacity="0.84"/>
        <path d="M94 336H866" stroke="${ink}" stroke-width="${panelStroke - 4}" opacity="0.14"/>
        <rect x="84" y="420" width="796" height="140" rx="30" fill="#fffefb" stroke="${ink}" stroke-width="${panelStroke - 2}" opacity="0.42"/>
      `
    case 'street':
      return `
        ${outdoorSky}
        <path d="M114 324H302V600H64V418C64 374 86 342 114 324Z" fill="#fffaf0" opacity="0.58"/>
        <path d="M662 290H852C884 290 900 322 900 360V604H628V324C628 306 642 290 662 290Z" fill="#fffaf0" opacity="0.52"/>
        <path d="M422 566L550 566L602 886H370L422 566Z" fill="#fffef9" opacity="0.52"/>
      `
    case 'transit':
      return `
        <rect x="54" y="78" width="852" height="808" rx="42" fill="#eef3f8" opacity="0.9"/>
        <rect x="54" y="530" width="852" height="356" fill="url(#floor)"/>
        <rect x="88" y="158" width="784" height="198" rx="34" fill="#f7fbff" stroke="${ink}" stroke-width="${panelStroke - 2}" opacity="0.82"/>
        <rect x="124" y="194" width="148" height="98" rx="18" fill="${support}" opacity="0.28"/>
        <rect x="310" y="194" width="148" height="98" rx="18" fill="${support}" opacity="0.28"/>
        <rect x="496" y="194" width="148" height="98" rx="18" fill="${support}" opacity="0.28"/>
        <rect x="682" y="194" width="148" height="98" rx="18" fill="${support}" opacity="0.28"/>
      `
    case 'bathroom':
      return `
        <rect x="54" y="78" width="852" height="808" rx="42" fill="#f4fbff" opacity="0.9"/>
        <rect x="54" y="540" width="852" height="346" fill="#f0f4f7" opacity="0.94"/>
        <path d="M54 540H906" stroke="${ink}" stroke-width="${panelStroke - 3}" opacity="0.16"/>
        <path d="M160 78V540M320 78V540M480 78V540M640 78V540M800 78V540" stroke="${ink}" stroke-width="4" opacity="0.08"/>
      `
    case 'park':
      return `
        ${outdoorSky}
        <path d="M54 654C204 590 338 604 504 640C646 672 772 664 906 628V886H54V654Z" fill="#dff3dc" opacity="0.92"/>
        <circle cx="176" cy="286" r="42" fill="${accent}" opacity="0.16"/>
        <circle cx="776" cy="314" r="34" fill="${accent}" opacity="0.14"/>
      `
    case 'home':
    default:
      return `
        <rect x="54" y="78" width="852" height="808" rx="42" fill="#fff9f3" opacity="0.84"/>
        <rect x="54" y="528" width="852" height="358" fill="url(#floor)"/>
        <rect x="104" y="150" width="256" height="172" rx="28" fill="#f6fbff" stroke="${ink}" stroke-width="${panelStroke - 2}" opacity="0.86"/>
        <rect x="612" y="176" width="212" height="130" rx="24" fill="#fffef9" stroke="${ink}" stroke-width="${panelStroke - 3}" opacity="0.5"/>
      `
  }
}

function weatherMarkup(weather: SceneWeather, accent: string) {
  if (weather === 'rain') {
    return Array.from({ length: 20 }, (_, index) => {
      const x = 76 + index * 44
      const y = 94 + (index % 4) * 48
      return `<path d="M${x} ${y}L${x - 24} ${y + 72}" stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.48"/>`
    }).join('')
  }

  if (weather === 'cloudy') {
    return `
      <g opacity="0.46">
        <ellipse cx="212" cy="170" rx="74" ry="28" fill="#ffffff"/>
        <ellipse cx="730" cy="186" rx="92" ry="34" fill="#ffffff"/>
      </g>
    `
  }

  return ''
}

function accentMarkup(accentMode: SceneAccent, characterX: number, accent: string) {
  switch (accentMode) {
    case 'speed':
      return `
        <g opacity="0.4">
          <path d="M${characterX - 220} 422H${characterX - 40}" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
          <path d="M${characterX - 250} 476H${characterX - 80}" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
          <path d="M${characterX - 210} 532H${characterX - 24}" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>
        </g>
      `
    case 'steam':
      return `
        <g opacity="0.5">
          <path d="M${characterX + 166} 432C${characterX + 152} 406 ${characterX + 184} 384 ${characterX + 166} 354" stroke="${accent}" stroke-width="8" stroke-linecap="round" fill="none"/>
          <path d="M${characterX + 196} 442C${characterX + 182} 414 ${characterX + 214} 390 ${characterX + 196} 360" stroke="${accent}" stroke-width="6" stroke-linecap="round" fill="none"/>
        </g>
      `
    case 'sparkle':
      return `
        <g opacity="0.74">
          ${sparkle(characterX - 186, 214, accent, 20)}
          ${sparkle(characterX + 176, 176, accent, 24)}
          ${sparkle(characterX + 232, 332, accent, 18)}
        </g>
      `
    case 'glow':
      return `
        <g opacity="0.5">
          <circle cx="${characterX}" cy="456" r="176" fill="${accent}" opacity="0.16"/>
          <circle cx="${characterX}" cy="456" r="128" fill="${accent}" opacity="0.12"/>
        </g>
      `
    case 'none':
    default:
      return ''
  }
}

function sparkle(x: number, y: number, fill: string, size: number) {
  const half = size / 2
  return `<path d="M${x} ${y - size}L${x + half} ${y - half}L${x + size} ${y}L${x + half} ${y + half}L${x} ${y + size}L${x - half} ${y + half}L${x - size} ${y}L${x - half} ${y - half}Z" fill="${fill}"/>`
}

function detailMarkup({
  detail,
  x,
  y,
  scale,
  support,
  accent,
  ink,
}: {
  detail: SceneDetail
  x: number
  y: number
  scale: number
  support: string
  accent: string
  ink: string
}) {
  const transform = `translate(${x} ${y}) scale(${scale})`

  switch (detail) {
    case 'window':
      return `<g transform="${transform}"><rect x="-74" y="-68" width="148" height="136" rx="20" fill="#f5fbff" stroke="${ink}" stroke-width="8"/><path d="M0 -68V68M-74 0H74" stroke="${ink}" stroke-width="6" opacity="0.18"/><rect x="-54" y="-50" width="108" height="100" rx="12" fill="${support}" opacity="0.18"/></g>`
    case 'clock':
      return `<g transform="${transform}"><circle cx="0" cy="0" r="56" fill="#fffaf2" stroke="${ink}" stroke-width="8"/><path d="M0 0V-24M0 0L26 10" stroke="${ink}" stroke-width="8" stroke-linecap="round"/></g>`
    case 'desk':
      return `<g transform="${transform}"><rect x="-84" y="-26" width="168" height="30" rx="14" fill="#fffef9" stroke="${ink}" stroke-width="8"/><path d="M-60 4V78M60 4V78" stroke="${ink}" stroke-width="8" stroke-linecap="round"/><rect x="-60" y="-68" width="76" height="42" rx="10" fill="${support}" opacity="0.24" stroke="${ink}" stroke-width="7"/></g>`
    case 'lamp':
      return `<g transform="${transform}"><path d="M0 -66L42 -10H-42L0 -66Z" fill="#fff8ef" stroke="${ink}" stroke-width="8" stroke-linejoin="round"/><path d="M0 -10V64" stroke="${ink}" stroke-width="8" stroke-linecap="round"/><rect x="-26" y="64" width="52" height="12" rx="6" fill="${accent}"/></g>`
    case 'plant':
      return `<g transform="${transform}"><rect x="-28" y="20" width="56" height="48" rx="14" fill="#fff9ef" stroke="${ink}" stroke-width="8"/><path d="M0 20V-34M0 -10C-18 -18 -28 -42 -12 -64M0 -6C16 -18 28 -44 12 -68M-6 8C-22 -4 -34 -20 -30 -42" stroke="${accent}" stroke-width="8" stroke-linecap="round" fill="none"/></g>`
    case 'shelf':
      return `<g transform="${transform}"><rect x="-72" y="-56" width="144" height="18" rx="9" fill="${accent}" opacity="0.24"/><rect x="-72" y="-8" width="144" height="18" rx="9" fill="${accent}" opacity="0.24"/><path d="M-58 -56V10M58 -56V10" stroke="${ink}" stroke-width="8" stroke-linecap="round"/></g>`
    case 'door':
      return `<g transform="${transform}"><rect x="-56" y="-88" width="112" height="176" rx="20" fill="#fffaf1" stroke="${ink}" stroke-width="8"/><circle cx="24" cy="8" r="7" fill="${accent}"/></g>`
    case 'sign':
      return `<g transform="${transform}"><rect x="-72" y="-44" width="144" height="88" rx="22" fill="#fffdf9" stroke="${ink}" stroke-width="8"/><path d="M-58 -20H58M-58 8H32" stroke="${ink}" stroke-width="8" stroke-linecap="round" opacity="0.2"/></g>`
    case 'cloud':
      return `<g transform="${transform}" opacity="0.78"><ellipse cx="-16" cy="0" rx="48" ry="24" fill="#fff"/><ellipse cx="26" cy="-8" rx="42" ry="26" fill="#fff"/><ellipse cx="54" cy="8" rx="28" ry="18" fill="#fff"/></g>`
    case 'puddle':
      return `<g transform="${transform}"><ellipse cx="0" cy="0" rx="82" ry="26" fill="${support}" opacity="0.28"/><ellipse cx="0" cy="0" rx="62" ry="18" fill="#fff" opacity="0.3"/></g>`
    case 'curtain':
      return `<g transform="${transform}"><rect x="-58" y="-84" width="116" height="168" rx="18" fill="#fffaf1" opacity="0.72"/><path d="M-34 -84V84M0 -84V84M34 -84V84" stroke="${accent}" stroke-width="7" opacity="0.34"/></g>`
    case 'tile':
      return `<g transform="${transform}" opacity="0.22"><path d="M-68 -68H68V68H-68Z" stroke="${ink}" stroke-width="8"/><path d="M0 -68V68M-68 0H68" stroke="${ink}" stroke-width="6"/></g>`
    default:
      return ''
  }
}

function characterMarkup({
  x,
  y,
  scale,
  action,
  emotionKey,
  ink,
  accent,
  support,
}: {
  x: number
  y: number
  scale: number
  action: SceneAction
  emotionKey: EmotionKey
  ink: string
  accent: string
  support: string
}) {
  const pose = poseConfig(action)

  return `
    <g transform="translate(${x} ${y}) scale(${scale})">
      <ellipse cx="0" cy="178" rx="122" ry="30" fill="#000" opacity="0.12"/>
      ${pose.seat ? `<rect x="-102" y="110" width="204" height="26" rx="14" fill="${accent}" opacity="0.18"/>` : ''}
      <g transform="rotate(${pose.bodyRotate})">
        <path d="M-58 22C-42 -18 42 -18 58 22L66 104C70 136 46 154 16 154H-16C-46 154 -70 136 -66 104L-58 22Z" fill="#fff8ef" stroke="${ink}" stroke-width="10"/>
        <path d="M-52 16C-30 0 34 0 54 16" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity="0.55"/>
      </g>
      <circle cx="0" cy="-58" r="72" fill="#fff8ef" stroke="${ink}" stroke-width="10"/>
      <path d="M-56 -62C-36 -108 44 -108 60 -50C56 -92 30 -118 0 -122C-28 -120 -50 -102 -56 -62Z" fill="${ink}" opacity="0.92"/>
      ${faceMarkup(emotionKey, ink, accent)}
      <path d="${pose.armLeft}" stroke="${ink}" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="${pose.armRight}" stroke="${ink}" stroke-width="12" stroke-linecap="round" fill="none"/>
      <circle cx="${pose.leftHand[0]}" cy="${pose.leftHand[1]}" r="10" fill="#fff8ef" stroke="${ink}" stroke-width="6"/>
      <circle cx="${pose.rightHand[0]}" cy="${pose.rightHand[1]}" r="10" fill="#fff8ef" stroke="${ink}" stroke-width="6"/>
      <path d="${pose.legLeft}" stroke="${ink}" stroke-width="14" stroke-linecap="round" fill="none"/>
      <path d="${pose.legRight}" stroke="${ink}" stroke-width="14" stroke-linecap="round" fill="none"/>
      <path d="M-22 154L-38 212L12 212" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity="0.28"/>
      <path d="M22 154L54 212L98 212" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity="0.22"/>
      <path d="M-42 30C-16 18 16 18 42 30" stroke="${support}" stroke-width="10" stroke-linecap="round" opacity="0.32"/>
    </g>
  `
}

function poseConfig(action: SceneAction) {
  switch (action) {
    case 'running':
      return {
        bodyRotate: -8,
        armLeft: 'M-44 30L-114 0',
        armRight: 'M44 24L112 78',
        leftHand: [-118, -2] as const,
        rightHand: [116, 80] as const,
        legLeft: 'M-18 146L-98 212',
        legRight: 'M20 146L112 184',
        seat: false,
      }
    case 'walking':
      return {
        bodyRotate: -2,
        armLeft: 'M-44 34L-92 84',
        armRight: 'M44 34L96 82',
        leftHand: [-96, 88] as const,
        rightHand: [100, 86] as const,
        legLeft: 'M-18 146L-48 214',
        legRight: 'M20 146L76 214',
        seat: false,
      }
    case 'sitting':
      return {
        bodyRotate: 4,
        armLeft: 'M-40 40L-88 84',
        armRight: 'M42 36L88 72',
        leftHand: [-92, 88] as const,
        rightHand: [92, 76] as const,
        legLeft: 'M-12 146L-40 186L18 186',
        legRight: 'M14 146L46 186L104 186',
        seat: true,
      }
    case 'slumping':
      return {
        bodyRotate: 10,
        armLeft: 'M-42 42L-98 116',
        armRight: 'M42 40L92 124',
        leftHand: [-100, 120] as const,
        rightHand: [96, 128] as const,
        legLeft: 'M-16 146L-24 220',
        legRight: 'M18 146L38 220',
        seat: false,
      }
    case 'reaching':
      return {
        bodyRotate: -4,
        armLeft: 'M-42 30L-86 -48',
        armRight: 'M42 36L98 108',
        leftHand: [-88, -52] as const,
        rightHand: [100, 110] as const,
        legLeft: 'M-16 146L-56 220',
        legRight: 'M18 146L52 220',
        seat: false,
      }
    case 'resting':
      return {
        bodyRotate: 6,
        armLeft: 'M-38 40L-84 96',
        armRight: 'M38 40L86 94',
        leftHand: [-88, 98] as const,
        rightHand: [90, 98] as const,
        legLeft: 'M-10 146L-30 186L8 200',
        legRight: 'M12 146L46 176L96 182',
        seat: true,
      }
    case 'celebrating':
      return {
        bodyRotate: -2,
        armLeft: 'M-40 24L-104 -60',
        armRight: 'M40 24L104 -60',
        leftHand: [-108, -64] as const,
        rightHand: [108, -64] as const,
        legLeft: 'M-16 146L-60 218',
        legRight: 'M18 146L74 214',
        seat: false,
      }
    case 'standing':
    default:
      return {
        bodyRotate: 0,
        armLeft: 'M-42 36L-92 96',
        armRight: 'M42 36L92 96',
        leftHand: [-96, 100] as const,
        rightHand: [96, 100] as const,
        legLeft: 'M-14 146L-34 220',
        legRight: 'M16 146L36 220',
        seat: false,
      }
  }
}

function focusPropMarkup({
  prop,
  x,
  y,
  scale,
  ink,
  accent,
  support,
}: {
  prop: PanelProp
  x: number
  y: number
  scale: number
  ink: string
  accent: string
  support: string
}) {
  const transform = `translate(${x} ${y}) scale(${scale})`

  switch (prop) {
    case 'coffee':
      return `<g transform="${transform}"><ellipse cx="0" cy="88" rx="84" ry="22" fill="#000" opacity="0.1"/><rect x="-46" y="-12" width="92" height="106" rx="24" fill="#fffaf1" stroke="${ink}" stroke-width="10"/><path d="M48 10C84 10 88 64 48 64" fill="none" stroke="${ink}" stroke-width="10"/><path d="M-18 -42C-26 -64 -12 -82 -18 -108" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><path d="M14 -42C6 -66 20 -82 12 -110" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/></g>`
    case 'phone':
      return `<g transform="${transform}"><rect x="-56" y="-86" width="112" height="188" rx="30" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><rect x="-34" y="-50" width="68" height="110" rx="16" fill="${support}" opacity="0.3"/><circle cx="0" cy="76" r="8" fill="${ink}"/></g>`
    case 'laptop':
      return `<g transform="${transform}"><rect x="-88" y="-78" width="176" height="114" rx="18" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><path d="M-112 60H112L84 98H-84L-112 60Z" fill="${accent}" opacity="0.32" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/></g>`
    case 'train':
      return `<g transform="${transform}"><rect x="-104" y="-56" width="208" height="126" rx="24" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><rect x="-70" y="-24" width="42" height="44" rx="10" fill="${support}" opacity="0.32"/><rect x="-18" y="-24" width="42" height="44" rx="10" fill="${support}" opacity="0.32"/><rect x="34" y="-24" width="42" height="44" rx="10" fill="${support}" opacity="0.32"/><circle cx="-62" cy="78" r="12" fill="${ink}"/><circle cx="62" cy="78" r="12" fill="${ink}"/></g>`
    case 'bed':
      return `<g transform="${transform}"><rect x="-118" y="-8" width="236" height="96" rx="28" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><rect x="-104" y="-46" width="92" height="54" rx="22" fill="${support}" opacity="0.34" stroke="${ink}" stroke-width="10"/><path d="M-94 88V124M94 88V124" stroke="${ink}" stroke-width="10" stroke-linecap="round"/></g>`
    case 'food':
      return `<g transform="${transform}"><circle cx="0" cy="0" r="86" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><path d="M-42 10C-18 -32 28 -32 54 16" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/><circle cx="-12" cy="-6" r="8" fill="${support}" opacity="0.42"/><circle cx="18" cy="16" r="8" fill="${support}" opacity="0.42"/></g>`
    case 'rain':
      return `<g transform="${transform}"><path d="M-76 74C-74 6 -26 -40 44 -68C74 -4 70 74 70 74H-76Z" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><path d="M0 -62V132" stroke="${ink}" stroke-width="10" stroke-linecap="round"/></g>`
    case 'cat':
      return `<g transform="${transform}"><circle cx="0" cy="0" r="82" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><path d="M-60 -26L-34 -84L-8 -20" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><path d="M16 -20L46 -84L68 -12" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><circle cx="-24" cy="-4" r="8" fill="${ink}"/><circle cx="24" cy="-4" r="8" fill="${ink}"/><path d="M-18 26C0 40 18 40 34 26" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/></g>`
    case 'spark':
    default:
      return `<g transform="${transform}">${sparkle(0, 0, accent, 46)}<circle cx="0" cy="0" r="18" fill="#fffef8" opacity="0.72"/></g>`
  }
}

function faceMarkup(emotionKey: EmotionKey, ink: string, accent: string) {
  const commonEyes = `<circle cx="-20" cy="-62" r="8" fill="${ink}"/><circle cx="22" cy="-62" r="8" fill="${ink}"/>`

  switch (emotionKey) {
    case 'joy':
      return `${commonEyes}<path d="M-30 -24C-10 2 18 2 40 -24" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><circle cx="54" cy="-80" r="8" fill="${accent}"/>`
    case 'proud':
      return `${commonEyes}<path d="M-26 -24C-8 -2 20 -2 40 -24" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M-70 -100L-60 -78L-38 -76L-56 -60L-50 -38L-70 -50L-90 -38L-84 -60L-102 -76L-80 -78Z" fill="${accent}" opacity="0.86"/>`
    case 'comfort':
      return `${commonEyes}<path d="M-22 -16C0 -32 20 -32 38 -16" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M50 -34C60 -16 58 6 40 14" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`
    case 'awkward':
      return `${commonEyes}<path d="M-28 -20C-8 -36 10 -2 38 -20" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M-58 -90C-50 -106 -40 -114 -28 -118" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`
    case 'calm':
      return `${commonEyes}<path d="M-20 -12H34" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><circle cx="54" cy="-100" r="6" fill="${accent}" opacity="0.7"/>`
    case 'tired':
      return `<path d="M-38 -62C-30 -68 -18 -68 -8 -62" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="M12 -62C20 -68 32 -68 42 -62" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="M-14 -6H30" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M54 -80C64 -68 66 -46 54 -30" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`
    default:
      return `${commonEyes}<path d="M-18 -20C-4 -6 14 -6 28 -20" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>`
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
