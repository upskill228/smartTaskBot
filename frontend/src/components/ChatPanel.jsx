import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getTaskBotSession, sendChatMessageStream } from '../api'

const quickPrompts = [
  'Cria uma tarefa urgente para rever o logo amanhã.',
  'Resume as tarefas pendentes desta semana.',
  'Marca a última tarefa como concluída.',
  'Mostra todas as tarefas urgentes.',
]

const initialMessages = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Escreve em linguagem natural e eu trato da criação, edição, filtragem e eliminação de tarefas.',
    meta: null,
  },
]

function normalizeListFormatting(text = '') {
  return text.replace(/\s+\*\s+(?=(\*\*|[A-ZÀ-ÿ0-9]))/g, '\n* ')
}

function renderInlineFormatting(text, keyPrefix) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)

  return segments.map((segment, index) => {
    const boldMatch = segment.match(/^\*\*(.+)\*\*$/)

    if (boldMatch) {
      return <strong key={`${keyPrefix}-strong-${index}`}>{boldMatch[1]}</strong>
    }

    return <span key={`${keyPrefix}-text-${index}`}>{segment}</span>
  })
}

function renderMessageContent(text = '') {
  const normalizedText = normalizeListFormatting(text)
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean)

  if (!lines.length) {
    return null
  }

  const blocks = []
  let listItems = []

  function flushList() {
    if (!listItems.length) {
      return
    }

    blocks.push(
      <ul key={`list-${blocks.length}`} className='chat-message-list'>
        {listItems.map((item, index) => (
          <li key={`item-${index}`}>{renderInlineFormatting(item, `list-${blocks.length}-${index}`)}</li>
        ))}
      </ul>
    )

    listItems = []
  }

  lines.forEach((line, index) => {
    if (/^\*\s+/.test(line) || /^-\s+/.test(line)) {
      listItems.push(line.replace(/^(\*|-)\s+/, ''))
      return
    }

    flushList()
    blocks.push(
      <p key={`paragraph-${index}`} className='chat-message-paragraph'>
        {renderInlineFormatting(line, `paragraph-${index}`)}
      </p>
    )
  })

  flushList()
  return blocks
}

function getFriendlyChatErrorMessage(error) {
  const message = error?.message?.trim() || ''

  if (message.includes('limite temporário de pedidos') || message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    return 'Estou com demasiados pedidos neste momento. Tenta novamente daqui a pouco.'
  }

  if (
    message.includes('temporariamente indisponível')
    || message.includes('temporariamente indisponivel')
    || message.includes('UNAVAILABLE')
    || message.includes('high demand')
    || message.includes('503')
  ) {
    return 'Estou temporariamente indisponível. Tenta novamente dentro de instantes.'
  }

  if (message.includes('modelo Gemini configurado') || message.includes('problema de configuração')) {
    return 'Estou com um problema de configuração. Será necessário contactar o administrador antes de tentares novamente.'
  }

  return message || 'Não consegui processar o pedido agora. Tenta novamente daqui a pouco.'
}

function getChatErrorMeta(error) {
  const message = error?.message?.trim() || ''

  if (
    message.includes('limite temporário de pedidos')
    || message.includes('temporariamente indisponível')
    || message.includes('temporariamente indisponivel')
    || message.includes('RESOURCE_EXHAUSTED')
    || message.includes('UNAVAILABLE')
    || message.includes('high demand')
    || message.includes('429')
    || message.includes('503')
  ) {
    return 'Falha temporária'
  }

  if (message.includes('modelo Gemini configurado') || message.includes('problema de configuração')) {
    return 'Falha de configuração'
  }

  return error?.status >= 500 ? 'Falha temporária' : 'Pedido inválido'
}

function formatToolMeta(result) {
  if (!result.actions?.length) {
    return result.stepCount > 0 ? `Resposta em modo chat após ${result.stepCount} step${result.stepCount === 1 ? '' : 's'}` : 'Resposta em modo chat'
  }

  const groupedActions = Object.entries(
    result.actions.reduce((accumulator, action) => {
      accumulator[action.tool] = (accumulator[action.tool] || 0) + 1
      return accumulator
    }, {})
  ).map(([tool, count]) => (count > 1 ? `${tool} x${count}` : tool))

  const stepSuffix = result.stepCount > 0 ? ` em ${result.stepCount} step${result.stepCount === 1 ? '' : 's'}` : ''

  if (result.actions.length === 1) {
    return `Ação executada${stepSuffix}: ${groupedActions[0]}`
  }

  return `Ações executadas${stepSuffix}: ${groupedActions.join(', ')}`
}

function getCreatedTaskFromResult(result) {
  return result.actions?.find((action) => action.tool === 'create_task')?.data || null
}

function appendStreamingLine(currentText, nextLine) {
  const trimmedLine = nextLine?.trim()

  if (!trimmedLine) {
    return currentText
  }

  if (!currentText) {
    return trimmedLine
  }

  // Evita repetir estados seguidos quando o backend reenvia a mesma fase.
  const lines = currentText.split('\n').map((line) => line.trim()).filter(Boolean)

  if (lines[lines.length - 1] === trimmedLine) {
    return currentText
  }

  return `${currentText}\n${trimmedLine}`
}

function updateMessageById(messages, messageId, updater) {
  return messages.map((message) => (
    message.id === messageId
      ? updater(message)
      : message
  ))
}

function ChatPanel() {
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState(initialMessages)
  const [createdTask, setCreatedTask] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const chatThreadRef = useRef(null)

  function openTasksPageInNewTab(taskId = null) {
    const url = taskId ? `/tasks?highlightTaskId=${taskId}` : '/tasks'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const { data: session } = useQuery({
    queryKey: ['taskbot-session'],
    queryFn: getTaskBotSession,
    staleTime: Infinity,
  })

  const userId = session?.userId || 'utilizador'

  useEffect(() => {
    const threadElement = chatThreadRef.current

    if (!threadElement) {
      return
    }

    threadElement.scrollTop = threadElement.scrollHeight
  }, [messages, isStreaming, createdTask])

  useEffect(() => {
    if (!createdTask) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setCreatedTask(null)
    }, 8000)

    return () => window.clearTimeout(timeoutId)
  }, [createdTask])

  function submitPrompt(rawPrompt) {
    const trimmedPrompt = rawPrompt.trim()

    if (!trimmedPrompt || isStreaming) {
      return
    }

    const requestId = Date.now()
    const userMessageId = `user-${requestId}`
    const assistantMessageId = `assistant-stream-${requestId}`

    setCreatedTask(null)
    setPrompt('')
    setIsStreaming(true)
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: userMessageId,
        role: 'user',
        text: trimmedPrompt,
        meta: null,
      },
      {
        id: assistantMessageId,
        role: 'assistant',
        // Esta bolha começa como progresso incremental e é substituída pela resposta final.
        text: 'A ligar ao stream do TaskBot...',
        meta: 'Streaming em curso',
      },
    ])

    sendChatMessageStream(trimmedPrompt, {
      onEvent: (event) => {
        if (event.type !== 'status' && event.type !== 'tool') {
          return
        }

        const nextLine = event.message || 'A processar o pedido.'

        setMessages((currentMessages) => updateMessageById(currentMessages, assistantMessageId, (message) => ({
          ...message,
          text: appendStreamingLine(message.text, nextLine),
          meta: event.type === 'tool'
            ? `Streaming em curso · ${event.tool}`
            : 'Streaming em curso',
        })))
      },
      onResult: (result) => {
        setCreatedTask(getCreatedTaskFromResult(result))
        setMessages((currentMessages) => updateMessageById(currentMessages, assistantMessageId, (message) => ({
          ...message,
          text: result.reply,
          meta: formatToolMeta(result),
        })))
      },
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['categories'] })
      })
      .catch((error) => {
        setCreatedTask(null)
        setMessages((currentMessages) => updateMessageById(currentMessages, assistantMessageId, (message) => ({
          ...message,
          text: getFriendlyChatErrorMessage(error),
          meta: getChatErrorMeta(error),
        })))
      })
      .finally(() => {
        setIsStreaming(false)
      })
  }

  function handleSubmit(event) {
    event.preventDefault()
    submitPrompt(prompt)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitPrompt(prompt)
    }
  }

  return (
    <section className='chat-panel'>
      <div className='chat-panel-header'>
        <div>
          <h2>Chat TaskBot</h2>
          <p>Sugestões de comandos rápidos:</p>
        </div>

        <span className='chat-panel-status'>Olá {userId}!</span>
      </div>

      <div className='chat-quick-prompts'>
        {quickPrompts.map((quickPrompt) => (
          <button key={quickPrompt} type='button' onClick={() => submitPrompt(quickPrompt)} disabled={isStreaming}>
            {quickPrompt}
          </button>
        ))}
      </div>

      <div ref={chatThreadRef} className='chat-thread'>
        {messages.map((message) => (
          <article key={message.id} className={`chat-bubble chat-bubble-${message.role}`}>
            <span className='chat-role'>{message.role === 'assistant' ? 'TaskBot' : 'Tu'}</span>
            <div className='chat-message-content'>{renderMessageContent(message.text)}</div>
            {message.meta ? <small>{message.meta}</small> : null}
          </article>
        ))}

        {createdTask ? (
          <article className='chat-created-banner'>
            <div>
              <span className='chat-role'>Tarefa criada</span>
              <p>{createdTask.task}</p>
            </div>

            <button
              type='button'
              onClick={() => openTasksPageInNewTab(createdTask.id)}
            >
              Ver tarefa na lista
            </button>
          </article>
        ) : null}
      </div>

      <form className='chat-composer' onSubmit={handleSubmit}>
        <label htmlFor='chat-prompt' className='chat-label'>Mensagem</label>
        <textarea
          id='chat-prompt'
          name='chatPrompt'
          rows={4}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Ex: cria uma tarefa urgente para preparar a demo de amanhã'
        />

        <div className='chat-composer-footer'>
          <p>Enter envia. Shift + Enter cria nova linha.</p>
          <button type='submit' disabled={isStreaming || !prompt.trim()}>
            {isStreaming ? 'A transmitir...' : 'Enviar'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default ChatPanel