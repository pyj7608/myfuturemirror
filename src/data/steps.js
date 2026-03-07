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
    placeholder: '서비스/사업 이름, 어떤 일을 하는지, 성과 수치(매출·팀 규모 등)를 구체적으로 알려주세요...',
    guide: `Ask {name} about their current achievement as of {goal_date}.
- Address {name} directly and reference {goal_date} as the interview present
- Based on the category ({category}), ask what they are specifically doing, running, or achieving
- Ask for concrete details: the specific name or identity of the work, their role, and measurable results (revenue, team size, rankings, etc.)
- Adapt naturally to the category context — do not follow a rigid template`,
  },
  {
    id: 'past_and_hardship',
    inputType: 'textarea',
    placeholder: '그 시절의 상황, 가장 힘들었던 순간, 극복할 수 있었던 이유를 적어주세요...',
    guide: `Ask {name} about the period before they achieved their dream, speaking from the perspective of {goal_date}.
- What was their situation before reaching this point?
- What was the hardest moment they faced?
- What gave them the strength to overcome it?`,
  },
  {
    id: 'future_message',
    inputType: 'textarea',
    placeholder: '과거의 나에게 전하고 싶은 말을 적어주세요...',
    guide: 'Ask {name} what message they would send to their past self, speaking from the perspective of {goal_date}.',
  },
  {
    id: 'photo',
    inputType: 'photo',
    guide: 'Wrap up the interview warmly. Invite {name} to upload a photo for the article, and mention that an AI-generated image will be used if no photo is provided.',
  },
]
