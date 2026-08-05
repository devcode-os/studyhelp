You are creating exam-prep MCQs for competitive exam aspirants (SSC, Banking, RRB, TSPSC, UPSC-level Quantitative Aptitude sections) from a Quantitative Aptitude source text (textbook chapter, question bank, or exam paper excerpt).

I will give you one or more source texts covering the same topic (possibly from different books or question banks). Read all sources first to understand the full range of question patterns, styles, and difficulty levels covered.

FORMAT — use this exact structure per question:

Q1. [Question text]
(a) [option] (b) [option] (c) [option] (d) [option]
Answer: (letter) [answer value]
Explanation: [worked solution in plain paragraphs, broken into short paragraphs with blank lines between them where a natural step/reasoning break occurs]

MULTI-LINE QUESTION STEMS — formatting rule:
- If a question includes a numbered or lettered sub-statement list (e.g. "Consider the following statements... 1. ... 2. ..." or "Which of the following is/are true? I. ... II. ... III. ..."), format each sub-statement marker as (I), (II), (III) — with parentheses — never "I.", "II.", "III." with periods, and never "1.", "2.", "3." with periods.
- Keep the full question — including every sub-statement line and the closing "Which of the above...?" line — as one continuous question block with no blank line breaks in between. A blank line inside the question block will be misread as the end of the question by downstream converters.
- Do not split a sub-statement list across separate Q-numbered entries. It is one question with one Answer line and one set of options, regardless of how many sub-statement lines it contains.

SOURCE QUESTION HANDLING — verbatim vs. fresh:

- If a source question carries an exam-attribution tag — e.g. "(CLAT, 2010)", "(SSC, 2007)", "(R.R.B., 2006)", "(Bank P.O., 2009)" — that question was asked in a real past exam. Reproduce it VERBATIM: same question text, same 4 answer values, unchanged. Only reshuffle the order of the options (so the correct answer isn't sitting in the same position as the source's answer key) and reassign the (a)/(b)/(c)/(d) letters accordingly. Do not alter the numbers, wording, or values in any way.
  - Keep the exam tag visible in the question line, e.g.: "Q1. What is the place value of 5 in 3254710? (CLAT, 2010)"
  - The Answer line must point to the correct letter after reshuffling, not the source's original letter.
  - If a tagged question is a linked/directions-based set (one shared setup with multiple sub-questions, e.g. "Directions (Q54–57): For a 5-digit number..."), reproduce the shared directions once, then each sub-question as its own Q-numbered entry, each with the tag repeated and its own reshuffled options.

- If a source question has NO exam-attribution tag (a generic textbook/practice question with no named exam+year), treat it as a PATTERN reference only — not verbatim content. Identify its underlying topic and question pattern, then write a fresh original question testing that same pattern with different numbers/scenario. Do not reuse the source's exact numbers.

- Never mix the two: a tagged question is copied faithfully (options shuffled only); an untagged question is fully regenerated with new numbers. Do not partially rewrite a tagged question, and do not verbatim-copy an untagged one.

DIFFICULTY / STANDARD MATCHING (for freshly generated, untagged-pattern questions):

- Every fresh question you generate must match the difficulty level of the source questions it's patterned after — not simpler, not harder.
- Match on these dimensions specifically:
  - Number size/complexity (e.g. if the source uses 5-6 digit numbers, don't simplify to 2-3 digit numbers; if it uses 2-digit numbers, don't inflate to make it "harder")
  - Number of reasoning steps required (e.g. if the source question needs 2 steps to solve, the fresh question should also need roughly 2 steps — not reduced to 1 direct lookup, not inflated to 4 steps)
  - Concept depth (e.g. if the source tests a single rule/formula, don't combine two concepts into one question unless the source itself does that)
  - Exam-appropriate phrasing and framing (match the tone/style of how these exams actually phrase questions, not a simplified "textbook example" tone)
- Before finalizing each fresh question, compare it mentally against its source pattern: would this credibly sit in the same exam paper, at the same difficulty, without standing out as easier or harder? If not, adjust it until it does.
- Do not pad difficulty artificially (e.g. adding irrelevant extra numbers just to look harder) — match genuine difficulty, not superficial complexity.
- If a symbolic/algebraic pattern (e.g. parity or inequality proofs using letters, not numbers) has very limited room for genuine variation beyond renaming variables, that's acceptable — note it isn't a numeric-scenario question and proceed; don't force artificial complexity just to appear "more different" from the source.

RULES FOR THE EXPLANATION:
- Write for someone with a weak math background, not for someone who already half-knows the method. Assume no shortcuts are obvious.
- Use plain paragraphs, not "Step 1 / Step 2" labels.
- Break the explanation into multiple short paragraphs (separated by a blank line) at natural reasoning breaks — e.g. one paragraph to state the rule/concept, one to apply it, one to compute the final answer. Do not write one dense wall of text.
- Every number in the explanation must exactly match the working shown — no skipped arithmetic steps, no "obviously" or "clearly."
- Keep sentences short. No filler phrases ("as we can see," "it is important to note").
- If there's a reusable shortcut or pattern worth remembering for similar future questions, you may add one line for it — but only if it adds real recognition value, not as a habit on every question.
- Use proper Unicode math symbols throughout — ², ³, ⁴ for powers, × for multiply, ÷ for divide, √ for roots — never caret notation (^) or asterisk (*) for multiplication.
- If a sub-statement list appears inside the explanation (referring back to statements I/II/III from the question), refer to them the same way they appear in the question: (I), (II), (III) with parentheses, for consistency between question and explanation.

MCQ OPTION RULES:
- Exactly 4 options (a)-(d).
- No throwaway options that are obviously wrong at a glance — every distractor should reflect a plausible mistake a real student could make (sign error, wrong operation, off-by-one, wrong place value, common miscalculation, etc.).
- The correct answer must be verifiably correct — recompute it independently, don't just trust the source's stated answer (for tagged/verbatim questions, still double-check the source's answer key is actually correct before reproducing it).
- Never let two options be mathematically identical in different forms.
- If your own independent recomputation shows a source's stated answer key is wrong, flag it inline rather than silently reproducing the error (see ACCURACY RULES below) — do not just quietly go with the source's answer.

TABLE / DATA INTERPRETATION QUESTIONS — special format:
If a question requires a data table (DI sets, comparative figures, multi-year data), add a Table: block immediately after the question and before the options:

Table:
Header1 | Header2 | Header3
Row1Val1 | Row1Val2 | Row1Val3
Unit: [e.g. "in ₹ lakhs" or "% growth"]

Only use this for genuine multi-row/multi-column data — not for simple 2-3 number comparisons that read fine in the question text itself.

ACCURACY RULES — CRITICAL FOR MATH:
- Recompute every answer from scratch, independent of what the source claims — source answer keys sometimes contain errors, and I need YOUR verified answer, not a copied one.
- Double-check every arithmetic step character by character before finalizing. Numbers are the single most common error point.
- If you're unsure whether a computed answer is correct, recompute it a second way (e.g. estimation check, reverse-check by plugging the answer back into the question) before finalizing.
- Never output "Answer: see explanation" or any placeholder — always the actual computed value.
- If a source question is ambiguous, underspecified, or the source's stated answer appears mathematically wrong, do NOT silently copy it — flag it: [Source answer appears incorrect: source says X, correct answer is Y — verify]
- If a source question's underlying puzzle logic is genuinely ambiguous or under-determined once independently verified (e.g. a digit puzzle whose visual/formatting cues didn't survive text extraction cleanly), skip it rather than guessing at a "probably intended" answer — note it as skipped in the batch summary instead of publishing an unverifiable question.

TOPIC COVERAGE / QUESTION PATTERN RULES:
- Do not repeat the same numeric setup as an existing question with only the numbers changed trivially — vary the underlying scenario/wording, not just the digits.
- Cover a genuine spread of sub-patterns within the topic (e.g. for "Number System": place value, face value, divisibility rules, remainders, unit's digit cycles, factorial zeros — not five variations of the same place-value question).
- Do NOT create questions just to hit a target count. If a topic genuinely supports 15 distinct question patterns, give 15. If it supports 40, give 40.
- At the end, state how many questions you generated, how many were verbatim (exam-tagged) vs freshly generated, and a one-line breakdown of which sub-patterns were covered. If any source question was skipped for ambiguity, note that too.
- If the topic would genuinely support more than roughly 25-30 questions in one response, stop and tell me the estimated total instead of generating everything at once — we'll batch it to preserve quality and let me review each batch.

MULTIPLE SOURCES RULE (if I give more than one source):
- If multiple sources contain the same tagged exam question (same exam+year), include it only once.
- Do not duplicate the same underlying untagged question pattern across sources — treat overlapping patterns as ONE pattern to generate fresh questions for, not two.

Here is the source text (or texts) / topic to generate from:
[PASTE SOURCE TEXT(S) OR TOPIC NAME HERE — label as SOURCE 1, SOURCE 2 if using multiple]
