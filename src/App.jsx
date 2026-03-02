import { useState } from 'react'
import StartScreen from './components/StartScreen'
import ChatScreen from './components/ChatScreen'
import ArticleScreen from './components/ArticleScreen'

async function fetchImage(prompt, templateType, variant = 'header') {
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, template_type: templateType, variant }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.imageUrl || null
  } catch {
    return null
  }
}

export default function App() {
  const [screen, setScreen] = useState('start')
  const [article, setArticle] = useState(null)
  const [interviewData, setInterviewData] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)

  async function handleInterviewComplete(data, photoUrl) {
    setInterviewData(data)
    setScreen('loading')
    setError(null)

    try {
      // 1단계: 기사 생성 (사진 있으면 vision 분석 포함)
      setLoadingMsg('AI 기자가 기사를 작성하고 있어요 ✍️')
      const articleRes = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, photo: photoUrl }),
      })
      if (!articleRes.ok) {
        const err = await articleRes.json().catch(() => ({}))
        throw new Error(err.error || '기사 생성에 실패했습니다.')
      }
      const articleData = await articleRes.json()
      const { image_prompt, template_type } = articleData

      // 2단계: 이미지 생성 (헤더 + 본문 병렬)
      setLoadingMsg('이미지를 생성하고 있어요 🎨')
      const [headerImage, bodyImage] = await Promise.all([
        // 헤더: 사용자 사진 우선, 없으면 AI 생성
        photoUrl
          ? Promise.resolve(photoUrl)
          : fetchImage(image_prompt, template_type, 'header'),
        // 본문 중간: 항상 AI 생성
        fetchImage(image_prompt, template_type, 'body'),
      ])

      setArticle({ ...articleData, headerImage, bodyImage })
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
          {loadingMsg}
          <br />
          잠시만 기다려주세요
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
