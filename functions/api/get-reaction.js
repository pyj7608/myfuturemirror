const TEXTAREA_STEPS = new Set(['role_details', 'past_and_hardship', 'future_message'])

const INVALID_MESSAGES = {
  harmful:    '인터뷰 기록에 포함할 수 없는 내용이에요. 다시 한번 말씀해 주시겠어요?',
  offtopic:   '인터뷰 내용과 다른 이야기인 것 같아요. 다시 한번 말씀해 주시겠어요?',
  profanity:  '인터뷰 기록에는 부적절한 표현이 포함될 수 없어요. 조금 정리해서 다시 말씀해 주세요.',
  nonsense:   '답변을 이해하기 어려워요. 질문에 맞게 조금 더 자세히 입력해 주세요.',
  too_short:  '조금 더 자세히 말씀해 주시겠어요?',
}

// OpenAI Moderation API — 욕설·약물·폭력·혐오 등 안전 검사 (무료, 다국어)
async function moderateContent(answer, apiKey) {
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: answer, model: 'omni-moderation-latest' }),
    })
    if (!res.ok) return false
    const json = await res.json()
    return json.results[0]?.flagged ?? false
  } catch {
    return false // 오류 시 통과 처리
  }
}

// ① 검증 전용 호출 (temperature 0.2 — 일관성 우선)
async function validateAnswer(stepId, answer, lastAiQuestion, apiKey) {
  const prompt = `당신은 인터뷰 답변 검증 시스템입니다. 아래 답변을 평가하세요.

[AI 기자가 한 질문]: ${lastAiQuestion ?? '(질문 정보 없음)'}
[사용자 답변]: ${answer}

평가 기준:
1. 정상 답변 (질문과 관련된 내용): valid: true, reason: "normal"
2. 이탈 답변 (질문과 전혀 무관한 내용): valid: false, reason: "offtopic"
3. 욕설/비속어 (한국어·영어·변형어 포함): valid: false, reason: "profanity"
4. 무의미한 입력 (랜덤 문자, 반복 문자 등): valid: false, reason: "nonsense"
5. 지나치게 짧고 내용 없는 답변: valid: false, reason: "too_short"
   단, future_message 단계는 짧은 답변도 valid: true 처리

JSON으로만 응답하세요:
{"valid": true 또는 false, "reason": "normal" | "offtopic" | "profanity" | "nonsense" | "too_short"}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 60,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return { valid: true, reason: 'normal' } // API 오류 시 통과 처리
    const json = await res.json()
    const result = JSON.parse(json.choices[0].message.content)
    return { valid: result.valid ?? true, reason: result.reason || 'normal' }
  } catch {
    return { valid: true, reason: 'normal' } // 예외 시 통과 처리
  }
}

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { stepId, answer, interviewData, nextStep, lastAiQuestion } = await context.request.json()

  const name = interviewData?.name || answer || '고객'
  const goalDate = interviewData?.goal_date || '미래'
  const categoryMap = { A: '사업/경제(A)', B: 'IT/기술(B)', C: '취업/커리어(C)', D: '학업/개인성취(D)' }
  const category = categoryMap[interviewData?.category] || interviewData?.category || '미정'

  const needsExample = nextStep && TEXTAREA_STEPS.has(nextStep.id)

  const contextLines = Object.entries(interviewData || {})
    .filter(([k]) => k !== 'photo' && k !== 'photo_uploaded')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const exampleInstruction = needsExample
    ? `\n"example": 다음 질문에 대한 입력 예시. 지금까지 나온 인터뷰 맥락을 반드시 반영해서 구체적으로 작성. "예) "로 시작, 2~3줄, 실제 답변처럼 자연스럽게.`
    : `\n"example": ""`

  // 가이드 안의 플레이스홀더를 실제 값으로 치환
  const guide = (nextStep?.guide ?? '인터뷰를 마무리하세요.')
    .replaceAll('{name}', name)
    .replaceAll('{goal_date}', goalDate)
    .replaceAll('{category}', category)

  // 이름 단계: Moderation API만 실행 (offtopic/too_short 기준 불필요)
  if (stepId === 'name') {
    const isFlagged = await moderateContent(answer, OPENAI_API_KEY)
    if (isFlagged) {
      return Response.json({
        message: INVALID_MESSAGES.harmful,
        example: '',
        proceed: false,
        reason: 'harmful',
      })
    }
    return Response.json({ message: '', example: '', proceed: true, reason: 'normal' })
  }

  // textarea 단계에서만 검증 수행
  if (TEXTAREA_STEPS.has(stepId)) {
    // ① Moderation API: 욕설·약물·폭력·혐오 등 안전 검사
    const isFlagged = await moderateContent(answer, OPENAI_API_KEY)
    if (isFlagged) {
      return Response.json({
        message: INVALID_MESSAGES.harmful,
        example: '',
        proceed: false,
        reason: 'harmful',
      })
    }

    // ② validateAnswer: 이탈·무의미·부정어·짧은 답변 등 의미 검증
    const validation = await validateAnswer(stepId, answer, lastAiQuestion, OPENAI_API_KEY)
    if (!validation.valid) {
      return Response.json({
        message: INVALID_MESSAGES[validation.reason] ?? INVALID_MESSAGES.nonsense,
        example: '',
        proceed: false,
        reason: validation.reason,
      })
    }
  }

  // ③ 검증 통과 → 반응 + 다음 질문 생성 (temperature 0.9)
  const isDateStep = stepId === 'goal_date'

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

[다음에 해야 할 질문 지침]
${guide}

${name}님을 호칭하며 위 규칙에 따라 아래 JSON 형식으로만 응답하세요:
{
  "message": "AI 기자의 자연스러운 인터뷰 메시지",${exampleInstruction}
}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    return Response.json({ message: '', example: '', proceed: true, reason: 'normal' }, { status: 200 })
  }

  const json = await res.json()
  const result = JSON.parse(json.choices[0].message.content)

  return Response.json({
    message: result.message || '',
    example: result.example || '',
    proceed: true,
    reason: 'normal',
  })
}
