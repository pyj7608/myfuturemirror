export function fmtDate(str) {
  if (!str) return ''
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
    guide: '지금 어떤 일을 하고 있고 어떤 성과를 이루었는지 구체적으로 물어보세요.',
  },
  {
    id: 'past_and_hardship',
    inputType: 'textarea',
    placeholder: '그 시절의 상황, 가장 힘들었던 순간, 극복할 수 있었던 이유를 적어주세요...',
    guide: '꿈을 이루기 전 어떤 상황이었는지, 가장 힘들었던 순간과 그것을 극복한 힘이 무엇이었는지 물어보세요.',
  },
  {
    id: 'future_message',
    inputType: 'textarea',
    placeholder: '과거의 나에게 전하고 싶은 말을 적어주세요...',
    guide: '지금까지의 경험을 돌아보며 과거의 자신에게 전하고 싶은 한 마디가 무엇인지 물어보세요.',
  },
  {
    id: 'photo',
    inputType: 'photo',
    guide: '인터뷰가 끝났음을 따뜻하게 마무리하고, 기사에 넣을 사진을 업로드해도 된다고 안내하세요. 없으면 AI가 이미지를 생성한다고도 알려주세요.',
  },
]
