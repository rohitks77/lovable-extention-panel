import { useState } from 'react'
import './index.css'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem('mt_admin_auth') === 'true')

  const handleLogin = () => setAuthed(true)
  const handleLogout = () => {
    localStorage.removeItem('mt_admin_auth')
    setAuthed(false)
  }

  return authed ? <Dashboard onLogout={handleLogout} /> : <Login onLogin={handleLogin} />
}
