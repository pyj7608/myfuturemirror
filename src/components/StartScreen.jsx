export default function StartScreen({ onStart, error }) {
  return (
    <div className="start-screen">
      <div className="start-card">
        <div className="start-logo">🪞</div>
        <h1 className="start-title">FutureMirror</h1>
        <p className="start-tagline">미래의 성공한 나와 인터뷰해보세요</p>

        {error && <div className="error-box">{error}</div>}

        <div className="start-desc">
          <div className="start-desc-item">
            <span>💬</span>
            <span>AI 기자와 7단계 채팅 인터뷰</span>
          </div>
          <div className="start-desc-item">
            <span>📰</span>
            <span>나만의 미래 성공 기사 자동 생성</span>
          </div>
          <div className="start-desc-item">
            <span>🎨</span>
            <span>3가지 스타일 중 AI가 자동 선택</span>
          </div>
        </div>

        <button className="btn-primary" onClick={onStart}>
          인터뷰 시작하기 →
        </button>
      </div>
    </div>
  )
}
