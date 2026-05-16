import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface SettingsFormContextValue {
  isDirty: boolean
  setDirty: (dirty: boolean) => void
  registerSave: (fn: (() => Promise<void>) | null) => void
  triggerSave: () => Promise<void>
}

const SettingsFormContext = createContext<SettingsFormContextValue>({
  isDirty: false,
  setDirty: () => {},
  registerSave: () => {},
  triggerSave: async () => {},
})

export function SettingsFormProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [isDirty, setIsDirty] = useState(false)
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null)

  const setDirty = useCallback((dirty: boolean) => setIsDirty(dirty), [])

  const registerSave = useCallback((fn: (() => Promise<void>) | null) => {
    saveHandlerRef.current = fn
  }, [])

  const triggerSave = useCallback(async () => {
    console.log('[SettingsForm] triggerSave called, saveHandler exists:', !!saveHandlerRef.current)
    try {
      if (saveHandlerRef.current) {
        await saveHandlerRef.current()
        console.log('[SettingsForm] Save handler completed successfully')
      }
    } catch (err) {
      console.error('[SettingsForm] Save handler failed:', err)
      throw err
    } finally {
      console.log('[SettingsForm] Setting isDirty to false')
      setIsDirty(false)
    }
  }, [])

  return (
    <SettingsFormContext.Provider value={{ isDirty, setDirty, registerSave, triggerSave }}>
      {children}
    </SettingsFormContext.Provider>
  )
}

export function useSettingsForm(): SettingsFormContextValue {
  return useContext(SettingsFormContext)
}
