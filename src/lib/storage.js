/**
 * @fileoverview IndexedDB storage layer for the Recall spaced-repetition app.
 *
 * Uses Dexie.js to manage four object stores:
 * - decks: card collections / folders
 * - cards: individual flashcards with FSRS scheduling metadata
 * - reviewLogs: per-review audit trail
 * - studySessions: aggregated study session records
 *
 * @module storage
 */

import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

/** @type {Dexie} */
const db = new Dexie('RecallAppDB');

db.version(1).stores({
  decks: '++id, name, createdAt, description, color',
  cards:
    '++id, deckId, front, back, createdAt, updatedAt, state, difficulty, stability, retrievability, lastReview, nextReview, reps, lapses',
  reviewLogs:
    '++id, cardId, deckId, rating, state, reviewedAt, elapsedDays, scheduledDays',
  studySessions:
    '++id, deckId, startedAt, endedAt, cardsReviewed, correctCount',
});

// ---------------------------------------------------------------------------
// Deck CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new deck.
 *
 * @param {Object} deck
 * @param {string} deck.name - Display name of the deck
 * @param {string} [deck.description] - Optional description
 * @param {string} [deck.color] - Optional colour hex / CSS value
 * @returns {Promise<number>} The auto-generated deck id
 */
export async function createDeck(deck) {
  return db.decks.add({
    ...deck,
    createdAt: new Date(),
  });
}

/**
 * Retrieve every deck.
 *
 * @returns {Promise<Object[]>} Array of all decks
 */
export async function getAllDecks() {
  return db.decks.toArray();
}

/**
 * Retrieve a single deck by id.
 *
 * @param {number} id
 * @returns {Promise<Object|undefined>}
 */
export async function getDeck(id) {
  return db.decks.get(id);
}

/**
 * Update an existing deck.
 *
 * @param {number} id
 * @param {Object} changes - Partial deck object with fields to update
 * @returns {Promise<number>} 1 if updated, 0 if id not found
 */
export async function updateDeck(id, changes) {
  return db.decks.update(id, changes);
}

/**
 * Delete a deck and all associated cards, review logs, and study sessions.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteDeck(id) {
  await db.transaction('rw', [db.decks, db.cards, db.reviewLogs, db.studySessions], async () => {
    // Remove review logs for those cards using the indexed deckId
    await db.reviewLogs.where('deckId').equals(id).delete();
    await db.cards.where('deckId').equals(id).delete();

    // Remove study sessions
    await db.studySessions.where('deckId').equals(id).delete();

    // Remove the deck itself
    await db.decks.delete(id);
  });
}

// ---------------------------------------------------------------------------
// Card CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new card in a deck.
 *
 * @param {Object} card
 * @param {number} card.deckId - The parent deck's id
 * @param {string} card.front - Front content (question)
 * @param {string} card.back - Back content (answer)
 * @param {number} [card.state=0] - Initial state (default: New)
 * @param {number} [card.difficulty=0] - Initial difficulty
 * @param {number} [card.stability=0] - Initial stability
 * @param {number} [card.retrievability=0] - Initial retrievability
 * @param {number} [card.reps=0] - Initial rep count
 * @param {number} [card.lapses=0] - Initial lapse count
 * @returns {Promise<number>} The auto-generated card id
 */
export async function createCard(card) {
  const now = new Date();
  return db.cards.add({
    state: 0,
    difficulty: 0,
    stability: 0,
    retrievability: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    nextReview: null,
    ...card,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Get all cards that belong to a specific deck.
 *
 * @param {number} deckId
 * @returns {Promise<Object[]>}
 */
export async function getCardsByDeck(deckId) {
  return db.cards.where('deckId').equals(deckId).toArray();
}

/**
 * Retrieve a single card by id.
 *
 * @param {number} id
 * @returns {Promise<Object|undefined>}
 */
export async function getCard(id) {
  return db.cards.get(id);
}

/**
 * Update an existing card.
 *
 * @param {number} id
 * @param {Object} changes - Partial card object with fields to update
 * @returns {Promise<number>} 1 if updated, 0 if id not found
 */
export async function updateCard(id, changes) {
  return db.cards.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

/**
 * Delete a card and its associated review logs.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteCard(id) {
  await db.transaction('rw', [db.cards, db.reviewLogs], async () => {
    await db.reviewLogs.where('cardId').equals(id).delete();
    await db.cards.delete(id);
  });
}

// ---------------------------------------------------------------------------
// Review helpers
// ---------------------------------------------------------------------------

/**
 * Get all cards that are due for review in a deck.
 *
 * A card is "due" when:
 * - Its state is New (state === 0) — it has never been studied, OR
 * - Its nextReview date is at or before `now`
 *
 * @param {number} deckId
 * @param {Date} [now=new Date()] - Reference time for "due" calculation
 * @returns {Promise<Object[]>} Array of due cards
 */
export async function getDueCards(deckId, now = new Date()) {
  const allCards = await db.cards.where('deckId').equals(deckId).toArray();
  return allCards.filter((card) => {
    if (card.state === 0) return true; // New cards are always due
    if (card.nextReview && new Date(card.nextReview) <= new Date(now)) return true;
    return false;
  });
}

/**
 * Get all new (unstudied) cards in a deck.
 *
 * @param {number} deckId
 * @returns {Promise<Object[]>} Array of cards with state === 0
 */
export async function getNewCards(deckId) {
  return db.cards
    .where('[deckId+state]')
    .equals([deckId, 0])
    .toArray()
    .catch(() => {
      // Fallback if compound index is unavailable
      return db.cards
        .where('deckId')
        .equals(deckId)
        .filter((card) => card.state === 0)
        .toArray();
    });
}

/**
 * Persist a review log entry.
 *
 * @param {Object} log
 * @param {number} log.cardId
 * @param {number} log.deckId
 * @param {number} log.rating - Rating given (1–4)
 * @param {number} log.state - Card state at time of review
 * @param {Date} [log.reviewedAt=new Date()] - Timestamp of the review
 * @param {number} log.elapsedDays - Days since the previous review
 * @param {number} log.scheduledDays - Interval that was scheduled
 * @returns {Promise<number>} The auto-generated log id
 */
export async function logReview(log) {
  return db.reviewLogs.add({
    ...log,
    reviewedAt: log.reviewedAt || new Date(),
  });
}

/**
 * Get review logs for a deck, optionally filtered by a start date.
 *
 * @param {number} deckId
 * @param {Date} [since] - Only return logs on or after this date
 * @returns {Promise<Object[]>}
 */
export async function getReviewLogs(deckId, since) {
  let collection = db.reviewLogs.where('deckId').equals(deckId);
  const logs = await collection.toArray();

  if (since) {
    const sinceTime = new Date(since).getTime();
    return logs.filter(
      (log) => new Date(log.reviewedAt).getTime() >= sinceTime
    );
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Study sessions
// ---------------------------------------------------------------------------

/**
 * Start a new study session for a deck.
 *
 * @param {number} deckId
 * @returns {Promise<number>} The auto-generated session id
 */
export async function startSession(deckId) {
  return db.studySessions.add({
    deckId,
    startedAt: new Date(),
    endedAt: null,
    cardsReviewed: 0,
    correctCount: 0,
  });
}

/**
 * End an existing study session with final stats.
 *
 * @param {number} id - Session id
 * @param {Object} stats
 * @param {number} stats.cardsReviewed - Total cards reviewed in the session
 * @param {number} stats.correctCount - Cards answered correctly (rating ≥ Good)
 * @returns {Promise<number>} 1 if updated, 0 if id not found
 */
export async function endSession(id, stats) {
  return db.studySessions.update(id, {
    endedAt: new Date(),
    ...stats,
  });
}

/**
 * Get all study sessions for a deck, ordered by most recent first.
 *
 * @param {number} deckId
 * @returns {Promise<Object[]>}
 */
export async function getSessionsByDeck(deckId) {
  return db.studySessions
    .where('deckId')
    .equals(deckId)
    .reverse()
    .sortBy('startedAt');
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Compute aggregate statistics for a deck.
 *
 * @param {number} deckId
 * @returns {Promise<{
 *   totalCards: number,
 *   dueCards: number,
 *   newCards: number,
 *   masteredCards: number,
 *   totalReviews: number,
 *   averageRetention: number
 * }>}
 */
export async function getDeckStats(deckId) {
  const [allCards, dueCardsList, totalReviews] = await Promise.all([
    db.cards.where('deckId').equals(deckId).toArray(),
    getDueCards(deckId),
    db.reviewLogs.where('deckId').equals(deckId).count(),
  ]);

  const totalCards = allCards.length;
  const dueCards = dueCardsList.length;
  const newCards = allCards.filter((c) => c.state === 0).length;
  const masteredCards = allCards.filter((c) => c.state === 2).length; // State.Review is 2

  // Average retention: mean retrievability across all non-new cards
  const nonNewCards = allCards.filter((c) => c.state !== 0 && c.lastReview);
  let averageRetention = 0;
  if (nonNewCards.length > 0) {
    const now = new Date();
    const sum = nonNewCards.reduce((acc, card) => {
      if (card.stability <= 0) return acc;
      const elapsed = Math.max(
        (now.getTime() - new Date(card.lastReview).getTime()) /
          (1000 * 60 * 60 * 24),
        0
      );
      return acc + Math.pow(1 + elapsed / (9 * card.stability), -1);
    }, 0);
    averageRetention = sum / nonNewCards.length;
  }

  return {
    totalCards,
    dueCards,
    newCards,
    masteredCards,
    totalReviews,
    averageRetention,
  };
}

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

/**
 * Calculate total study time (in minutes) for a deck from completed sessions.
 *
 * @param {number} deckId
 * @returns {Promise<number>} Total minutes studied
 */
export async function getDeckStudyTime(deckId) {
  const sessions = await db.studySessions
    .where('deckId')
    .equals(deckId)
    .toArray();

  const totalMs = sessions.reduce((acc, session) => {
    if (session.startedAt && session.endedAt) {
      return (
        acc +
        (new Date(session.endedAt).getTime() -
          new Date(session.startedAt).getTime())
      );
    }
    return acc;
  }, 0);

  return Math.round(totalMs / (1000 * 60));
}

/**
 * Calculate the current consecutive-day study streak.
 *
 * Looks at all review logs across all decks, groups them by calendar date,
 * and counts backwards from today (or the most recent review day) to find
 * how many consecutive days the user has studied.
 *
 * @returns {Promise<number>} Number of consecutive study days (0 if none)
 */
export async function getStudyStreak() {
  // Start from today and yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const uniqueDays = new Set();

  // Query in reverse chronological order, stopping at the first gap > 1 day
  await db.reviewLogs
    .orderBy('reviewedAt')
    .reverse()
    .each((log) => {
      const d = new Date(log.reviewedAt);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toDateString();

      if (uniqueDays.size === 0) {
        // If the most recent review is older than yesterday, the streak is 0
        if (d.getTime() < yesterday.getTime()) {
          return false; // Stop iteration
        }
      } else {
        // Check if there's a gap between the last added date and this one
        const daysArray = Array.from(uniqueDays);
        const lastDay = new Date(daysArray[daysArray.length - 1]);
        const diffDays = Math.round((lastDay.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
          return false; // Stop iteration
        }
      }

      uniqueDays.add(dateStr);
    });

  return uniqueDays.size;
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default db;
