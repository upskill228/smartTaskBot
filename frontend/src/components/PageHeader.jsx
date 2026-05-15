import '../styles/PageHeader.css'

function PageHeader({ title, subtitle, children, className = '' }) {
  const headerClassName = className ? `page-header ${className}` : 'page-header'

  return (
    <div className={headerClassName}>
      <div className='page-header-text'>
        <h3>{title}</h3>
        {subtitle ? <p className='page-header-subtitle'>{subtitle}</p> : null}
      </div>

      {children ? <div className='page-header-actions'>{children}</div> : null}
    </div>
  )
}

export default PageHeader