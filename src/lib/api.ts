import type {
  ComicDraft,
  DraftInput,
  GenerationStepId,
  MediaBackend,
} from '../types'

export interface GenerationJobState {
  jobId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  step: GenerationStepId
  mediaBackend: MediaBackend
  message: string
  error?: string
  result?: ComicDraft
}

function parseErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error
  }

  return '요청 처리 중 문제가 발생했습니다.'
}

async function readJsonOrThrow<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | null

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload))
  }

  if (!payload) {
    throw new Error('서버 응답이 비어 있습니다.')
  }

  return payload
}

export async function createGenerationJob(request: DraftInput) {
  const response = await fetch('/api/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  return readJsonOrThrow<{ jobId: string }>(response)
}

export async function getGenerationJob(jobId: string) {
  const response = await fetch(`/api/generations/${jobId}`)
  return readJsonOrThrow<GenerationJobState>(response)
}

export async function cancelGenerationJob(jobId: string) {
  const response = await fetch(`/api/generations/${jobId}`, {
    method: 'DELETE',
  })

  return readJsonOrThrow<GenerationJobState>(response)
}
