import { useState } from 'react'
import StartScreen from './components/StartScreen'
import ChatScreen from './components/ChatScreen'
import ArticleScreen from './components/ArticleScreen'

export default function App() {
  const [screen, setScreen] = useState('start')
  const [article, setArticle] = useState(null)
  const [interviewData, setInterviewData] = useState(null)
  const [error, setError] = useState(null)

  async function handleInterviewComplete(data, photoUrl) {
    setInterviewData(data)
    setScreen('loading')
    setError(null)

    try {
      const articleRes = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!articleRes.ok) {
        const err = await articleRes.json().catch(() => ({}))
        throw new Error(err.error || '기사 생성에 실패했습니다.')
      }
      const articleData = await articleRes.json()

      let imageUrl = photoUrl
      if (!photoUrl) {
        try {
          const imgRes = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: data.name,
              role_details: data.role_details,
              template_type: articleData.template_type,
            }),
          })
          if (imgRes.ok) {
            const imgData = await imgRes.json()
            imageUrl = imgData.imageUrl
          }
        } catch {
          // 이미지 생성 실패는 비치명적 — 기사는 그대로 표시
        }
      }

      setArticle({ ...articleData, imageUrl })
      setScreen('article')
    } catch (err) {
      setError(err.message)
      setScreen('start')
    }
  }

  function handleRestart() {
    setScreen('start')
    setArticle(null)
    setInterviewData(null)
    setError(null)
  }

  if (screen === 'loading') {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p className="loading-text">
          AI 기자가 기사를 작성하고 있어요
          <br />
          잠시만 기다려주세요 ✍️
        </p>
      </div>
    )
  }

  return (
    <>
      {screen === 'start' && (
        <StartScreen onStart={() => setScreen('chat')} error={error} />
      )}
      {screen === 'chat' && (
        <ChatScreen
          onComplete={handleInterviewComplete}
          onBack={() => setScreen('start')}
        />
      )}
      {screen === 'article' && article && (
        <ArticleScreen
          article={article}
          interviewData={interviewData}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
