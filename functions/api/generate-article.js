function fmtDate(str) {
  if (!str) return ''
  if (str.includes('년')) return str  // 이미 포맷된 한국어 날짜는 그대로 반환
  const d = new Date(str + 'T00:00:00')
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function classifyTemplate(roleDetails = '', hardship = '') {
  const text = (roleDetails + ' ' + hardship).toLowerCase()
  const aWords = ['ceo', '창업', '글로벌', '투자', '매출', '기업', '대표', '상장', '펀딩', '사업', '회사', '경영', '수익', '브랜드', '마케팅', '영업', '무역', '부동산', '금융', '벤처']
  const bWords = ['it', '게임', '개발', '플랫폼', '앱', '소프트웨어', 'ai', '혁신', '출시', '수상', '기술', '스타트업', '코딩', '프로그래밍', '디지털', '데이터', '클라우드', '서비스', '유튜브', '콘텐츠']
  const cWords = ['취업', '취직', '입사', '직장', '승진', '이직', '커리어', '자격증', '면허', '공무원', '전문직', '의사', '변호사', '회계사', '간호사', '교사', '합격', '채용']
  const dWords = ['입학', '대학', '대학원', '수능', '유학', '졸업', '장학금', '논문', '박사', '석사', '학교', '운동', '마라톤', '다이어트', '예술', '음악', '작가', '출판', '그림', '개인']
  const scores = {
    A: aWords.filter((w) => text.includes(w)).length,
    B: bWords.filter((w) => text.includes(w)).length,
    C: cWords.filter((w) => text.includes(w)).length,
    D: dWords.filter((w) => text.includes(w)).length,
  }
  const max = Math.max(...Object.values(scores))
  if (max === 0) return 'D'
  return Object.keys(scores).find((k) => scores[k] === max) ?? 'D'
}

async function analyzePhoto(photo, apiKey) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: photo, detail: 'low' } },
              {
                type: 'text',
                text: '이 사진을 2~3문장으로 묘사해주세요. 인물, 배경, 분위기를 중심으로.',
              },
            ],
          },
        ],
        max_tokens: 200,
      }),
    })
    if (!res.ok) return ''
    const json = await res.json()
    return json.choices[0].message.content || ''
  } catch {
    return ''
  }
}

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const data = await context.request.json()
  const { name, goal_date, role_details, past_and_hardship, future_message, photo, photo_uploaded, category } = data

  // 사용자가 직접 선택한 카테고리를 우선 사용, 없으면 키워드 자동 분류
  const templateType = category || classifyTemplate(role_details, past_and_hardship)
  const templateName = {
    A: '사업/경제 성공 스토리 — 정통 경제지 스타일. 성과 수치, 시장 영향력, 리더십을 강조하는 어휘 사용.',
    B: 'IT/기술 성공 스토리 — 트렌디 테크 잡지 스타일. 혁신성, 기술적 도전, 업계 변화를 강조하는 어휘 사용.',
    C: '취업/커리어 성공 스토리 — 커리어 매거진 스타일. 직업적 성장, 노력과 준비 과정, 전문성을 강조하는 어휘 사용.',
    D: '학업/개인성취 스토리 — 라이프스타일 매거진 스타일. 개인의 꿈과 도전, 성장 과정, 감동적인 변화를 강조하는 어휘 사용.',
  }[templateType]

  // 사진이 있으면 vision으로 분석
  const photoDesc = photo_uploaded && photo ? await analyzePhoto(photo, OPENAI_API_KEY) : ''
  const photoContext = photoDesc ? `\n- 업로드된 사진 묘사: ${photoDesc}` : ''

  const prompt = `당신은 전문 AI 기자입니다. 아래 인터뷰 데이터를 바탕으로 실제 신문 기사를 작성해주세요.
기사 톤: ${templateName}

[인터뷰 데이터]
- 이름: ${name}
- 목표 달성 날짜: ${fmtDate(goal_date)}
- 현재 상태 및 성과: ${role_details}
- 과거 상황 / 힘들었던 순간 / 극복한 힘: ${past_and_hardship}
- 과거 자신에게 한 마디: ${future_message}${photoContext}

[작성 지침]
1. 기사 작성일: ${fmtDate(goal_date)}
2. 기사 제목: ${name}과 성과를 조합한 강렬한 헤드라인 (실제 신문 1면 스타일)
3. 서브타이틀: 핵심 메시지를 1~2문장으로, 인용구 스타일 포함
4. 본문 5개 문단: 현재 성과 소개 → 과거 준비 과정 → 힘들었던 순간 → 극복 과정 → 과거 자신에게 전하는 말
5. 사용자 구어체를 전문 기자의 기사체로 재구성
6. 불필요한 섹션 제목 금지, 중복 표현 제거
7. image_prompt: 기사 내용을 대표하는 이미지 생성용 영어 프롬프트. 반드시 영어로 작성. 40~50단어 수준으로 구체적으로 작성. 인물의 직업·성과·상황, 배경(장소·환경), 분위기(감정·조명·색감)를 모두 포함. Stable Diffusion 입력에 최적화된 형식으로, 쉼표로 구분된 키워드·묘사 나열.

아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 포함하지 마세요:
{"title":"...","subtitle":"...","byline":"AI 기자 | ${fmtDate(goal_date)}","paragraphs":["p1","p2","p3","p4","p5"],"image_prompt":"..."}`

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
