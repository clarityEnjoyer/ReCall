/**
 * @fileoverview FSRS (Free Spaced Repetition Scheduler) Algorithm Implementation
 *
 * A modern spaced repetition algorithm that tracks three key memory metrics:
 * - Stability (S): How long a memory can last (in days)
 * - Difficulty (D): How hard a card is (0–10 scale)
 * - Retrievability (R): Probability of recall at a given time (0–1)
 *
 * Based on the FSRS v4 specification.
 *
 * @module fsrs
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @enum {number} Rating values the user can give after reviewing a card */
export const Rating = Object.freeze({
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
});

/** @enum {number} Possible learning states a card can be in */
export const State = Object.freeze({
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
});

// ---------------------------------------------------------------------------
// Default FSRS Parameters
// ---------------------------------------------------------------------------

/**
 * Default weight vector for the FSRS algorithm (17 parameters).
 * @type {number[]}
 */
const DEFAULT_W = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05,
  0.34, 1.26, 0.29, 2.61,
];

/** Target probability of recall when scheduling the next review */
const REQUEST_RETENTION = 0.9;

/** Upper bound for any computed interval (in days) */
const MAXIMUM_INTERVAL = 36500;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a value between a minimum and maximum.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate initial stability for a given rating on a new card.
 *
 * @param {number} rating - Rating (1–4)
 * @param {number[]} w - Weight vector
 * @returns {number} Initial stability in days
 */
function initStability(rating, w) {
  return Math.max(w[rating - 1], 0.1);
}

/**
 * Calculate initial difficulty for a given rating on a new card.
 *
 * @param {number} rating - Rating (1–4)
 * @param {number[]} w - Weight vector
 * @returns {number} Initial difficulty (clamped 1–10)
 */
function initDifficulty(rating, w) {
  return clamp(w[4] - (rating - 3) * w[5], 1, 10);
}

/**
 * Calculate the retrievability (probability of recall) given elapsed days
 * and the current stability.
 *
 * Uses the FSRS power-law forgetting curve:
 *   R = (1 + elapsedDays / (9 * S))^(-1)
 *
 * @param {number} elapsedDays - Days since last review
 * @param {number} stability - Current stability
 * @returns {number} Retrievability in range [0, 1]
 */
function forgettingCurve(elapsedDays, stability) {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/**
 * Compute the next interval in days from a target retrievability and stability.
 *
 * Derived by inverting the forgetting curve for the requested retention:
 *   interval = S * 9 * (1/requestRetention - 1)
 *
 * @param {number} stability - Current stability
 * @returns {number} Interval in days (integer, ≥ 1, ≤ MAXIMUM_INTERVAL)
 */
function nextInterval(stability) {
  const interval = (stability / 9) * (Math.pow(REQUEST_RETENTION, -1) - 1);
  return Math.min(Math.max(Math.round(interval), 1), MAXIMUM_INTERVAL);
}

/**
 * Update difficulty after a review.
 *
 * Uses mean-reversion formula:
 *   D' = w[7] * D_0(3) + (1 - w[7]) * (D - w[6] * (rating - 3))
 *
 * @param {number} difficulty - Current difficulty
 * @param {number} rating - Rating (1–4)
 * @param {number[]} w - Weight vector
 * @returns {number} New difficulty (clamped 1–10)
 */
function nextDifficulty(difficulty, rating, w) {
  const nextD = difficulty - w[6] * (rating - 3);
  // Mean reversion towards initial difficulty of a "Good" rating
  const meanReverted = w[7] * initDifficulty(Rating.Good, w) + (1 - w[7]) * nextD;
  return clamp(meanReverted, 1, 10);
}

/**
 * Calculate the next stability after a successful recall (rating ≥ Hard).
 *
 * @param {number} difficulty - Current difficulty
 * @param {number} stability - Current stability
 * @param {number} retrievability - Current retrievability
 * @param {number} rating - Rating (2–4)
 * @param {number[]} w - Weight vector
 * @returns {number} New stability in days
 */
function nextRecallStability(difficulty, stability, retrievability, rating, w) {
  const hardPenalty = rating === Rating.Hard ? w[15] : 1;
  const easyBonus = rating === Rating.Easy ? w[16] : 1;

  return (
    stability *
    (1 +
      Math.exp(w[8]) *
        (11 - difficulty) *
        Math.pow(stability, -w[9]) *
        (Math.exp((1 - retrievability) * w[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

/**
 * Calculate the next stability after a lapse (rating = Again).
 *
 * @param {number} difficulty - Current difficulty
 * @param {number} stability - Current stability
 * @param {number} retrievability - Current retrievability
 * @param {number[]} w - Weight vector
 * @returns {number} New stability in days (≥ 0.1)
 */
function nextForgetStability(difficulty, stability, retrievability, w) {
  return Math.max(
    w[11] *
      Math.pow(difficulty, -w[12]) *
      (Math.pow(stability + 1, w[13]) - 1) *
      Math.exp((1 - retrievability) * w[14]),
    0.1
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CardState
 * @property {number} state - Card state enum value (New=0, Learning=1, Review=2, Relearning=3)
 * @property {number} difficulty - Difficulty rating (1–10)
 * @property {number} stability - Memory stability in days
 * @property {number} retrievability - Current probability of recall (0–1)
 * @property {number} reps - Total number of successful reviews
 * @property {number} lapses - Number of times the card was forgotten (rated Again)
 * @property {number} interval - Current interval in days
 * @property {Date|null} lastReview - Timestamp of the last review
 * @property {Date|null} nextReview - Scheduled date for the next review
 */

/**
 * Create a brand-new card state with default FSRS parameters.
 *
 * @returns {CardState} A fresh card state ready for its first review
 */
export function createNewCard() {
  return {
    state: State.New,
    difficulty: 0,
    stability: 0,
    retrievability: 0,
    reps: 0,
    lapses: 0,
    interval: 0,
    lastReview: null,
    nextReview: null,
  };
}

/**
 * Process a review and return the updated card state.
 *
 * @param {CardState} cardState - The current state of the card
 * @param {number} rating - User rating: Again(1), Hard(2), Good(3), Easy(4)
 * @param {Date} [now=new Date()] - The current timestamp
 * @returns {CardState} Updated card state with new scheduling information
 *
 * @example
 * const card = createNewCard();
 * const updated = repeat(card, Rating.Good);
 * console.log(updated.nextReview); // Date in the future
 */
export function repeat(cardState, rating, now = new Date()) {
  const w = DEFAULT_W;

  // Clone the card so we don't mutate the original
  const card = { ...cardState };
  const currentNow = new Date(now);

  // Elapsed days since the last review
  const elapsedDays = card.lastReview
    ? Math.max(
        (currentNow.getTime() - new Date(card.lastReview).getTime()) /
          (1000 * 60 * 60 * 24),
        0
      )
    : 0;

  // Update lastReview timestamp
  card.lastReview = currentNow;

  // -----------------------------------------------------------------------
  // State-machine transitions
  // -----------------------------------------------------------------------

  switch (card.state) {
    // ── New card (first ever review) ──────────────────────────────────────
    case State.New: {
      card.stability = initStability(rating, w);
      card.difficulty = initDifficulty(rating, w);
      card.reps = 1;

      if (rating === Rating.Again) {
        card.state = State.Learning;
        card.lapses += 1;
        card.interval = 0;
        card.nextReview = new Date(currentNow.getTime() + 10 * 60 * 1000); // 10 mins
        card.isLapseRepetition = true;
      } else if (rating === Rating.Hard) {
        card.state = State.Learning;
        card.interval = 0;
        card.nextReview = new Date(currentNow.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      } else if (rating === Rating.Good) {
        card.state = State.Review;
        card.interval = 2;
        card.nextReview = new Date(currentNow.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
      } else {
        // Easy
        card.state = State.Review;
        card.interval = 8;
        card.nextReview = new Date(currentNow.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 days
      }
      break;
    }

    // ── Learning / Relearning ─────────────────────────────────────────────
    case State.Learning:
    case State.Relearning: {
      card.reps += 1;

      if (rating === Rating.Again) {
        card.difficulty = nextDifficulty(card.difficulty, rating, w);
        card.stability = initStability(rating, w);
        card.lapses += 1;
        card.state =
          card.state === State.Learning ? State.Learning : State.Relearning;
        card.interval = 0;
        card.nextReview = new Date(currentNow.getTime() + 10 * 60 * 1000); // 10 mins
        card.isLapseRepetition = true;
      } else if (rating === Rating.Hard) {
        card.difficulty = nextDifficulty(card.difficulty, rating, w);
        card.stability = initStability(rating, w);
        card.interval = 0;
        card.nextReview = new Date(currentNow.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      } else {
        // Good or Easy → graduate to Review
        card.difficulty = nextDifficulty(card.difficulty, rating, w);
        card.stability = initStability(rating, w);
        card.state = State.Review;
        const interval = nextInterval(card.stability);
        card.interval = interval;
        card.nextReview = new Date(
          currentNow.getTime() + interval * 24 * 60 * 60 * 1000
        );
      }
      break;
    }

    // ── Review (long-term memory) ─────────────────────────────────────────
    case State.Review: {
      card.reps += 1;

      const retrievability = forgettingCurve(elapsedDays, card.stability);

      if (rating === Rating.Again) {
        // Lapse → enter Relearning
        card.difficulty = nextDifficulty(card.difficulty, rating, w);
        card.stability = nextForgetStability(
          card.difficulty,
          card.stability,
          retrievability,
          w
        );
        card.lapses += 1;
        card.state = State.Relearning;
        card.interval = 0;
        card.nextReview = new Date(currentNow.getTime() + 10 * 60 * 1000); // 10 mins
        card.isLapseRepetition = true;
      } else {
        // Successful recall → stay in Review
        card.difficulty = nextDifficulty(card.difficulty, rating, w);
        card.stability = nextRecallStability(
          card.difficulty,
          card.stability,
          retrievability,
          rating,
          w
        );
        const interval = nextInterval(card.stability);
        card.interval = interval;
        card.nextReview = new Date(
          currentNow.getTime() + interval * 24 * 60 * 60 * 1000
        );
      }
      break;
    }

    default:
      throw new Error(`Unknown card state: ${card.state}`);
  }

  // Compute current retrievability for the scheduled review time
  card.retrievability = card.nextReview
    ? forgettingCurve(
        Math.max(
          (new Date(card.nextReview).getTime() - currentNow.getTime()) /
            (1000 * 60 * 60 * 24),
          0
        ),
        card.stability
      )
    : 0;

  return card;
}

/**
 * Calculate the current retrievability (probability of recall) for a card.
 *
 * @param {CardState} cardState - The current state of the card
 * @param {Date} [now=new Date()] - The current timestamp
 * @returns {number} Retrievability between 0 and 1.
 *   Returns 0 for new cards that have never been reviewed.
 *
 * @example
 * const r = getRetrievability(card, new Date());
 * console.log(`${(r * 100).toFixed(1)}% chance of recall`);
 */
export function getRetrievability(cardState, now = new Date()) {
  if (cardState.state === State.New || !cardState.lastReview) {
    return 0;
  }

  const elapsedDays = Math.max(
    (new Date(now).getTime() - new Date(cardState.lastReview).getTime()) /
      (1000 * 60 * 60 * 24),
    0
  );

  return forgettingCurve(elapsedDays, cardState.stability);
}
