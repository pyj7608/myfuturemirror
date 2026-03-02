export function fmtDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export const STEPS = [
  {
    id: 'name',
    question: () =>
      '안녕하세요! 저는 FutureMirror의 AI 기자입니다 ✨\n미래의 성공한 당신을 인터뷰하게 되어 정말 기쁩니다.\n먼저 이름이나 닉네임을 알려주실래요?',
    inputType: 'text',
    placeholder: '이름 또는 닉네임을 입력하세요',
  },
  {
    id: 'goal_date',
    question: (d) =>
      `${d.name}씨, 반갑습니다! 언제쯤 꿈을 이루셨나요?\n그 날짜를 기준으로 이야기 나눌게요. 📅`,
    inputType: 'date',
  },
  {
    id: 'role_details',
    question: (d) =>
      `${d.name}씨, 현재(${fmtDate(d.goal_date)}) 어떤 일을 하고 계시고,\n지금까지 어떤 성과를 이루셨나요? 자세히 알려주실 수 있나요? 😊`,
    inputType: 'textarea',
    placeholder: '현재 하시는 일과 이루신 성과를 자세히 알려주세요...',
  },
  {
    id: 'past_status',
    question: (d) =>
      `${d.name}씨, 성공하기 전에는 어떤 상황에서 꿈을 준비하고 계셨나요?\n그때의 경험이 지금의 성과와 어떻게 이어졌는지도 듣고 싶어요. 🌱`,
    inputType: 'textarea',
    placeholder: '성공하기 전의 상황과 준비 과정을 알려주세요...',
  },
  {
    id: 'hardship',
    question: (d) =>
      `${d.name}씨, 꿈을 이루는 과정에서 가장 힘들었던 순간은 언제였고,\n그 어려움을 극복하는 데 무엇이 가장 큰 힘이 되었나요? 💪`,
    inputType: 'textarea',
    placeholder: '힘들었던 순간과 극복할 수 있었던 힘을 알려주세요...',
  },
  {
    id: 'future_message',
    question: (d) =>
      `${d.name}씨, 지금까지의 경험을 돌아보며\n과거의 자신에게 한 마디 한다면 어떤 말을 전하고 싶으신가요? 💌`,
    inputType: 'textarea',
    placeholder: '과거의 나에게 전하고 싶은 말을 적어주세요...',
  },
  {
    id: 'photo',
    question: (d) =>
      `${d.name}씨, 정말 멋진 이야기를 들려주셔서 감사합니다! 🎉\n원하신다면 기사에 넣을 사진을 업로드해 주세요.\n없으시면 AI가 적절한 이미지를 만들어 넣을게요. 📸`,
    inputType: 'photo',
  },
]
