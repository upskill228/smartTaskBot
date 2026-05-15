export default function CategoryFilter({ categories, activeCategory, onCategoryChange }) {
  return (
    <div className="category-filter">
      <button
        type="button"
        className={!activeCategory ? 'active' : ''}
        onClick={() => onCategoryChange(null)}
      >
        Todas
      </button>

      {categories.map(cat => (
        <button
          key={cat.slug} // slug é identificador único - é passado para key
          type="button"
          className={activeCategory === cat.slug ? 'active' : ''}
          onClick={() => onCategoryChange(cat.slug)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}