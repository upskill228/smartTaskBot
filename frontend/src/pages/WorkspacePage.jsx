import '../styles/WorkspaceLayout.css'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTasks } from '../api'
import ChatPanel from '../components/ChatPanel'
import TaskWorkspaceRail from '../components/TaskWorkspaceRail'

export default function WorkspacePage() {
  const [isIntroCollapsed, setIsIntroCollapsed] = useState(true)
  const { data: tasks = [], isLoading, isError } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  })

  if (isLoading) return <p>A carregar...</p>
  if (isError) return <p>Erro ao carregar tarefas.</p>

  return (
    <section className='workspace-page chat-page'>
      <div className='workspace-layout chat-page-layout'>
        <div className='chat-workspace-rail-column'>
          <section className={isIntroCollapsed ? 'chat-workspace-intro is-collapsed' : 'chat-workspace-intro'}>
            <div className='chat-workspace-intro-copy'>
              <span className='chat-page-kicker'>Assistente conversacional para gestão de tarefas.</span>

              <h2>Cria, edita e gere tarefas directamente no chat.</h2>

              {!isIntroCollapsed ? (
                <p>
                  Escreve pedidos com linguagem natural.
                  <br />
                  Após criares uma tarefa, podes continuar com “agora atribui”, “muda a prioridade” ou “marca como concluída”.
                  <br />
                  Podes ainda fazer consultas rápidas para perceber estado, urgência e pendências.
                </p>
              ) : null}
            </div>

            <button
              type='button'
              className={isIntroCollapsed ? 'chat-workspace-intro-toggle is-collapsed' : 'chat-workspace-intro-toggle'}
              onClick={() => setIsIntroCollapsed((currentValue) => !currentValue)}
              aria-expanded={!isIntroCollapsed}
              aria-label={isIntroCollapsed ? 'Expandir introdução' : 'Recolher introdução'}
              title={isIntroCollapsed ? 'Expandir introdução' : 'Recolher introdução'}
            >
              <span className='chat-workspace-intro-toggle-glyph' aria-hidden='true'>
                {isIntroCollapsed ? '+' : '-'}
              </span>
            </button>
          </section>

          <TaskWorkspaceRail tasks={tasks} />
        </div>

        <div className='workspace-main-column'>
          <ChatPanel />
        </div>
      </div>
    </section>
  )
}