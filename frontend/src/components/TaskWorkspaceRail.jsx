import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteTask, updateTaskCompletionStatus } from '../api'
import Modal from './Modal'
import { getPriorityLabel } from '../utils/priorityLabels'

const railFilters = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'urgent', label: 'Urgentes' },
  { id: 'today', label: 'Hoje' },
]

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
})

function isSameDay(dateValue, referenceDate) {
  const date = new Date(dateValue)

  return date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth()
    && date.getDate() === referenceDate.getDate()
}

function getVisibleTasks(tasks, filterId) {
  const today = new Date()

  switch (filterId) {
    case 'pending':
      return tasks.filter((task) => !task.completed)
    case 'urgent':
      return tasks.filter((task) => task.priority === 'URGENT')
    case 'today':
      return tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, today))
    default:
      return tasks
  }
}

function getTaskMeta(task) {
  const parts = []

  if (task.priority) {
    parts.push(getPriorityLabel(task.priority))
  }

  if (task.dueDate) {
    parts.push(dateFormatter.format(new Date(task.dueDate)))
  }

  if (task.assignee) {
    parts.push(task.assignee)
  }

  return parts.join(' · ') || 'Sem prioridade, data ou responsável'
}

export default function TaskWorkspaceRail({ tasks = [] }) {
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState('all')
  const [taskToDelete, setTaskToDelete] = useState(null)

  function openTasksPageInNewTab(taskId = null) {
    const url = taskId ? `/tasks?highlightTaskId=${taskId}` : '/tasks'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const { mutate: deleteTaskMutation, isPending: isDeleting } = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      setTaskToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const { mutate: updateTaskStatusMutation, isPending: isUpdating } = useMutation({
    mutationFn: ({ taskId, completed }) => updateTaskCompletionStatus(taskId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const visibleTasks = useMemo(() => {
    const filteredTasks = getVisibleTasks(tasks, activeFilter)
    // A rail mostra só uma amostra curta; a navegação completa fica na página /tasks.
    return filteredTasks.slice(0, 7)
  }, [tasks, activeFilter])

  const summary = useMemo(() => {
    const pendingTasks = tasks.filter((task) => !task.completed).length
    const urgentTasks = tasks.filter((task) => task.priority === 'URGENT').length

    return {
      total: tasks.length,
      pending: pendingTasks,
      urgent: urgentTasks,
    }
  }, [tasks])

  function handleToggleComplete(task) {
    updateTaskStatusMutation({
      taskId: task.id,
      completed: !task.completed,
    })
  }

  function openDeleteModal(task) {
    setTaskToDelete(task)
  }

  function closeDeleteModal() {
    if (isDeleting) {
      return
    }

    setTaskToDelete(null)
  }

  function confirmDeleteTask() {
    if (!taskToDelete) {
      return
    }

    deleteTaskMutation(taskToDelete.id)
  }

  return (
    <>
      <aside className='task-workspace-rail'>
        <section className='task-workspace-section'>
          <div className='task-workspace-heading'>
            <div>
              <span className='task-workspace-kicker'>Estatísticas</span>
            </div>
            <button
              type='button'
              className='task-workspace-link'
              onClick={() => openTasksPageInNewTab()}
            >
              Abrir vista completa
            </button>
          </div>

          <div className='task-workspace-summary'>
            <article>
              <span>Total</span>
              <strong>{summary.total}</strong>
            </article>
            <article>
              <span>Pendentes</span>
              <strong>{summary.pending}</strong>
            </article>
            <article>
              <span>Urgentes</span>
              <strong>{summary.urgent}</strong>
            </article>
          </div>
        </section>

        <section className='task-workspace-section'>
          <div className='task-workspace-heading'>
            <div>
              <span className='task-workspace-kicker'>Filtros rápidos</span>
            </div>
            <span className='task-workspace-filter-count'>{visibleTasks.length} visíveis</span>
          </div>

          <div className='task-workspace-filters'>
            {railFilters.map((filter) => (
              <button
                key={filter.id}
                type='button'
                className={filter.id === activeFilter ? 'task-workspace-filter active' : 'task-workspace-filter'}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className='task-workspace-section'>
          <div className='task-workspace-heading'>
            <div>
              <span className='task-workspace-kicker'>Atividade recente</span>
            </div>
          </div>

          {visibleTasks.length === 0 ? (
            <p className='task-workspace-empty'>Não existem tarefas para este filtro. Usa o chat para criar uma nova ou muda o filtro acima.</p>
          ) : (
            <div className='task-workspace-list'>
              {visibleTasks.map((task) => (
                <article key={task.id} className={task.completed ? 'task-workspace-item is-completed' : 'task-workspace-item'}>
                  <div className='task-workspace-item-main'>
                    <button
                      type='button'
                      className={task.completed ? 'task-workspace-toggle is-completed' : 'task-workspace-toggle'}
                      onClick={() => handleToggleComplete(task)}
                      disabled={isUpdating}
                      aria-label={`${task.completed ? 'Reabrir' : 'Concluir'} tarefa ${task.task}`}
                    >
                      {task.completed ? 'Concluída' : 'Pendente'}
                    </button>

                    <div className='task-workspace-copy'>
                      <strong>{task.task}</strong>
                      <p>{getTaskMeta(task)}</p>
                    </div>
                  </div>

                  <div className='task-workspace-actions'>
                    <button
                      type='button'
                      className='task-workspace-mini-button'
                      onClick={() => openTasksPageInNewTab(task.id)}
                    >
                      Ver
                    </button>
                    <button
                      type='button'
                      className='task-workspace-mini-button danger'
                      onClick={() => openDeleteModal(task)}
                      disabled={isDeleting}
                    >
                      Apagar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </aside>

      <Modal
        isOpen={Boolean(taskToDelete)}
        title='Confirmar eliminação'
        message={taskToDelete ? `Tens a certeza que queres eliminar a tarefa "${taskToDelete.task}"?` : ''}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteTask}
        isConfirming={isDeleting}
      />
    </>
  )
}