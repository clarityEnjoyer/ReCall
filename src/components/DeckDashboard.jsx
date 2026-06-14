import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllDecks, createDeck, deleteDeck, getDeckStats, getDeckStudyTime, getCardsByDeck } from '../lib/storage'

const DECK_COLORS = [
  { name: 'Lavender', value: '#C4B5E0' },
  { name: 'Peach', value: '#F5C6AA' },
  { name: 'Mint', value: '#A8E6CF' },
  { name: 'Sky', value: '#A0C4FF' },
  { name: 'Rose', value: '#FFB3BA' },
]

export default function DeckDashboard() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [deckStats, setDeckStats] = useState({})
  const [deckStudyTime, setDeckStudyTime] = useState({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDeck, setNewDeck] = useState({ name: '', description: '', color: DECK_COLORS[0].value })
  const [loading, setLoading] = useState(true)

  const loadDecks = useCallback(async () => {
    try {
      const allDecks = await getAllDecks()
      setDecks(allDecks)

      const statsMap = {}
      const timeMap = {}
      for (const deck of allDecks) {
        statsMap[deck.id] = await getDeckStats(deck.id)
        timeMap[deck.id] = await getDeckStudyTime(deck.id)
      }
      setDeckStats(statsMap)
      setDeckStudyTime(timeMap)
    } catch (err) {
      console.error('Failed to load decks:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDecks()
  }, [loadDecks])

  const handleCreateDeck = async () => {
    if (!newDeck.name.trim()) return
    await createDeck({
      name: newDeck.name.trim(),
      description: newDeck.description.trim(),
      color: newDeck.color,
      createdAt: new Date(),
    })
    setNewDeck({ name: '', description: '', color: DECK_COLORS[0].value })
    setShowCreateModal(false)
    loadDecks()
  }

  const handleDeleteDeck = async (e, deckId) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this deck and all its cards?')) {
      const cards = await getCardsByDeck(deckId)
      // Delete associated cards would be handled by storage layer in production
      await deleteDeck(deckId)
      loadDecks()
    }
  }

  const formatStudyTime = (minutes) => {
    if (!minutes || minutes < 1) return '0m'
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const getCompletionPercentage = (stats) => {
    if (!stats || !stats.totalCards) return 0
    return Math.round((stats.masteredCards / stats.totalCards) * 100)
  }

  if (loading) {
    return (
      <div className="stagger-children">
        <div className="page-header">
          <div className="skeleton" style={{ width: 200, height: 36, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 300, height: 20 }} />
        </div>
        <div className="deck-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Your Decks</h1>
        <p className="page-subtitle">
          {decks.length === 0
            ? 'Create your first deck to start learning!'
            : `${decks.length} deck${decks.length > 1 ? 's' : ''} — keep up the great work! 🧠`}
        </p>
      </div>

      <div className="deck-grid stagger-children">
        {decks.map(deck => {
          const stats = deckStats[deck.id] || {}
          const studyTime = deckStudyTime[deck.id] || 0
          const completion = getCompletionPercentage(stats)

          return (
            <div
              key={deck.id}
              className="deck-card surface"
              onClick={() => navigate(`/deck/${deck.id}`)}
              id={`deck-${deck.id}`}
            >
              <div className="deck-card-accent" style={{ background: `linear-gradient(90deg, ${deck.color}, ${deck.color}88)` }} />
              <div className="deck-card-header">
                <h3 className="deck-card-title">{deck.name}</h3>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={(e) => handleDeleteDeck(e, deck.id)}
                  title="Delete deck"
                  id={`delete-deck-${deck.id}`}
                >
                  🗑️
                </button>
              </div>
              {deck.description && (
                <p className="deck-card-description">{deck.description}</p>
              )}

              <div className="deck-card-stats">
                <div className="deck-stat">
                  <div className="deck-stat-value" style={{ color: 'var(--color-sky-dark)' }}>{stats.dueCards || 0}</div>
                  <div className="deck-stat-label">Due</div>
                </div>
                <div className="deck-stat">
                  <div className="deck-stat-value" style={{ color: 'var(--color-lavender-dark)' }}>{stats.newCards || 0}</div>
                  <div className="deck-stat-label">New</div>
                </div>
                <div className="deck-stat">
                  <div className="deck-stat-value">{stats.totalCards || 0}</div>
                  <div className="deck-stat-label">Total</div>
                </div>
              </div>

              <div className="deck-card-progress">
                <div className="deck-progress-label">
                  <span>Mastered: {completion}%</span>
                  <span>⏱ {formatStudyTime(studyTime)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${completion}%` }} />
                </div>
              </div>

              <div className="deck-card-footer">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={(e) => { e.stopPropagation(); navigate(`/study/${deck.id}`) }}
                  disabled={!stats.totalCards}
                  id={`study-deck-${deck.id}`}
                >
                  Study Now
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); navigate(`/deck/${deck.id}`) }}
                  id={`edit-deck-${deck.id}`}
                >
                  Edit Cards
                </button>
              </div>
            </div>
          )
        })}

        {/* Create New Deck */}
        <div
          className="create-deck-card"
          style={{ borderRadius: 'var(--radius-lg)' }}
          onClick={() => setShowCreateModal(true)}
          id="create-deck-btn"
        >
          <div className="create-deck-icon">+</div>
          <span className="create-deck-label">Create New Deck</span>
        </div>
      </div>

      {/* Create Deck Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Create New Deck</h2>

            <div className="form-group">
              <label className="label" htmlFor="deck-name">Deck Name</label>
              <input
                id="deck-name"
                className="input"
                type="text"
                placeholder="e.g., Spanish Vocabulary"
                value={newDeck.name}
                onChange={e => setNewDeck(d => ({ ...d, name: e.target.value }))}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateDeck()}
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="deck-description">Description (optional)</label>
              <textarea
                id="deck-description"
                className="input textarea"
                placeholder="What will you learn?"
                value={newDeck.description}
                onChange={e => setNewDeck(d => ({ ...d, description: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="label">Color</label>
              <div className="color-picker">
                {DECK_COLORS.map(color => (
                  <button
                    key={color.value}
                    className={`color-swatch ${newDeck.color === color.value ? 'selected' : ''}`}
                    style={{ background: color.value }}
                    onClick={() => setNewDeck(d => ({ ...d, color: color.value }))}
                    title={color.name}
                    id={`color-${color.name.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} id="cancel-create-deck">Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateDeck} id="confirm-create-deck">Create Deck</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
