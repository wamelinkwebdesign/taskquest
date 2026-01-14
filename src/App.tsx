import { useState, useEffect, useCallback } from 'react'
import './App.css'

type Category = 'work' | 'health' | 'learning' | 'home' | 'personal'

interface Todo {
  id: number
  text: string
  completed: boolean
  xpValue: number
  category: Category
}

type FilterType = 'all' | 'active' | 'completed'

interface CategoryXp {
  work: number
  health: number
  learning: number
  home: number
  personal: number
}

interface GameStats {
  xp: number
  level: number
  streak: number
  longestStreak: number
  lastCompletedDate: string | null
  totalCompleted: number
  achievements: string[]
  categoryXp: CategoryXp
}

const STORAGE_KEY = 'todos'
const STATS_KEY = 'gameStats'

const XP_PER_TODO = 25
const XP_PER_LEVEL = 100

const CATEGORIES: { id: Category; name: string; color: string }[] = [
  { id: 'work', name: 'Work', color: '#3b82f6' },
  { id: 'health', name: 'Health', color: '#22c55e' },
  { id: 'learning', name: 'Learning', color: '#a855f7' },
  { id: 'home', name: 'Home', color: '#f97316' },
  { id: 'personal', name: 'Personal', color: '#ec4899' },
]

const ACHIEVEMENTS = [
  { id: 'first_todo', requirement: 1 },
  { id: 'five_todos', requirement: 5 },
  { id: 'ten_todos', requirement: 10 },
  { id: 'twentyfive_todos', requirement: 25 },
  { id: 'fifty_todos', requirement: 50 },
  { id: 'streak_3', requirement: 3, type: 'streak' },
  { id: 'streak_7', requirement: 7, type: 'streak' },
  { id: 'level_5', requirement: 5, type: 'level' },
  { id: 'level_10', requirement: 10, type: 'level' },
]

const initialCategoryXp: CategoryXp = {
  work: 0, health: 0, learning: 0, home: 0, personal: 0,
}

const initialStats: GameStats = {
  xp: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
  totalCompleted: 0,
  achievements: [],
  categoryXp: initialCategoryXp,
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem(STATS_KEY)
    const parsed = saved ? JSON.parse(saved) : initialStats
    if (!parsed.categoryXp) parsed.categoryXp = initialCategoryXp
    return parsed
  })
  const [inputValue, setInputValue] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category>('personal')
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  }, [stats])

  const checkAchievements = useCallback((newStats: GameStats) => {
    const newAchievements: string[] = []
    ACHIEVEMENTS.forEach(achievement => {
      if (newStats.achievements.includes(achievement.id)) return
      let earned = false
      if (achievement.type === 'streak') {
        earned = newStats.streak >= achievement.requirement
      } else if (achievement.type === 'level') {
        earned = newStats.level >= achievement.requirement
      } else {
        earned = newStats.totalCompleted >= achievement.requirement
      }
      if (earned) newAchievements.push(achievement.id)
    })
    return newAchievements
  }, [])

  const addTodo = () => {
    if (inputValue.trim() === '') return
    const newTodo: Todo = {
      id: Date.now(),
      text: inputValue.trim(),
      completed: false,
      xpValue: XP_PER_TODO,
      category: selectedCategory,
    }
    setTodos([newTodo, ...todos])
    setInputValue('')
  }

  const toggleTodo = (id: number) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return
    const wasCompleted = todo.completed
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t))

    if (!wasCompleted) {
      const today = new Date().toDateString()
      const yesterdayDate = new Date()
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterday = yesterdayDate.toDateString()
      let newStreak = stats.streak
      if (stats.lastCompletedDate === yesterday) {
        newStreak = stats.streak + 1
      } else if (stats.lastCompletedDate !== today) {
        newStreak = 1
      }

      const xpEarned = XP_PER_TODO
      const newXp = stats.xp + xpEarned
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1
      const newLongestStreak = Math.max(stats.longestStreak, newStreak)
      const newCategoryXp = {
        ...stats.categoryXp,
        [todo.category]: stats.categoryXp[todo.category] + xpEarned,
      }

      const newStats: GameStats = {
        ...stats,
        xp: newXp,
        level: newLevel,
        streak: newStreak,
        longestStreak: newLongestStreak,
        lastCompletedDate: today,
        totalCompleted: stats.totalCompleted + 1,
        categoryXp: newCategoryXp,
      }

      const earnedAchievements = checkAchievements(newStats)
      if (earnedAchievements.length > 0) {
        newStats.achievements = [...newStats.achievements, ...earnedAchievements]
      }

      setStats(newStats)
    }
  }

  const deleteTodo = (id: number) => {
    const element = document.querySelector(`[data-todo-id="${id}"]`)
    if (element) {
      element.classList.add('deleting')
      setTimeout(() => setTodos(todos.filter(todo => todo.id !== id)), 200)
    } else {
      setTodos(todos.filter(todo => todo.id !== id))
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') addTodo() }

  const startEditing = (todo: Todo) => { setEditingId(todo.id); setEditText(todo.text) }

  const saveEdit = () => {
    if (editingId === null || editText.trim() === '') { setEditingId(null); setEditText(''); return }
    setTodos(todos.map(t => t.id === editingId ? { ...t, text: editText.trim() } : t))
    setEditingId(null)
    setEditText('')
  }

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit()
    else if (e.key === 'Escape') { setEditingId(null); setEditText('') }
  }

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active' && todo.completed) return false
    if (filter === 'completed' && !todo.completed) return false
    return true
  })

  const completedCount = todos.filter(t => t.completed).length
  const activeCount = todos.length - completedCount
  const xpProgress = (stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100
  const getCategoryInfo = (catId: Category) => CATEGORIES.find(c => c.id === catId)!

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>Taskquest</h1>
        <div className="stats-subtle">
          <span className="level-badge">Lvl {stats.level}</span>
          <div className="xp-progress">
            <div className="xp-fill" style={{ width: `${xpProgress}%` }} />
          </div>
          {stats.streak > 0 && <span className="streak-text">{stats.streak} day streak</span>}
        </div>
      </header>

      {/* Add Todo */}
      <div className="add-section">
        <div className="category-pills">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
              style={{ '--cat-color': cat.color } as React.CSSProperties}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div className="input-group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="What needs to be done?"
            className="todo-input"
          />
          <button onClick={addTodo} className="add-button" disabled={!inputValue.trim()}>
            Add
          </button>
        </div>
      </div>

      {/* Filters */}
      {todos.length > 0 && (
        <div className="filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span className="count">{todos.length}</span>
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active <span className="count">{activeCount}</span>
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Done <span className="count">{completedCount}</span>
          </button>
        </div>
      )}

      {/* Todo List */}
      <ul className="todo-list">
        {filteredTodos.map(todo => {
          const catInfo = getCategoryInfo(todo.category)
          const isEditing = editingId === todo.id
          return (
            <li
              key={todo.id}
              className={`todo-item ${todo.completed ? 'completed' : ''}`}
              data-todo-id={todo.id}
            >
              <button
                className={`checkbox ${todo.completed ? 'checked' : ''}`}
                onClick={() => toggleTodo(todo.id)}
                aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
              >
                <svg viewBox="0 0 24 24" className="check-icon">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <span
                className="category-dot"
                style={{ background: catInfo.color }}
                title={catInfo.name}
              />
              {isEditing ? (
                <input
                  type="text"
                  className="edit-input"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleEditKeyPress}
                  onBlur={saveEdit}
                  autoFocus
                />
              ) : (
                <span
                  className="todo-text"
                  onDoubleClick={() => !todo.completed && startEditing(todo)}
                >
                  {todo.text}
                </span>
              )}
              <button
                onClick={() => deleteTodo(todo.id)}
                className="delete-btn"
                aria-label="Delete todo"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Empty States */}
      {todos.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">No tasks yet</p>
          <p className="empty-sub">Add your first task above to get started</p>
        </div>
      )}

      {todos.length > 0 && filteredTodos.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">No {filter} tasks</p>
        </div>
      )}
    </div>
  )
}

export default App
