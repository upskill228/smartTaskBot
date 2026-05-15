const priorityLabels = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export function getPriorityLabel(priority) {
  if (!priority) {
    return 'Sem prioridade'
  }

  return priorityLabels[priority] || priority
}