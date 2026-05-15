import '../styles/WorkspaceLayout.css'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { getCategories, getTasks } from '../api'
import TaskList from '../components/TaskList'
import DateRangePicker from '../components/DateRangePicker'
import CategoryFilter from '../filters/CategoryFilter'
import { filtersReducer, initialState } from '../filters/filtersReducer'
import PageHeader from '../components/PageHeader'
import { getCategorySlug } from '../utils/categoryHelpers'

function resolveHighlightedTaskId(location) {
  const stateHighlightTaskId = location.state?.highlightTaskId

  if (stateHighlightTaskId !== undefined && stateHighlightTaskId !== null) {
    return Number(stateHighlightTaskId)
  }

  const queryHighlightTaskId = new URLSearchParams(location.search).get('highlightTaskId')

  if (!queryHighlightTaskId) {
    return null
  }

  const numericHighlightTaskId = Number(queryHighlightTaskId)
  return Number.isNaN(numericHighlightTaskId) ? null : numericHighlightTaskId
}

export default function TasksPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [filters, dispatch] = useReducer(filtersReducer, initialState)
  const [sortMode, setSortMode] = useState('date-desc')
  const [hideCompleted, setHideCompleted] = useState(false)
  const [highlightedTaskId, setHighlightedTaskId] = useState(() => resolveHighlightedTaskId(location))

  useEffect(() => {
    const nextHighlightedTaskId = resolveHighlightedTaskId(location)

    if (nextHighlightedTaskId !== null) {
      setHighlightedTaskId(nextHighlightedTaskId)
    }
  }, [location])

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search)

    if (!queryParams.has('highlightTaskId')) {
      return
    }

    // O highlight vem da navegação a partir do chat e é consumido só uma vez.
    queryParams.delete('highlightTaskId')
    const nextSearch = queryParams.toString()

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      {
        replace: true,
        state: location.state,
      },
    )
  }, [location.pathname, location.search, location.state, navigate])

  const { data: allTasks = [], isLoading, isError } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  })

  const highlightedTask = allTasks.find((task) => task.id === highlightedTaskId) ?? null

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const baseFilteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      // Os filtros de data usam apenas o prazo real; tarefas sem dueDate ficam fora do intervalo.
      const hasDateInRange = !filters.startDate && !filters.endDate
        ? true
        : Boolean(task.dueDate)
      const date = task.dueDate ? new Date(task.dueDate) : null
      const afterStart = !filters.startDate || (date && date >= new Date(filters.startDate))
      const beforeEnd = !filters.endDate || (date && date <= new Date(filters.endDate))
      const matchesCategory =
        !filters.activeCategory || getCategorySlug(task.space) === filters.activeCategory

      return hasDateInRange && afterStart && beforeEnd && matchesCategory
    })
  }, [allTasks, filters])

  const filteredTasks = useMemo(() => {
    if (!hideCompleted) {
      return baseFilteredTasks
    }

    return baseFilteredTasks.filter((task) => !task.completed)
  }, [baseFilteredTasks, hideCompleted])

  const sortedTasks = useMemo(() => {
    const tasks = [...filteredTasks]

    if (sortMode === 'title-asc') {
      return tasks.sort((firstTask, secondTask) => firstTask.task.localeCompare(secondTask.task, 'pt'))
    }

    if (sortMode === 'title-desc') {
      return tasks.sort((firstTask, secondTask) => secondTask.task.localeCompare(firstTask.task, 'pt'))
    }

    // Fora do modo alfabético, a lista mantém a timeline geral: dueDate quando existe, createdAt como fallback.
    return tasks.sort((firstTask, secondTask) => new Date(secondTask.timelineDate) - new Date(firstTask.timelineDate))
  }, [filteredTasks, sortMode])

  const activeFiltersCount =
    (filters.startDate !== initialState.startDate || filters.endDate !== initialState.endDate ? 1 : 0) +
    (filters.activeCategory ? 1 : 0) +
    (sortMode !== 'date-desc' ? 1 : 0) +
    (hideCompleted ? 1 : 0)

  const totalTasks = baseFilteredTasks.length
  const urgentTasks = baseFilteredTasks.filter((task) => task.priority === 'URGENT').length
  const completedTasks = baseFilteredTasks.filter((task) => task.completed === true).length
  const pendingTasks = totalTasks - completedTasks

  if (isLoading) return <p>A carregar...</p>
  if (isError) return <p>Erro ao carregar tarefas.</p>

  return (
    <section className='workspace-page'>
      <PageHeader
        title='Tarefas'
        subtitle='Consulta, filtra e organiza a lista completa sem competir com a interface conversacional.'
      />

      <div className='workspace-layout'>
        <aside className='workspace-sidebar-column'>
          <div className='workspace-sidebar-card'>
            <section className='workspace-sidebar-section'>
              <h2>Resumo</h2>
              <div className='workspace-summary-grid'>
                <article className='workspace-summary-item workspace-summary-item-wide'>
                  <span>Total de tarefas</span>
                  <strong>{totalTasks}</strong>
                </article>
                <article className='workspace-summary-item'>
                  <span>Tarefas urgentes</span>
                  <strong>{urgentTasks}</strong>
                </article>
                <article className='workspace-summary-item'>
                  <span>Tarefas pendentes</span>
                  <strong>{pendingTasks}</strong>
                </article>
                <article className='workspace-summary-item workspace-summary-item-muted'>
                  <span>Tarefas concluídas</span>
                  <strong>{completedTasks}</strong>
                </article>
              </div>
            </section>

            <section className='workspace-sidebar-section'>
              <div className='workspace-section-heading'>
                <h3>Filtros</h3>
                {activeFiltersCount > 0 ? (
                  <button
                    type='button'
                    className='workspace-reset-button'
                    onClick={() => {
                      dispatch({ type: 'RESET' })
                      setSortMode('date-desc')
                      setHideCompleted(false)
                    }}
                  >
                    Limpar
                  </button>
                ) : null}
              </div>

              <div className='workspace-filter-group'>
                <label htmlFor='workspace-sort-mode' className='workspace-filter-label'>Ordenar</label>
                <select
                  id='workspace-sort-mode'
                  className='workspace-sort-select'
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                >
                  <option value='date-desc'>Por data</option>
                  <option value='title-asc'>A-Z</option>
                  <option value='title-desc'>Z-A</option>
                </select>
              </div>

              <div className='workspace-filter-group'>
                <span className='workspace-filter-label'>Datas</span>
                <DateRangePicker
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  onDateChange={(start, end) => dispatch({ type: 'SET_DATE_RANGE', start, end })}
                />
              </div>

              <div className='workspace-filter-group'>
                <span className='workspace-filter-label'>Espaços</span>
                <CategoryFilter
                  categories={categories}
                  activeCategory={filters.activeCategory}
                  onCategoryChange={(category) => dispatch({ type: 'SET_CATEGORY', category })}
                />
              </div>

              <label className='workspace-toggle-filter'>
                <input
                  type='checkbox'
                  checked={hideCompleted}
                  onChange={(event) => setHideCompleted(event.target.checked)}
                />
                <span>Ocultar tarefas concluídas</span>
              </label>
            </section>
          </div>
        </aside>

        <div className='workspace-main-column'>
          <TaskList
            tasks={sortedTasks}
            title='Lista de tarefas'
            hideCompleted={hideCompleted}
            highlightedTaskId={highlightedTaskId}
            highlightedTaskLabel={highlightedTask?.task || null}
            actions={(
              <div className='workspace-list-actions'>
                <span className='workspace-filters-status'>
                  {activeFiltersCount > 0 ? `${activeFiltersCount} filtros ativos` : 'Ordenado por data'}
                </span>
              </div>
            )}
          />
        </div>
      </div>
    </section>
  )
}