import { useState, useEffect, useRef } from 'react'
import { STEPS, fmtDate } from '../data/steps'

const INITIAL_MESSAGE =
  '안녕하세요! 저는 FutureMirror의 AI 기자입니다 ✨\n미래의 성공한 당신을 인터뷰하게 되어 정말 기쁩니다.\n먼저 이름이나 닉네임을 알려주실래요?'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchReaction(stepId, answer, interviewData, nextStep) {
  try {
    const res = await fetch('/api/get-reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, answer, interviewData, nextStep }),
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
  const [selectedDate, setSelectedDate] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [interviewData, setInterviewData] = useState({})
  const [currentExample, setCurrentExample] = useState('')
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
      setSelectedDate('')
      setCurrentExample('')

      const nextIdx = currentStep + 1
      setCurrentStep(nextIdx)

      if (nextIdx >= STEPS.length) return

      const nextStep = STEPS[nextIdx]

      setIsTyping(true)
      const result = await fetchReaction(answerId, answerValue, newData, nextStep)
      setIsTyping(false)

      if (result?.message) {
        addMessage(result.message, 'ai')
      }
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
