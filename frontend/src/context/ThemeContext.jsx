import { createContext, useState, useEffect } from 'react'

export const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // Mantém o último tema escolhido entre reloads.
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  // Escrever no localStorage sempre que o tema muda
  useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme]) // ← corre sempre que 'theme' muda

  // Aplica a classe do tema ao body para que o CSS global reaja à mudança.
  useEffect(() => {
    document.body.classList.remove('light', 'dark')
    document.body.classList.add(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}