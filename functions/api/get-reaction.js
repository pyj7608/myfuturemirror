const TEXTAREA_STEPS = new Set(['role_details', 'past_and_hardship', 'future_message'])
const DEEP_DIVE_STEPS = new Set(['role_details', 'past_and_hardship'])

const INVALID_MESSAGES = {
  harmful:   '인터뷰 기록에 포함할 수 없는 내용이에요. 다시 한번 말씀해 주시겠어요?',
  offtopic:  '인터뷰 내용과 다른 이야기인 것 같아요. 다시 한번 말씀해 주시겠어요?',
  profanity: '인터뷰 기록에는 부적절한 표현이 포함될 수 없어요. 조금 정리해서 다시 말씀해 주세요.',
  nonsense:  '답변을 이해하기 어려워요. 질문에 맞게 조금 더 자세히 입력해 주세요.',
  too_short: '조금 더 자세히 말씀해 주시겠어요?',
}

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

// 검증 + Intelligent Gate (Deep-Dive 판단) 통합 — temperature 0.2, 1회 호출
// 하드코딩된 카테고리·언어별 규칙 없음. AI가 저널리스트 시각으로 정보 충만도를 자율 판단.
async function validateAndCheckDeepDive(stepId, answer, lastAiQuestion, deepDiveCount, apiKey, name, category, goalDate, contextLines) {
  const canDeepDive = DEEP_DIVE_STEPS.has(stepId) && deepDiveCount < 2

  const deepDiveCriteria = canDeepDive
    ? `\n6. Information density evaluation (needs_deep_dive + missing):
   You are a veteran journalist evaluating whether this answer contains enough specific information to write a compelling news article.

   Full interview context:
   - Name: ${name}
   - Category: ${category}
   - Goal date: ${goalDate}
   - Previous answers: ${contextLines || '(none)'}

   Apply journalistic 5W1H standards. Abstract or vague expressions alone (e.g. "innovative service", "a lot of money", "many users") without concrete substance = insufficient.
   If any key journalistic element is missing (What exactly it is, How it works, specific figures, concrete events), treat it as insufficient.

   If sufficient  → needs_deep_dive: false, missing: ""
   If insufficient → needs_deep_dive: true,  missing: "One sentence in the SAME LANGUAGE as the user's answer describing what specific information is missing for the article"`
    : ''

  const prompt = `You are an interview answer validation system. Evaluate the answer below.

[AI journalist's question]: ${lastAiQuestion ?? '(no question info)'}
[User's answer]: ${answer}

Evaluation criteria:
1. Normal answer: valid: true, reason: "normal"
2. Off-topic (completely unrelated to the question): valid: false, reason: "offtopic"
3. Profanity/obscenity: valid: false, reason: "profanity"
4. Meaningless input (random characters, etc.): valid: false, reason: "nonsense"
5. Excessively short with no content: valid: false, reason: "too_short"
   Exception: for the future_message step, short answers are always valid: true${deepDiveCriteria}

Respond ONLY in JSON:
{"valid": true|false, "reason": "normal"|"offtopic"|"profanity"|"nonsense"|"too_short"${canDeepDive ? ', "needs_deep_dive": true|false, "missing": ""' : ''}}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return { valid: true, reason: 'normal', needs_deep_dive: false, missing: '' }
    const json = await res.json()
    const result = JSON.parse(json.choices[0].message.content)
    return {
      valid: result.valid ?? true,
      reason: result.reason || 'normal',
      needs_deep_dive: canDeepDive ? (result.needs_deep_dive ?? false) : false,
      missing: result.missing || '',
    }
  } catch {
    return { valid: true, reason: 'normal', needs_deep_dive: false, missing: '' }
  }
}

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { stepId, answer, interviewData, nextStep, lastAiQuestion, deepDiveCount = 0, isDeepDive = false } = await context.request.json()

  const name = interviewData?.name || answer || '고객'
  const goalDate = interviewData?.goal_date || '미래'
  const categoryMap = { A: '사업/경제(A)', B: 'IT/기술(B)', C: '취업/커리어(C)', D: '학업/개인성취(D)' }
  const category = categoryMap[interviewData?.category] || interviewData?.category || '미정'

  const contextLines = Object.entries(interviewData || {})
    .filter(([k]) => k !== 'photo' && k !== 'photo_uploaded')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const guide = (nextStep?.guide ?? '인터뷰를 마무리하세요.')
    .replaceAll('{name}', name)
    .replaceAll('{goal_date}', goalDate)
    .replaceAll('{category}', category)

  // ① 이름 단계: Moderation API만 실행
  if (stepId === 'name') {
    const isFlagged = await moderateContent(answer, OPENAI_API_KEY)
    if (isFlagged) {
      return Response.json({ message: INVALID_MESSAGES.harmful, example: '', proceed: false, reason: 'harmful', deep_dive: false })
    }
    return Response.json({ message: '', example: '', proceed: true, reason: 'normal', deep_dive: false })
  }

  // ② textarea 단계: Moderation → Intelligent Gate (통합 1회 호출)
  let needsDeepDive = false
  let missingInfo = ''
  if (TEXTAREA_STEPS.has(stepId)) {
    const isFlagged = await moderateContent(answer, OPENAI_API_KEY)
    if (isFlagged) {
      return Response.json({ message: INVALID_MESSAGES.harmful, example: '', proceed: false, reason: 'harmful', deep_dive: false })
    }

    const validation = await validateAndCheckDeepDive(stepId, answer, lastAiQuestion, deepDiveCount, OPENAI_API_KEY, name, category, goalDate, contextLines)
    if (!validation.valid) {
      return Response.json({
        message: INVALID_MESSAGES[validation.reason] ?? INVALID_MESSAGES.nonsense,
        example: '',
        proceed: false,
        reason: validation.reason,
        deep_dive: false,
      })
    }
    needsDeepDive = validation.needs_deep_dive
    missingInfo = validation.missing || ''
  }

  // ③ 반응 + 질문 생성 (temperature 0.9)
  const isDateStep = stepId === 'goal_date'

  // 예시 지침: deep-dive 중이면 현재 단계 보완 예시, 아니면 다음 단계 입력 예시
  const needsExample = !needsDeepDive && nextStep && TEXTAREA_STEPS.has(nextStep.id)
  const exampleInstruction = needsDeepDive
    ? `\n"example": A concrete input example that fills in the missing information (${missingInfo}). Start with the same prefix as the user's language convention (e.g. "예) " for Korean). 2-3 lines, natural and realistic.`
    : needsExample
      ? nextStep.id === 'role_details'
        ? `\n"example": 다음 질문에 대한 입력 예시. 서비스/사업/제품 이름, 무엇을 하는지, 성과 수치(매출·팀 규모 등)를 반드시 포함해 구체적으로. "예) "로 시작, 2~3줄, 실제 답변처럼 자연스럽게.`
        : `\n"example": 다음 질문에 대한 입력 예시. 인터뷰 맥락을 반드시 반영해 구체적으로. "예) "로 시작, 2~3줄, 실제 답변처럼 자연스럽게.`
      : `\n"example": ""`

  // 질문 가이드: Intelligent Gate 판단 결과(missingInfo)로 팔로업 구동, 아니면 다음 단계 가이드
  const questionGuide = needsDeepDive
    ? `[Follow-up question guide — request additional information]
The following specific information is missing for the article: ${missingInfo}
Ask naturally for this missing information. Use the SAME LANGUAGE as the user's answer.${deepDiveCount >= 1 ? '\n※ Ask from a completely different angle than the previous follow-up question.' : ''}`
    : `[다음에 해야 할 질문 지침]
${guide}`

  const messageInstruction = needsDeepDive
    ? `Address ${name}, summarize the key point of the answer in one sentence, then naturally ask for the missing information. 2-3 sentences. Journalist tone. No praise or encouragement. Respond in the SAME LANGUAGE as the user's answer.`
    : isDateStep
      ? `${name}님을 호칭하며, 추임새 없이 바로 위 지침에 따라 질문을 시작하세요. 1~2문장. 간결하게.`
      : `Address ${name}. Summarize the answer in one sentence → ask the next question. 2-3 sentences. Respond in the SAME LANGUAGE as the user's answer.`

  const prompt = `당신은 친근하지만 전문적인 인터뷰를 진행하는 AI 기자입니다.
사용자의 미래 성공 스토리를 인터뷰하여 기사로 기록하는 역할입니다.

[인터뷰 설정]
오늘은 ${goalDate}입니다. 사용자는 이미 꿈을 이룬 상태이며, 이 날이 인터뷰의 "현재"입니다.
AI 기자와 사용자 모두 ${goalDate} 시점에서 대화하고 있습니다.
모든 질문은 미래가 아닌 현재 시제로 진행하세요. "${goalDate} 이후"를 암시하는 표현("앞으로" 등)은 사용하지 마세요.

[AI 기자 말투 규칙]
1. 실제 인터뷰 기자처럼 말하세요.
2. 과도한 칭찬(정말 대단합니다, 너무 멋집니다 등)은 사용하지 마세요.
3. 응원·격려·동기부여 톤을 사용하지 마세요.
4. 사용자의 답변을 한 문장으로 자연스럽게 요약한 뒤 질문을 이어가세요.
5. 질문은 간결하고 명확하게 작성하세요.

좋은 예: "혼자서 AI 웹서비스를 개발해 월 매출 2천만 원을 만들었군요. 이런 성과를 이루기 전에는 어떤 상황이었나요?"
나쁜 예: "정말 대단한 성과네요! 엄청난 노력이 있었을 것 같습니다! 그렇다면..."

[문장 스타일 규칙]
- 전체 메시지는 2~3문장
- 같은 표현 반복 금지
- 금지 표현: "정말 멋집니다!", "대단합니다!", "정말 놀라운 이야기네요!"
${isDateStep ? '- 이번 단계는 추임새 없이 바로 질문으로 시작하세요. 1~2문장.' : '- 답변 요약 → 질문 구조로 작성하세요.'}

[지금까지 나온 인터뷰 정보]
${contextLines || '(없음)'}

[방금 받은 답변 (${stepId})]
${answer}

${questionGuide}

${messageInstruction}
아래 JSON 형식으로만 응답하세요:
{
  "message": "AI 기자의 자연스러운 인터뷰 메시지",${exampleInstruction}
}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    return Response.json({ message: '', example: '', proceed: true, reason: 'normal', deep_dive: false }, { status: 200 })
  }

  const json = await res.json()
  const result = JSON.parse(json.choices[0].message.content)

  // 메시지가 비어 있으면 fallback 생성 (GPT가 빈 문자열을 반환한 경우 대비)
  if (!result.message) {
    result.message = needsDeepDive
      ? `${name}님, 조금 더 구체적으로 말씀해 주시겠어요?`
      : `${name}님, 감사합니다. 이어서 다음 질문 드리겠습니다.`
  }

  return Response.json({
    message: result.message || '',
    example: result.example || '',
    proceed: true,
    reason: 'normal',
    deep_dive: needsDeepDive,
  })
}
