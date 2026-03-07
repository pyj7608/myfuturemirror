import { useState, useEffect, useRef } from 'react'
import { STEPS } from '../data/steps'

const INITIAL_MESSAGE =
  '안녕하세요! 미래의 주인공을 기록하는 AI 기자입니다. 오늘 인터뷰를 시작하기 전, 성함(혹은 닉네임)을 알려주시겠어요?'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanName(input) {
  let name = input.trim().replace(/[.!?~]+$/, '').trim()

  // "이름은/이름이 X" 패턴 추출 (내/제 여부 무관)
  const nameMatch = name.match(/이름(?:은|이|을)?\s*(.+)/)
  if (nameMatch) {
    name = nameMatch[1].trim()
  } else {
    // "저는/나는 X" 패턴 추출
    const iaMatch = name.match(/(?:저|나)(?:는|은)\s*(.+)/)
    if (iaMatch) name = iaMatch[1].trim()
  }

  // 문장 부호 및 어미 제거
  name = name.replace(/[.!?~]+$/, '').trim()
  const suffixes = ['이라고 합니다', '라고 합니다', '입니다', '이에요', '예요', '이요', '이야', '야']
  for (const suffix of suffixes) {
    if (name.endsWith(suffix) && name.length > suffix.length + 1) {
      name = name.slice(0, -suffix.length).trim()
      break
    }
  }

  return name || input.trim()
}

function truncatePlaceholder(text, maxLines = 3, maxChars = 22) {
  if (!text) return text
  const lines = text.split('\n')
  const hasMoreLines = lines.length > maxLines
  const trimmed = lines.slice(0, maxLines).map((line) =>
    line.length > maxChars ? line.slice(0, maxChars) : line
  )
  const lastIdx = trimmed.length - 1
  const needsDots = hasMoreLines || lines[lastIdx]?.length > maxChars
  if (needsDots) trimmed[lastIdx] = trimmed[lastIdx] + '...'
  return trimmed.join('\n')
}

async function fetchReaction(stepId, answer, interviewData, nextStep, lastAiQuestion) {
  try {
    const res = await fetch('/api/get-reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, answer, interviewData, nextStep, lastAiQuestion }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default function ChatScreen({ onComplete, onBack }) {
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [isInputActive, setIsInputActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [selYear, setSelYear] = useState('')
  const [selMonth, setSelMonth] = useState('')
  const [selDay, setSelDay] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [interviewData, setInterviewData] = useState({})
  const [currentExample, setCurrentExample] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [showCancel, setShowCancel] = useState(false)
  const messagesEndRef = useRef(null)
  const hasInit = useRef(false)
  const isProcessing = useRef(false)

  useEffect(() => {
    if (hasInit.current) return
    hasInit.current = true
    setIsTyping(true)
    delay(800).then(() => {
      setIsTyping(false)
      addMessage(INITIAL_MESSAGE, 'ai')
      setIsInputActive(true)
    })
  }, []) // eslint-disable-line

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    const handler = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    window.visualViewport?.addEventListener('resize', handler)
    return () => window.visualViewport?.removeEventListener('resize', handler)
  }, [])

  function addMessage(text, role) {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }])
  }

  async function handleAnswer(answerId, answerValue, displayText) {
    if (isProcessing.current) return
    isProcessing.current = true
    setIsInputActive(false)

    try {
      const newData = { ...interviewData, [answerId]: answerValue }
      setInterviewData(newData)
      addMessage(displayText || answerValue, 'user')
      setInputValue('')
      setSelYear('')
      setSelMonth('')
      setSelDay('')
      setCurrentExample('')

      const nextIdx = currentStep + 1
      if (nextIdx >= STEPS.length) return

      const nextStep = STEPS[nextIdx]

      // 카테고리 선택 후: 날짜 질문 하드코딩 (API 불필요)
      if (answerId === 'category') {
        const deptMap = { A: '경제부', B: 'IT부', C: '커리어부', D: '문화부' }
        const momentMap = {
          A: '사업의 결실을 거두신 그날',
          B: '기술로 세상을 바꾸신 그날',
          C: '꿈의 자리에 오르신 그날',
          D: '목표를 이루신 그날',
        }
        const dept = deptMap[answerValue] || '특집부'
        const moment = momentMap[answerValue] || '꿈을 이루신 그날'
        setCurrentStep(nextIdx)
        setRetryCount(0)
        setShowCancel(false)
        setIsTyping(true)
        await delay(700)
        setIsTyping(false)
        addMessage(`${newData.name}님, 오늘 인터뷰를 맡은 ${dept} 기자입니다. 자, 이제 타임머신을 타고 ${newData.name}님이 ${moment}로 가보겠습니다. 그 역사적인 날은 몇 년 몇 월 며칠인가요?`, 'ai')
        setIsInputActive(true)
        return
      }

      // 이름 입력 후: Moderation API 검증 → 통과 시 카테고리 질문 하드코딩
      if (answerId === 'name') {
        setIsTyping(true)
        const lastAiQuestion = [...messages].reverse().find((m) => m.role === 'ai')?.text
        const result = await fetchReaction(answerId, answerValue, newData, nextStep, lastAiQuestion)
        setIsTyping(false)

        if (result?.proceed === false) {
          if (result.message) addMessage(result.message, 'ai')
          const newRetry = retryCount + 1
          setRetryCount(newRetry)
          if (newRetry >= 3) setShowCancel(true)
          setIsInputActive(true)
          return
        }

        setCurrentStep(nextIdx)
        setRetryCount(0)
        setShowCancel(false)
        addMessage(`반가워요, ${answerValue}님! 오늘은 어떤 분야의 성공 스토리를 들려주실 건가요? 분야에 딱 맞는 전문 기자를 연결해 드릴게요.`, 'ai')
        setIsInputActive(true)
        return
      }

      setIsTyping(true)
      const lastAiQuestion = [...messages].reverse().find((m) => m.role === 'ai')?.text
      const result = await fetchReaction(answerId, answerValue, newData, nextStep, lastAiQuestion)
      setIsTyping(false)

      if (result?.message) {
        addMessage(result.message, 'ai')
      }

      // proceed: false → 현재 스텝 유지, 재시도 카운트 증가
      if (result?.proceed === false) {
        const newRetry = retryCount + 1
        setRetryCount(newRetry)
        if (newRetry >= 3) setShowCancel(true)
        setCurrentExample(result?.example || '')
        setIsInputActive(true)
        return
      }

      // 정상 진행
      setCurrentStep(nextIdx)
      setRetryCount(0)
      setShowCancel(false)
      setCurrentExample(result?.example || '')
      setIsInputActive(true)
    } finally {
      isProcessing.current = false
    }
  }

  function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoDataUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handlePhotoSubmit(withPhoto) {
    const finalData = { ...interviewData, photo_uploaded: withPhoto }
    addMessage(withPhoto ? '📷 사진을 업로드했어요!' : '사진 없이 진행할게요.', 'user')
    onComplete(finalData, withPhoto ? photoDataUrl : null)
  }

  const step = STEPS[currentStep] ?? STEPS[STEPS.length - 1]
  const progress = Math.round((currentStep / STEPS.length) * 100)

  const today = new Date()
  const currentYear = today.getFullYear()
  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()
  const yearOptions = Array.from({ length: 31 }, (_, i) => currentYear + i)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const resolvedMonth = Number(selMonth) || todayMonth
  const dayCount = new Date(Number(selYear) || currentYear, resolvedMonth, 0).getDate()
  const dayOptions = Array.from({ length: dayCount }, (_, i) => i + 1)
  const displayDate = selYear
    ? `${selYear}년 ${resolvedMonth}월 ${Number(selDay) || todayDay}일`
    : ''

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button className="icon-btn" onClick={onBack} aria-label="처음으로">←</button>
        <div className="header-profile">
          <div className="avatar">📰</div>
          <div>
            <div className="header-name">AI 기자</div>
            <div className="header-sub">FutureMirror 특별 인터뷰</div>
          </div>
        </div>
        <div className="progress-badge">{currentStep + 1} / {STEPS.length}</div>
      </header>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="messages-list">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.role === 'ai' && <div className="msg-avatar">📰</div>}
            <div className="msg-bubble">
              {msg.text.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="message ai">
            <div className="msg-avatar">📰</div>
            <div className="msg-bubble typing-bubble">
              <div className="typing-dots">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-zone">
        {isInputActive && step.inputType === 'text' && (
          <div className="row-input">
            <textarea
              className="auto-textarea"
              rows={1}
              value={inputValue}
              placeholder={step.placeholder}
              onChange={(e) => {
                setInputValue(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
                  e.preventDefault()
                  handleAnswer(step.id, cleanName(inputValue.trim()), inputValue.trim())
                }
              }}
              autoFocus
            />
            <button
              className="send-btn"
              disabled={!inputValue.trim()}
              onClick={() => handleAnswer(step.id, cleanName(inputValue.trim()), inputValue.trim())}
            >↑</button>
          </div>
        )}

        {isInputActive && step.inputType === 'date' && (
          <div className="date-select-wrap">
            <div className="date-selects">
              <select
                className="date-select"
                value={selYear}
                onChange={(e) => { setSelYear(e.target.value); setSelDay('') }}
              >
                <option value="">년도</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select
                className="date-select"
                value={selMonth}
                onChange={(e) => { setSelMonth(e.target.value); setSelDay('') }}
              >
                <option value="">월</option>
                {monthOptions.map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
              <select
                className="date-select"
                value={selDay}
                onChange={(e) => setSelDay(e.target.value)}
              >
                <option value="">일</option>
                {dayOptions.map(d => <option key={d} value={d}>{d}일</option>)}
              </select>
            </div>
            <button
              className="btn-primary"
              disabled={!selYear}
              onClick={() => displayDate && handleAnswer(step.id, displayDate, displayDate)}
            >
              이 날짜로 인터뷰하기 →
            </button>
          </div>
        )}

        {isInputActive && step.inputType === 'textarea' && (
          <div className="row-input">
            <textarea
              className="auto-textarea"
              value={inputValue}
              placeholder={truncatePlaceholder(currentExample) || step.placeholder}
              rows={1}
              onChange={(e) => {
                setInputValue(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              autoFocus
            />
            <button
              className="send-btn"
              disabled={!inputValue.trim()}
              onClick={() => handleAnswer(step.id, inputValue.trim())}
            >↑</button>
          </div>
        )}

        {isInputActive && step.inputType === 'category' && (
          <div className="category-zone">
            {step.options.map((opt) => (
              <button
                key={opt.value}
                className="btn-category"
                onClick={() => handleAnswer(step.id, opt.value, `${opt.emoji} ${opt.label}`)}
              >
                <span className="cat-emoji">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {isInputActive && step.inputType === 'photo' && (
          <div className="photo-zone">
            {photoDataUrl && (
              <img src={photoDataUrl} alt="업로드 미리보기" className="photo-preview" />
            )}
            <div className="photo-btns">
              <label className="btn-upload">
                📷 사진 업로드
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
              </label>
              <button className="btn-skip" onClick={() => handlePhotoSubmit(false)}>
                건너뛰기 →
              </button>
            </div>
            {photoDataUrl && (
              <button className="btn-primary" onClick={() => handlePhotoSubmit(true)}>
                이 사진으로 기사 만들기 →
              </button>
            )}
          </div>
        )}
      </div>

      {showCancel && (
        <button className="btn-cancel-interview" onClick={onBack}>
          인터뷰 취소
        </button>
      )}
    </div>
  )
}
