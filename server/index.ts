import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import express from 'express'
import {
  renderScenePng,
  type SceneSpec,
} from './sceneRenderer'
import type {
  ComicDraft,
  DraftInput,
  EmotionKey,
  GenerationStepId,
  MediaAssetKind,
  MediaBackend,
  PanelProp,
  ResolvedTone,
  StoryBeat,
} from '../src/types'

type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

const rootDir = process.cwd()

dotenv.config({ path: path.resolve(rootDir, '.env') })
dotenv.config({ path: path.resolve(rootDir, '.env.local'), override: true })

interface GenerationJob {
  jobId: string
  status: JobStatus
  step: GenerationStepId
  mediaBackend: MediaBackend
  message: string
  createdAt: string
  updatedAt: string
  request: DraftInput
  error?: string
  result?: ComicDraft
}

interface RawCodexPanel {
  beat: StoryBeat
  beatLabel: string
  caption: string
  dialogue: string
  emotion: string
  emotionKey: EmotionKey
  scene: string
  artPrompt: string
}

interface RawCodexScenePanel extends RawCodexPanel {
  sceneSpec: SceneSpec
}

interface RawCodexResult {
  title: string
  summary: string
  moodLine: string
  resolvedTone: ResolvedTone
  characterAnchor: string
  panels: RawCodexPanel[]
}

interface RawCodexComicWithSceneResult {
  title: string
  summary: string
  moodLine: string
  resolvedTone: ResolvedTone
  characterAnchor: string
  panels: RawCodexScenePanel[]
}

interface PanelMedia {
  imageUrl: string
  sourceBackend: MediaBackend
  sourceAssetKind: MediaAssetKind
  videoUrl?: string
}

interface OpenAiImageResponse {
  data?: Array<{
    b64_json?: string
    url?: string
  }>
}

interface OpenAiVideoJob {
  id: string
  status: string
  error?: {
    message?: string
  }
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        inlineData?: {
          data?: string
          mimeType?: string
        }
        inline_data?: {
          data?: string
          mime_type?: string
        }
      }>
    }
  }>
}

class JobCancelledError extends Error {
  constructor() {
    super('generation-cancelled')
    this.name = 'JobCancelledError'
  }
}

const app = express()
const port = Number(process.env.PORT ?? '4174') || 4174
const combinedSceneSchemaPath = path.resolve(rootDir, 'server/schemas/comic-generation-with-scene.schema.json')
const scriptSchemaPath = path.resolve(rootDir, 'server/schemas/comic-generation.schema.json')
const jobsDir = path.resolve(rootDir, 'server-data/generations')
const jobs = new Map<string, GenerationJob>()
const activeChildren = new Map<string, ChildProcessWithoutNullStreams>()
const activeControllers = new Map<string, AbortController>()

const requestedMediaBackendRaw =
  process.env.MEDIA_BACKEND?.trim().toLowerCase() ||
  process.env.OPENAI_MEDIA_BACKEND?.trim().toLowerCase() ||
  ''
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() ?? ''
const openAiBaseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/u, '')
const requestedMediaBackend = normalizeMediaBackend(requestedMediaBackendRaw)
const codexModel = process.env.CODEX_MODEL?.trim() || 'gpt-5.3-codex-spark'
const codexReasoningEffort = process.env.CODEX_REASONING_EFFORT?.trim() || 'low'
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? ''
const geminiTextModel = process.env.GEMINI_TEXT_MODEL?.trim() || 'gemini-2.5-flash'
const geminiBaseUrl =
  (process.env.GEMINI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/u, '')
const geminiImageModel = resolveGeminiImageModel()
const geminiAspectRatio = process.env.GEMINI_IMAGE_ASPECT_RATIO?.trim() || '1:1'
const geminiImageSize = process.env.GEMINI_IMAGE_SIZE?.trim() || '2K'
const openAiVideoModel = process.env.OPENAI_VIDEO_MODEL?.trim() || 'sora-2'
const openAiImageModel = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1.5'
const openAiVideoSeconds = Number(process.env.OPENAI_VIDEO_SECONDS ?? '4') || 4
const openAiVideoSize = process.env.OPENAI_VIDEO_SIZE?.trim() || '720x1280'
const openAiImageSize = process.env.OPENAI_IMAGE_SIZE?.trim() || '1024x1536'

const tonePalettes: Record<ResolvedTone, Array<[string, string, string]>> = {
  cute: [
    ['#fff2b7', '#ffdde5', '#ff8aa1'],
    ['#f8f0ff', '#d8d0ff', '#7f66ff'],
    ['#e7fbf2', '#b8efd9', '#39aa7f'],
    ['#fff3e2', '#ffd6ac', '#f07e4d'],
  ],
  comic: [
    ['#ffe8ba', '#ffc466', '#f06f2d'],
    ['#fff4e5', '#ffdfae', '#fb5a41'],
    ['#f4f6ff', '#d5dcff', '#5a70ff'],
    ['#fff0ef', '#ffc0bb', '#e14335'],
  ],
  warm: [
    ['#fff2df', '#ffd7b3', '#df714b'],
    ['#fff4e8', '#f8cfa6', '#ba7a50'],
    ['#f4f6ee', '#d9e6be', '#6f8d5a'],
    ['#eef4f7', '#bfd7df', '#538297'],
  ],
  plain: [
    ['#f1ede5', '#ddd3c3', '#7b6f61'],
    ['#eff2f3', '#d5dde1', '#6a7c86'],
    ['#f6f4f0', '#ded7ce', '#837566'],
    ['#edeef7', '#cfd3e7', '#5f6783'],
  ],
  comfort: [
    ['#fef1df', '#ffd4a8', '#de7b55'],
    ['#fff1f4', '#ffd6df', '#e46f89'],
    ['#eef7f2', '#c6ead2', '#529d77'],
    ['#f2effb', '#dbd2ff', '#7a69d8'],
  ],
}

const beatLabels: Record<StoryBeat, string> = {
  setup: '상황 소개',
  build: '전개',
  twist: '감정 고조',
  ending: '결말',
}

const toneDirections: Record<ResolvedTone, string> = {
  cute: 'cute Korean four-panel comic, rounded silhouettes, soft light, playful warmth',
  comic: 'dynamic Korean four-panel comic, expressive poses, punchy timing, clear silhouette',
  warm: 'warm slice-of-life comic, paper-like texture, cozy evening light, gentle realism',
  plain: 'clean slice-of-life comic, restrained palette, direct composition, calm documentary feeling',
  comfort: 'comforting diary comic, soothing color, soft light, reassuring atmosphere',
}

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    defaultMediaBackend: resolveMediaBackend(),
    openAiConfigured: Boolean(openAiApiKey),
    geminiConfigured: Boolean(geminiApiKey),
    codexModel,
    codexReasoningEffort,
    geminiImageModel,
  })
})

app.get('/generated/:jobId/:fileName', async (request, response) => {
  const jobId = request.params.jobId
  const fileName = path.basename(request.params.fileName)
  const targetPath = path.join(mediaDir(jobId), fileName)

  try {
    await fs.access(targetPath)
    response.sendFile(targetPath)
  } catch {
    response.status(404).json({ error: '생성된 미디어를 찾지 못했습니다.' })
  }
})

app.post('/api/generations', async (request, response) => {
  const diaryText =
    typeof request.body?.diaryText === 'string' ? request.body.diaryText.trim() : ''
  const toneSelection =
    typeof request.body?.toneSelection === 'string' ? request.body.toneSelection : 'auto'

  if (diaryText.length < 12) {
    response.status(400).json({ error: '일기는 최소 12자 이상 필요합니다.' })
    return
  }

  const jobId = randomUUID()
  const now = new Date().toISOString()
  const job: GenerationJob = {
    jobId,
    status: 'queued',
    step: 'script',
    mediaBackend: resolveMediaBackend(),
    message: 'Codex CLI 작업을 준비하는 중입니다.',
    createdAt: now,
    updatedAt: now,
    request: {
      diaryText,
      toneSelection,
    },
  }

  jobs.set(jobId, job)
  await writeJob(job)
  void runJob(jobId)

  response.status(202).json({ jobId })
})

app.get('/api/generations/:jobId', async (request, response) => {
  const jobId = request.params.jobId
  const inMemory = jobs.get(jobId)

  if (inMemory) {
    response.json(inMemory)
    return
  }

  const fromDisk = await readJob(jobId)

  if (!fromDisk) {
    response.status(404).json({ error: '생성 작업을 찾지 못했습니다.' })
    return
  }

  jobs.set(jobId, fromDisk)
  response.json(fromDisk)
})

app.delete('/api/generations/:jobId', async (request, response) => {
  const jobId = request.params.jobId
  const inMemory = jobs.get(jobId) ?? (await readJob(jobId))

  if (!inMemory) {
    response.status(404).json({ error: '취소할 생성 작업을 찾지 못했습니다.' })
    return
  }

  jobs.set(jobId, inMemory)

  if (
    inMemory.status === 'completed' ||
    inMemory.status === 'failed' ||
    inMemory.status === 'cancelled'
  ) {
    response.json(inMemory)
    return
  }

  await updateJob(jobId, {
    status: 'cancelled',
    message: '생성을 취소했어요.',
  })

  activeChildren.get(jobId)?.kill('SIGTERM')
  activeControllers.get(jobId)?.abort()
  clearRuntime(jobId)

  response.json(jobs.get(jobId))
})

app.listen(port, '0.0.0.0', async () => {
  await fs.mkdir(jobsDir, { recursive: true })
console.log(`Generation API listening on http://127.0.0.1:${port}`)
})

function normalizeMediaBackend(value: string | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (
    normalized === 'codex-scene' ||
    normalized === 'codex-png' ||
    normalized === 'codex' ||
    normalized === 'codex-svg' ||
    normalized === 'svg'
  ) {
    return 'codex-scene'
  }

  if (normalized === 'mock') {
    return 'mock'
  }

  if (
    normalized === 'gemini' ||
    normalized === 'gemini-image' ||
    normalized === 'nano-banana' ||
    normalized === 'nano-banana-2' ||
    normalized === 'nano-banana-pro'
  ) {
    return 'gemini-image'
  }

  if (normalized === 'image' || normalized === 'openai-image') {
    return 'openai-image'
  }

  if (normalized === 'sora') {
    return 'sora'
  }

  return null
}

function resolveMediaBackend() {
  if (requestedMediaBackend) {
    return requestedMediaBackend
  }

  return 'codex-scene'
}

function resolveGeminiImageModel() {
  if (process.env.GEMINI_IMAGE_MODEL?.trim()) {
    return process.env.GEMINI_IMAGE_MODEL.trim()
  }

  if (requestedMediaBackendRaw === 'nano-banana') {
    return 'gemini-2.5-flash-image'
  }

  if (requestedMediaBackendRaw === 'nano-banana-pro') {
    return 'gemini-3-pro-image-preview'
  }

  if (requestedMediaBackendRaw === 'nano-banana-2') {
    return 'gemini-3.1-flash-image-preview'
  }

  return 'gemini-3.1-flash-image-preview'
}

function jobDir(jobId: string) {
  return path.join(jobsDir, jobId)
}

function mediaDir(jobId: string) {
  return path.join(jobDir(jobId), 'media')
}

function jobFile(jobId: string) {
  return path.join(jobDir(jobId), 'job.json')
}

function outputFile(jobId: string) {
  return path.join(jobDir(jobId), 'result.json')
}

function logFile(jobId: string) {
  return path.join(jobDir(jobId), 'codex.log')
}

function mediaUrl(jobId: string, fileName: string) {
  return `/generated/${jobId}/${encodeURIComponent(fileName)}`
}

async function writeJob(job: GenerationJob) {
  await fs.mkdir(jobDir(job.jobId), { recursive: true })
  await fs.writeFile(jobFile(job.jobId), JSON.stringify(job, null, 2))
}

async function readJob(jobId: string) {
  try {
    const raw = await fs.readFile(jobFile(jobId), 'utf8')
    return JSON.parse(raw) as GenerationJob
  } catch {
    return null
  }
}

async function updateJob(jobId: string, patch: Partial<GenerationJob>) {
  const current = jobs.get(jobId)

  if (!current) {
    return
  }

  if (current.status === 'cancelled' && patch.status !== 'cancelled') {
    return
  }

  const nextJob = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }

  jobs.set(jobId, nextJob)
  await writeJob(nextJob)
}

function clearRuntime(jobId: string) {
  activeChildren.delete(jobId)
  activeControllers.delete(jobId)
}

function clearChildRuntime(jobId: string) {
  activeChildren.delete(jobId)
}

function isJobCancelled(jobId: string) {
  return jobs.get(jobId)?.status === 'cancelled'
}

function assertJobActive(jobId: string, signal?: AbortSignal) {
  if (isJobCancelled(jobId) || signal?.aborted) {
    throw new JobCancelledError()
  }
}

async function writeMediaFile(jobId: string, fileName: string, contents: string | Uint8Array) {
  await fs.mkdir(mediaDir(jobId), { recursive: true })
  await fs.writeFile(path.join(mediaDir(jobId), fileName), contents)
}

async function runJob(jobId: string) {
  const job = jobs.get(jobId)

  if (!job) {
    return
  }

  if ((job.mediaBackend === 'sora' || job.mediaBackend === 'openai-image') && !openAiApiKey) {
    await updateJob(jobId, {
      status: 'failed',
      step: 'images',
      message: '실제 미디어 생성 설정이 빠져 있어요.',
      error: 'OPENAI_API_KEY가 없어 Sora 또는 OpenAI 이미지 생성을 시작할 수 없습니다.',
    })
    return
  }

  if (job.mediaBackend === 'gemini-image' && !geminiApiKey) {
    await updateJob(jobId, {
      status: 'failed',
      step: 'images',
      message: 'Gemini 이미지 생성 설정이 빠져 있어요.',
      error: 'GEMINI_API_KEY가 없어 Gemini 이미지 생성을 시작할 수 없습니다.',
    })
    return
  }

  await updateJob(jobId, {
    status: 'running',
    step: 'script',
    message:
      job.mediaBackend === 'codex-scene'
        ? 'Codex CLI로 네 컷 스크립트와 장면 JSON을 함께 설계하고 있습니다.'
        : job.mediaBackend === 'gemini-image'
          ? 'Gemini로 네 컷 스크립트와 컷 구성을 생성하고 있습니다.'
          : 'Codex CLI로 네 컷 스크립트와 장면 구조를 생성하고 있습니다.',
  })

  try {
    if (job.mediaBackend === 'codex-scene') {
      const prompt = buildPrompt(job.request, 'codex-scene')
      const result = await runCodexStructured<RawCodexComicWithSceneResult>({
        jobId,
        prompt,
        schemaPath: combinedSceneSchemaPath,
        outputPath: outputFile(jobId),
        logPath: logFile(jobId),
      })

      if (isJobCancelled(jobId)) {
        return
      }

      await finalizeCodexSceneJob(jobId, job.request, result)
      return
    }

    const prompt = buildPrompt(job.request, job.mediaBackend)

    if (job.mediaBackend === 'gemini-image') {
      await runGeminiStructured<RawCodexResult>({
        jobId,
        prompt,
        schemaPath: scriptSchemaPath,
        outputPath: outputFile(jobId),
        logPath: logFile(jobId),
      })

      if (isJobCancelled(jobId)) {
        return
      }

      await finalizeJob(jobId, job.request)
      return
    }

    await runCodexStructured<RawCodexResult>({
      jobId,
      prompt,
      schemaPath: scriptSchemaPath,
      outputPath: outputFile(jobId),
      logPath: logFile(jobId),
    })

    if (isJobCancelled(jobId)) {
      return
    }

    await finalizeJob(jobId, job.request)
  } catch (error) {
    if (error instanceof JobCancelledError || isJobCancelled(jobId)) {
      return
    }

      await updateJob(jobId, {
        status: 'failed',
        message:
          error instanceof Error && (error.message.includes('Codex CLI') || error.message.includes('Gemini'))
            ? error.message
            : '생성 결과를 정리하는 중 문제가 생겼습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      })
  }
}

async function finalizeCodexSceneJob(
  jobId: string,
  request: DraftInput,
  result: RawCodexComicWithSceneResult,
) {
  await updateJob(jobId, {
    step: 'images',
    message: '장면 JSON을 바탕으로 PNG 컷을 합성하고 있습니다.',
  })

  const draft = await toComicDraftFromEmbeddedScene(jobId, request, result)

  if (isJobCancelled(jobId)) {
    return
  }

  await updateJob(jobId, {
    step: 'layout',
    message: '생성된 컷을 네 컷 시트로 정리하고 있습니다.',
  })

  await updateJob(jobId, {
    status: 'completed',
    step: 'layout',
    message: completionMessage('codex-scene'),
    result: draft,
  })
}

async function finalizeJob(jobId: string, request: DraftInput) {
  await updateJob(jobId, {
    step: 'prompts',
    message: '컷별 프롬프트와 캐릭터 앵커를 정리하고 있습니다.',
  })

  const rawOutput = await fs.readFile(outputFile(jobId), 'utf8')
  const parsed = parseJsonOutput<RawCodexResult>(rawOutput)
  const job = jobs.get(jobId)

  if (!job) {
    return
  }

  const controller = new AbortController()
  activeControllers.set(jobId, controller)

  try {
    const result = await toComicDraft(
      jobId,
      request,
      parsed,
      job.mediaBackend,
      controller.signal,
    )

    assertJobActive(jobId, controller.signal)

    await updateJob(jobId, {
      step: 'layout',
      message: '생성된 컷을 네 컷 시트로 정리하고 있습니다.',
    })

    await updateJob(jobId, {
      status: 'completed',
      step: 'layout',
      message: completionMessage(job.mediaBackend),
      result,
    })
  } finally {
    activeControllers.delete(jobId)
  }
}

async function runCodexStructured<T>({
  jobId,
  prompt,
  schemaPath,
  outputPath,
  logPath,
}: {
  jobId: string
  prompt: string
  schemaPath: string
  outputPath: string
  logPath: string
}) {
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []

  const child = spawn(
    'codex',
    [
      'exec',
      '--skip-git-repo-check',
      '--ephemeral',
      '-m',
      codexModel,
      '-c',
      `model_reasoning_effort="${codexReasoningEffort}"`,
      '--sandbox',
      'read-only',
      '--color',
      'never',
      '--output-schema',
      schemaPath,
      '-o',
      outputPath,
      '-C',
      rootDir,
      '-',
    ],
    {
      cwd: rootDir,
      env: process.env,
    },
  )

  activeChildren.set(jobId, child)

  return await new Promise<T>((resolve, reject) => {
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk.toString('utf8'))
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk.toString('utf8'))
    })

    child.on('error', async (error) => {
      stderrChunks.push(error.message)
      clearChildRuntime(jobId)
      await fs.writeFile(logPath, [...stdoutChunks, ...stderrChunks].join(''))

      if (isJobCancelled(jobId)) {
        reject(new JobCancelledError())
        return
      }

      reject(new Error(`Codex CLI 작업 시작에 실패했습니다. ${error.message}`))
    })

    child.on('close', async (code) => {
      clearChildRuntime(jobId)
      await fs.writeFile(logPath, [...stdoutChunks, '\n\n--- stderr ---\n', ...stderrChunks].join(''))

      if (isJobCancelled(jobId)) {
        reject(new JobCancelledError())
        return
      }

      if (code !== 0) {
        reject(
          new Error(
            `Codex CLI 작업이 비정상 종료되었습니다. ${summarizeError(stderrChunks.join('') || stdoutChunks.join(''))}`,
          ),
        )
        return
      }

      try {
        const rawOutput = await fs.readFile(outputPath, 'utf8')
        resolve(parseJsonOutput<T>(rawOutput))
      } catch (error) {
        reject(error)
      }
    })

    child.stdin.write(prompt)
    child.stdin.end()
  })
}

async function runGeminiStructured<T>({
  jobId,
  prompt,
  schemaPath,
  outputPath,
  logPath,
}: {
  jobId: string
  prompt: string
  schemaPath: string
  outputPath: string
  logPath: string
}) {
  const schema = await fs.readFile(schemaPath, 'utf8')
  const attemptLogs: string[] = []
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const retryHint =
      attempt === 1
        ? ''
        : `\n\n이전 응답은 스키마를 만족하지 못했다. 특히 panels는 정확히 4개의 객체를 가진 배열이어야 한다. 각 panel은 별도 객체여야 하며 쉼표와 중괄호를 정확히 닫아라. 설명 없이 JSON만 다시 반환하라.`

    const response = await geminiFetch(
      `/models/${encodeURIComponent(geminiTextModel)}:generateContent`,
      {
        method: 'POST',
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${prompt}\n\n반드시 아래 JSON Schema를 만족하는 application/json 본문만 반환하라.\n${schema}${retryHint}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    if (isJobCancelled(jobId)) {
      throw new JobCancelledError()
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse
    const rawOutput = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim()
    attemptLogs.push(`--- attempt ${attempt} ---\n${rawOutput || JSON.stringify(payload, null, 2)}`)

    if (!rawOutput) {
      lastError = new Error('Gemini 스크립트 생성 결과에서 JSON 본문을 찾지 못했습니다.')
      continue
    }

    try {
      const parsed = parseJsonOutput<T>(rawOutput)
      validateStructuredScriptResult(parsed)
      await fs.writeFile(logPath, attemptLogs.join('\n\n'))
      await fs.writeFile(outputPath, JSON.stringify(parsed, null, 2))
      return parsed
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Gemini 스크립트 결과 검증에 실패했습니다.')
    }
  }

  await fs.writeFile(logPath, attemptLogs.join('\n\n'))
  throw lastError ?? new Error('Gemini 스크립트 생성에 실패했습니다.')
}

function validateStructuredScriptResult(value: unknown): asserts value is RawCodexResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Gemini 스크립트 결과가 객체 형식이 아닙니다.')
  }

  const candidate = value as Partial<RawCodexResult>

  if (!Array.isArray(candidate.panels) || candidate.panels.length !== 4) {
    throw new Error('Gemini 스크립트 결과의 panel 수가 4개가 아닙니다.')
  }

  for (const [index, panel] of candidate.panels.entries()) {
    if (!panel || typeof panel !== 'object') {
      throw new Error(`Gemini 스크립트 결과의 ${index + 1}번째 panel이 객체가 아닙니다.`)
    }

    const rawPanel = panel as Partial<RawCodexPanel>

    if (!rawPanel.beat || !rawPanel.beatLabel || !rawPanel.caption || !rawPanel.dialogue || !rawPanel.emotion || !rawPanel.emotionKey || !rawPanel.scene || !rawPanel.artPrompt) {
      throw new Error(`Gemini 스크립트 결과의 ${index + 1}번째 panel 필드가 부족합니다.`)
    }
  }
}

function buildPrompt(request: DraftInput, mediaBackend?: MediaBackend) {
  return `
너는 한국어 일기를 네 컷 만화 설계안으로 바꾸는 생성기다.
반드시 스키마에 맞는 JSON만 반환한다.
설명, 마크다운, 코드펜스는 절대 넣지 마라.

입력 일기:
${request.diaryText}

톤 선택:
${request.toneSelection}

출력 규칙:
- 결과 언어는 한국어.
- 원문 기반성을 유지하고 과도한 창작은 하지 않는다.
- panels는 정확히 4개.
- beat는 setup, build, twist, ending 순서를 지킨다.
- beatLabel은 한국어 한두 단어로 작성한다.
- caption과 dialogue는 짧고 모바일에서 읽기 쉽게 작성한다.
- resolvedTone은 cute, comic, warm, plain, comfort 중 하나여야 한다.
- toneSelection이 auto이면 가장 어울리는 resolvedTone을 선택한다.
- characterAnchor는 모든 컷에서 동일하게 유지할 주인공의 외형 앵커다. 성별을 단정하지 말고, 머리/옷/분위기처럼 이미지 모델이 재사용하기 쉬운 시각 정보로 20자 안팎으로 작성한다.
- scene은 컷에서 보이는 핵심 장면을 간결하게 적는다.
- artPrompt는 실제 이미지 또는 Sora 썸네일 생성에 그대로 쓸 수 있게 구도, 배경, 감정, 행동을 자연어로 구체적으로 작성한다.
- 이미지 안에 말풍선, 자막, 워터마크, UI 텍스트는 절대 넣지 않는다.
- emotionKey는 joy, tired, awkward, calm, comfort, proud 중 하나만 사용한다.
- ${mediaBackend === 'codex-scene' ? '각 panel에는 sceneSpec 객체를 반드시 포함한다.' : 'sceneSpec 필드는 넣지 않는다.'}
${
  mediaBackend === 'codex-scene'
    ? `- sceneSpec은 setting, framing, shot, action, weather, accent, backgroundDetails를 모두 채운다.
- setting은 bedroom, cafe, office, street, transit, bathroom, home, park 중 하나만 사용한다.
- framing은 left, center, right 중 하나만 사용한다.
- shot은 close, mid, wide 중 하나만 사용한다.
- action은 running, sitting, walking, standing, slumping, reaching, resting, celebrating 중 하나만 사용한다.
- weather는 indoor, clear, rain, cloudy 중 하나만 사용한다.
- accent는 none, speed, steam, sparkle, glow 중 하나만 사용한다.
- backgroundDetails는 2개 또는 3개의 요소만 넣고, window, clock, desk, lamp, plant, shelf, door, sign, cloud, puddle, curtain, tile 중에서 고른다.
- sceneSpec은 패널 분위기와 동작을 시각적으로 풍성하게 만들기 위한 구조이므로, scene과 artPrompt와 모순되지 않게 고른다.
- 네 컷 전체에서 주인공 외형과 화풍, 색감은 일관되게 유지한다.`
    : ''
}
`.trim()
}

function parseJsonOutput<T>(rawOutput: string) {
  const trimmed = rawOutput
    .trim()
    .replace(/^```json/u, '')
    .replace(/^```/u, '')
    .replace(/```$/u, '')
    .trim()

  try {
    return JSON.parse(trimmed) as T
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')

    if (start === -1 || end === -1) {
      throw new Error('Codex 결과에서 JSON 본문을 찾지 못했습니다.')
    }

    return JSON.parse(trimmed.slice(start, end + 1)) as T
  }
}

async function toComicDraft(
  jobId: string,
  request: DraftInput,
  result: RawCodexResult,
  mediaBackend: MediaBackend,
  signal: AbortSignal,
) {
  if (result.panels.length !== 4) {
    throw new Error('Codex 결과의 panel 수가 4개가 아닙니다.')
  }

  const panels: ComicDraft['panels'] = []

  for (const [index, panel] of result.panels.entries()) {
    assertJobActive(jobId, signal)
    await updateJob(jobId, {
      step: 'images',
      message: mediaProgressMessage(mediaBackend, index + 1, result.panels.length),
    })

    const palette = tonePalettes[result.resolvedTone][index]
    const prop = inferProp(`${panel.scene} ${panel.artPrompt}`)
    const media = await createPanelMedia({
      jobId,
      characterAnchor: result.characterAnchor.trim(),
      panel,
      panelIndex: index,
      resolvedTone: result.resolvedTone,
      mediaBackend,
      signal,
      palette,
      prop,
    })

    panels.push({
      id: randomUUID(),
      beat: panel.beat,
      beatLabel: panel.beatLabel || beatLabels[panel.beat],
      caption: panel.caption.trim(),
      dialogue: panel.dialogue.trim(),
      emotion: panel.emotion.trim(),
      emotionKey: panel.emotionKey,
      scene: panel.scene.trim(),
      artPrompt: panel.artPrompt.trim(),
      imageUrl: media.imageUrl,
      sourceBackend: media.sourceBackend,
      sourceAssetKind: media.sourceAssetKind,
      videoUrl: media.videoUrl,
      palette,
      prop,
    })
  }

  const now = new Date().toISOString()

  return {
    diaryText: request.diaryText.trim(),
    toneSelection: request.toneSelection,
    resolvedTone: result.resolvedTone,
    title: result.title.trim(),
    summary: result.summary.trim(),
    moodLine: result.moodLine.trim(),
    createdAt: now,
    updatedAt: now,
    lastQuickAction: null,
    panels,
  } satisfies ComicDraft
}

async function toComicDraftFromEmbeddedScene(
  jobId: string,
  request: DraftInput,
  result: RawCodexComicWithSceneResult,
) {
  if (result.panels.length !== 4) {
    throw new Error('Codex 결과의 panel 수가 4개가 아닙니다.')
  }

  const panels: ComicDraft['panels'] = []

  for (const [index, panel] of result.panels.entries()) {
    await updateJob(jobId, {
      step: 'images',
      message: mediaProgressMessage('codex-scene', index + 1, result.panels.length),
    })

    const palette = tonePalettes[result.resolvedTone][index]
    const prop = inferProp(`${panel.scene} ${panel.artPrompt}`)
    const fileName = `panel-${index + 1}.png`
    const png = await renderScenePng({
      scene: panel.scene.trim(),
      emotionKey: panel.emotionKey,
      palette,
      prop,
      resolvedTone: result.resolvedTone,
      sceneSpec: panel.sceneSpec,
    })

    await writeMediaFile(jobId, fileName, png)

    panels.push({
      id: randomUUID(),
      beat: panel.beat,
      beatLabel: panel.beatLabel || beatLabels[panel.beat],
      caption: panel.caption.trim(),
      dialogue: panel.dialogue.trim(),
      emotion: panel.emotion.trim(),
      emotionKey: panel.emotionKey,
      scene: panel.scene.trim(),
      artPrompt: panel.artPrompt.trim(),
      imageUrl: mediaUrl(jobId, fileName),
      sourceBackend: 'codex-scene',
      sourceAssetKind: 'illustration',
      palette,
      prop,
    })
  }

  const now = new Date().toISOString()

  return {
    diaryText: request.diaryText.trim(),
    toneSelection: request.toneSelection,
    resolvedTone: result.resolvedTone,
    title: result.title.trim(),
    summary: result.summary.trim(),
    moodLine: result.moodLine.trim(),
    createdAt: now,
    updatedAt: now,
    lastQuickAction: null,
    panels,
  } satisfies ComicDraft
}

async function createPanelMedia({
  jobId,
  characterAnchor,
  panel,
  panelIndex,
  resolvedTone,
  mediaBackend,
  signal,
  palette,
  prop,
}: {
  jobId: string
  characterAnchor: string
  panel: RawCodexPanel
  panelIndex: number
  resolvedTone: ResolvedTone
  mediaBackend: MediaBackend
  signal: AbortSignal
  palette: [string, string, string]
  prop: PanelProp
}) {
  const visualPrompt = buildVisualPrompt({
    characterAnchor,
    panel,
    panelIndex,
    resolvedTone,
  })

  if (mediaBackend === 'sora') {
    return createSoraPanel(jobId, panelIndex, visualPrompt, signal)
  }

  if (mediaBackend === 'openai-image') {
    return createOpenAiImagePanel(jobId, panelIndex, visualPrompt, signal)
  }

  if (mediaBackend === 'gemini-image') {
    return createGeminiImagePanel(jobId, panelIndex, visualPrompt, signal)
  }

  return createMockPanel(jobId, panel, panelIndex, palette, prop)
}

function buildVisualPrompt({
  characterAnchor,
  panel,
  panelIndex,
  resolvedTone,
}: {
  characterAnchor: string
  panel: RawCodexPanel
  panelIndex: number
  resolvedTone: ResolvedTone
}) {
  return [
    `Panel ${panelIndex + 1} of 4 for a Korean diary comic.`,
    `One consistent protagonist: ${characterAnchor}.`,
    `Scene: ${panel.scene}.`,
    `Emotion: ${panel.emotion}.`,
    `Action: ${panel.artPrompt}.`,
    `Style: ${toneDirections[resolvedTone]}.`,
    'Simple mobile-friendly composition with empty room for top and bottom overlay text.',
    'No speech bubbles, captions, subtitles, logos, or interface text.',
  ].join(' ')
}

async function createSoraPanel(
  jobId: string,
  panelIndex: number,
  prompt: string,
  signal: AbortSignal,
): Promise<PanelMedia> {
  const body = new FormData()
  body.set('model', openAiVideoModel)
  body.set('prompt', `${prompt} Create a short static moment with subtle natural motion and no camera cuts.`)
  body.set('seconds', String(openAiVideoSeconds))
  body.set('size', openAiVideoSize)

  const createResponse = await openAiFetch('/videos', {
    method: 'POST',
    body,
    signal,
  })
  const initialJob = (await createResponse.json()) as OpenAiVideoJob
  const finalJob = await pollVideoJob(initialJob.id, signal)

  if (finalJob.status !== 'completed') {
    throw new Error(finalJob.error?.message || `Sora 작업이 ${finalJob.status} 상태로 종료되었습니다.`)
  }

  const thumbnailResponse = await openAiFetch(
    `/videos/${finalJob.id}/content?variant=thumbnail`,
    {
      signal,
    },
  )

  const mimeType = thumbnailResponse.headers.get('content-type') || 'image/webp'
  const extension = extensionFromMimeType(mimeType)
  const fileName = `panel-${panelIndex + 1}.${extension}`
  const buffer = Buffer.from(await thumbnailResponse.arrayBuffer())

  await writeMediaFile(jobId, fileName, buffer)

  return {
    imageUrl: mediaUrl(jobId, fileName),
    sourceBackend: 'sora',
    sourceAssetKind: 'video-thumbnail',
  }
}

async function createOpenAiImagePanel(
  jobId: string,
  panelIndex: number,
  prompt: string,
  signal: AbortSignal,
): Promise<PanelMedia> {
  const response = await openAiFetch('/images/generations', {
    method: 'POST',
    body: JSON.stringify({
      model: openAiImageModel,
      prompt,
      size: openAiImageSize,
      quality: 'medium',
      response_format: 'b64_json',
      output_format: 'webp',
    }),
    signal,
  })

  const payload = (await response.json()) as OpenAiImageResponse
  const asset = payload.data?.[0]

  if (!asset?.b64_json && !asset?.url) {
    throw new Error('이미지 생성 결과에서 미디어를 찾지 못했습니다.')
  }

  const extension = 'webp'
  const fileName = `panel-${panelIndex + 1}.${extension}`

  if (asset.b64_json) {
    await writeMediaFile(jobId, fileName, Buffer.from(asset.b64_json, 'base64'))
  } else if (asset.url) {
    const assetResponse = await fetch(asset.url, { signal })
    const buffer = Buffer.from(await assetResponse.arrayBuffer())
    await writeMediaFile(jobId, fileName, buffer)
  }

  return {
    imageUrl: mediaUrl(jobId, fileName),
    sourceBackend: 'openai-image',
    sourceAssetKind: 'illustration',
  }
}

async function createGeminiImagePanel(
  jobId: string,
  panelIndex: number,
  prompt: string,
  signal: AbortSignal,
): Promise<PanelMedia> {
  const response = await geminiFetch(
    `/models/${encodeURIComponent(geminiImageModel)}:generateContent`,
    {
      method: 'POST',
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          imageConfig: {
            aspectRatio: geminiAspectRatio,
            ...(geminiImageModel.startsWith('gemini-3') ? { imageSize: geminiImageSize } : {}),
          },
        },
      }),
      signal,
    },
  )

  const payload = (await response.json()) as GeminiGenerateContentResponse
  const part = payload.candidates?.[0]?.content?.parts?.find((entry) => {
    return Boolean(entry.inlineData?.data || entry.inline_data?.data)
  })
  const inline = part?.inlineData ?? part?.inline_data

  if (!inline?.data) {
    throw new Error('Gemini 이미지 생성 결과에서 실제 이미지 바이트를 찾지 못했습니다.')
  }

  const mimeType =
    ('mimeType' in inline
      ? inline.mimeType
      : 'mime_type' in inline
        ? inline.mime_type
        : undefined) ?? 'image/png'
  const extension = extensionFromMimeType(mimeType)
  const fileName = `panel-${panelIndex + 1}.${extension}`
  await writeMediaFile(jobId, fileName, Buffer.from(inline.data, 'base64'))

  return {
    imageUrl: mediaUrl(jobId, fileName),
    sourceBackend: 'gemini-image',
    sourceAssetKind: 'illustration',
  }
}

async function createMockPanel(
  jobId: string,
  panel: RawCodexPanel,
  panelIndex: number,
  palette: [string, string, string],
  prop: PanelProp,
): Promise<PanelMedia> {
  const fileName = `panel-${panelIndex + 1}.svg`
  const svg = renderPanelSvg({
    scene: panel.scene.trim(),
    emotionKey: panel.emotionKey,
    palette,
    prop,
  })

  await writeMediaFile(jobId, fileName, svg)

  return {
    imageUrl: mediaUrl(jobId, fileName),
    sourceBackend: 'mock',
    sourceAssetKind: 'illustration',
  }
}

async function pollVideoJob(videoId: string, signal: AbortSignal) {
  for (;;) {
    assertJobActiveFromSignal(signal)
    const response = await openAiFetch(`/videos/${videoId}`, { signal })
    const payload = (await response.json()) as OpenAiVideoJob

    if (['completed', 'failed', 'cancelled'].includes(payload.status)) {
      return payload
    }

    await sleep(4000, signal)
  }
}

function assertJobActiveFromSignal(signal: AbortSignal) {
  if (signal.aborted) {
    throw new JobCancelledError()
  }
}

async function sleep(duration: number, signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, duration)

    const onAbort = () => {
      clearTimeout(timeoutId)
      reject(new JobCancelledError())
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function openAiFetch(resourcePath: string, init: RequestInit) {
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.')
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${openAiApiKey}`)

  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${openAiBaseUrl}${resourcePath}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const message = summarizeApiError(await response.text(), 'OpenAI API 요청 중 오류가 발생했습니다.')
    throw new Error(message)
  }

  return response
}

async function geminiFetch(resourcePath: string, init: RequestInit) {
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const headers = new Headers(init.headers)
  headers.set('x-goog-api-key', geminiApiKey)

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${geminiBaseUrl}${resourcePath}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const message = summarizeApiError(await response.text(), 'Gemini API 요청 중 오류가 발생했습니다.')
    throw new Error(message)
  }

  return response
}

function summarizeApiError(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        message?: string
      }
      message?: string
    }

    if (parsed.error?.message) {
      return parsed.error.message
    }

    if (parsed.message) {
      return parsed.message
    }
  } catch {
    // noop
  }

  return raw.trim() || fallback
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes('webp')) {
    return 'webp'
  }

  if (mimeType.includes('png')) {
    return 'png'
  }

  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return 'jpg'
  }

  if (mimeType.includes('svg')) {
    return 'svg'
  }

  return 'bin'
}

function mediaProgressMessage(mediaBackend: MediaBackend, current: number, total: number) {
  if (mediaBackend === 'codex-scene') {
    return `장면 JSON을 바탕으로 ${current}/${total}컷 PNG를 합성하고 있습니다.`
  }

  if (mediaBackend === 'codex-svg') {
    return `Codex CLI로 ${current}/${total}컷 SVG 장면을 그리고 있습니다.`
  }

  if (mediaBackend === 'sora') {
    return `Sora로 ${current}/${total}컷 장면을 만들고 썸네일을 가져오는 중입니다.`
  }

  if (mediaBackend === 'gemini-image') {
    return `Gemini 이미지 모델로 ${current}/${total}컷 장면을 그리고 있습니다.`
  }

  if (mediaBackend === 'openai-image') {
    return `OpenAI 이미지 생성기로 ${current}/${total}컷 장면을 그리고 있습니다.`
  }

  return `모의 렌더러로 ${current}/${total}컷을 구성하고 있습니다.`
}

function completionMessage(mediaBackend: MediaBackend) {
  if (mediaBackend === 'codex-scene') {
    return 'Codex 장면 JSON을 바탕으로 합성한 PNG 네 컷이 준비됐어요.'
  }

  if (mediaBackend === 'codex-svg') {
    return 'Codex CLI가 직접 그린 SVG 네 컷 결과가 준비됐어요.'
  }

  if (mediaBackend === 'sora') {
    return 'Sora 썸네일까지 포함한 네 컷 결과가 준비됐어요.'
  }

  if (mediaBackend === 'gemini-image') {
    return 'Gemini 이미지 생성 결과가 포함된 네 컷이 준비됐어요.'
  }

  if (mediaBackend === 'openai-image') {
    return '실제 이미지 생성 결과가 포함된 네 컷이 준비됐어요.'
  }

  return '모의 렌더 네 컷 결과가 준비됐어요.'
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
      return `<g opacity="0.95"><circle cx="484" cy="380" r="64" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><path d="M448 380C460 350 486 350 520 388" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/></g>`
    case 'rain':
      return `<g opacity="0.95"><path d="M446 428C446 372 482 336 528 318C548 366 544 430 544 430H446Z" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><path d="M494 310V466" stroke="${ink}" stroke-width="10" stroke-linecap="round"/></g>`
    case 'cat':
      return `<g opacity="0.95"><circle cx="486" cy="376" r="66" fill="#fff9ef" stroke="${ink}" stroke-width="10"/><path d="M432 340L450 286L470 336" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/><path d="M502 336L526 286L540 344" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/></g>`
    case 'spark':
    default:
      return `<g opacity="0.95"><path d="M492 294L510 338L556 342L520 370L532 416L492 392L452 416L464 370L428 342L474 338L492 294Z" fill="#fff9ef" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/></g>`
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

function renderPanelSvg({
  scene,
  emotionKey,
  palette,
  prop,
}: {
  scene: string
  emotionKey: EmotionKey
  palette: [string, string, string]
  prop: PanelProp
}) {
  const [from, to, accent] = palette
  const ink = '#241b17'
  const label = escapeXml(scene.slice(0, 12))

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${from}"/>
          <stop offset="100%" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="640" height="640" rx="52" fill="url(#bg)"/>
      <circle cx="122" cy="118" r="92" fill="${accent}" opacity="0.18"/>
      <circle cx="520" cy="156" r="108" fill="#fffaf1" opacity="0.3"/>
      <rect x="64" y="72" width="148" height="50" rx="16" fill="#fffaf1" opacity="0.92"/>
      <text x="138" y="104" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${ink}">${label}</text>
      <ellipse cx="320" cy="532" rx="184" ry="44" fill="#000" opacity="0.12"/>
      <rect x="150" y="184" width="256" height="248" rx="66" fill="#fff8ef" stroke="${ink}" stroke-width="10"/>
      <circle cx="320" cy="274" r="92" fill="#fff8ef" stroke="${ink}" stroke-width="10"/>
      <path d="M220 428C240 472 400 472 420 428" fill="${accent}" opacity="0.28"/>
      <rect x="244" y="390" width="152" height="110" rx="42" fill="#fff8ef" stroke="${ink}" stroke-width="10"/>
      ${faceMarkup(emotionKey, ink, accent)}
      ${propMarkup(prop, accent, ink)}
    </svg>
  `.trim()
}

function inferProp(text: string): PanelProp {
  if (/(카페|커피|라떼|카공)/u.test(text)) {
    return 'coffee'
  }

  if (/(전화|문자|휴대폰|연락)/u.test(text)) {
    return 'phone'
  }

  if (/(회의|업무|회사|과제|노트북)/u.test(text)) {
    return 'laptop'
  }

  if (/(지하철|버스|출근|퇴근|이동)/u.test(text)) {
    return 'train'
  }

  if (/(침대|잠|이불|집)/u.test(text)) {
    return 'bed'
  }

  if (/(밥|빵|디저트|점심|저녁)/u.test(text)) {
    return 'food'
  }

  if (/(비|우산|흐림)/u.test(text)) {
    return 'rain'
  }

  if (/(고양이|강아지|냥이|반려)/u.test(text)) {
    return 'cat'
  }

  return 'spark'
}

function summarizeError(logs: string) {
  const lines = logs
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.slice(-6).join(' ') || 'Codex CLI 실행 중 오류가 발생했습니다.'
}
