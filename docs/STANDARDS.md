# How the tool measures sight-word learning

This explains the choices behind the numbers teachers see, so they can be
checked against school or district practice and changed if needed. The
values live in `services/mastery.js` and in each student's
`accommodations`.

## What is assessed

| Fry list | Usually expected by | Common Core alignment |
|---|---|---|
| First 100 | end of grade 1 | RF.K.3c, RF.1.3g |
| Second 100 | end of grade 2 | RF.2.3f |
| Third 100 | end of grade 2 | RF.2.3f, RF.3.3d |
| Fourth–Tenth 100 | grades 3–5 | RF.3.3d, RF.4.3a, RF.5.3a |

The RF.x.3 standards ask students to *recognize and read grade-appropriate
irregularly spelled words*. RF.x.4 (fluency) is the reason automaticity is
measured, not just accuracy. Grade bands are guidance, not limits: the
tool always teaches from each child's **working list** (the first list
under 90% mastered).

## Definitions

- **Automatic**: read correctly within the student's threshold, **3 seconds**
  by default. This is the usual cut-off in sight-word intervention
  protocols, where a hesitation over about 3 seconds counts as an error.
  Teachers can raise it per student, or turn timing off (**untimed**), as an
  accommodation.
- **Mastered**: automatic and correct on **3 separate days**. "Three correct
  in a row" is a common mastery criterion. Spreading it over separate days
  checks that the word was retained, not just remembered for a minute.
- **Review**: a mastered word that was most recently missed.
- **Learning**: read correctly at least once, not yet mastered.
- **Not yet known**: attempted, never correct. **Not assessed**: never tried.
- Reads where the child first pressed *Hear it* / *Spell it* are saved but
  don't count toward mastery.

## Kinds of evidence

| Context | Who scores | Counts toward mastery |
|---|---|---|
| Benchmark (1:1 teacher assessment) | teacher | yes |
| Live testing room | teacher | yes |
| Practice: Read it + self-check | student | yes (expressive) |
| Practice: Listen & find, Build it | the app | only if *receptive counts for mastery* is on (non-speaking / AAC students) |

Students can only ever log practice. They cannot create benchmark
results, and automaticity is calculated by the server from response times.

## Practice design

- Sessions mix **a few unknown words (default 3) into mostly familiar
  words**, in the spirit of incremental rehearsal, so children succeed most
  of the time.
- **Spaced repetition**: a word is reviewed 1, 2, 4, 7, 14, then 30 days
  after each successful day, and goes back to the start after a miss.
- **Error correction**: a missed word is modelled right away ("This word is
  *said*") and comes back once at the end of the session.
- No visible timers, scores or comparisons with other children. Break
  reminders are on by default (10 minutes).

## Progress monitoring (MTSS / IEP)

The student page shows words mastered per week with an optional goal **aim
line** from a baseline to a target date. This is the usual curriculum-based
measurement graph for deciding whether an intervention is working. The
1:1 benchmark presents words in random order and can stop after N misses in
a row so struggling readers aren't discouraged.

## Speech recognition ("Say it")

- **Off by default.** A teacher or parent turns it on per student
  (accommodation answer mode `speech`).
- **On-device only.** The app only uses the browser's speech recognition
  when the browser confirms local processing (Web Speech API
  `processLocally`). Otherwise the microphone is never turned on. There is
  no cloud fallback, and no audio is recorded or stored.
- **Confirm-only scoring.** Recognizers are much less accurate on young
  children's speech than on adults', so the computer may confirm a correct
  read (`scoredBy: speech`) but never marks a child wrong. If it doesn't
  hear the word, the child hears the model and self-checks.
- Sound-alike words (to/two/too, there/their …) are accepted, because a
  reader saying them aloud cannot be told apart.
- Availability depends on the browser and device. Where it isn't
  available, a self-hosted engine such as Vosk (WebAssembly, word-list
  grammar) is the planned alternative.

## Accessibility and privacy

- The frontend is checked against **WCAG 2.1/2.2 Level AA**, the standard
  named in the U.S. DOJ ADA Title II rule for public school web content.
- **Universal Design for Learning**: several ways to see a word (fonts
  including OpenDyslexic and Atkinson Hyperlegible, size, spacing,
  colour themes), hear it (text-to-speech) and respond (read aloud,
  choose, build).
- Student data is limited to what teaching needs. Text-to-speech runs in
  the browser, and **no voice audio is recorded or stored** (voice
  recordings are personal information under the amended COPPA rule).
  Schools should still review FERPA/COPPA obligations before use.
