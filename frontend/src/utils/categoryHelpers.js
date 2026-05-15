// Aceita categoria como objeto completo ou slug simples.
export function getCategorySlug(categoryOrTransaction) {
  const category = categoryOrTransaction?.category ?? categoryOrTransaction

  return category && typeof category === 'object' ? category.slug : category
}