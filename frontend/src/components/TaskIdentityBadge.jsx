import { useEffect, useRef, useState } from 'react'

async function copyTaskId(taskId) {
  const normalizedId = String(taskId)

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(normalizedId)
    return true
  }

  const fallbackInput = document.createElement('textarea')
  fallbackInput.value = normalizedId
  fallbackInput.setAttribute('readonly', '')
  fallbackInput.style.position = 'absolute'
  fallbackInput.style.left = '-9999px'

  document.body.appendChild(fallbackInput)
  fallbackInput.select()

  const didCopy = document.execCommand('copy') // fallback para browsers antigos
  document.body.removeChild(fallbackInput)

  return didCopy
}

export default function TaskIdentityBadge({ taskId }) {
  const [copyState, setCopyState] = useState('idle')
  const resetTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  async function handleCopyId() {
    try {
      const didCopy = await copyTaskId(taskId)
      setCopyState(didCopy ? 'copied' : 'error')
    } catch {
      setCopyState('error')
    }

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current)
    }

    resetTimeoutRef.current = setTimeout(() => {
      setCopyState('idle')
    }, 1600)
  }

  const taskLabel = `#${taskId}`
  const helperText = copyState === 'copied' ? 'Copiado' : copyState === 'error' ? 'Falhou' : ''

  return (
    <button
      type='button'
      className={copyState === 'copied' ? 'task-id-button is-copied' : 'task-id-button'}
      onClick={handleCopyId}
      aria-label={`${helperText}: ${taskLabel}`}
      title={helperText}
    >
      <span>{taskLabel}</span>
      <span className='task-id-helper'>{helperText}</span>
    </button>
  )
}