const TEXTAREA_STEPS = new Set(['role_details', 'past_and_hardship', 'future_message'])

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { stepId, answer, interviewData, nextStep } = await context.request.json()

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

  const isDateStep = stepId === 'goal_date'
  const messageInstruction = isDateStep
    ? `${name}님을 호칭하며, 추임새 없이 바로 위 지침에 따라 질문을 시작하세요. 1~2문장. 간결하게.`
    : `${name}님을 호칭하며, 방금 답변에 자연스럽게 공감·반응한 뒤 위 지침에 따라 다음 질문을 이어가는 메시지. 반응과 질문이 하나의 자연스러운 흐름으로 이어져야 함. 3~4문장. 과도한 칭찬 금지.`

  const prompt = `당신은 친근하고 공감 능력이 뛰어난 AI 기자입니다.

[인터뷰 배경]
오늘은 ${goalDate}입니다. 사용자는 이미 꿈을 이룬 상태이며, 이 날이 인터뷰의 "현재"입니다.
AI 기자와 사용자 모두 ${goalDate} 시점에 있습니다. 과거가 아닌 현재 시제로 이야기하세요.

[지금까지 나온 인터뷰 정보]
${contextLines || '(없음)'}

[방금 받은 답변 (${stepId})]
${answer}

[다음에 해야 할 질문 지침]
${guide}

아래 JSON 형식으로만 응답하세요:
{
  "message": "${messageInstruction}",${exampleInstruction}
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
    return Response.json({ message: '', example: '' }, { status: 200 })
  }

  const json = await res.json()
  const result = JSON.parse(json.choices[0].message.content)

  return Response.json({
    message: result.message || '',
    example: result.example || '',
  })
}
