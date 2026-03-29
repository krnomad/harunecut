import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react'
import {
  cancelGenerationJob,
  createGenerationJob,
  getGenerationJob,
} from '../lib/api'
import {
  applyQuickActionToDraft,
  regenerateDraftPanel,
  regenerateDraftTone,
} from '../lib/generator'
import { loadPersistedAppState, savePersistedAppState } from '../lib/storage'
import type {
  ComicDraft,
  ComicEntry,
  DraftInput,
  GenerationSession,
  QuickAction,
  ToneOption,
  UserSettings,
} from '../types'

interface AppContextValue {
  entries: ComicEntry[]
  settings: UserSettings
  draftInput: DraftInput
  activeDraft: ComicDraft | null
  generation: GenerationSession | null
  updateDraftInput: (patch: Partial<DraftInput>) => void
  beginGeneration: (request: DraftInput) => Promise<void>
  cancelGeneration: () => Promise<void>
  updateDraftTitle: (title: string) => void
  updateDraftDialogue: (panelId: string, dialogue: string) => void
  updateDraftCaption: (panelId: string, caption: string) => void
  regeneratePanel: (panelId: string) => Promise<void>
  regenerateTone: (toneSelection: ToneOption) => Promise<void>
  applyQuickAction: (action: QuickAction) => void
  saveActiveDraft: () => string | null
  updateSettings: (patch: Partial<UserSettings>) => void
  removeEntry: (entryId: string) => void
  clearEntries: () => void
  openEntryForEditing: (entryId: string) => boolean
}

const AppContext = createContext<AppContextValue | null>(null)

function wait(duration: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration)
  })
}

function toEntry(draft: ComicDraft, existingEntryId?: string): ComicEntry {
  const savedAt = new Date().toISOString()

  return {
    id: existingEntryId ?? crypto.randomUUID(),
    diaryText: draft.diaryText,
    title: draft.title,
    summary: draft.summary,
    moodLine: draft.moodLine,
    toneSelection: draft.toneSelection,
    resolvedTone: draft.resolvedTone,
    panels: draft.panels,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    savedAt,
  }
}

function upsertEntry(entries: ComicEntry[], entry: ComicEntry) {
  const nextEntries = [...entries.filter((item) => item.id !== entry.id), entry]

  return nextEntries.sort((left, right) => {
    return Date.parse(right.savedAt) - Date.parse(left.savedAt)
  })
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const persistedState = loadPersistedAppState()
  const [entries, setEntries] = useState<ComicEntry[]>(persistedState.entries)
  const [settings, setSettings] = useState<UserSettings>(persistedState.settings)
  const [draftInput, setDraftInput] = useState<DraftInput>(persistedState.draftInput)
  const [activeDraft, setActiveDraft] = useState<ComicDraft | null>(null)
  const [generation, setGeneration] = useState<GenerationSession | null>(null)
  const runVersionRef = useRef(0)

  const persistState = useEffectEvent((nextEntries: ComicEntry[], nextSettings: UserSettings, nextDraft: DraftInput) => {
    savePersistedAppState({
      entries: nextSettings.keepHistory ? nextEntries : [],
      settings: nextSettings,
      draftInput: nextDraft,
    })
  })

  useEffect(() => {
    persistState(entries, settings, draftInput)
  }, [draftInput, entries, settings])

  function updateDraftInput(patch: Partial<DraftInput>) {
    setDraftInput((current) => {
      return {
        ...current,
        ...patch,
      }
    })
  }

  async function beginGeneration(request: DraftInput) {
    const runVersion = runVersionRef.current + 1
    runVersionRef.current = runVersion
    setDraftInput(request)

    const startedAt = new Date().toISOString()
    const localRunId = crypto.randomUUID()

    startTransition(() => {
      setGeneration({
        runId: localRunId,
        request,
        status: 'running',
        step: 'script',
        message: 'Codex CLI 작업을 시작하는 중입니다.',
        startedAt,
      })
    })

    try {
      const { jobId } = await createGenerationJob(request)

      setGeneration((current) => {
        if (!current || current.runId !== localRunId) {
          return current
        }

        return {
          ...current,
          jobId,
        }
      })

      while (runVersionRef.current === runVersion) {
        const job = await getGenerationJob(jobId)

        setGeneration({
          runId: localRunId,
          jobId,
          request,
          status:
            job.status === 'completed'
              ? 'done'
              : job.status === 'failed'
                ? 'failed'
                : job.status === 'cancelled'
                  ? 'failed'
                : 'running',
          step: job.step,
          message: job.message,
          startedAt,
          mediaBackend: job.mediaBackend,
          error: job.error,
        })

        if (job.status === 'completed' && job.result) {
          let nextDraft: ComicDraft = job.result

          if (settings.autoSave) {
            const entry = toEntry(job.result)
            setEntries((current) => upsertEntry(current, entry))
            nextDraft = {
              ...job.result,
              sourceEntryId: entry.id,
            }
          }

          setActiveDraft(nextDraft)
          return
        }

        if (job.status === 'failed' || job.status === 'cancelled') {
          return
        }

        await wait(1500)
      }
    } catch (error) {
      if (runVersionRef.current !== runVersion) {
        return
      }

      setGeneration({
        runId: localRunId,
        request,
        status: 'failed',
        step: 'script',
        message: 'Codex CLI 작업을 시작하지 못했습니다.',
        startedAt,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      })
    }
  }

  async function cancelGeneration() {
    const runningJobId = generation?.jobId

    runVersionRef.current += 1
    setGeneration(null)

    if (!runningJobId) {
      return
    }

    try {
      await cancelGenerationJob(runningJobId)
    } catch {
      // The UI should recover even if the backend has already exited.
    }
  }

  function updateDraftTitle(title: string) {
    setActiveDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        title,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  function updateDraftDialogue(panelId: string, dialogue: string) {
    setActiveDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        panels: current.panels.map((panel) => {
          return panel.id === panelId ? { ...panel, dialogue } : panel
        }),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  function updateDraftCaption(panelId: string, caption: string) {
    setActiveDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        panels: current.panels.map((panel) => {
          return panel.id === panelId ? { ...panel, caption } : panel
        }),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  async function regeneratePanel(panelId: string) {
    if (!activeDraft) {
      return
    }

    const regenerated = await regenerateDraftPanel(activeDraft, panelId)
    setActiveDraft(regenerated)
  }

  async function regenerateTone(toneSelection: ToneOption) {
    if (!activeDraft) {
      return
    }

    const regenerated = await regenerateDraftTone(activeDraft, toneSelection)
    setActiveDraft(regenerated)
  }

  function applyQuickAction(action: QuickAction) {
    setActiveDraft((current) => {
      if (!current) {
        return current
      }

      return applyQuickActionToDraft(current, action)
    })
  }

  function saveActiveDraft() {
    if (!activeDraft) {
      return null
    }

    const entry = toEntry(activeDraft, activeDraft.sourceEntryId)

    setEntries((current) => upsertEntry(current, entry))
    setActiveDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        sourceEntryId: entry.id,
      }
    })

    return entry.id
  }

  function updateSettings(patch: Partial<UserSettings>) {
    setSettings((current) => {
      const nextSettings = {
        ...current,
        ...patch,
      }

      if (patch.defaultTone && !draftInput.diaryText.trim()) {
        setDraftInput((currentDraft) => ({
          ...currentDraft,
          toneSelection: patch.defaultTone ?? current.defaultTone,
        }))
      }

      return nextSettings
    })
  }

  function removeEntry(entryId: string) {
    setEntries((current) => current.filter((entry) => entry.id !== entryId))
    setActiveDraft((current) => {
      if (!current || current.sourceEntryId !== entryId) {
        return current
      }

      return null
    })
  }

  function clearEntries() {
    setEntries([])
  }

  function openEntryForEditing(entryId: string) {
    const entry = entries.find((item) => item.id === entryId)

    if (!entry) {
      return false
    }

    setActiveDraft({
      diaryText: entry.diaryText,
      title: entry.title,
      summary: entry.summary,
      moodLine: entry.moodLine,
      toneSelection: entry.toneSelection,
      resolvedTone: entry.resolvedTone,
      panels: entry.panels,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      sourceEntryId: entry.id,
      lastQuickAction: null,
    })

    return true
  }

  return (
    <AppContext.Provider
      value={{
        entries,
        settings,
        draftInput,
        activeDraft,
        generation,
        updateDraftInput,
        beginGeneration,
        cancelGeneration,
        updateDraftTitle,
        updateDraftDialogue,
        updateDraftCaption,
        regeneratePanel,
        regenerateTone,
        applyQuickAction,
        saveActiveDraft,
        updateSettings,
        removeEntry,
        clearEntries,
        openEntryForEditing,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const value = useContext(AppContext)

  if (!value) {
    throw new Error('useApp must be used within AppProvider')
  }

  return value
}
