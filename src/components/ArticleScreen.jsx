import { Fragment } from 'react'
import { fmtDate } from '../data/steps'

function BodyImage({ src, className }) {
  if (!src) return null
  return <img className={className} src={src} alt="기사 삽입 이미지" />
}

export default function ArticleScreen({ article, interviewData, onRestart }) {
  const { template_type: type, title, subtitle, byline, paragraphs, headerImage, bodyImage } = article

  const headerEl = headerImage ? (
    <img className={`${type.toLowerCase()}-photo`} src={headerImage} alt="기사 대표 사진" />
  ) : (
    <div className={`${type.toLowerCase()}-photo-ph`}>📸</div>
  )

  return (
    <div className="article-screen">
      <div className="article-wrap">
        {type === 'A' && (
          <div className="article-a">
            <div className="a-header">
              <div className="a-paper">FutureMirror Daily</div>
              <div className="a-dateline">
                <span>{fmtDate(interviewData.goal_date)}</span>
                <span>특별 인터뷰</span>
              </div>
              <h1 className="a-title">{title}</h1>
              <p className="a-subtitle">{subtitle}</p>
            </div>
            {headerEl}
            <div className="a-byline">{byline}</div>
            <div className="a-body">
              {paragraphs.map((p, i) => (
                <Fragment key={i}>
                  <p>{p}</p>
                  {i === 1 && <BodyImage src={bodyImage} className="body-img body-img--a" />}
                </Fragment>
              ))}
            </div>
          </div>
        )}

        {type === 'B' && (
          <div className="article-b">
            <div className="b-header">
              <div className="b-tag">Tech Interview</div>
              <h1 className="b-title">{title}</h1>
              <p className="b-subtitle">{subtitle}</p>
            </div>
            {headerEl}
            <div className="b-byline">{byline}</div>
            <div className="b-body">
              {paragraphs.map((p, i) => (
                <Fragment key={i}>
                  <p>{p}</p>
                  {i === 1 && <BodyImage src={bodyImage} className="body-img body-img--b" />}
                </Fragment>
              ))}
            </div>
          </div>
        )}

        {type === 'C' && (
          <div className="article-c">
            <div className="c-header">
              <div className="c-tag">Future Story</div>
              <h1 className="c-title">{title}</h1>
              <p className="c-subtitle">{subtitle}</p>
            </div>
            {headerEl}
            <div className="c-body">
              {paragraphs.map((p, i) => (
                <Fragment key={i}>
                  <p>{p}</p>
                  {i === 1 && <BodyImage src={bodyImage} className="body-img body-img--c" />}
                </Fragment>
              ))}
            </div>
            <div className="c-byline">{byline}</div>
          </div>
        )}

        {type === 'D' && (
          <div className="article-d">
            <div className="d-header">
              <div className="d-tag">Growth Story</div>
              <h1 className="d-title">{title}</h1>
              <p className="d-subtitle">{subtitle}</p>
            </div>
            {headerEl}
            <div className="d-body">
              {paragraphs.map((p, i) => (
                <Fragment key={i}>
                  <p>{p}</p>
                  {i === 1 && <BodyImage src={bodyImage} className="body-img body-img--d" />}
                </Fragment>
              ))}
            </div>
            <div className="d-byline">{byline}</div>
          </div>
        )}
      </div>

      <div className="article-actions">
        <button className="btn-secondary" onClick={onRestart}>
          새 인터뷰 시작하기
        </button>
      </div>
    </div>
  )
}
