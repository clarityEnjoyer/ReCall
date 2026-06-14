import { useState, useEffect } from 'react'
import { getAllDecks, getDeckStats, getDeckStudyTime, getStudyStreak, getReviewLogs } from '../lib/storage'

export default function StatsPage() {
  const [stats, setStats] = useState({
    totalDecks: 0,
    totalCards: 0,
    totalReviews: 0,
    masteredCards: 0,
    studyStreak: 0,
    totalStudyTimeMinutes: 0,
    averageAccuracy: 0,
  })
  const [deckBreakdown, setDeckBreakdown] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const decks = await getAllDecks()
      let totalCards = 0
      let totalReviews = 0
      let masteredCards = 0
      let totalStudyTime = 0
      let totalRetention = 0
      let retentionCount = 0
      const breakdown = []

      for (const deck of decks) {
        const dStats = await getDeckStats(deck.id)
        const studyTime = await getDeckStudyTime(deck.id)

        totalCards += dStats.totalCards
        totalReviews += dStats.totalReviews
        masteredCards += dStats.masteredCards
        totalStudyTime += studyTime

        if (dStats.averageRetention > 0) {
          totalRetention += dStats.averageRetention
          retentionCount++
        }

        breakdown.push({
          ...deck,
          stats: dStats,
          studyTime,
          completion: dStats.totalCards > 0
            ? Math.round((dStats.masteredCards / dStats.totalCards) * 100)
            : 0,
        })
      }

      const streak = await getStudyStreak()

      setStats({
        totalDecks: decks.length,
        totalCards,
        totalReviews,
        masteredCards,
        studyStreak: streak,
        totalStudyTimeMinutes: totalStudyTime,
        averageAccuracy: retentionCount > 0
          ? Math.round(totalRetention / retentionCount)
          : 0,
      })
      setDeckBreakdown(breakdown)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes) => {
    if (!minutes || minutes < 1) return '0m'
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const formatDays = (streak) => {
    if (streak === 0) return '0 days'
    if (streak === 1) return '1 day'
    return `${streak} days`
  }

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ width: 200, height: 36, marginBottom: 24 }} />
        <div className="stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Statistics</h1>
        <p className="page-subtitle">Track your learning journey and progress</p>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid stagger-children">
        <div className="stat-card surface">
          <div className="stat-card-icon">🔥</div>
          <div className="stat-card-value">{stats.studyStreak}</div>
          <div className="stat-card-label">Day Streak</div>
        </div>
        <div className="stat-card surface">
          <div className="stat-card-icon">🃏</div>
          <div className="stat-card-value">{stats.totalCards}</div>
          <div className="stat-card-label">Total Cards</div>
        </div>
        <div className="stat-card surface">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-value">{stats.totalReviews}</div>
          <div className="stat-card-label">Reviews Done</div>
        </div>
        <div className="stat-card surface">
          <div className="stat-card-icon">🧠</div>
          <div className="stat-card-value">{stats.masteredCards}</div>
          <div className="stat-card-label">Mastered</div>
        </div>
        <div className="stat-card surface">
          <div className="stat-card-icon">⏱️</div>
          <div className="stat-card-value">{formatTime(stats.totalStudyTimeMinutes)}</div>
          <div className="stat-card-label">Total Study Time</div>
        </div>
        <div className="stat-card surface">
          <div className="stat-card-icon">🎯</div>
          <div className="stat-card-value">{stats.averageAccuracy || 0}%</div>
          <div className="stat-card-label">Avg. Retention</div>
        </div>
      </div>

      {/* Per-Deck Breakdown */}
      <div style={{ marginTop: 'var(--space-2xl)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
          Deck Breakdown
        </h2>

        {deckBreakdown.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>No data yet</h3>
            <p>Create a deck and start studying to see your statistics here.</p>
          </div>
        ) : (
          <div className="card-list stagger-children">
            {deckBreakdown.map(deck => (
              <div key={deck.id} className="surface" style={{ padding: 'var(--space-lg)' }} id={`stats-deck-${deck.id}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: deck.color }} />
                    <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>{deck.name}</h3>
                  </div>
                  <span className="badge badge-lavender">{deck.completion}% mastered</span>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-xl)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Cards</div>
                    <div style={{ fontWeight: 700 }}>{deck.stats.totalCards}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Due</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-sky-dark)' }}>{deck.stats.dueCards}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Mastered</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-mint-dark)' }}>{deck.stats.masteredCards}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Reviews</div>
                    <div style={{ fontWeight: 700 }}>{deck.stats.totalReviews}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Study Time</div>
                    <div style={{ fontWeight: 700 }}>{formatTime(deck.studyTime)}</div>
                  </div>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${deck.completion}%`,
                      background: `linear-gradient(90deg, ${deck.color}, var(--color-mint))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
