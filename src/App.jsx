import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
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
  const [isLoading, setIsLoading] = useState(true)
  
  const intervalRef = useRef(null)
  const fileInputRef = useRef(null)

  // Load sessions from Supabase on mount
  useEffect(() => {
    loadSessions()
    loadSettings()
  }, [])

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      setSessions(data || [])
      
      // Extract unique tags
      const tags = new Set(['#study', '#coding', '#writing'])
      data?.forEach(session => tags.add(session.tag))
      setSavedTags(Array.from(tags))
      
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading sessions:', error)
      setIsLoading(false)
    }
  }

  const loadSettings = () => {
    const stored = localStorage.getItem('pomodoroSettings')
    if (stored) {
      const settings = JSON.parse(stored)
      setPomodoroDuration(settings.pomodoroDuration || 25)
      setShortBreakDuration(settings.shortBreakDuration || 5)
      setLongBreakDuration(settings.longBreakDuration || 15)
      setAutoStartBreaks(settings.autoStartBreaks || false)
      setAutoStartPomodoros(settings.autoStartPomodoros || false)
      setLongBreakInterval(settings.longBreakInterval || 4)
      setTheme(settings.theme || 'device')
      setCurrentTag(settings.currentTag || '#study')
      setSavedTags(settings.savedTags || ['#study', '#coding', '#writing'])
    }
    
    const lastReminder = localStorage.getItem('lastBackupReminder')
    if (lastReminder) {
      setLastBackupReminder(new Date(lastReminder))
    }
  }

  const saveSettings = () => {
    const settings = {
      pomodoroDuration,
      shortBreakDuration,
      longBreakDuration,
      autoStartBreaks,
      autoStartPomodoros,
      longBreakInterval,
      theme,
      currentTag,
      savedTags
    }
    localStorage.setItem('pomodoroSettings', JSON.stringify(settings))
  }

  useEffect(() => {
    saveSettings()
  }, [pomodoroDuration, shortBreakDuration, longBreakDuration, autoStartBreaks, autoStartPomodoros, longBreakInterval, theme, currentTag, savedTags])

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

  const handleTimerComplete = async () => {
    if (mode === 'pomodoro') {
      const now = new Date()
      const newSession = {
        timestamp: formatDateTime(now),
        date: formatDate(now),
        duration: pomodoroDuration,
        tag: currentTag,
        type: 'pomodoro'
      }
      
      // Save to Supabase
      try {
        const { data, error } = await supabase
          .from('sessions')
          .insert([newSession])
          .select()
        
        if (error) throw error
        
        if (data && data[0]) {
          setSessions(prev => [data[0], ...prev])
        }
      } catch (error) {
        console.error('Error saving session:', error)
        alert('Failed to save session. Please check your connection.')
      }
      
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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (e) => {
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
      
      // Merge by date+tag
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
      
      // Convert to session format and upload to Supabase
      const newSessions = Object.values(merged).map(item => ({
        timestamp: `${item.date} 00:00`,
        date: item.date,
        duration: item.minutes,
        tag: item.tag,
        type: 'pomodoro'
      }))
      
      try {
        // Delete existing sessions
        const { error: deleteError } = await supabase
          .from('sessions')
          .delete()
          .neq('id', 0) // Delete all
        
        if (deleteError) throw deleteError
        
        // Insert new sessions
        const { data, error } = await supabase
          .from('sessions')
          .insert(newSessions)
          .select()
        
        if (error) throw error
        
        // Extract unique tags
        const allTags = new Set(savedTags)
        newSessions.forEach(session => allTags.add(session.tag))
        setSavedTags(Array.from(allTags))
        
        await loadSessions()
        alert(`Imported ${parsedSessions.length} sessions!`)
      } catch (error) {
        console.error('Error importing sessions:', error)
        alert('Failed to import sessions. Please try again.')
      }
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

  if (isLoading) {
    return (
      <div className={`app ${activeTheme}`}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Loading...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className={`app ${activeTheme}`}>
      {/* Rest of JSX stays exactly the same - just the data handling changed above */}
      {/* I'll continue in next message with the full JSX... */}