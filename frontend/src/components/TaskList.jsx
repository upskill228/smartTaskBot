import '../styles/TaskList.css'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteTask, updateTaskCompletionStatus } from '../api'
import React from 'react'
import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import TaskIdentityBadge from './TaskIdentityBadge'
import { getPriorityLabel } from '../utils/priorityLabels'

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
})

const TaskCard = React.forwardRef(function TaskCard({
    task,
    isHighlighted,
    isDeleteDisabled,
    isStatusDisabled,
    onDelete,
    onToggleComplete,
}, ref) {
    const formattedDate = task.dueDate ? dateFormatter.format(new Date(task.dueDate)) : 'Sem prazo'
    const priorityLabel = getPriorityLabel(task.priority)
    const spaceLabel = task.space || 'Sem espaço'
    const assigneeLabel = task.assignee || 'Não atribuída'
    const statusLabel = task.completed ? 'Concluída' : 'Pendente'

    return (
        <article
            ref={ref}
            className={[
                'task-card',
                task.completed ? 'task-card-completed' : '',
                isHighlighted ? 'task-card-highlighted' : '',
            ].filter(Boolean).join(' ')}>
            <div className='task-card-header'>
                <div className='task-card-copy'>
                    <div className='task-title-row'>
                        <TaskIdentityBadge taskId={task.id} />
                    </div>
                    <strong>{task.task}</strong>
                    <span>{task.completed ? 'Fechada' : 'Em aberto'}</span>
                </div>

                <button
                    className={task.completed ? 'task-status-button is-completed' : 'task-status-button'}
                    onClick={() => onToggleComplete(task)}
                    type='button'
                    disabled={isStatusDisabled}
                    aria-label={`${task.completed ? 'Reabrir' : 'Concluir'} tarefa ${task.task}`}
                >
                    {statusLabel}
                </button>
            </div>

            <dl className='task-card-meta-grid'>
                <div>
                    <dt>Prioridade</dt>
                    <dd><span className='type-badge'>{priorityLabel}</span></dd>
                </div>
                <div>
                    <dt>Prazo</dt>
                    <dd>{formattedDate}</dd>
                </div>
                <div>
                    <dt>Espaço</dt>
                    <dd>{spaceLabel}</dd>
                </div>
                <div>
                    <dt>Responsável</dt>
                    <dd>{assigneeLabel}</dd>
                </div>
            </dl>

            <div className='task-card-actions'>
                <button
                    className='task-card-delete-button'
                    onClick={() => onDelete(task)}
                    type='button'
                    disabled={isDeleteDisabled}
                    aria-label={`Eliminar tarefa ${task.task}`}
                >
                    Eliminar
                </button>
            </div>
        </article>
    )
})

function TaskList({
    tasks,
    title = 'Tarefas',
    actions = null,
    hideCompleted = false,
    highlightedTaskId = null,
    highlightedTaskLabel = null,
}) {
    const queryClient = useQueryClient()
    const [taskToDelete, setTaskToDelete] = useState(null)
    const highlightedTaskRef = useRef(null)
    const [visibleHighlightedTaskId, setVisibleHighlightedTaskId] = useState(highlightedTaskId)

    const {
        mutate: deleteTaskMutation,
        isError,
        isPending,
    } = useMutation({
        mutationFn: deleteTask,
        onSuccess: () => {
            setTaskToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
        },
    })

    const { mutate: updateTaskStatusMutation, isPending: isUpdatingStatus } = useMutation({
        mutationFn: ({ taskId, completed }) => updateTaskCompletionStatus(taskId, completed),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
        },
    })

    function openDeleteModal(task) {
        setTaskToDelete(task)
    }

    function closeDeleteModal() {
        if (isPending) {
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

    function handleToggleComplete(task) {
        updateTaskStatusMutation({
            taskId: task.id,
            completed: !task.completed,
        })
    }

    useEffect(() => {
        setVisibleHighlightedTaskId(highlightedTaskId)
    }, [highlightedTaskId])

    useEffect(() => {
        if (!visibleHighlightedTaskId || !highlightedTaskRef.current) {
            return
        }

        // Quando a navegação vem do chat, traz a tarefa destacada para o centro da lista.
        highlightedTaskRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        })
    }, [visibleHighlightedTaskId, tasks])

    useEffect(() => {
        if (!visibleHighlightedTaskId) {
            return undefined
        }

        // O destaque visual é temporário para não ficar preso na UI após a navegação contextual.
        const timeoutId = window.setTimeout(() => {
            setVisibleHighlightedTaskId(null)
        }, 8000)

        return () => window.clearTimeout(timeoutId)
    }, [visibleHighlightedTaskId])

    return (
        <>
            <section className='task-list-section'>
                <div className='task-list-header'>
                    <div className='task-list-heading-block'>
                        <h2>{title}</h2>
                        <p>
                            {hideCompleted
                                ? 'A mostrar apenas tarefas activas para manter o foco no que falta.'
                                : 'Visão geral das tarefas mais recentes com estado, prioridade e responsáveis.'}
                        </p>
                    </div>
                    {actions ? <div className='task-list-actions'>{actions}</div> : null}
                </div>

                {isError ? <p className='error-message'>Erro ao eliminar tarefa.</p> : null}

                <div className='task-card-list-wrapper'>
                    {tasks.length === 0 ? (
                        <p className='task-list-empty-state'>Não existem tarefas para os filtros selecionados.</p>
                    ) : (
                        <div className='task-card-list'>
                            {tasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    ref={task.id === visibleHighlightedTaskId ? highlightedTaskRef : null}
                                    task={task}
                                    isHighlighted={task.id === visibleHighlightedTaskId}
                                    onToggleComplete={handleToggleComplete}
                                    onDelete={openDeleteModal}
                                    isDeleteDisabled={isPending}
                                    isStatusDisabled={isUpdatingStatus}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <Modal
                isOpen={Boolean(taskToDelete)}
                title='Confirmar eliminação'
                message={taskToDelete ? `Tens a certeza que queres eliminar a tarefa "${taskToDelete.task}"?` : ''}
                onClose={closeDeleteModal}
                onConfirm={confirmDeleteTask}
                isConfirming={isPending}
            />
        </>
    )
}

export default React.memo(TaskList)