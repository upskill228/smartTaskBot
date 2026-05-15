export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const CATEGORY_COLORS = ['#B33F51', '#3A86FF', '#2A9D8F', '#F4A261', '#6D597A', '#457B9D']

async function parseResponse(res) {
  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    const message = payload?.error?.message || 'Erro ao comunicar com a API'
    const error = new Error(message)
    error.code = payload?.error?.code || null
    error.status = res.status
    throw error
  }

  return payload
}

function slugify(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function buildChatPrompt(data = {}) {
  if (typeof data === 'string') {
    return data.trim()
  }

  const directPrompt = data?.message || data?.prompt || data?.userPrompt

  if (typeof directPrompt === 'string' && directPrompt.trim()) {
    return directPrompt.trim()
  }

  const description = data?.description?.trim()

  if (!description) {
    throw new Error('É necessário enviar uma mensagem ou description para o chatbot.')
  }

  const parts = [`Cria uma tarefa: ${description}`]

  if (data.date) {
    parts.push(`com data ${data.date}`)
  }

  if (data.category) {
    parts.push(`no espaço ${data.category}`)
  }

  if (data.priority) {
    parts.push(`com prioridade ${data.priority}`)
  }

  if (data.assignee) {
    parts.push(`e atribui a ${data.assignee}`)
  }

  return parts.join(', ')
}

function buildCategoriesFromTasks(tasks) {
  const uniqueSpaces = [...new Set(tasks.map((task) => task.space).filter(Boolean))]

  return uniqueSpaces.map((space, index) => ({
    slug: slugify(space),
    label: space,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }))
}

function normalizeTask(task = {}) {
  return {
    ...task,
    completed: Boolean(task.completed),
    timelineDate: task.dueDate || task.createdAt || null,
  }
}

function normalizeChatActions(result = {}) {
  if (Array.isArray(result.actions)) {
    return result.actions
  }

  if (result.tool) {
    return [{
      tool: result.tool,
      args: result.args || null,
      data: result.data ?? null,
    }]
  }

  return []
}

function normalizeChatResult(result = {}) {
  const actions = normalizeChatActions(result)
  const primaryAction = actions[0] || null

  return {
    ...result,
    actions,
    toolCount: typeof result.toolCount === 'number' ? result.toolCount : actions.length,
    tool: result.tool ?? (actions.length === 1 ? primaryAction?.tool || null : null),
    args: result.args ?? (actions.length === 1 ? primaryAction?.args || null : null),
    data: result.data ?? (actions.length === 1 ? primaryAction?.data ?? null : actions),
  }
}

export const sendChatMessage = async (userPrompt) => {
  const res = await fetch(`${API_URL}/api/taskbot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: buildChatPrompt(userPrompt),
    }),
  })

  const payload = await parseResponse(res)
  return normalizeChatResult(payload.data)
}

// Consome o stream NDJSON do chat e entrega progresso antes do resultado final.
export const sendChatMessageStream = async (userPrompt, handlers = {}) => {
  const res = await fetch(`${API_URL}/api/taskbot/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: buildChatPrompt(userPrompt),
    }),
  })

  if (!res.ok) {
    const payload = await parseResponse(res)
    return normalizeChatResult(payload.data)
  }

  if (!res.body) {
    throw new Error('O browser não suporta leitura de streaming nesta resposta.')
  }

  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buffer = ''
  let finalResult = null

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmedLine = line.trim()

      if (!trimmedLine) {
        continue
      }

      const event = JSON.parse(trimmedLine)
      handlers.onEvent?.(event)

      if (event.type === 'error') {
        const error = new Error(event.error?.message || 'Erro ao processar o chat em streaming.')
        error.code = event.error?.code || null
        error.status = event.error?.status || 500
        throw error
      }

      if (event.type === 'result') {
        finalResult = normalizeChatResult(event.data)
        handlers.onResult?.(finalResult)
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer.trim())
    handlers.onEvent?.(event)

    if (event.type === 'error') {
      const error = new Error(event.error?.message || 'Erro ao processar o chat em streaming.')
      error.code = event.error?.code || null
      error.status = event.error?.status || 500
      throw error
    }

    if (event.type === 'result') {
      finalResult = normalizeChatResult(event.data)
      handlers.onResult?.(finalResult)
    }
  }

  if (!finalResult) {
    throw new Error('A resposta de streaming terminou sem resultado final.')
  }

  return finalResult
}

export const getTaskBotSession = async () => {
  const res = await fetch(`${API_URL}/api/taskbot/session`)
  const payload = await parseResponse(res)
  return payload.data || { userId: null }
}

export const getTasks = async () => {
  const res = await fetch(`${API_URL}/api/taskbot/tasks`)
  const payload = await parseResponse(res)
  return (payload.data || []).map(normalizeTask)
}

export const getCategories = async () => {
  const tasks = await getTasks()
  return buildCategoriesFromTasks(tasks)
}

export const deleteTask = async (taskId) => {
  if (!taskId) {
    throw new Error('É necessário indicar o id da tarefa a apagar.')
  }

  const res = await fetch(`${API_URL}/api/taskbot/tasks/${taskId}`, {
    method: 'DELETE',
  })

  const payload = await parseResponse(res)
  return payload.data
}

export const updateTaskCompletionStatus = async (taskId, completed) => {
  if (!taskId) {
    throw new Error('É necessário indicar o id da tarefa a atualizar.')
  }

  const res = await fetch(`${API_URL}/api/taskbot/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  })

  const payload = await parseResponse(res)
  return payload.data
}
