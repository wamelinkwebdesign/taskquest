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

interface FloatingXp {
  id: number
  value: number
  x: number
  y: number
}

type FilterType = 'all' | 'active' | 'completed'
type SortType = 'newest' | 'oldest' | 'category'

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
const XP_PER_TIER = 75

const CATEGORIES: { id: Category; name: string; icon: string; color: string }[] = [
  { id: 'work', name: 'Work', icon: '💼', color: '#3b82f6' },
  { id: 'health', name: 'Health', icon: '💪', color: '#22c55e' },
  { id: 'learning', name: 'Learning', icon: '📚', color: '#a855f7' },
  { id: 'home', name: 'Home', icon: '🏠', color: '#f97316' },
  { id: 'personal', name: 'Personal', icon: '⭐', color: '#ec4899' },
]

const TIER_NAMES = ['Novice', 'Apprentice', 'Adept', 'Expert', 'Master']
const TIER_PERKS = [
  'Started your journey',
  '+5% bonus XP',
  '+10% bonus XP',
  '+15% bonus XP',
  '+25% bonus XP + Badge',
]

const ACHIEVEMENTS = [
  { id: 'first_todo', name: 'First Steps', description: 'Complete your first todo', icon: '🌟', requirement: 1 },
  { id: 'five_todos', name: 'Getting Started', description: 'Complete 5 todos', icon: '🔥', requirement: 5 },
  { id: 'ten_todos', name: 'On a Roll', description: 'Complete 10 todos', icon: '⚡', requirement: 10 },
  { id: 'twentyfive_todos', name: 'Productivity Pro', description: 'Complete 25 todos', icon: '💎', requirement: 25 },
  { id: 'fifty_todos', name: 'Task Master', description: 'Complete 50 todos', icon: '👑', requirement: 50 },
  { id: 'streak_3', name: 'Consistent', description: '3 day streak', icon: '🎯', requirement: 3, type: 'streak' },
  { id: 'streak_7', name: 'Week Warrior', description: '7 day streak', icon: '🏆', requirement: 7, type: 'streak' },
  { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐', requirement: 5, type: 'level' },
  { id: 'level_10', name: 'Legend', description: 'Reach level 10', icon: '🌈', requirement: 10, type: 'level' },
  { id: 'work_master', name: 'Work Master', description: 'Reach Tier 5 in Work', icon: '💼', requirement: 5, type: 'category', category: 'work' },
  { id: 'health_master', name: 'Health Master', description: 'Reach Tier 5 in Health', icon: '💪', requirement: 5, type: 'category', category: 'health' },
  { id: 'learning_master', name: 'Learning Master', description: 'Reach Tier 5 in Learning', icon: '📚', requirement: 5, type: 'category', category: 'learning' },
  { id: 'home_master', name: 'Home Master', description: 'Reach Tier 5 in Home', icon: '🏠', requirement: 5, type: 'category', category: 'home' },
  { id: 'personal_master', name: 'Personal Master', description: 'Reach Tier 5 in Personal', icon: '⭐', requirement: 5, type: 'category', category: 'personal' },
]

const initialCategoryXp: CategoryXp = {
  work: 0,
  health: 0,
  learning: 0,
  home: 0,
  personal: 0,
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

// XP multiplier based on streak
const getStreakMultiplier = (streak: number): number => {
  if (streak >= 7) return 1.5
  if (streak >= 3) return 1.25
  return 1
}

// Get tier from XP
const getTier = (xp: number): number => {
  return Math.min(Math.floor(xp / XP_PER_TIER) + 1, 5)
}

// Get category bonus multiplier based on tier
const getCategoryBonus = (tier: number): number => {
  const bonuses = [1, 1.05, 1.1, 1.15, 1.25]
  return bonuses[Math.min(tier - 1, 4)]
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem(STATS_KEY)
    const parsed = saved ? JSON.parse(saved) : initialStats
    // Ensure categoryXp exists for older saves
    if (!parsed.categoryXp) {
      parsed.categoryXp = initialCategoryXp
    }
    return parsed
  })
  const [inputValue, setInputValue] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category>('personal')
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [newAchievement, setNewAchievement] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showSkillTree, setShowSkillTree] = useState(false)
  const [floatingXps, setFloatingXps] = useState<FloatingXp[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('newest')
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all')

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
      } else if (achievement.type === 'category' && 'category' in achievement) {
        const catXp = newStats.categoryXp[achievement.category as Category]
        const tier = getTier(catXp)
        earned = tier >= achievement.requirement
      } else {
        earned = newStats.totalCompleted >= achievement.requirement
      }

      if (earned) {
        newAchievements.push(achievement.id)
      }
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

    setTodos([...todos, newTodo])
    setInputValue('')
  }

  const toggleTodo = (id: number) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    const wasCompleted = todo.completed

    setTodos(todos.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ))

    if (!wasCompleted) {
      const today = new Date().toDateString()
      const yesterday = new Date(Date.now() - 86400000).toDateString()

      let newStreak = stats.streak
      if (stats.lastCompletedDate === yesterday) {
        newStreak = stats.streak + 1
      } else if (stats.lastCompletedDate !== today) {
        newStreak = 1
      }

      // Get category tier bonus
      const categoryTier = getTier(stats.categoryXp[todo.category])
      const categoryBonus = getCategoryBonus(categoryTier)

      // Apply streak multiplier and category bonus to XP
      const streakMult = getStreakMultiplier(newStreak)
      const xpEarned = Math.floor(XP_PER_TODO * streakMult * categoryBonus)
      const newXp = stats.xp + xpEarned
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1
      const leveledUp = newLevel > stats.level

      // Update longest streak if current streak is higher
      const newLongestStreak = Math.max(stats.longestStreak, newStreak)

      // Update category XP
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
        setNewAchievement(earnedAchievements[0])
        setShowConfetti(true)
        setTimeout(() => {
          setNewAchievement(null)
          setShowConfetti(false)
        }, 3000)
      }

      setStats(newStats)

      if (leveledUp) {
        setShowLevelUp(true)
        setShowConfetti(true)
        setTimeout(() => {
          setShowLevelUp(false)
          setShowConfetti(false)
        }, 2500)
      }

      // Spawn floating XP animation
      const floatingXp: FloatingXp = {
        id: Date.now(),
        value: xpEarned,
        x: Math.random() * 40 + 30, // Random position 30-70%
        y: 50,
      }
      setFloatingXps(prev => [...prev, floatingXp])
      setTimeout(() => {
        setFloatingXps(prev => prev.filter(f => f.id !== floatingXp.id))
      }, 1500)
    }
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTodo()
    }
  }

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  const saveEdit = () => {
    if (editingId === null) return
    if (editText.trim() === '') {
      cancelEdit()
      return
    }
    setTodos(todos.map(t =>
      t.id === editingId ? { ...t, text: editText.trim() } : t
    ))
    setEditingId(null)
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  // Filter and sort todos
  const filteredTodos = todos
    .filter(todo => {
      if (filter === 'active' && todo.completed) return false
      if (filter === 'completed' && !todo.completed) return false
      if (categoryFilter !== 'all' && todo.category !== categoryFilter) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'newest') return b.id - a.id
      if (sort === 'oldest') return a.id - b.id
      if (sort === 'category') {
        const catOrder = CATEGORIES.findIndex(c => c.id === a.category) - CATEGORIES.findIndex(c => c.id === b.category)
        return catOrder !== 0 ? catOrder : b.id - a.id
      }
      return 0
    })

  const completedCount = todos.filter(t => t.completed).length
  const totalCount = todos.length
  const xpProgress = (stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100
  const xpToNextLevel = XP_PER_LEVEL - (stats.xp % XP_PER_LEVEL)
  const streakMultiplier = getStreakMultiplier(stats.streak)
  const hasActiveStreak = stats.streak >= 1

  const earnedAchievementObjects = ACHIEVEMENTS.filter(a => stats.achievements.includes(a.id))

  const getCategoryInfo = (catId: Category) => CATEGORIES.find(c => c.id === catId)!

  return (
    <div className="app-container">
      {showConfetti && <div className="confetti" />}

      {/* Floating XP animations */}
      {floatingXps.map(xp => (
        <div
          key={xp.id}
          className="floating-xp"
          style={{ left: `${xp.x}%`, top: `${xp.y}%` }}
          aria-hidden="true"
        >
          +{xp.value} XP
        </div>
      ))}

      {showLevelUp && (
        <div className="level-up-overlay">
          <div className="level-up-modal">
            <div className="level-up-icon">🎉</div>
            <h2>Level Up!</h2>
            <p>You reached <span>Level {stats.level}</span></p>
          </div>
        </div>
      )}

      {newAchievement && (
        <div className="achievement-toast">
          <div className="achievement-icon">
            {ACHIEVEMENTS.find(a => a.id === newAchievement)?.icon}
          </div>
          <div className="achievement-info">
            <span className="achievement-label">Achievement Unlocked!</span>
            <span className="achievement-name">
              {ACHIEVEMENTS.find(a => a.id === newAchievement)?.name}
            </span>
          </div>
        </div>
      )}

      {showSkillTree && (
        <div className="skill-tree-overlay" onClick={() => setShowSkillTree(false)}>
          <div className="skill-tree-modal" onClick={e => e.stopPropagation()}>
            <button className="close-skill-tree" onClick={() => setShowSkillTree(false)}>×</button>
            <h2>Skill Tree</h2>
            <p className="skill-tree-subtitle">Specialize in categories to unlock bonus XP</p>

            <div className="skill-trees">
              {CATEGORIES.map(category => {
                const xp = stats.categoryXp[category.id]
                const tier = getTier(xp)
                const tierProgress = ((xp % XP_PER_TIER) / XP_PER_TIER) * 100
                const bonus = getCategoryBonus(tier)

                return (
                  <div key={category.id} className="skill-tree-category">
                    <div className="skill-category-header">
                      <span className="skill-category-icon" style={{ background: category.color }}>
                        {category.icon}
                      </span>
                      <div className="skill-category-info">
                        <span className="skill-category-name">{category.name}</span>
                        <span className="skill-category-tier">{TIER_NAMES[tier - 1]}</span>
                      </div>
                      {bonus > 1 && (
                        <span className="skill-bonus" style={{ background: category.color }}>
                          +{Math.round((bonus - 1) * 100)}% XP
                        </span>
                      )}
                    </div>

                    <div className="tier-track">
                      {[1, 2, 3, 4, 5].map(t => (
                        <div
                          key={t}
                          className={`tier-node ${tier >= t ? 'unlocked' : ''} ${tier === t ? 'current' : ''}`}
                          style={{ '--tier-color': category.color } as React.CSSProperties}
                          title={`Tier ${t}: ${TIER_NAMES[t - 1]} - ${TIER_PERKS[t - 1]}`}
                        >
                          <span className="tier-number">{t}</span>
                        </div>
                      ))}
                      <div className="tier-track-line">
                        <div
                          className="tier-track-fill"
                          style={{
                            width: `${Math.min(((tier - 1) * 25) + (tierProgress * 0.25), 100)}%`,
                            background: category.color
                          }}
                        />
                      </div>
                    </div>

                    <div className="skill-xp-info">
                      <span>{xp} XP</span>
                      {tier < 5 && <span>{XP_PER_TIER - (xp % XP_PER_TIER)} XP to next tier</span>}
                      {tier === 5 && <span className="maxed">MAXED</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="app">
        <header className="header">
          <h1>Taskquest</h1>
          <p className="subtitle">Level up your productivity</p>
        </header>

        <div className="stats-panel" role="region" aria-label="Player statistics">
          <div className="stat-card level-card" role="group" aria-label="Current level">
            <div className="stat-icon" aria-hidden="true">⚔️</div>
            <div className="stat-content">
              <span className="stat-label">Level</span>
              <span className="stat-value">{stats.level}</span>
            </div>
          </div>

          <div className="stat-card xp-card" role="group" aria-label="Experience progress">
            <div className="stat-content full-width">
              <div className="xp-header">
                <span className="stat-label">XP Progress</span>
                <span className="xp-text">{stats.xp % XP_PER_LEVEL} / {XP_PER_LEVEL}</span>
              </div>
              <div
                className="xp-bar"
                role="progressbar"
                aria-valuenow={stats.xp % XP_PER_LEVEL}
                aria-valuemin={0}
                aria-valuemax={XP_PER_LEVEL}
                aria-label={`${stats.xp % XP_PER_LEVEL} of ${XP_PER_LEVEL} XP to next level`}
              >
                <div className="xp-fill" style={{ width: `${xpProgress}%` }} />
              </div>
              <span className="xp-hint">{xpToNextLevel} XP to next level</span>
            </div>
          </div>

          <div className={`stat-card streak-card ${hasActiveStreak ? 'active-streak' : ''}`}>
            <div className={`stat-icon flame-icon ${hasActiveStreak ? 'burning' : ''}`}>🔥</div>
            <div className="stat-content">
              <span className="stat-label">
                Streak {streakMultiplier > 1 && <span className="multiplier-badge">{streakMultiplier}x XP</span>}
              </span>
              <span className="stat-value">{stats.streak} <small>days</small></span>
              {stats.longestStreak > 0 && (
                <span className="longest-streak">Best: {stats.longestStreak} days</span>
              )}
            </div>
          </div>

          <div className="stat-card completed-card">
            <div className="stat-icon">✨</div>
            <div className="stat-content">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{stats.totalCompleted}</span>
            </div>
          </div>
        </div>

        {/* Skill Tree Button */}
        <button
          className="skill-tree-button"
          onClick={() => setShowSkillTree(true)}
          aria-label="View Skill Tree - Track your category progress"
        >
          <span className="skill-tree-icon" aria-hidden="true">🌳</span>
          <span>View Skill Tree</span>
          <div className="category-previews" aria-hidden="true">
            {CATEGORIES.map(cat => (
              <span
                key={cat.id}
                className="category-preview"
                style={{ background: cat.color }}
                title={`${cat.name}: Tier ${getTier(stats.categoryXp[cat.id])}`}
              >
                {cat.icon}
              </span>
            ))}
          </div>
        </button>

        {earnedAchievementObjects.length > 0 && (
          <div className="achievements-section">
            <h3>Achievements</h3>
            <div className="achievements-grid">
              {earnedAchievementObjects.map(achievement => (
                <div key={achievement.id} className="achievement-badge" title={achievement.description}>
                  <span className="badge-icon">{achievement.icon}</span>
                  <span className="badge-name">{achievement.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="input-section">
          <div className="category-selector" role="radiogroup" aria-label="Quest category">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                className={`category-button ${selectedCategory === category.id ? 'selected' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
                style={{ '--cat-color': category.color } as React.CSSProperties}
                title={category.name}
                role="radio"
                aria-checked={selectedCategory === category.id}
                aria-label={`${category.name} category`}
              >
                <span aria-hidden="true">{category.icon}</span>
              </button>
            ))}
          </div>
          <div className="input-container">
            <label htmlFor="todo-input" className="visually-hidden">
              Add a new {getCategoryInfo(selectedCategory).name.toLowerCase()} quest
            </label>
            <input
              id="todo-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Add a ${getCategoryInfo(selectedCategory).name.toLowerCase()} quest...`}
              className="todo-input"
              style={{ '--input-accent': getCategoryInfo(selectedCategory).color } as React.CSSProperties}
              aria-describedby="xp-reward-hint"
            />
            <button
              onClick={addTodo}
              className="add-button"
              style={{ background: getCategoryInfo(selectedCategory).color }}
              aria-label="Add quest"
            >
              <span className="button-icon" aria-hidden="true">+</span>
              <span className="button-text">Add Quest</span>
            </button>
          </div>
          <p className="xp-reward" id="xp-reward-hint">
            +{Math.floor(XP_PER_TODO * streakMultiplier * getCategoryBonus(getTier(stats.categoryXp[selectedCategory])))} XP per completed quest
            {streakMultiplier > 1 && <span className="bonus-text"> (streak bonus!)</span>}
            {getCategoryBonus(getTier(stats.categoryXp[selectedCategory])) > 1 && (
              <span className="bonus-text"> (+{Math.round((getCategoryBonus(getTier(stats.categoryXp[selectedCategory])) - 1) * 100)}% {getCategoryInfo(selectedCategory).name})</span>
            )}
          </p>
        </div>

        {totalCount > 0 && (
          <div className="progress-section">
            <div className="progress-header">
              <span>Quest Progress</span>
              <span>{completedCount} / {totalCount}</span>
            </div>
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-label={`${completedCount} of ${totalCount} quests completed`}
            >
              <div
                className="progress-fill"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Filter and Sort Controls */}
        {totalCount > 0 && (
          <div className="filter-sort-section" role="group" aria-label="Filter and sort options">
            <div className="filter-group">
              <span className="filter-label">Filter:</span>
              <div className="filter-buttons" role="radiogroup" aria-label="Status filter">
                {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                  <button
                    key={f}
                    className={`filter-button ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                    role="radio"
                    aria-checked={filter === f}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Category:</span>
              <div className="category-filter-buttons" role="radiogroup" aria-label="Category filter">
                <button
                  className={`category-filter-btn ${categoryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('all')}
                  role="radio"
                  aria-checked={categoryFilter === 'all'}
                  aria-label="All categories"
                >
                  All
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    className={`category-filter-btn ${categoryFilter === cat.id ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat.id)}
                    style={{ '--cat-color': cat.color } as React.CSSProperties}
                    role="radio"
                    aria-checked={categoryFilter === cat.id}
                    aria-label={cat.name}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Sort:</span>
              <select
                className="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortType)}
                aria-label="Sort order"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="category">By Category</option>
              </select>
            </div>
          </div>
        )}

        <ul className="todo-list" role="list" aria-label="Quest list">
          {filteredTodos.map(todo => {
            const catInfo = getCategoryInfo(todo.category)
            const isEditing = editingId === todo.id
            return (
              <li
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}`}
                role="listitem"
              >
                <button
                  className={`check-button ${todo.completed ? 'checked' : ''}`}
                  onClick={() => toggleTodo(todo.id)}
                  style={{ '--check-color': catInfo.color } as React.CSSProperties}
                  aria-label={todo.completed ? `Mark "${todo.text}" as incomplete` : `Mark "${todo.text}" as complete`}
                  aria-pressed={todo.completed}
                >
                  {todo.completed && <span className="check-icon" aria-hidden="true">✓</span>}
                </button>
                <span
                  className="todo-category-icon"
                  style={{ background: catInfo.color }}
                  aria-label={catInfo.name}
                  title={catInfo.name}
                >
                  {catInfo.icon}
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    className="edit-input"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={handleEditKeyPress}
                    onBlur={saveEdit}
                    autoFocus
                    aria-label="Edit quest text"
                  />
                ) : (
                  <span
                    className="todo-text"
                    onDoubleClick={() => !todo.completed && startEditing(todo)}
                    title={todo.completed ? undefined : "Double-click to edit"}
                  >
                    {todo.text}
                  </span>
                )}
                <span className="todo-xp" aria-label={`${todo.xpValue} experience points`}>+{todo.xpValue} XP</span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="delete-button"
                  aria-label={`Delete "${todo.text}"`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            )
          })}
        </ul>

        {todos.length === 0 && (
          <div className="empty-state" role="status">
            <div className="empty-icon" aria-hidden="true">🗡️</div>
            <p className="empty-title">No quests yet</p>
            <p className="empty-subtitle">Choose a category and add your first quest!</p>
          </div>
        )}

        {todos.length > 0 && filteredTodos.length === 0 && (
          <div className="empty-state" role="status">
            <div className="empty-icon" aria-hidden="true">🔍</div>
            <p className="empty-title">No matching quests</p>
            <p className="empty-subtitle">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
