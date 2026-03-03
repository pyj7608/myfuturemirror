const TEXTAREA_STEPS = new Set(['role_details', 'past_and_hardship', 'future_message'])

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { stepId, answer, interviewData, nextStep } = await context.request.json()

  const name = interviewData?.name || answer || '고객'
  const needsExample = nextStep && TEXTAREA_STEPS.has(nextStep.id)

  const contextLines = Object.entries(interviewData || {})
    .filter(([k]) => k !== 'photo' && k !== 'photo_uploaded')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const exampleInstruction = needsExample
    ? `\n"example": 다음 질문에 대한 입력 예시. 지금까지 나온 인터뷰 맥락을 반드시 반영해서 구체적으로 작성. "예) "로 시작, 2~3줄, 실제 답변처럼 자연스럽게.`
    : `\n"example": ""`

  const prompt = `당신은 친근하고 공감 능력이 뛰어난 AI 기자입니다.

[지금까지 나온 인터뷰 정보]
${contextLines || '(없음)'}

[방금 받은 답변 (${stepId})]
${answer}

[다음에 해야 할 질문 지침]
${nextStep?.guide ?? '인터뷰를 마무리하세요.'}

아래 JSON 형식으로만 응답하세요:
{
  "message": "${name}씨를 호칭하며, 방금 답변에 자연스럽게 공감·반응한 뒤 위 지침에 따라 다음 질문을 이어가는 메시지. 반응과 질문이 하나의 자연스러운 흐름으로 이어져야 함. 3~4문장. 과도한 칭찬 금지.",${exampleInstruction}
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
