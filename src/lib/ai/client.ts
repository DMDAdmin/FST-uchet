import type {
  AiExecutor,
  AiExecutorContext,
  AiPendingConfirmation,
  AiSettingsResolved,
  AiToolCall,
} from './types'
import { AI_TOOL_DEFINITIONS, buildSystemPrompt, parseToolResult, type AiChatMessage } from './types'

type ApiMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: AiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export type RunAiAssistantOptions = {
  settings: AiSettingsResolved
  executor: AiExecutor
  history: AiChatMessage[]
  userText: string
  maxToolRounds?: number
  onStatus?: (status: string | null) => void
  onConfirmation?: (confirmation: AiPendingConfirmation) => void
  ctx: AiExecutorContext
}

export type RunAiAssistantResult = {
  reply: string
  history: AiChatMessage[]
  confirmation?: AiPendingConfirmation
}

export async function callAiChat(
  settings: AiSettingsResolved,
  messages: ApiMessage[],
): Promise<{ message: { content: string | null; tool_calls?: AiToolCall[] } }> {
  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        tools: AI_TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.2,
      }),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Превышено время ожидания (30 с). Проверьте сеть или выберите встроенный помощник.')
    }
    throw new Error('Не удалось связаться с API. Проверьте URL и интернет.')
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Неверный API-ключ (401). Проверьте ключ в настройках.')
    }
    if (res.status === 429) {
      throw new Error('Слишком много запросов (429). Подождите или смените провайдера.')
    }
    const text = await res.text()
    throw new Error(`AI ${res.status}: ${text.slice(0, 180)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: AiToolCall[] } }[]
  }
  const message = data.choices?.[0]?.message
  if (!message) throw new Error('Пустой ответ модели')
  return { message: { content: message.content ?? null, tool_calls: message.tool_calls } }
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

export function humanizeToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'set_timesheet_code':
      return `ставлю код ${String(args.code ?? '')} в табель`
    case 'assign_employee_to_brigade':
      return 'назначаю сотрудника в бригаду'
    case 'replace_in_brigade':
      return 'заменяю сотрудника в бригаде'
    case 'swap_employee_rows':
      return 'меняю сотрудников местами'
    case 'change_schedule_from_day':
      return 'меняю график'
    case 'warehouse_document':
      return 'провожу складской документ'
    case 'warehouse_balance':
      return 'проверяю остаток склада'
    case 'list_low_stock':
      return 'ищу позиции, которые заканчиваются'
    case 'open_warehouse_pick_modal':
      return 'открываю подбор склада'
    case 'search_employees':
      return 'ищу сотрудника'
    case 'open_month':
      return 'открываю месяц'
    case 'navigate':
      return 'открываю раздел'
    case 'confirm_action':
      return 'готовлю подтверждение'
    default:
      return name
  }
}

export function executeToolCall(
  executor: AiExecutor,
  call: AiToolCall,
  ctx: AiExecutorContext,
): string {
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
  } catch {
    return JSON.stringify({ ok: false, error: 'Неверный JSON аргументов' })
  }

  try {
    switch (call.function.name) {
      case 'navigate':
        return executor.navigate(args.view as Parameters<AiExecutor['navigate']>[0], ctx)
      case 'open_month':
        return executor.openMonth(String(args.month ?? ''), ctx)
      case 'get_app_summary':
        return executor.getAppSummary(ctx)
      case 'search_employees':
        return executor.searchEmployees(String(args.query ?? ''), ctx)
      case 'list_brigades':
        return executor.listBrigades(ctx)
      case 'warehouse_balance':
        return executor.warehouseBalance(String(args.query ?? ''), ctx)
      case 'list_low_stock':
        return executor.listLowStock(ctx)
      case 'warehouse_document':
        return executor.warehouseDocument(
          {
            type: args.type as 'receipt' | 'issue',
            lines: (args.lines as { name: string; quantity: number }[]) ?? [],
            counterparty: args.counterparty as string | undefined,
            brigade: args.brigade as string | undefined,
            comment: args.comment as string | undefined,
            confirmationToken: args.confirmationToken as string | undefined,
          },
          ctx,
        )
      case 'set_timesheet_code':
        return executor.setTimesheetCode(args, ctx)
      case 'assign_employee_to_brigade':
        return executor.assignEmployeeToBrigade(args, ctx)
      case 'replace_in_brigade':
        return executor.replaceInBrigade(args, ctx)
      case 'swap_employee_rows':
        return executor.swapEmployeeRows(args, ctx)
      case 'change_schedule_from_day':
        return executor.changeScheduleFromDay(args, ctx)
      case 'open_warehouse_pick_modal':
        return executor.openWarehousePickModal(args, ctx)
      case 'confirm_action':
        return executor.confirmAction(args, ctx)
      default:
        return JSON.stringify({ ok: false, error: `Unknown tool: ${call.function.name}` })
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}

export async function runAiAssistant(
  options: RunAiAssistantOptions,
): Promise<RunAiAssistantResult> {
  const { settings, executor, history, userText, ctx } = options
  const maxToolRounds = options.maxToolRounds ?? 6

  const apiMessages: ApiMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.map((m) => (m.role === 'tool' ? m : { role: m.role, content: m.content })),
    { role: 'user', content: userText },
  ]

  const newHistory: AiChatMessage[] = [...history, { role: 'user', content: userText }]

  for (let round = 0; round < maxToolRounds; round += 1) {
    const { message } = await callAiChat(settings, apiMessages)
    const toolCalls = message.tool_calls

    if (!toolCalls?.length) {
      options.onStatus?.(null)
      const reply = message.content?.trim() || 'Готово.'
      newHistory.push({ role: 'assistant', content: reply })
      return { reply, history: newHistory }
    }

    apiMessages.push({ role: 'assistant', content: message.content, tool_calls: toolCalls })
    newHistory.push({
      role: 'assistant',
      content: message.content ?? `[${toolCalls.map((t) => t.function.name).join(', ')}]`,
    })

    for (const call of toolCalls) {
      const args = safeParseArgs(call.function.arguments)
      options.onStatus?.(`Выполняю: ${humanizeToolCall(call.function.name, args)}`)

      const resultRaw = executeToolCall(executor, call, ctx)
      const parsed = parseToolResult(resultRaw)

      const toolMsg = { role: 'tool' as const, tool_call_id: call.id, content: resultRaw }
      apiMessages.push(toolMsg)
      newHistory.push(toolMsg)

      if (parsed.requiresConfirmation && parsed.confirmation) {
        options.onStatus?.(null)
        options.onConfirmation?.(parsed.confirmation)
        return {
          reply: parsed.confirmation.message,
          history: newHistory,
          confirmation: parsed.confirmation,
        }
      }
    }
  }

  options.onStatus?.(null)
  const reply = 'Слишком много шагов — разбейте запрос на части.'
  newHistory.push({ role: 'assistant', content: reply })
  return { reply, history: newHistory }
}

export async function executeConfirmedTool(
  executor: AiExecutor,
  action: string,
  args: Record<string, unknown>,
  ctx: AiExecutorContext,
): Promise<string> {
  const call: AiToolCall = {
    id: 'confirm',
    type: 'function',
    function: { name: action, arguments: JSON.stringify(args) },
  }
  return executeToolCall(executor, call, ctx)
}
