import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { executeConfirmedTool, runAiAssistant } from '@/lib/ai/client'
import { runLocalAssistant } from '@/lib/ai/localAssistant'
import {
  isLocalAiProvider,
  isAiActive,
  normalizeAiProvider,
  providerStatusKey,
  resolveAiConnection,
} from '@/lib/ai/providers'
import { parseToolResult } from '@/lib/ai/types'
import type { AiChatMessage, AiExecutor, AiPendingConfirmation, AiSettingsResolved } from '@/lib/ai/types'
import type { AiSettings, AppStore } from '@/lib/types'

type UiMessage = { id: string; role: 'user' | 'assistant'; content: string }

type AiAssistantContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  messages: UiMessage[]
  loading: boolean
  status: string | null
  pendingConfirmation: AiPendingConfirmation | null
  configured: boolean
  aiActive: boolean
  providerLabelKey: string
  send: (text: string) => Promise<void>
  approvePendingConfirmation: () => Promise<void>
  rejectPendingConfirmation: () => void
  clearChat: () => void
  registerExecutor: (executor: AiExecutor) => () => void
}

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null)

function resolveSettings(ai: AiSettings | undefined): AiSettingsResolved | null {
  const conn = resolveAiConnection(ai)
  if (!conn) return null
  return {
    enabled: true,
    apiKey: conn.apiKey,
    baseUrl: conn.baseUrl,
    model: conn.model,
  }
}

export function AiAssistantProvider({
  aiSettings,
  activeMonth,
  store,
  children,
}: {
  aiSettings?: AiSettings
  activeMonth: string
  store: AppStore
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<AiPendingConfirmation | null>(null)
  const historyRef = useRef<AiChatMessage[]>([])
  const executorRef = useRef<AiExecutor | null>(null)
  const approvedConfirmationsRef = useRef(new Set<string>())

  const settings = useMemo(() => resolveSettings(aiSettings), [aiSettings])
  const configured = settings !== null || isLocalAiProvider(aiSettings)
  const aiActive = isAiActive(aiSettings)
  const providerLabelKeyValue = providerStatusKey(normalizeAiProvider(aiSettings))

  const executorCtx = useMemo(
    () => ({
      isConfirmationApproved: (token: string) => {
        const approved = approvedConfirmationsRef.current.has(token)
        if (approved) approvedConfirmationsRef.current.delete(token)
        return approved
      },
    }),
    [],
  )

  const registerExecutor = useCallback((executor: AiExecutor) => {
    executorRef.current = executor
    return () => {
      if (executorRef.current === executor) executorRef.current = null
    }
  }, [])

  const appendAssistant = useCallback((content: string) => {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content }])
  }, [])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      const provider = normalizeAiProvider(aiSettings)
      if (provider === 'off') {
        appendAssistant('ИИ-помощник выключен в настройках.')
        return
      }

      if (!isLocalAiProvider(aiSettings) && !settings) {
        appendAssistant('Укажите API-ключ в настройках или выберите «Встроенный помощник».')
        return
      }
      if (!executorRef.current) {
        appendAssistant('Помощник ещё не готов — обновите страницу.')
        return
      }

      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: trimmed }])
      setLoading(true)
      setPendingConfirmation(null)
      try {
        const runner = isLocalAiProvider(aiSettings)
          ? runLocalAssistant({
              executor: executorRef.current,
              userText: trimmed,
              activeMonth,
              store,
              history: historyRef.current,
              ctx: executorCtx,
              onStatus: setStatus,
              onConfirmation: setPendingConfirmation,
            })
          : runAiAssistant({
              settings: settings!,
              executor: executorRef.current,
              history: historyRef.current,
              userText: trimmed,
              ctx: executorCtx,
              onStatus: setStatus,
              onConfirmation: setPendingConfirmation,
            })

        const { reply, history, confirmation } = await runner
        historyRef.current = history.slice(-24)
        if (!confirmation) {
          appendAssistant(reply)
        }
      } catch (e) {
        setStatus(null)
        appendAssistant(`Ошибка: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setLoading(false)
      }
    },
    [loading, settings, aiSettings, activeMonth, store, executorCtx, appendAssistant],
  )

  const approvePendingConfirmation = useCallback(async () => {
    if (!pendingConfirmation || !executorRef.current) return

    const confirmation = pendingConfirmation
    setPendingConfirmation(null)
    approvedConfirmationsRef.current.add(confirmation.token)
    setLoading(true)
    setStatus('Выполняю: подтверждённое действие')

    try {
      const resultRaw = await executeConfirmedTool(
        executorRef.current,
        confirmation.action,
        { ...confirmation.args, confirmationToken: confirmation.token },
        executorCtx,
      )
      setStatus(null)
      const parsed = parseToolResult(resultRaw)

      if (parsed.requiresConfirmation && parsed.confirmation) {
        setPendingConfirmation(parsed.confirmation)
        appendAssistant(parsed.confirmation.message)
        return
      }

      appendAssistant(
        parsed.ok
          ? parsed.message || 'Готово.'
          : parsed.error || 'Не удалось выполнить действие.',
      )
    } catch (e) {
      setStatus(null)
      appendAssistant(`Ошибка: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [pendingConfirmation, executorCtx, appendAssistant])

  const rejectPendingConfirmation = useCallback(() => {
    setPendingConfirmation(null)
    appendAssistant('Отменено.')
  }, [appendAssistant])

  const clearChat = useCallback(() => {
    historyRef.current = []
    setMessages([])
    setPendingConfirmation(null)
    setStatus(null)
  }, [])

  const value = useMemo(
    () => ({
      open,
      setOpen,
      messages,
      loading,
      status,
      pendingConfirmation,
      configured,
      aiActive,
      providerLabelKey: providerLabelKeyValue,
      send,
      approvePendingConfirmation,
      rejectPendingConfirmation,
      clearChat,
      registerExecutor,
    }),
    [
      open,
      messages,
      loading,
      status,
      pendingConfirmation,
      configured,
      aiActive,
      providerLabelKeyValue,
      send,
      approvePendingConfirmation,
      rejectPendingConfirmation,
      clearChat,
      registerExecutor,
    ],
  )

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>
}

export function useAiAssistant() {
  const ctx = useContext(AiAssistantContext)
  if (!ctx) throw new Error('useAiAssistant outside provider')
  return ctx
}
