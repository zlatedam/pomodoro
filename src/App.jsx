import { useState } from 'react'
import './App.css'

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true)

  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      <header>
        <h1>My Pomodoro</h1>
        <button onClick={() => setIsDarkMode(!isDarkMode)}>
          Toggle Theme
        </button>
      </header>

      <main>
        <div className="timer-section">
          <div className="timer-display">25:00</div>
          <div className="timer-controls">
            <button>Start</button>
            <button>Reset</button>
          </div>
        </div>

        <div className="stats-section">
          <h2>Today's Stats</h2>
          <p>Sessions completed: 0</p>
        </div>
      </main>
    </div>
  )
}

export default App
