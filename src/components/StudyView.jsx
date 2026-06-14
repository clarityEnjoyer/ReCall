import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDeck, getDueCards, getNewCards, updateCard, logReview, startSession, endSession, getCardsByDeck } from '../lib/storage'
import { repeat, getRetrievability, Rating, State } from '../lib/fsrs'

export default function StudyView() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [noDueCardsPrompt, setNoDueCardsPrompt] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 })
  const [loading, setLoading] = useState(true)
  const startTimeRef = useRef(Date.now())

  const loadStudyData = useCallback(async () => {
    try {
      const d = await getDeck(Number(deckId))
      if (!d) { navigate('/'); return }
      setDeck(d)

      const now = new Date()
      const dueCards = await getDueCards(Number(deckId), now)
      const newCards = await getNewCards(Number(deckId))

      // Combine due and new cards, prioritize due ones
      const combined = [...dueCards]
      for (const card of newCards) {
        if (!combined.find(c => c.id === card.id)) {
          combined.push(card)
        }
      }

      if (combined.length === 0) {
        const allCards = await getCardsByDeck(Number(deckId))
        if (allCards.length > 0) {
          setNoDueCardsPrompt(true)
        } else {
          setCompleted(true)
        }
      } else {
        setCards(combined)
        const sid = await startSession(Number(deckId))
        setSessionId(sid)
      }
    } catch (err) {
      console.error('Failed to load study data:', err)
    } finally {
      setLoading(false)
    }
  }, [deckId, navigate])

  useEffect(() => {
    loadStudyData()
  }, [loadStudyData])

  const handleStudyAllAnyway = async () => {
    setLoading(true)
    const allCards = await getCardsByDeck(Number(deckId))
    setCards(allCards)
    setNoDueCardsPrompt(false)
    const sid = await startSession(Number(deckId))
    setSessionId(sid)
    setLoading(false)
  }

  const currentCard = cards[currentIndex]

  const handleFlip = () => {
    if (!flipped) setFlipped(true)
  }

  const handleRate = async (rating) => {
    if (!currentCard) return

    const now = new Date()
    const cardState = {
      state: currentCard.state,
      difficulty: currentCard.difficulty,
      stability: currentCard.stability,
      reps: currentCard.reps,
      lapses: currentCard.lapses,
      lastReview: currentCard.lastReview,
      elapsedDays: currentCard.lastReview
        ? (now - new Date(currentCard.lastReview)) / (1000 * 60 * 60 * 24)
        : 0,
    }

    const result = repeat(cardState, rating, now)

    // Update card in database
    await updateCard(currentCard.id, {
      state: result.state,
      difficulty: result.difficulty,
      stability: result.stability,
      retrievability: getRetrievability(
        { stability: result.stability, lastReview: now },
        now
      ),
      lastReview: now,
      nextReview: result.nextReview,
      reps: result.reps,
      lapses: result.lapses,
      updatedAt: now,
    })

    // Log review
    await logReview({
      cardId: currentCard.id,
      deckId: Number(deckId),
      rating,
      state: result.state,
      reviewedAt: now,
      elapsedDays: cardState.elapsedDays,
      scheduledDays: result.interval,
    })

    // Update session stats
    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (rating >= Rating.Good ? 1 : 0),
    }))

    // Check if the card is a lapse that requires an intra-session repetition
    const updatedCard = {
      ...currentCard,
      state: result.state,
      difficulty: result.difficulty,
      stability: result.stability,
      reps: result.reps,
      lapses: result.lapses,
      lastReview: now,
      isLapseRepetition: result.isLapseRepetition,
    }

    const shouldReviewAgain = !!result.isLapseRepetition

    if (shouldReviewAgain) {
      setCards(prev => [...prev, updatedCard])
    }

    const nextCardsLength = cards.length + (shouldReviewAgain ? 1 : 0)

    // Move to next card, wait for flip animation to hide the answer before updating content
    setFlipped(false)
    setTimeout(async () => {
      if (currentIndex + 1 < nextCardsLength) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // Session complete
        if (sessionId) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000 / 60 // minutes
          await endSession(sessionId, {
            cardsReviewed: sessionStats.reviewed + 1,
            correctCount: sessionStats.correct + (rating >= Rating.Good ? 1 : 0),
            endedAt: now,
            duration: elapsed,
          })
        }
        setCompleted(true)
      }
    }, 200)
  }

  const handleNextLapse = () => {
    setFlipped(false)
    setTimeout(async () => {
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // Session complete
        if (sessionId) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000 / 60 // minutes
          await endSession(sessionId, {
            cardsReviewed: sessionStats.reviewed,
            correctCount: sessionStats.correct,
            endedAt: new Date(),
            duration: elapsed,
          })
        }
        setCompleted(true)
      }
    }, 200)
  }

  const formatInterval = (days) => {
    if (days < 1) {
      const minutes = Math.round(days * 24 * 60)
      if (minutes < 60) return `${minutes}m`
      return `${Math.round(days * 24)}h`
    }
    if (days < 30) return `${Math.round(days)}d`
    if (days < 365) return `${Math.round(days / 30)}mo`
    return `${(days / 365).toFixed(1)}y`
  }

  const getPreviewIntervals = () => {
    if (!currentCard) return {}
    const now = new Date()
    const cardState = {
      state: currentCard.state,
      difficulty: currentCard.difficulty,
      stability: currentCard.stability,
      reps: currentCard.reps,
      lapses: currentCard.lapses,
      lastReview: currentCard.lastReview,
      elapsedDays: currentCard.lastReview
        ? (now - new Date(currentCard.lastReview)) / (1000 * 60 * 60 * 24)
        : 0,
    }

    return {
      [Rating.Again]: formatInterval(repeat(cardState, Rating.Again, now).interval),
      [Rating.Hard]: formatInterval(repeat(cardState, Rating.Hard, now).interval),
      [Rating.Good]: formatInterval(repeat(cardState, Rating.Good, now).interval),
      [Rating.Easy]: formatInterval(repeat(cardState, Rating.Easy, now).interval),
    }
  }

  if (loading) {
    return (
      <div className="study-container">
        <div className="study-header">
          <div className="skeleton" style={{ width: 120, height: 32 }} />
        </div>
        <div className="study-body">
          <div className="skeleton" style={{ width: '100%', maxWidth: 600, height: 350, borderRadius: 'var(--radius-xl)' }} />
        </div>
      </div>
    )
  }

  if (noDueCardsPrompt) {
    return (
      <div className="study-container">
        <div className="study-header">
          <div className="study-header-left">
            <button className="back-btn" onClick={() => navigate('/')} id="back-from-study">←</button>
            <span style={{ fontWeight: 600 }}>{deck?.name}</span>
          </div>
        </div>
        <div className="study-body">
          <div className="study-complete surface">
            <div className="study-complete-icon">✨</div>
            <h2>You've caught up!</h2>
            <p style={{ marginTop: 'var(--space-md)', color: 'var(--text-secondary)' }}>
              You already studied all due cards for now. Are you sure you want to study them again?
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>
                Back to Decks
              </button>
              <button className="btn btn-primary" onClick={handleStudyAllAnyway}>
                Study Anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (completed) {
    const accuracy = sessionStats.reviewed > 0
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
      : 0
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000 / 60)

    return (
      <div className="study-container">
        <div className="study-header">
          <div className="study-header-left">
            <button className="back-btn" onClick={() => navigate('/')} id="back-from-study">←</button>
            <span style={{ fontWeight: 600 }}>{deck?.name}</span>
          </div>
        </div>
        <div className="study-body">
          <div className="study-complete">
            <div className="study-complete-icon">🎉</div>
            <h2>Session Complete!</h2>
            <p>Great job! You've reviewed all due cards.</p>
            <div className="study-summary">
              <div className="study-summary-item">
                <div className="value" style={{ color: 'var(--color-sky-dark)' }}>{sessionStats.reviewed}</div>
                <div className="label">Cards Reviewed</div>
              </div>
              <div className="study-summary-item">
                <div className="value" style={{ color: 'var(--color-mint-dark)' }}>{accuracy}%</div>
                <div className="label">Accuracy</div>
              </div>
              <div className="study-summary-item">
                <div className="value" style={{ color: 'var(--color-lavender-dark)' }}>{elapsed || '<1'}m</div>
                <div className="label">Time Spent</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/')} id="back-to-decks">
                Back to Decks
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const intervals = getPreviewIntervals()

  return (
    <div className="study-container">
      <div className="study-header">
        <div className="study-header-left">
          <button className="back-btn" onClick={() => navigate('/')} id="exit-study" title="Exit Study">←</button>
          <span style={{ fontWeight: 600 }}>{deck?.name}</span>
        </div>
        <div className="study-progress-info">
          <div className="study-progress-stat">
            <div className="value">{currentIndex + 1}</div>
            <div className="label">Current</div>
          </div>
          <div className="study-progress-stat">
            <div className="value">{cards.length}</div>
            <div className="label">Total</div>
          </div>
        </div>
      </div>

      <div className="study-body">
        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 600, marginBottom: 'var(--space-xl)' }}>
          <div className="progress-bar" style={{ height: 4 }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Flashcard */}
        <div className="flashcard-container" onClick={handleFlip}>
          <div className={`flashcard ${flipped ? 'flipped' : ''}`}>
            <div className="flashcard-face">
              <div className="flashcard-label">Question</div>
              <div className="flashcard-content">{currentCard?.front}</div>
              <div className="flashcard-hint">Click to reveal answer</div>
            </div>
            <div className="flashcard-face flashcard-back">
              <div className="flashcard-label">Answer</div>
              <div className="flashcard-content">{currentCard?.back}</div>
            </div>
          </div>
        </div>

        {/* Rating Buttons */}
        {flipped && currentCard?.isLapseRepetition ? (
          <div className="rating-buttons animate-fade-in-up" style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={handleNextLapse} id="continue-lapse" style={{ width: '100%', maxWidth: '300px' }}>
              Continue
            </button>
          </div>
        ) : flipped && (
          <div className="rating-buttons animate-fade-in-up">
            <button className="rating-btn again" onClick={() => handleRate(Rating.Again)} id="rate-again">
              <span>Again</span>
              <span className="interval">{intervals[Rating.Again]}</span>
            </button>
            <button className="rating-btn hard" onClick={() => handleRate(Rating.Hard)} id="rate-hard">
              <span>Hard</span>
              <span className="interval">{intervals[Rating.Hard]}</span>
            </button>
            <button className="rating-btn good" onClick={() => handleRate(Rating.Good)} id="rate-good">
              <span>Good</span>
              <span className="interval">{intervals[Rating.Good]}</span>
            </button>
            <button className="rating-btn easy" onClick={() => handleRate(Rating.Easy)} id="rate-easy">
              <span>Easy</span>
              <span className="interval">{intervals[Rating.Easy]}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
