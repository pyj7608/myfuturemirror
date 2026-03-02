import { useState, useEffect, useRef } from 'react'
import { STEPS, fmtDate } from '../data/steps'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchReaction(stepId, answer, interviewData, nextStepId) {
  try {
    const res = await fetch('/api/get-reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, answer, interviewData, nextStepId }),
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
  const [isInputActive, setIsInputActive] = useState(false) // 질문 표시 후에만 true
  const [currentStep, setCurrentStep] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [interviewData, setInterviewData] = useState({})
  const [currentExample, setCurrentExample] = useState('')
  const messagesEndRef = useRef(null)
  const hasInit = useRef(false)
  const isProcessing = useRef(false) // 중복 제출 방지

  useEffect(() => {
    if (hasInit.current) return
    hasInit.current = true
    triggerQuestion(0, {})
  }, []) // eslint-disable-line

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function addMessage(text, role) {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }])
  }

  // 질문 표시 — 완료된 후에만 입력창 활성화
  async function triggerQuestion(stepIdx, data) {
    setIsInputActive(false)
    const step = STEPS[stepIdx]
    const text = typeof step.question === 'function' ? step.question(data) : step.question
    setIsTyping(true)
    await delay(800 + Math.random() * 500)
    setIsTyping(false)
    addMessage(text, 'ai')
    setIsInputActive(true) // 질문이 화면에 추가된 후에만 입력창 열기
  }

  async function handleAnswer(answerId, answerValue, displayText) {
    if (isProcessing.current) return // 중복 호출 방지
    isProcessing.current = true
    setIsInputActive(false) // 즉시 입력창 닫기

    try {
      const newData = { ...interviewData, [answerId]: answerValue }
      setInterviewData(newData)
      addMessage(displayText || answerValue, 'user')
      setInputValue('')
      setSelectedDate('')
      setCurrentExample('')

      const nextIdx = currentStep + 1
      setCurrentStep(nextIdx)

      if (nextIdx >= STEPS.length) return

      const nextStep = STEPS[nextIdx]

      // 이름 입력 후: 환영 인사 (API 불필요)
      if (answerId === 'name') {
        setIsTyping(true)
        await delay(700)
        setIsTyping(false)
        addMessage(`반갑습니다, ${answerValue}씨! 정말 설레는 인터뷰가 될 것 같아요 ✨`, 'ai')
        await delay(400)
        await triggerQuestion(nextIdx, newData)
        return
      }

      // 날짜 입력 후: 추임새 + 다음 질문
      if (answerId === 'goal_date') {
        setIsTyping(true)
        const reactionData = await fetchReaction(answerId, answerValue, newData, nextStep.id)
        setIsTyping(false)
        if (reactionData?.reaction) {
          addMessage(reactionData.reaction, 'ai')
          await delay(400)
        }
        setCurrentExample(reactionData?.example || '')
        await triggerQuestion(nextIdx, newData)
        return
      }

      // 나머지 단계: 추임새 + 동적 예시 + 다음 질문
      setIsTyping(true)
      const reactionData = await fetchReaction(answerId, answerValue, newData, nextStep.id)
      setIsTyping(false)
      if (reactionData?.reaction) {
        addMessage(reactionData.reaction, 'ai')
        await delay(400)
      }
      setCurrentExample(reactionData?.example || '')
      await triggerQuestion(nextIdx, newData)
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
  const todayStr = new Date().toISOString().split('T')[0]

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
            <input
              type="text"
              value={inputValue}
              placeholder={step.placeholder}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim())
                  handleAnswer(step.id, inputValue.trim())
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

        {isInputActive && step.inputType === 'date' && (
          <div className="date-row">
            <input
              type="date"
              value={selectedDate}
              min={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              className="send-btn"
              disabled={!selectedDate}
              onClick={() => selectedDate && handleAnswer(step.id, selectedDate, fmtDate(selectedDate))}
            >↑</button>
          </div>
        )}

        {isInputActive && step.inputType === 'textarea' && (
          <div className="col-input">
            <textarea
              value={inputValue}
              placeholder={step.placeholder}
              rows={3}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey && inputValue.trim())
                  handleAnswer(step.id, inputValue.trim())
              }}
              autoFocus
            />
            {currentExample && (
              <div className="input-example">{currentExample}</div>
            )}
            <div className="input-footer">
              <span className="input-hint">Ctrl + Enter로 전송</span>
              <button
                className="send-btn"
                disabled={!inputValue.trim()}
                onClick={() => handleAnswer(step.id, inputValue.trim())}
              >↑</button>
            </div>
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
    </div>
  )
}
