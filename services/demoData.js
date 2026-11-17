/**
 * Generates a realistic, clearly fictional demo class: one teacher, six
 * students with different needs, ~8 weeks of practice history, goals and
 * assignments. Deterministic (seeded) so the demo looks the same each time.
 *
 * Pure: returns plain objects; scripts/seed-demo.js writes them.
 */
import { FRY_LISTS, getFryList } from '../data/fryWords.js'

const DAY_MS = 24 * 60 * 60 * 1000

// Small seeded random number generator (mulberry32)
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEMO_EMAIL = 'demo-teacher@example.invalid'
export const DEMO_TEACHER_NAME = 'Demo Teacher'

/**
 * Student archetypes. `skill` = how fast words are learned, `practice` =
 * chance of practising on a school day, `startWord` = how many Fry words
 * they already knew at the start.
 */
export const DEMO_STUDENTS = [
  { name: 'Demo-Ava', grade: 2, skill: 0.9, practice: 0.85, startWord: 60, goalGain: 50, note: 'Steady progress' },
  { name: 'Demo-Ben', grade: 2, skill: 1.3, practice: 0.8, startWord: 140, goalGain: 60, note: 'Strong reader' },
  { name: 'Demo-Cleo', grade: 2, skill: 0.35, practice: 0.7, startWord: 15, goalGain: 45, note: 'Struggling; too many new words' },
  { name: 'Demo-Dev', grade: 2, skill: 0.8, practice: 0.75, startWord: 45, goalGain: 40, absentLastDays: 10, note: 'Has not practised recently' },
  {
    name: 'Demo-Eli',
    grade: 2,
    skill: 0.7,
    practice: 0.8,
    startWord: 30,
    goalGain: 35,
    accommodations: { untimed: true, wordsPerSession: 6, newWordsPerSession: 2, breakReminderMinutes: 5 },
    note: 'Untimed, smaller sessions (processing)'
  },
  {
    name: 'Demo-Fay',
    grade: 2,
    skill: 0.75,
    practice: 0.8,
    startWord: 20,
    goalGain: 30,
    receptive: true,
    accommodations: {
      receptiveCountsForMastery: true,
      responseModes: ['choice', 'build'],
      choiceCount: 2,
      autoReadWords: true
    },
    note: 'Non-speaking (AAC): listen & find counts'
  }
]

const isSchoolDay = (date) => {
  const d = date.getUTCDay()
  return d !== 0 && d !== 6
}

export function generateDemo({ now = new Date(), weeks = 8, seed = 42 } = {}) {
  const random = rng(seed)
  const allWords = FRY_LISTS.flatMap((l) => l.words)
  const start = new Date(new Date(now).getTime() - weeks * 7 * DAY_MS)
  start.setUTCHours(0, 0, 0, 0)

  const students = DEMO_STUDENTS.map((profile, index) => {
    const acc = {
      automaticitySeconds: 3,
      untimed: false,
      wordsPerSession: 10,
      newWordsPerSession: 3,
      ...(profile.accommodations || {})
    }
    const threshold = acc.automaticitySeconds * 1000
    // strength per word index; words before startWord are already known
    const strength = new Map()
    for (let i = 0; i < profile.startWord; i++) strength.set(i, 3 + random())
    let frontier = profile.startWord // next unseen word
    const attempts = []
    const pCorrectFor = (s) => 1 / (1 + Math.exp(-(s - 0.6) * 2))
    const responseFor = (s) =>
      // ~1.2 s for well-known words, ~5 s for brand-new ones
      Math.round((1100 + 4200 / (1 + s * s)) * (0.75 + random() * 0.5))
    let schoolDay = -1

    for (let t = start.getTime(); t < new Date(now).getTime(); t += DAY_MS) {
      const day = new Date(t)
      if (!isSchoolDay(day)) continue
      schoolDay += 1
      const daysLeft = (new Date(now).getTime() - t) / DAY_MS
      if (profile.absentLastDays && daysLeft < profile.absentLastDays) continue

      // Teacher benchmark about every three weeks (MTSS-style probe):
      // every word in the lists up to the student's current one
      if (schoolDay % 15 === 0) {
        const upTo = Math.min(allWords.length, Math.ceil((frontier + 1) / 100) * 100)
        for (let i = 0; i < upTo; i++) {
          const s = strength.get(i) ?? 0
          const correct = random() < pCorrectFor(s)
          const responseMs = responseFor(s)
          const timed = !acc.untimed
          const word = allWords[i]
          attempts.push({
            word,
            wordKey: word.toLowerCase(),
            fryList: getFryList(word),
            correct,
            responseMs: timed ? responseMs : undefined,
            timed,
            automatic: correct && timed && responseMs <= threshold,
            skill: profile.receptive ? 'receptive' : 'expressive',
            context: 'benchmark',
            scoredBy: 'teacher',
            helpUsed: false,
            date: new Date(t + (13 * 60 + Math.floor(i / 4)) * 60 * 1000)
          })
        }
      }

      if (random() > profile.practice) continue

      // Session: a few new words + review of familiar ones
      const session = []
      // Only add new words when few are still being learned (as the app does);
      // Cleo's teacher hasn't lowered her new-word load yet, so she gets 5
      const stillLearning = [...strength.values()].filter((v) => v < 3.5).length
      const newCount =
        profile.name === 'Demo-Cleo'
          ? 5
          : stillLearning > 12
            ? 0
            : Math.min(2, acc.newWordsPerSession)
      for (let n = 0; n < newCount && frontier < allWords.length; n++) {
        if (!strength.has(frontier)) strength.set(frontier, 0)
        session.push(frontier++)
      }
      const learning = [...strength.keys()].filter((i) => strength.get(i) < 3.5)
      const known = [...strength.keys()].filter((i) => strength.get(i) >= 3.5)
      while (session.length < acc.wordsPerSession && (learning.length || known.length)) {
        // Mostly familiar words, some still-learning ones (as the app does)
        const pool = learning.length && random() < 0.75 ? learning : known.length ? known : learning
        const pick = pool.splice(Math.floor(random() * pool.length), 1)[0]
        if (pick !== undefined && !session.includes(pick)) session.push(pick)
      }

      let minute = 9 * 60 + Math.floor(random() * 300)
      for (const i of session) {
        const s = strength.get(i)
        const correct = random() < pCorrectFor(s)
        const responseMs = responseFor(s)
        const timed = !acc.untimed
        const word = allWords[i]
        const date = new Date(t + minute * 60 * 1000)
        minute += 1
        attempts.push({
          word,
          wordKey: word.toLowerCase(),
          fryList: getFryList(word),
          correct,
          responseMs: timed ? responseMs : undefined,
          timed,
          automatic: correct && timed && responseMs <= threshold,
          skill: profile.receptive ? 'receptive' : 'expressive',
          context: 'practice',
          scoredBy: profile.receptive ? 'choice' : 'self',
          helpUsed: false,
          date
        })
        // Missed words are modelled ("this word is…"), so they still grow
        strength.set(i, s + (correct ? profile.skill : 0.4 * profile.skill))
      }
    }

    return {
      ...profile,
      accommodations: acc,
      goal: {
        baselineWords: Math.max(0, profile.startWord - 5),
        baselineDate: start.toISOString().slice(0, 10),
        targetWords: profile.startWord + profile.goalGain,
        targetDate: new Date(new Date(now).getTime() + 5 * 7 * DAY_MS).toISOString().slice(0, 10)
      },
      attempts,
      index
    }
  })

  const assignments = [
    {
      title: 'Tricky words: Group A',
      note: 'Read these every day this week!',
      studentNames: ['Demo-Cleo', 'Demo-Dev'],
      words: ['said', 'were', 'there', 'what', 'could', 'their']
    },
    {
      title: 'List 2 warm-up',
      note: '',
      studentNames: ['Demo-Ava', 'Demo-Eli', 'Demo-Fay'],
      words: FRY_LISTS[1].words.slice(0, 8)
    }
  ]

  return { teacher: { name: DEMO_TEACHER_NAME, email: DEMO_EMAIL }, students, assignments }
}
