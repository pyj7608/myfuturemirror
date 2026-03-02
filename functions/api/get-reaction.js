const STEP_LABELS = {
  role_details: '현재 하고 있는 일과 이루신 성과',
  past_and_hardship: '꿈을 이루기 전 상황과 힘들었던 순간',
  future_message: '과거의 자신에게 전하는 한 마디',
}

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { stepId, answer, interviewData, nextStepId } = await context.request.json()

  const name = interviewData?.name || '고객'
  const needsExample = nextStepId in STEP_LABELS
  const nextLabel = STEP_LABELS[nextStepId] || ''

  const contextLines = Object.entries(interviewData || {})
    .filter(([k]) => k !== 'photo' && k !== 'photo_uploaded')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const exampleInstruction = needsExample
    ? `\n"example": 다음 질문("${nextLabel}")에 대한 입력 예시. 지금까지 나온 인터뷰 맥락을 반드시 반영해서 구체적으로 작성. "예) "로 시작, 2~3줄, 실제 답변처럼 자연스럽게.`
    : `\n"example": ""`

  const prompt = `당신은 친근하고 공감 능력이 뛰어난 AI 기자입니다. 인터뷰 중 사용자의 답변에 자연스럽게 반응해주세요.

[지금까지 나온 인터뷰 정보]
${contextLines}

[방금 받은 답변 (${stepId})]
${answer}

아래 JSON 형식으로만 응답하세요:
{
  "reaction": "${name}씨를 호칭하며 방금 답변에 공감하고 호기심을 드러내는 추임새. 2문장 이내. 자연스러운 대화체. 과도한 칭찬 금지.",${exampleInstruction}
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
      max_tokens: 300,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    return Response.json({ reaction: '', example: '' }, { status: 200 })
  }

  const json = await res.json()
  const result = JSON.parse(json.choices[0].message.content)

  return Response.json({
    reaction: result.reaction || '',
    example: result.example || '',
  })
}
