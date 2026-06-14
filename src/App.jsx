import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import DeckDashboard from './components/DeckDashboard'
import StudyView from './components/StudyView'
import CardEditor from './components/CardEditor'
import StatsPage from './components/StatsPage'
import './App.css'

const ThemeContext = createContext()

export function useTheme() {
  return useContext(ThemeContext)
}

function AppContent() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const isStudying = location.pathname.startsWith('/study/')

  return (
    <div className="app-layout">
      {!isStudying && (
        <nav className="sidebar">
          <div className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">✦</span>
              <span className="logo-text">Recall</span>
            </div>
            <p className="logo-subtitle">Learn smarter, not harder</p>
          </div>

          <div className="sidebar-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-dashboard">
              <span className="nav-icon">📚</span>
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/stats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-stats">
              <span className="nav-icon">📊</span>
              <span>Statistics</span>
            </NavLink>
          </div>

          <div className="sidebar-footer">
            <button onClick={toggleTheme} className="theme-toggle btn btn-ghost" id="theme-toggle">
              <span>{theme === 'light' ? '🌙' : '☀️'}</span>
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
          </div>
        </nav>
      )}

      <main className={`main-content ${isStudying ? 'full-width' : ''}`}>
        <Routes>
          <Route path="/" element={<DeckDashboard />} />
          <Route path="/deck/:deckId" element={<CardEditor />} />
          <Route path="/study/:deckId" element={<StudyView />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('recall-theme') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('recall-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeContext.Provider>
  )
}

export default App
