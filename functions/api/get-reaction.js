const TEXTAREA_STEPS = new Set(['role_details', 'past_and_hardship', 'future_message'])
const DEEP_DIVE_STEPS = new Set(['role_details', 'past_and_hardship'])

// OpenAI Moderation API — 욕설·약물·폭력·혐오 등 안전 검사 (무료, 다국어)
async function moderateContent(answer, apiKey) {
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: answer, model: 'omni-moderation-latest' }),
    })
    if (!res.ok) return false
    const json = await res.json()
    return json.results[0]?.flagged ?? false
  } catch {
    return false
  }
}

// 인터뷰 AI — 유효성 판단 + Intelligent Gate + 메시지 생성을 단일 호출로 처리
// 하드코딩 없이 AI가 저널리스트 시각으로 모든 판단을 자율 수행
async function runInterviewAI({ stepId, answer, interviewData, nextStep, lastAiQuestion, deepDiveCount, isFlagged, apiKey }) {
  const name = interviewData?.name || '고객'
  const goalDate = interviewData?.goal_date || '미래'
  const categoryMap = { A: '사업/경제(A)', B: 'IT/기술(B)', C: '취업/커리어(C)', D: '학업/개인성취(D)' }
  const category = categoryMap[interviewData?.category] || interviewData?.category || '미정'

  const contextLines = Object.entries(interviewData || {})
    .filter(([k]) => k !== 'photo' && k !== 'photo_uploaded')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const canDeepDive = DEEP_DIVE_STEPS.has(stepId) && deepDiveCount < 2
  const isDateStep = stepId === 'goal_date'
  const needsExample = nextStep && TEXTAREA_STEPS.has(nextStep.id)

  const guide = (nextStep?.guide ?? 'Wrap up the interview warmly.')
    .replaceAll('{name}', name)
    .replaceAll('{goal_date}', goalDate)
    .replaceAll('{category}', category)

  const prompt = `You are an AI journalist for FutureMirror, conducting a future success story interview.
You receive the interview context and the user's answer, then make ALL judgments autonomously — no hardcoded rules.

[Interview Setup]
Today is ${goalDate} (the interview "present"). The interviewee has already achieved their dream.
All conversation is in present tense at ${goalDate}.

[Interview Context]
- Name: ${name}
- Category: ${category}
- Previous answers:
${contextLines || '(none)'}

[Current step]: ${stepId}
[Last AI question]: ${lastAiQuestion ?? '(none)'}
[User's answer]: ${answer}

---

${isFlagged
  ? `## Safety Flag
This answer was flagged by a content safety system as potentially harmful.
Set valid: false, reason: "harmful".
Generate a brief, polite message asking the user to rephrase. Use the SAME LANGUAGE as the user's answer.`
  : `## Task 1 — Validity Check
Is this answer valid and relevant for the current interview step?
- valid: true → proceed
- valid: false + reason + message (in the user's language):
  - "offtopic": completely unrelated to the question
  - "profanity": inappropriate language
  - "nonsense": meaningless or random input
  - "too_short": too vague or empty to be useful
  Note: for the "future_message" step, any short answer is always valid.`}

${canDeepDive
  ? `## Task 2 — Information Density (Intelligent Gate)
If valid, evaluate as a veteran journalist: does this answer contain enough specific information to write a compelling news article?
Apply 5W1H. Vague expressions alone ("a lot of money", "innovative service", "many users") without concrete substance = insufficient.
- Sufficient → deep_dive: false
- Insufficient → deep_dive: true (generate a targeted follow-up question)
${deepDiveCount >= 1 ? '※ Ask from a completely different angle than the previous follow-up.\n' : ''}`
  : `## Task 2 — Intelligent Gate
deep_dive: false (not applicable for this step)
`}

## Task 3 — Message
${isFlagged
  ? 'Generate rejection message only.'
  : canDeepDive
    ? 'If valid + deep_dive: false → ask next question per guide below.\nIf valid + deep_dive: true → ask targeted follow-up.\nIf invalid → ask to re-answer.'
    : 'If valid → ask next question per guide below.\nIf invalid → ask to re-answer.'}
${isDateStep ? 'For this step: start directly with the question, no preamble. 1-2 sentences.' : 'Summarize the answer in one sentence → ask the question. 2-3 sentences.'}
No excessive praise or encouragement. Real journalist tone. Respond in the SAME LANGUAGE as the user's answer.

[Next step guide]: ${guide}

## Task 4 — Example
${canDeepDive
  ? `If deep_dive: true: provide a concrete example that fills in the missing information. 2-3 lines, same language as user.
If deep_dive: false: ${needsExample ? 'provide a concrete example input for the next question based on the interview context. 2-3 lines, same language as user.' : '"example": ""'}`
  : needsExample
    ? 'Provide a concrete example input for the next question based on the interview context. 2-3 lines, natural and realistic. Same language as user.'
    : '"example": ""'}

Respond ONLY in JSON:
{
  "valid": true|false,
  "reason": "normal"|"offtopic"|"profanity"|"nonsense"|"too_short"|"harmful",
  "deep_dive": true|false,
  "message": "...",
  "example": ""
}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return JSON.parse(json.choices[0].message.content)
  } catch {
    return null
  }
}

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { stepId, answer, interviewData, nextStep, lastAiQuestion, deepDiveCount = 0, isDeepDive = false } = await context.request.json()

  // Moderation check (이름 + textarea 단계)
  let isFlagged = false
  if (stepId === 'name' || TEXTAREA_STEPS.has(stepId)) {
    isFlagged = await moderateContent(answer, OPENAI_API_KEY)
  }

  // 이름 단계: 안전 검사만, 다음 질문은 프론트에서 처리
  if (stepId === 'name') {
    if (!isFlagged) {
      return Response.json({ message: '', example: '', proceed: true, reason: 'normal', deep_dive: false })
    }
    const result = await runInterviewAI({ stepId, answer, interviewData: interviewData || {}, nextStep, lastAiQuestion, deepDiveCount, isFlagged: true, apiKey: OPENAI_API_KEY })
    return Response.json({ message: result?.message || '', example: '', proceed: false, reason: 'harmful', deep_dive: false })
  }

  // 모든 단계: 인터뷰 AI가 판단 + 메시지 생성
  const result = await runInterviewAI({ stepId, answer, interviewData: interviewData || {}, nextStep, lastAiQuestion, deepDiveCount, isFlagged, apiKey: OPENAI_API_KEY })

  if (!result) {
    return Response.json({ message: '', example: '', proceed: true, reason: 'normal', deep_dive: false })
  }

  const proceed = result.valid !== false

  return Response.json({
    message: result.message || '',
    example: result.example || '',
    proceed,
    reason: result.reason || 'normal',
    deep_dive: proceed ? (result.deep_dive || false) : false,
  })
}
