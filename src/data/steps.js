export function fmtDate(str) {
  if (!str) return ''
  if (str.includes('년')) return str  // 이미 포맷된 한국어 날짜는 그대로 반환
  const d = new Date(str + 'T00:00:00')
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export const STEPS = [
  {
    id: 'name',
    inputType: 'text',
    placeholder: '이름 또는 닉네임을 입력하세요',
  },
  {
    id: 'category',
    inputType: 'category',
    options: [
      { label: '사업/경제', value: 'A', emoji: '💼' },
      { label: 'IT/기술', value: 'B', emoji: '💻' },
      { label: '취업/커리어', value: 'C', emoji: '🏢' },
      { label: '학업/개인성취', value: 'D', emoji: '🎓' },
    ],
    guide: '어떤 분야의 성공 이야기인지 물어보세요. 사업/경제, IT/기술, 취업/커리어, 학업/개인성취 중 하나를 선택하게 됩니다. 분야에 맞춰 전문 기자를 배정해드린다고 안내하세요.',
  },
  {
    id: 'goal_date',
    inputType: 'date',
    guide: '꿈이나 목표를 이룬 날짜가 언제인지 자연스럽게 물어보세요.',
  },
  {
    id: 'role_details',
    inputType: 'textarea',
    placeholder: '현재 하시는 일과 이루신 성과를 자세히 알려주세요...',
    guide: `[작성 지침]
1. 오늘은 {goal_date}입니다. 이 날이 인터뷰의 "현재"입니다.
2. 질문 문장 안에 반드시 "{goal_date} 현재"라는 표현을 포함하세요.
3. {name}씨를 호칭하며 시작하세요.
4. 카테고리({category})에 맞는 기자 페르소나로 질문하세요.

[카테고리별 질문 가이드]
- 사업/경제(A): "{goal_date} 현재 어떤 사업을 이끌고 계신가요? 매출, 팀 규모, 시장 영향력 등 구체적인 성과를 알려주세요."
- IT/기술(B): "{goal_date} 현재 어떤 서비스나 기술을 만들고 계신가요? 출시한 제품이나 이룬 기술적 성과를 구체적으로 말씀해 주세요."
- 취업/커리어(C): "{goal_date} 현재 어떤 직무나 포지션에서 일하고 계신가요? 현재 역할과 이루신 성과를 자세히 알려주세요."
- 학업/개인성취(D): "{goal_date} 현재 어떤 목표를 달성하셨나요? 지금 어떤 위치에 계신지, 이루신 것들을 구체적으로 말씀해 주세요."`,
  },
  {
    id: 'past_and_hardship',
    inputType: 'textarea',
    placeholder: '그 시절의 상황, 가장 힘들었던 순간, 극복할 수 있었던 이유를 적어주세요...',
    guide: '인터뷰는 goal_date 시점의 미래에서 진행 중입니다. 꿈을 이루기 전(과거)에는 어떤 상황이었는지, 가장 힘들었던 순간과 그것을 극복한 힘이 무엇이었는지 물어보세요.',
  },
  {
    id: 'future_message',
    inputType: 'textarea',
    placeholder: '과거의 나에게 전하고 싶은 말을 적어주세요...',
    guide: '인터뷰는 goal_date 시점의 미래에서 진행 중입니다. 지금(goal_date)의 시점에서 과거의 자신에게 전하고 싶은 한 마디가 무엇인지 물어보세요.',
  },
  {
    id: 'photo',
    inputType: 'photo',
    guide: '인터뷰가 끝났음을 따뜻하게 마무리하고, 기사에 넣을 사진을 업로드해도 된다고 안내하세요. 없으면 AI가 이미지를 생성한다고도 알려주세요.',
  },
]
