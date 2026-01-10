import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [theme, setTheme] = useState('device')
  const [showSettings, setShowSettings] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showDataModal, setShowDataModal] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportTab, setReportTab] = useState('summary')
  const [chartView, setChartView] = useState('week')
  const [chartOffset, setChartOffset] = useState(0)
  const [chartTooltip, setChartTooltip] = useState({ show: false, x: 0, y: 0, value: '', label: '' })
  
  // Timer settings
  const [pomodoroDuration, setPomodoroDuration] = useState(25)
  const [shortBreakDuration, setShortBreakDuration] = useState(5)
  const [longBreakDuration, setLongBreakDuration] = useState(15)
  const [autoStartBreaks, setAutoStartBreaks] = useState(false)
  const [autoStartPomodoros, setAutoStartPomodoros] = useState(false)
  const [longBreakInterval, setLongBreakInterval] = useState(4)
  
  // Timer state
  const [mode, setMode] = useState('pomodoro')
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  
  // Tag state
  const [currentTag, setCurrentTag] = useState('#study')
  const [savedTags, setSavedTags] = useState(['#study', '#coding', '#writing'])
  const [editingTag, setEditingTag] = useState(null)
  const [tempTagValue, setTempTagValue] = useState('')
  
  // Session data
  const [sessions, setSessions] = useState([])
  const [lastBackupReminder, setLastBackupReminder] = useState(null)
  
  const intervalRef = useRef(null)
  const fileInputRef = useRef(null)

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('pomodoroSessions')
    if (stored) {
      setSessions(JSON.parse(stored))
    }
  }, [])

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('pomodoroSessions', JSON.stringify(sessions))
    }
  }, [sessions])

  // Load last backup reminder date
  useEffect(() => {
    const stored = localStorage.getItem('lastBackupReminder')
    if (stored) {
      setLastBackupReminder(new Date(stored))
    }
  }, [])

  // Check for backup reminder (weekly)
  useEffect(() => {
    if (sessions.length === 0) return
    
    const now = new Date()
    if (!lastBackupReminder) {
      localStorage.setItem('lastBackupReminder', now.toISOString())
      setLastBackupReminder(now)
      return
    }
    
    const daysSinceLastReminder = Math.floor((now - lastBackupReminder) / (1000 * 60 * 60 * 24))
    
    if (daysSinceLastReminder >= 7) {
      const shouldBackup = window.confirm('It\'s been a week since your last backup reminder. Would you like to export your data now?')
      if (shouldBackup) {
        handleExportData()
      }
      localStorage.setItem('lastBackupReminder', now.toISOString())
      setLastBackupReminder(now)
    }
  }, [sessions.length])

  const getActiveTheme = () => {
    if (isRunning) return 'dark'
    if (theme === 'device') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }

  const activeTheme = getActiveTheme()

  useEffect(() => {
    if (theme === 'device') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => setTheme('device')
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      setIsRunning(false)
      handleTimerComplete()
    }

    return () => clearInterval(intervalRef.current)
  }, [isRunning, timeLeft])

  const handleTimerComplete = () => {
    if (mode === 'pomodoro') {
      const now = new Date()
      const newSession = {
        id: Date.now(),
        timestamp: formatDateTime(now),
        date: formatDate(now),
        duration: pomodoroDuration,
        tag: currentTag,
        type: 'pomodoro'
      }
      setSessions(prev => [...prev, newSession])
      
      const newSessionCount = sessionsCompleted + 1
      setSessionsCompleted(newSessionCount)
      
      if (newSessionCount % longBreakInterval === 0) {
        switchMode('longBreak')
        if (autoStartBreaks) setIsRunning(true)
      } else {
        switchMode('shortBreak')
        if (autoStartBreaks) setIsRunning(true)
      }
    } else {
      switchMode('pomodoro')
      if (autoStartPomodoros) setIsRunning(true)
    }
  }

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(2)
    return `${day}-${month}-${year}`
  }

  const formatDateTime = (date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(2)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}-${month}-${year} ${hours}:${minutes}`
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setIsRunning(false)
    
    if (newMode === 'pomodoro') {
      setTimeLeft(pomodoroDuration * 60)
    } else if (newMode === 'shortBreak') {
      setTimeLeft(shortBreakDuration * 60)
    } else if (newMode === 'longBreak') {
      setTimeLeft(longBreakDuration * 60)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartPause = () => {
    setIsRunning(!isRunning)
  }

  const handleReset = () => {
    setIsRunning(false)
    if (mode === 'pomodoro') {
      setTimeLeft(pomodoroDuration * 60)
    } else if (mode === 'shortBreak') {
      setTimeLeft(shortBreakDuration * 60)
    } else {
      setTimeLeft(longBreakDuration * 60)
    }
  }

  const handleSaveCurrentTag = () => {
    const trimmedTag = tempTagValue.trim()
    if (!trimmedTag) return
    
    const formattedTag = trimmedTag.startsWith('#') ? trimmedTag : `#${trimmedTag}`
    setCurrentTag(formattedTag)
    
    if (!savedTags.includes(formattedTag)) {
      setSavedTags(prev => [...prev, formattedTag])
    }
  }

  const handleEditSavedTag = (oldTag, newTag) => {
    const formattedTag = newTag.startsWith('#') ? newTag : `#${newTag}`
    setSavedTags(prev => prev.map(tag => tag === oldTag ? formattedTag : tag))
    if (currentTag === oldTag) {
      setCurrentTag(formattedTag)
    }
    setEditingTag(null)
  }

  const handleDeleteTag = (tagToDelete) => {
    setSavedTags(prev => prev.filter(tag => tag !== tagToDelete))
    if (currentTag === tagToDelete) {
      setCurrentTag('#study')
    }
  }

  const openTagModal = () => {
    setTempTagValue(currentTag)
    setShowTagModal(true)
  }

  const handleExportData = () => {
    const dailyTotals = {}
    
    sessions.forEach(session => {
      const key = `${session.date}|${session.tag}`
      if (!dailyTotals[key]) {
        dailyTotals[key] = {
          date: session.date,
          tag: session.tag,
          minutes: 0
        }
      }
      dailyTotals[key].minutes += session.duration
    })

    let csv = 'date,tag,minutes\n'
    Object.values(dailyTotals).forEach(row => {
      csv += `${row.date},${row.tag},${row.minutes}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pomodoro-export-${formatDate(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportData = () => {
    fileInputRef.current?.click()
  }

  const parsePomofocusCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim())
    const sessions = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const parts = line.split('\t')
      if (parts.length < 3) continue
      
      const dateStr = parts[0]
      const project = parts[1].replace(/"/g, '').trim()
      const minutes = parseInt(parts[2])
      
      if (!dateStr || isNaN(minutes)) continue
      
      const year = dateStr.substring(0, 4)
      const month = dateStr.substring(4, 6)
      const day = dateStr.substring(6, 8)
      const formattedDate = `${day}-${month}-${year.slice(2)}`
      
      const tag = project ? `#${project}` : '#study'
      
      sessions.push({
        date: formattedDate,
        tag: tag,
        minutes: minutes
      })
    }
    
    return sessions
  }

  const parseGoodtimeCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim())
    const sessions = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const parts = line.split(',')
      if (parts.length < 3) continue
      
      const timestamp = parts[0]
      const duration = parseInt(parts[1])
      const label = parts[2]?.trim() || ''
      
      if (!timestamp || isNaN(duration)) continue
      
      const dateParts = timestamp.split('-')
      if (dateParts.length < 3) continue
      
      const year = dateParts[0]
      const month = dateParts[1]
      const day = dateParts[2]
      const formattedDate = `${day}-${month}-${year.slice(2)}`
      
      const tag = label ? (label.toLowerCase() === 'study' ? '#study' : `#${label}`) : '#study'
      
      sessions.push({
        date: formattedDate,
        tag: tag,
        minutes: duration
      })
    }
    
    return sessions
  }

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (!text) return
      
      let parsedSessions = []
      
      if (text.includes('time-of-completion')) {
        parsedSessions = parseGoodtimeCSV(text)
      } else if (text.includes('\t')) {
        parsedSessions = parsePomofocusCSV(text)
      } else {
        alert('Unrecognized CSV format')
        return
      }
      
      const merged = {}
      
      sessions.forEach(session => {
        const key = `${session.date}|${session.tag}`
        if (!merged[key]) {
          merged[key] = {
            date: session.date,
            tag: session.tag,
            minutes: 0
          }
        }
        merged[key].minutes += session.duration
      })
      
      parsedSessions.forEach(session => {
        const key = `${session.date}|${session.tag}`
        if (!merged[key]) {
          merged[key] = session
        } else {
          merged[key].minutes += session.minutes
        }
      })
      
      const newSessions = Object.values(merged).map((item, index) => ({
        id: Date.now() + index,
        timestamp: `${item.date} 00:00`,
        date: item.date,
        duration: item.minutes,
        tag: item.tag,
        type: 'pomodoro'
      }))
      
      const allTags = new Set(savedTags)
      newSessions.forEach(session => allTags.add(session.tag))
      setSavedTags(Array.from(allTags))
      
      setSessions(newSessions)
      alert(`Imported ${parsedSessions.length} sessions!`)
    }
    
    reader.readAsText(file)
    event.target.value = ''
  }

  const handlePomodoroDurationChange = (newDuration) => {
    setPomodoroDuration(newDuration)
    if (mode === 'pomodoro' && !isRunning) {
      setTimeLeft(newDuration * 60)
    }
  }

  const handleShortBreakDurationChange = (newDuration) => {
    setShortBreakDuration(newDuration)
    if (mode === 'shortBreak' && !isRunning) {
      setTimeLeft(newDuration * 60)
    }
  }

  const handleLongBreakDurationChange = (newDuration) => {
    setLongBreakDuration(newDuration)
    if (mode === 'longBreak' && !isRunning) {
      setTimeLeft(newDuration * 60)
    }
  }

  const calculateStats = () => {
    const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0)
    const totalHours = Math.floor(totalMinutes / 60)
    
    const uniqueDates = new Set(sessions.map(s => s.date))
    const daysAccessed = uniqueDates.size
    
    const sortedDates = Array.from(uniqueDates).sort((a, b) => {
      const [dayA, monthA, yearA] = a.split('-')
      const [dayB, monthB, yearB] = b.split('-')
      const dateA = new Date(`20${yearA}-${monthA}-${dayA}`)
      const dateB = new Date(`20${yearB}-${monthB}-${dayB}`)
      return dateB - dateA
    })
    
    let streak = 0
    const today = new Date()
    
    if (sortedDates.length > 0) {
      const [day, month, year] = sortedDates[0].split('-')
      const mostRecent = new Date(`20${year}-${month}-${day}`)
      const diffDays = Math.floor((today - mostRecent) / (1000 * 60 * 60 * 24))
      
      if (diffDays <= 1) {
        streak = 1
        for (let i = 1; i < sortedDates.length; i++) {
          const [prevDay, prevMonth, prevYear] = sortedDates[i - 1].split('-')
          const [currDay, currMonth, currYear] = sortedDates[i].split('-')
          const prevDate = new Date(`20${prevYear}-${prevMonth}-${prevDay}`)
          const currDate = new Date(`20${currYear}-${currMonth}-${currDay}`)
          const diff = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24))
          
          if (diff === 1) {
            streak++
          } else {
            break
          }
        }
      }
    }
    
    return {
      hoursFocused: totalHours,
      daysAccessed: daysAccessed,
      dayStreak: streak
    }
  }

  const calculateProjectData = () => {
    const byTag = {}
    
    sessions.forEach(session => {
      if (!byTag[session.tag]) {
        byTag[session.tag] = 0
      }
      byTag[session.tag] += session.duration
    })
    
    return Object.entries(byTag).map(([tag, minutes]) => ({
      tag: tag,
      time: `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`
    }))
  }

  const stats = calculateStats()
  const projectData = calculateProjectData()

  const getChartLabels = () => {
    if (chartView === 'week') {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    } else if (chartView === 'month') {
      const now = new Date()
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + chartOffset, 1)
      const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
      return Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`)
    } else {
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    }
  }

  const getChartData = () => {
    const now = new Date()
    const data = []
    
    if (chartView === 'week') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay() + (chartOffset * 7))
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek)
        date.setDate(startOfWeek.getDate() + i)
        const dateStr = formatDate(date)
        
        const dayMinutes = sessions
          .filter(s => s.date === dateStr)
          .reduce((sum, s) => sum + s.duration, 0)
        
        data.push(dayMinutes / 60)
      }
    } else if (chartView === 'month') {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + chartOffset, 1)
      const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
      
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), i)
        const dateStr = formatDate(date)
        
        const dayMinutes = sessions
          .filter(s => s.date === dateStr)
          .reduce((sum, s) => sum + s.duration, 0)
        
        data.push(dayMinutes / 60)
      }
    } else {
      const targetYear = now.getFullYear() + chartOffset
      
      for (let month = 0; month < 12; month++) {
        const monthMinutes = sessions
          .filter(s => {
            const [day, monthStr, year] = s.date.split('-')
            return parseInt(`20${year}`) === targetYear && parseInt(monthStr) === month + 1
          })
          .reduce((sum, s) => sum + s.duration, 0)
        
        data.push(monthMinutes / 60)
      }
    }
    
    return data
  }

  const getChartDateLabel = () => {
    const now = new Date()
    
    if (chartView === 'week') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay() + (chartOffset * 7))
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      
      if (chartOffset === 0) return 'This Week'
      if (chartOffset === -1) return 'Last Week'
      if (chartOffset === 1) return 'Next Week'
      
      return `${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1} - ${endOfWeek.getDate()}/${endOfWeek.getMonth() + 1}`
    } else if (chartView === 'month') {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + chartOffset, 1)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      
      if (chartOffset === 0) return 'This Month'
      if (chartOffset === -1) return 'Last Month'
      
      return `${months[targetMonth.getMonth()]} ${targetMonth.getFullYear()}`
    } else {
      const targetYear = now.getFullYear() + chartOffset
      
      if (chartOffset === 0) return 'This Year'
      return targetYear.toString()
    }
  }

  const renderChart = () => {
    const data = getChartData()
    const labels = getChartLabels()
    const maxValue = Math.max(...data, 1)
    
    const handleMouseEnter = (e, value, label) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const hours = Math.floor(value)
      const minutes = Math.round((value - hours) * 60)
      const timeStr = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
      
      setChartTooltip({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        value: timeStr,
        label: label
      })
    }
    
    const handleMouseLeave = () => {
      setChartTooltip({ show: false, x: 0, y: 0, value: '', label: '' })
    }
    
    return (
      <div className="chart-container">
        <div className="chart-bars">
          {data.map((value, index) => (
            <div 
              key={index} 
              className="chart-bar-wrapper"
              onMouseEnter={(e) => handleMouseEnter(e, value, labels[index])}
              onMouseLeave={handleMouseLeave}
            >
              <div className="chart-bar-container">
                <div 
                  className="chart-bar" 
                  style={{ height: `${(value / maxValue) * 100}%` }}
                ></div>
              </div>
              <div className="chart-label">{labels[index]}</div>
            </div>
          ))}
        </div>
        {chartTooltip.show && (
          <div 
            className="chart-tooltip"
            style={{
              left: chartTooltip.x,
              top: chartTooltip.y
            }}
          >
            <div className="tooltip-label">{chartTooltip.label}</div>
            <div className="tooltip-value">{chartTooltip.value}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`app ${activeTheme}`}>
      <header>
        <h1>My Pomodoro</h1>
        <div className="header-actions">
          <button className="header-btn" onClick={() => setShowReport(true)}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2z"/>
            </svg>
            Report
          </button>
          <button className="header-btn" onClick={() => setShowSettings(true)}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/>
            </svg>
            Settings
          </button>
          <button className="header-btn icon-only" onClick={() => setShowDataModal(true)}>
            Z
          </button>
        </div>
      </header>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      
      {showReport && (
        <div className="settings-modal" onClick={() => setShowReport(false)}>
          <div className="report-content" onClick={(e) => e.stopPropagation()}>
            <div className="report-header">
              <div className="report-tabs">
                <button 
                  className={reportTab === 'summary' ? 'active' : ''}
                  onClick={() => setReportTab('summary')}
                >
                  Summary
                </button>
                <button 
                  className={reportTab === 'detail' ? 'active' : ''}
                  onClick={() => setReportTab('detail')}
                >
                  Detail
                </button>
              </div>
              <button className="close-icon" onClick={() => setShowReport(false)}>×</button>
            </div>

            {reportTab === 'summary' && (
              <div className="report-body">
                <h2>Activity Summary</h2>
                <div className="activity-cards">
                  <div className="activity-card">
                    <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                    </svg>
                    <div className="activity-value">{stats.hoursFocused}</div>
                    <div className="activity-label">hours focused</div>
                  </div>
                  <div className="activity-card">
                    <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>
                    </svg>
                    <div className="activity-value">{stats.daysAccessed}</div>
                    <div className="activity-label">days accessed</div>
                  </div>
                  <div className="activity-card">
                    <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8.5 5.6a.5.5 0 1 0-1 0v2.9h-3a.5.5 0 0 0 0 1H8a.5.5 0 0 0 .5-.5V5.6z"/>
                      <path d="M6.5 1A.5.5 0 0 1 7 .5h2a.5.5 0 0 1 0 1v.57c1.36.196 2.594.78 3.584 1.64a.715.715 0 0 1 .012-.013l.354-.354-.354-.353a.5.5 0 0 1 .707-.708l1.414 1.415a.5.5 0 1 1-.707.707l-.353-.354-.354.354a.512.512 0 0 1-.013.012A7 7 0 1 1 7 2.071V1.5a.5.5 0 0 1-.5-.5zM8 3a6 6 0 1 0 .001 12A6 6 0 0 0 8 3z"/>
                    </svg>
                    <div className="activity-value">{stats.dayStreak}</div>
                    <div className="activity-label">day streak</div>
                  </div>
                </div>

                <h3 className="section-title">Focus Hours</h3>
                <div className="chart-controls">
                  <div className="chart-view-toggle">
                    <button 
                      className={chartView === 'week' ? 'active' : ''}
                      onClick={() => {
                        setChartView('week')
                        setChartOffset(0)
                      }}
                    >
                      Week
                    </button>
                    <button 
                      className={chartView === 'month' ? 'active' : ''}
                      onClick={() => {
                        setChartView('month')
                        setChartOffset(0)
                      }}
                    >
                      Month
                    </button>
                    <button 
                      className={chartView === 'year' ? 'active' : ''}
                      onClick={() => {
                        setChartView('year')
                        setChartOffset(0)
                      }}
                    >
                      Year
                    </button>
                  </div>
                  <div className="chart-navigation">
                    <button onClick={() => setChartOffset(chartOffset - 1)}>&lt;</button>
                    <span>{getChartDateLabel()}</span>
                    <button onClick={() => setChartOffset(chartOffset + 1)}>&gt;</button>
                  </div>
                </div>

                {renderChart()}

                {projectData.length > 0 && (
                  <div className="project-breakdown">
                    <div className="project-header">
                      <span>PROJECT</span>
                      <span>TIME(HH:MM)</span>
                    </div>
                    {projectData.map((project, index) => (
                      <div key={index} className="project-row">
                        <span>{project.tag}</span>
                        <span>{project.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reportTab === 'detail' && (
              <div className="report-body">
                <h2>Session Details</h2>
                <p className="placeholder-text">Session history will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showDataModal && (
        <div className="settings-modal" onClick={() => setShowDataModal(false)}>
          <div className="settings-content" onClick={(e) => e.stopPropagation()}>
            <h2>Data Management</h2>
            
            <div className="setting-group">
              <h3>Export Data</h3>
              <button className="data-action-btn" onClick={handleExportData}>
                Download CSV
              </button>
              <p className="data-note">{sessions.length} sessions stored</p>
            </div>

            <div className="setting-group">
              <h3>Import Data</h3>
              <button className="data-action-btn" onClick={handleImportData}>
                Upload CSV
              </button>
              <p className="data-note">Supports Pomofocus & Goodtime formats</p>
            </div>

            <button className="close-settings" onClick={() => setShowDataModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="settings-modal" onClick={() => setShowSettings(false)}>
          <div className="settings-content" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            
            <div className="setting-group">
              <h3>Timer</h3>
              <div className="timer-settings">
                <div className="timer-input-group">
                  <label>Pomodoro</label>
                  <input 
                    type="number" 
                    value={pomodoroDuration}
                    onChange={(e) => handlePomodoroDurationChange(Number(e.target.value))}
                    min="1"
                    max="60"
                  />
                </div>
                <div className="timer-input-group">
                  <label>Short Break</label>
                  <input 
                    type="number" 
                    value={shortBreakDuration}
                    onChange={(e) => handleShortBreakDurationChange(Number(e.target.value))}
                    min="1"
                    max="60"
                  />
                </div>
                <div className="timer-input-group">
                  <label>Long Break</label>
                  <input 
                    type="number" 
                    value={longBreakDuration}
                    onChange={(e) => handleLongBreakDurationChange(Number(e.target.value))}
                    min="1"
                    max="60"
                  />
                </div>
              </div>
              
              <div className="toggle-setting">
                <label>Auto Start Breaks</label>
                <input 
                  type="checkbox"
                  checked={autoStartBreaks}
                  onChange={(e) => setAutoStartBreaks(e.target.checked)}
                />
              </div>
              
              <div className="toggle-setting">
                <label>Auto Start Pomodoros</label>
                <input 
                  type="checkbox"
                  checked={autoStartPomodoros}
                  onChange={(e) => setAutoStartPomodoros(e.target.checked)}
                />
              </div>
              
              <div className="toggle-setting">
                <label>Long Break Interval</label>
                <input 
                  type="number"
                  value={longBreakInterval}
                  onChange={(e) => setLongBreakInterval(Number(e.target.value))}
                  min="1"
                  max="10"
                />
              </div>
            </div>

            <div className="setting-group">
              <h3>Theme</h3>
              <div className="theme-options">
                <button 
                  className={theme === 'device' ? 'active' : ''}
                  onClick={() => setTheme('device')}
                >
                  Follow Device
                </button>
                <button 
                  className={theme === 'light' ? 'active' : ''}
                  onClick={() => setTheme('light')}
                >
                  Light
                </button>
                <button 
                  className={theme === 'dark' ? 'active' : ''}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </button>
              </div>
              <p className="theme-note">Timer automatically uses dark mode when running</p>
            </div>

            <button 
              className="close-settings"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="settings-modal" onClick={() => setShowTagModal(false)}>
          <div className="settings-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Session Tag</h2>
            
            <div className="setting-group">
              <h3>Current Session</h3>
              <div className="tag-bubbles">
                {savedTags.map(tag => (
                  <button
                    key={tag}
                    className={`tag-bubble ${tempTagValue === tag ? 'active' : ''}`}
                    onClick={() => setTempTagValue(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <h3>Previously Used Tags</h3>
              <div className="saved-tags-list">
                {savedTags.map(tag => (
                  <div key={tag} className="saved-tag-item">
                    {editingTag === tag ? (
                      <>
                        <input 
                          type="text"
                          defaultValue={tag}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleEditSavedTag(tag, e.target.value)
                            }
                          }}
                          autoFocus
                        />
                        <button onClick={() => setEditingTag(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="tag-name">{tag}</span>
                        <div className="tag-actions">
                          <button onClick={() => setEditingTag(tag)}>Edit</button>
                          <button onClick={() => handleDeleteTag(tag)}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="save-btn" onClick={() => {
                handleSaveCurrentTag()
                setShowTagModal(false)
              }}>
                Save
              </button>
              <button className="cancel-btn" onClick={() => setShowTagModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      <main>
        <div className="timer-section">
          <div className="mode-selector">
            <button 
              className={mode === 'pomodoro' ? 'active' : ''}
              onClick={() => switchMode('pomodoro')}
            >
              Pomodoro
            </button>
            <button 
              className={mode === 'shortBreak' ? 'active' : ''}
              onClick={() => switchMode('shortBreak')}
            >
              Short Break
            </button>
            <button 
              className={mode === 'longBreak' ? 'active' : ''}
              onClick={() => switchMode('longBreak')}
            >
              Long Break
            </button>
          </div>
          
          {mode === 'pomodoro' && (
            <div className="current-tag">
              {currentTag}
              <button className="edit-tag-btn" onClick={openTagModal}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                </svg>
              </button>
            </div>
          )}
          
          <div className="timer-display">{formatTime(timeLeft)}</div>
          
          <div className="timer-controls">
            <button onClick={handleStartPause} className="start-btn">
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button onClick={handleReset} className="reset-btn">
              Reset
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App