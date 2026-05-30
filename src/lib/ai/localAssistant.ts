import type { RunAiAssistantResult } from '@/lib/ai/client'
import { executeToolCall, humanizeToolCall } from '@/lib/ai/client'
import { logAiQuery } from '@/lib/ai/queryLog'
import {
  parseToolResult,
  type AiChatMessage,
  type AiExecutor,
  type AiExecutorContext,
  type AiPendingConfirmation,
} from '@/lib/ai/types'
import { parseSmartIntent, type SmartParseResult } from '@/lib/ai/smartParse'
import type { AppStore } from '@/lib/types'
import { monthKey, parseMonthKey } from '@/lib/dates'
import { parseVoiceCommand, type VoiceAction } from '@/lib/voiceCommands'

const HELP_TEXT = `Встроенный помощник — понимает фамилии с опечатками и нескольких сотрудников сразу.

Примеры:
• «Солошвили с 15 ночная в факте» (можно: Солошвилли, солошвили)
• «Иванову и Петрову отпуск с 10 по 20 в плане»
• «Всей бригаде 1 ночная с 15»
• «Что заканчивается на складе?»
• «Сколько осталось стрейч» (ищет по базе склада)
• «Найди Солошвили»
• «Проведи расход 10 картон на бригаду 1»

Если написали только фамилию — подскажу, что уточнить.
На массовых изменениях спрошу «Да / Нет».`

function parseOpenMonthLegacy(t: string, activeMonth: string): string | null {
  const iso = t.match(/\b(20\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}`

  const open = t.match(/открой(?:те)?\s+(?:табель\s+)?(?:за\s+)?(.+)/i)
  if (open) {
    const inner = open[1].toLowerCase().replace(/ё/g, 'е')
    const stems: [RegExp, number][] = [
      [/январ/i, 1],
      [/феврал/i, 2],
      [/март/i, 3],
      [/апрел/i, 4],
      [/\bмай\b|мая/i, 5],
      [/июн/i, 6],
      [/июл/i, 7],
      [/август/i, 8],
      [/сентябр/i, 9],
      [/октябр/i, 10],
      [/ноябр/i, 11],
      [/декабр/i, 12],
    ]
    const yearMatch = inner.match(/(20\d{2})/)
    const year = yearMatch ? Number(yearMatch[1]) : parseMonthKey(activeMonth).year
    for (const [re, mo] of stems) {
      if (re.test(inner)) return monthKey(year, mo)
    }
  }
  return null
}

function voiceActionToTool(
  action: VoiceAction,
  activeMonth: string,
): { name: string; args: Record<string, unknown> } | { clarify: string } | null {
  switch (action.type) {
    case 'nav':
      return { name: 'navigate', args: { view: action.view } }
    case 'goMonth':
      return { name: 'open_month', args: { month: action.month } }
    case 'search':
      return { name: 'search_employees', args: { query: action.query } }
    case 'warehouseBalance':
      return { name: 'warehouse_balance', args: { query: action.name } }
    case 'warehouseReceipt':
      return {
        name: 'warehouse_document',
        args: { type: 'receipt', lines: [{ name: action.name, quantity: action.qty }] },
      }
    case 'assign':
    case 'permanentAssign':
      if (!action.brigadeQuery) {
        return { clarify: 'Укажите бригаду, например: назначить Иванова в бригаду 1.' }
      }
      return {
        name: 'assign_employee_to_brigade',
        args: { employee: action.name, brigade: action.brigadeQuery, month: activeMonth },
      }
    case 'changeSchedule':
      return {
        name: 'change_schedule_from_day',
        args: {
          employee: action.name,
          month: activeMonth,
          fromDay: action.fromDay,
          schedule: action.schedule,
          target: 'plan',
        },
      }
    case 'setCode':
      if (!action.name) return { clarify: 'Укажите сотрудника и код.' }
      if (!action.day) return { clarify: `Какой день для ${action.name}?` }
      return {
        name: 'set_timesheet_code',
        args: {
          employee: action.name,
          month: activeMonth,
          day: action.day,
          code: action.code,
          target: action.mode ?? 'fact',
        },
      }
    case 'setCodeRange':
      return {
        name: 'set_timesheet_code',
        args: {
          employee: action.name,
          month: activeMonth,
          fromDay: action.fromDay,
          toDay: action.toDay,
          code: action.code,
          target: action.mode ?? 'plan',
        },
      }
    case 'replaceInBrigade':
      return {
        name: 'replace_in_brigade',
        args: {
          brigade: action.brigadeQuery,
          from: action.fromName,
          to: action.toName.replace(/\s+за\s+.*$/i, '').replace(/\s+в\s+(плане|факте).*$/i, '').trim(),
          month: activeMonth,
        },
      }
    case 'swapEmployees':
      return {
        name: 'swap_employee_rows',
        args: {
          employeeA: action.nameA,
          employeeB: action.nameB,
          month: activeMonth,
        },
      }
    default:
      return null
  }
}

function legacyVoiceIntent(
  raw: string,
  activeMonth: string,
): SmartParseResult | null {
  const t = raw.toLowerCase().replace(/ё/g, 'е').trim()
  if (/^(справка|помощь|команды|что умеешь|инструкция|help)/.test(t)) {
    return { help: HELP_TEXT }
  }

  const voice = parseVoiceCommand(raw)
  if (voice) {
    if (voice.type === 'help') return { help: HELP_TEXT }
    const mapped = voiceActionToTool(voice, activeMonth)
    if (mapped && 'clarify' in mapped) return mapped
    if (mapped && 'name' in mapped) return { tools: [mapped] }
  }

  const month = parseOpenMonthLegacy(raw, activeMonth)
  if (month) return { tools: [{ name: 'open_month', args: { month } }] }

  return null
}

function resolveIntent(raw: string, store: AppStore, activeMonth: string): SmartParseResult | null {
  const smart = parseSmartIntent(raw, store, activeMonth)
  if (smart) return smart
  return legacyVoiceIntent(raw, activeMonth)
}

async function executeTools(
  tools: Array<{ name: string; args: Record<string, unknown> }>,
  options: {
    executor: AiExecutor
    ctx: AiExecutorContext
    userText: string
    onStatus?: (status: string | null) => void
    onConfirmation?: (confirmation: AiPendingConfirmation) => void
    newHistory: AiChatMessage[]
  },
): Promise<{ reply: string; confirmation?: AiPendingConfirmation }> {
  const replies: string[] = []
  const errors: string[] = []

  for (const tool of tools) {
    options.onStatus?.(`Выполняю: ${humanizeToolCall(tool.name, tool.args)}`)

    const call = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'function' as const,
      function: { name: tool.name, arguments: JSON.stringify(tool.args) },
    }

    const resultRaw = executeToolCall(options.executor, call, options.ctx)
    const parsed = parseToolResult(resultRaw)

    options.newHistory.push({ role: 'assistant', content: `[${tool.name}]` })
    options.newHistory.push({ role: 'tool', tool_call_id: call.id, content: resultRaw })

    if (parsed.requiresConfirmation && parsed.confirmation) {
      options.onStatus?.(null)
      options.onConfirmation?.(parsed.confirmation)
      return { reply: parsed.confirmation.message, confirmation: parsed.confirmation }
    }

    if (parsed.ok && parsed.message) {
      replies.push(parsed.message)
    } else if (!parsed.ok) {
      errors.push(parsed.error || 'Ошибка')
    }
  }

  options.onStatus?.(null)

  if (errors.length && replies.length) {
    logAiQuery(options.userText, 'partial_batch', errors.join('; '))
    return {
      reply: `${replies.join('\n')}\n\n⚠ Часть не выполнена:\n${errors.join('\n')}`,
    }
  }

  if (errors.length) {
    return { reply: errors.length === 1 ? errors[0]! : `Не выполнено: ${errors.join('; ')}` }
  }

  return { reply: replies.length ? replies.join('\n') : 'Готово.' }
}

export async function runLocalAssistant(options: {
  executor: AiExecutor
  userText: string
  activeMonth: string
  store: AppStore
  history: AiChatMessage[]
  ctx: AiExecutorContext
  onStatus?: (status: string | null) => void
  onConfirmation?: (confirmation: AiPendingConfirmation) => void
}): Promise<RunAiAssistantResult> {
  const { executor, userText, activeMonth, store, history, ctx } = options
  const newHistory: AiChatMessage[] = [...history, { role: 'user', content: userText }]

  const intent = resolveIntent(userText, store, activeMonth)

  if (!intent) {
    logAiQuery(userText, 'unparsed')
    const reply =
      'Не понял запрос. Напишите «помощь». Можно фамилию с опечаткой + действие: «Солошвилли с 15 ночная в факте».'
    newHistory.push({ role: 'assistant', content: reply })
    return { reply, history: newHistory }
  }

  if ('help' in intent) {
    newHistory.push({ role: 'assistant', content: intent.help })
    return { reply: intent.help, history: newHistory }
  }

  if ('clarify' in intent) {
    logAiQuery(userText, 'clarify', intent.clarify)
    newHistory.push({ role: 'assistant', content: intent.clarify })
    return { reply: intent.clarify, history: newHistory }
  }

  const { reply, confirmation } = await executeTools(intent.tools, {
    executor,
    ctx,
    userText,
    onStatus: options.onStatus,
    onConfirmation: options.onConfirmation,
    newHistory,
  })

  if (!confirmation) {
    newHistory.push({ role: 'assistant', content: reply })
  }

  return { reply, history: newHistory, confirmation }
}
