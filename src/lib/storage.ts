import type { ComicEntry, DraftInput, UserSettings } from '../types'

const STORAGE_KEY = 'harunecut:v1'

export interface PersistedAppState {
  entries: ComicEntry[]
  settings: UserSettings
  draftInput: DraftInput
}

export const defaultSettings: UserSettings = {
  autoSave: false,
  privateMode: true,
  keepHistory: true,
  defaultTone: 'auto',
}

export const defaultDraftInput: DraftInput = {
  diaryText: '',
  toneSelection: defaultSettings.defaultTone,
}

export function loadPersistedAppState(): PersistedAppState {
  if (typeof window === 'undefined') {
    return {
      entries: [],
      settings: defaultSettings,
      draftInput: defaultDraftInput,
    }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return {
      entries: [],
      settings: defaultSettings,
      draftInput: defaultDraftInput,
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>

    return {
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.slice().sort((left, right) => {
            return Date.parse(right.savedAt) - Date.parse(left.savedAt)
          })
        : [],
      settings: {
        ...defaultSettings,
        ...parsed.settings,
      },
      draftInput: {
        ...defaultDraftInput,
        ...parsed.draftInput,
      },
    }
  } catch {
    return {
      entries: [],
      settings: defaultSettings,
      draftInput: defaultDraftInput,
    }
  }
}

export function savePersistedAppState(state: PersistedAppState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
