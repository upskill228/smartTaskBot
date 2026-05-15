import { NavLink, Outlet } from 'react-router'
import { useContext } from 'react'
import { ThemeContext } from '../context/ThemeContext'
import '../styles/MainLayout.css'

function MainLayout() {
    const { theme, toggleTheme } = useContext(ThemeContext)
    
    return (
        <div className={`app ${theme}`}>
            <div className="main-layout">
                <header className="header-container">
                    <div className="icon-title-container">
                        <i className="fa-solid fa-list-check header-icon"></i>
                        <div className="header-text">
                            <h1 className="header-title">TaskBot</h1>
                        </div>
                    </div>

                    <div className='controllers-container'>
                        <nav className="main-layout-nav">
                            <NavLink to="/chat" className={({ isActive }) => isActive ? 'active' : undefined}>Chat</NavLink>
                                <NavLink to="/tasks" className={({ isActive }) => isActive ? 'active' : undefined}>Tarefas</NavLink>
                        </nav>

                        <button type='button' className='theme-toggle-button' onClick={toggleTheme} aria-label='Alternar tema'>
                            <i className={theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun'}></i>
                        </button>
                    </div>
                </header>

                <main className="main-layout-content">
                    <Outlet />
                </main>
            </div>
        </div>
  )
}

export default MainLayout