function fmtDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function classifyTemplate(roleDetails = '', hardship = '') {
  const text = (roleDetails + ' ' + hardship).toLowerCase()
  const aWords = ['ceo', '창업', '글로벌', '투자', '매출', '기업', '대표', '상장', '펀딩', '사업', '회사']
  const bWords = ['it', '게임', '개발', '플랫폼', '앱', '소프트웨어', 'ai', '혁신', '출시', '수상', '기술', '스타트업', '코딩', '프로그래밍']
  const aScore = aWords.filter((w) => text.includes(w)).length
  const bScore = bWords.filter((w) => text.includes(w)).length
  if (aScore > bScore && aScore > 0) return 'A'
  if (bScore > 0) return 'B'
  return 'C'
}

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const data = await context.request.json()
  const { name, goal_date, role_details, past_status, hardship, future_message } = data

  const templateType = classifyTemplate(role_details, hardship)
  const templateName = {
    A: '정통 경제지 스타일',
    B: '트렌디 테크 잡지 스타일',
    C: '소셜 카드뉴스 스타일',
  }[templateType]

  const prompt = `당신은 전문 AI 기자입니다. 아래 인터뷰 데이터를 바탕으로 실제 신문 기사를 작성해주세요.
기사 톤: ${templateName}

[인터뷰 데이터]
- 이름: ${name}
- 목표 달성 날짜: ${fmtDate(goal_date)}
- 현재 상태 및 성과: ${role_details}
- 과거 상태: ${past_status}
- 가장 힘든 순간과 극복한 힘: ${hardship}
- 과거 자신에게 한 마디: ${future_message}

[작성 지침]
1. 기사 작성일: ${fmtDate(goal_date)}
2. 기사 제목: ${name}과 성과를 조합한 강렬한 헤드라인 (실제 신문 1면 스타일)
3. 서브타이틀: 핵심 메시지를 1~2문장으로, 인용구 스타일 포함
4. 본문 5개 문단: 현재 성과 소개 → 과거 준비 과정 → 힘들었던 순간 → 극복 과정 → 과거 자신에게 전하는 말
5. 사용자 구어체를 전문 기자의 기사체로 재구성
6. 불필요한 섹션 제목 금지, 중복 표현 제거

아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 포함하지 마세요:
{"title":"...","subtitle":"...","byline":"AI 기자 | ${fmtDate(goal_date)}","paragraphs":["p1","p2","p3","p4","p5"]}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return Response.json(
      { error: err.error?.message || 'OpenAI API 오류가 발생했습니다.' },
      { status: 500 }
    )
  }

  const json = await res.json()
  const article = JSON.parse(json.choices[0].message.content)

  return Response.json({ ...article, template_type: templateType })
}
