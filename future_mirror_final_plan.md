# FutureMirror 최종 기획서 (현행 기준)

> 최종 업데이트: 2026-03-07

---

## 1. 서비스 개요

- 사용자가 미래의 어느 시점에서 성공한 자신의 모습을 상상하고, AI 기자와 인터뷰를 진행하여 맞춤형 뉴스 기사 생성
- 인터뷰는 SNS 채팅형으로 진행되어 몰입감 극대화
- **핵심 프레이밍**: 인터뷰 자체가 `{goal_date}` 시점에서 진행됨. AI 기자와 사용자 모두 그 미래에 있으며, 모든 질문은 `{goal_date}`를 "현재"로 표현
- 인터뷰 종료 후 사용자가 업로드한 사진 또는 AI 생성 이미지를 포함해 기사 완성

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React + Vite |
| 배포 | Cloudflare Pages |
| 백엔드 API | Cloudflare Pages Functions |
| 답변 검증 (안전) | OpenAI Moderation API (`omni-moderation-latest`, 무료) |
| 답변 검증 (의미) | OpenAI GPT-4o-mini (temperature 0.2) |
| 인터뷰 반응 생성 | OpenAI GPT-4o-mini (temperature 0.9) |
| 기사 생성 | OpenAI GPT-4o-mini (temperature 0.85) |
| 사진 분석 | OpenAI GPT-4o-mini (vision) |
| AI 이미지 생성 | Cloudflare Workers AI (Stable Diffusion XL Base 1.0) |

---

## 3. 인터뷰 UX 흐름 (SNS 채팅형)

총 7단계. 처음 3개 질문은 하드코딩, 4번부터는 AI가 동적 생성 (`get-reaction` API).

### Step 1: 이름 입력
- **입력 UI**: auto-resize 텍스트에어리어 (브라우저 자동완성 툴바 억제)
- **AI 기자 (하드코딩)**: "안녕하세요! 미래의 주인공을 기록하는 AI 기자입니다. 오늘 인터뷰를 시작하기 전, 성함(혹은 닉네임)을 알려주시겠어요?"
- **저장 변수**: `{name}`
- **특이사항**:
  - `cleanName()` 함수로 한국어 경어 어미 자동 제거 (예: "홍길동 입니다" → "홍길동")
  - 답변 제출 시 `get-reaction` API 호출 → **Moderation API** 안전 검사 실행
  - 유해 콘텐츠 포함 시 `proceed: false` 반환 → 재입력 요청 (최대 3회 후 인터뷰 취소 버튼 표시)

### Step 2: 카테고리 선택
- **입력 UI**: 버튼형 2×2 그리드 (이모지 + 레이블)
- **AI 기자 (하드코딩)**: "반가워요, {name}님! 오늘은 어떤 분야의 성공 스토리를 들려주실 건가요? 분야에 딱 맞는 전문 기자를 연결해 드릴게요."
- **선택지**:
  | 값 | 레이블 | 이모지 |
  |----|--------|--------|
  | A | 사업/경제 | 💼 |
  | B | IT/기술 | 💻 |
  | C | 취업/커리어 | 🏢 |
  | D | 학업/개인성취 | 🎓 |
- **저장 변수**: `{category}`

### Step 3: 목표 달성 날짜
- **입력 UI**: 년/월/일 드롭다운 3단 선택
  - 년도: 필수 (현재 연도부터 +30년)
  - 월/일: 선택 (미선택 시 인터뷰 당일의 월/일 자동 사용)
- **AI 기자 (하드코딩)**: 카테고리별 담당 부서 기자 소개 + 타임머신 프레이밍
  - A(경제부): "{name}님, 오늘 인터뷰를 맡은 경제부 기자입니다. 자, 이제 타임머신을 타고 {name}님이 사업의 결실을 거두신 그날로 가보겠습니다. 그 역사적인 날은 몇 년 몇 월 며칠인가요?"
  - B(IT부): "...기술로 세상을 바꾸신 그날로 가보겠습니다."
  - C(커리어부): "...꿈의 자리에 오르신 그날로 가보겠습니다."
  - D(문화부): "...목표를 이루신 그날로 가보겠습니다."
- **저장 변수**: `{goal_date}` (예: "2030년 5월 1일")

### Step 4: 현재 상태 및 성과
- **입력 UI**: 멀티라인 텍스트에어리어
- **AI 기자 (동적 생성)**: `{goal_date} 현재`라는 표현을 질문에 반드시 포함. 카테고리별 질문 가이드:
  - A(사업/경제): "{goal_date} 현재 어떤 사업을 이끌고 계신가요? 매출, 팀 규모, 시장 영향력 등 구체적인 성과를 알려주세요."
  - B(IT/기술): "{goal_date} 현재 어떤 서비스나 기술을 만들고 계신가요? 출시한 제품이나 이룬 기술적 성과를 구체적으로 말씀해 주세요."
  - C(취업/커리어): "{goal_date} 현재 어떤 직무나 포지션에서 일하고 계신가요? 현재 역할과 이루신 성과를 자세히 알려주세요."
  - D(학업/개인성취): "{goal_date} 현재 어떤 목표를 달성하셨나요? 지금 어떤 위치에 계신지, 이루신 것들을 구체적으로 말씀해 주세요."
- **저장 변수**: `{role_details}`
- **특이사항**: goal_date 답변 직후이므로 추임새 없이 바로 질문 시작 (1~2문장)

### Step 5: 과거 상황 / 힘든 순간 / 극복한 힘 (통합)
- **입력 UI**: 멀티라인 텍스트에어리어
- **AI 기자 (동적 생성)**: 꿈을 이루기 전(과거) 상황, 가장 힘들었던 순간, 극복한 힘을 한 번에 물어봄
- **저장 변수**: `{past_and_hardship}`

### Step 6: 과거 자신에게 한 마디
- **입력 UI**: 멀티라인 텍스트에어리어
- **AI 기자 (동적 생성)**: `{goal_date}` 시점에서 과거의 자신에게 전하고 싶은 한 마디 질문
- **저장 변수**: `{future_message}`
- **특이사항**: 짧은 답변도 정상 처리 (too_short 검증 제외)

### Step 7: 사진 업로드 (선택)
- **입력 UI**: 업로드 버튼 + 건너뛰기 버튼
- **AI 기자 (동적 생성)**: 인터뷰 마무리 + 사진 업로드 안내 + AI 이미지 생성 안내
- **저장 변수**: `{photo_uploaded}` (boolean), `{photo}` (dataURL)

---

## 4. AI 기자 질문 동적 생성 (`get-reaction` API)

**엔드포인트**: `POST /api/get-reaction`

### 4.1 요청 파라미터

| 파라미터 | 설명 |
|----------|------|
| `stepId` | 현재 단계 ID |
| `answer` | 사용자 답변 |
| `interviewData` | 지금까지 수집된 인터뷰 데이터 전체 |
| `nextStep` | 다음 단계 정보 (guide 포함) |
| `lastAiQuestion` | 프론트엔드에서 전달하는 직전 AI 질문 텍스트 (검증 컨텍스트용) |

### 4.2 처리 흐름 (3단계)

```
① Moderation API (모든 textarea 단계 + name 단계)
   욕설·약물·폭력·혐오 등 안전 검사
   → flagged 시: proceed: false, reason: "harmful"

② validateAnswer (textarea 단계만, temperature 0.2)
   lastAiQuestion을 컨텍스트로 사용
   - offtopic: 질문과 전혀 무관한 답변
   - profanity: 욕설/비속어
   - nonsense: 무의미한 입력
   - too_short: 지나치게 짧은 답변 (future_message 단계 제외)
   → 검증 실패 시: proceed: false

③ 반응 생성 (temperature 0.9)
   검증 통과 후 AI 기자 메시지 생성
   → proceed: true
```

### 4.3 AI 기자 말투 규칙 (반응 생성 프롬프트)

- **톤**: 친근하지만 전문적인 인터뷰 기자
- **구조**: 답변 핵심 요약 → 다음 질문 (2~3문장)
- **금지**: 과도한 칭찬(멋집니다, 대단합니다), 응원·격려·동기부여 톤
- **시제**: `{goal_date}`를 현재로, `{goal_date}` 이후 암시 표현("앞으로" 등) 금지
- **예외 — Step 4 진입 시**: 추임새 없이 바로 질문 시작 (1~2문장)

### 4.4 응답 형식

```json
{
  "message": "AI 기자 메시지",
  "example": "입력 예시 (textarea 단계만, 그 외 빈 문자열)",
  "proceed": true,
  "reason": "normal"
}
```

검증 실패 시:
```json
{
  "message": "재입력 안내 메시지",
  "example": "",
  "proceed": false,
  "reason": "harmful" | "offtopic" | "profanity" | "nonsense" | "too_short"
}
```

### 4.5 재시도 / 취소 정책

- `proceed: false` 수신 시 현재 단계 유지, `retryCount` 증가
- 3회 연속 실패 시 **"인터뷰 취소"** 버튼 표시 (`onBack()` 호출)
- 재시도 성공 시 카운트 초기화

---

## 5. 기사 생성 (`generate-article` API)

**엔드포인트**: `POST /api/generate-article`

### 5.1 템플릿 분류 (4종)

사용자가 Step 2에서 직접 선택한 카테고리를 우선 사용. 미선택 시 `{role_details}` + `{past_and_hardship}` 키워드 자동 분류.

| 템플릿 | 분야 | 스타일 |
|--------|------|--------|
| Type A | 사업/경제 | 정통 경제지 스타일. 성과 수치, 시장 영향력, 리더십 강조 |
| Type B | IT/기술 | 트렌디 테크 잡지 스타일. 혁신성, 기술적 도전, 업계 변화 강조 |
| Type C | 취업/커리어 | 커리어 매거진 스타일. 직업적 성장, 노력 과정, 전문성 강조 |
| Type D | 학업/개인성취 | 라이프스타일 매거진 스타일. 꿈과 도전, 성장 과정, 감동적 변화 강조 |

### 5.2 기사 구성

| 필드 | 내용 |
|------|------|
| `title` | 실제 신문 1면 헤드라인 스타일 |
| `subtitle` | 핵심 메시지 1~2문장 (인용구 스타일) |
| `byline` | "AI 기자 \| {goal_date}" |
| `호칭` | 인터뷰 내용에서 가장 자연스러운 직함을 추론해 사용 (예: 대표, CEO, 개발자, CTO, 팀장, 작가 등). 직함 특정이 어려우면 "씨" 사용. 기사 전체에서 일관되게 사용 |
| `paragraphs` | 5개 문단: 현재 성과 → 과거 준비 → 힘들었던 순간 → 극복 과정 → 과거 자신에게 전하는 말 |
| `image_prompt` | Stable Diffusion용 영어 프롬프트 (40~50단어, 직업·성과·배경·분위기 포함) |
| `template_type` | A/B/C/D |

### 5.3 사진 처리

- **업로드 시**: GPT-4o-mini vision으로 사진 분석 (인물·배경·분위기 2~3문장 묘사) → 기사 프롬프트에 반영
- **미업로드 시**: `image_prompt`를 Stable Diffusion XL로 전달해 AI 이미지 생성

---

## 6. AI 이미지 생성 (`generate-image` API)

**엔드포인트**: `POST /api/generate-image`

- **엔진**: Cloudflare Workers AI — `@cf/stabilityai/stable-diffusion-xl-base-1.0`
- **생성 위치**: 기사 헤더(header)와 본문 중간(body) 각 1장
- **프롬프트 구성**: `{image_prompt}` + 템플릿별 스타일 힌트 + 구도 힌트

| 구분 | 스타일 힌트 |
|------|------------|
| A | newspaper editorial style, cinematic lighting, corporate atmosphere |
| B | tech magazine style, vibrant colors, futuristic workspace |
| C | career success, professional confidence, warm studio lighting |
| D | personal achievement, joyful celebration, warm natural lighting |

---

## 7. 기사 화면 (ArticleScreen)

템플릿별 독립적인 비주얼 디자인:

| 템플릿 | 태그 | 컬러 테마 |
|--------|------|-----------|
| A | (없음) | 흑백 신문 스타일 |
| B | Tech Interview | 다크 + 블루 그라디언트 |
| C | Future Story | 웜 그라디언트 |
| D | Growth Story | 그린 그라디언트 |

---

## 8. UX 특징

1. **인터뷰 시제 프레이밍**: AI 기자와 사용자 모두 `{goal_date}` 시점에 있음. 과거가 아닌 현재 시제로 진행
2. **SNS 채팅형 레이아웃**: 말풍선 + 타이핑 애니메이션 (점 3개)
3. **AI 반응 + 질문 통합**: 답변 핵심 요약 → 다음 질문을 하나의 메시지로 (칭찬·감탄 없는 기자 톤)
4. **카테고리별 맞춤 기자 페르소나**: Step 3에서 담당 부서 소개 (경제부/IT부/커리어부/문화부), Step 4부터 카테고리별 질문 관점 차별화
5. **스마트 이름 파싱**: "저는 홍길동 입니다" → "홍길동" 자동 추출
6. **유연한 날짜 입력**: 년도 필수, 월/일 미선택 시 오늘 날짜 자동 적용
7. **입력 예시 제공**: textarea 단계에서 맥락 반영한 구체적 입력 예시 표시
8. **2단계 답변 검증**: Moderation API(안전) + GPT-4o-mini(의미) 조합. 3회 실패 시 인터뷰 취소 버튼
9. **기사 작성 자동화**: 4종 템플릿 자동 분류 + AI 이미지 생성

---

## 9. API 엔드포인트 요약

| 엔드포인트 | 역할 | 사용 모델 |
|-----------|------|-----------|
| `POST /api/get-reaction` | 답변 검증 + 인터뷰 AI 반응 + 다음 질문 생성 | Moderation API + GPT-4o-mini |
| `POST /api/generate-article` | 기사 전문 생성 | GPT-4o-mini |
| `POST /api/generate-image` | AI 이미지 생성 | Stable Diffusion XL |

---

## 10. 환경 변수

| 변수 | 용도 |
|------|------|
| `OPENAI_API_KEY` | Moderation API + GPT-4o-mini 호출 |
| `AI` (Cloudflare binding) | Workers AI (Stable Diffusion) |

---

## 11. 수집 데이터 변수 현황

| 변수명 | 단계 | 설명 |
|--------|------|------|
| `name` | Step 1 | 이름/닉네임 |
| `category` | Step 2 | 카테고리 (A/B/C/D) |
| `goal_date` | Step 3 | 목표 달성 날짜 (한국어 형식) |
| `role_details` | Step 4 | 현재 상태 및 성과 |
| `past_and_hardship` | Step 5 | 과거 상황 + 힘든 순간 + 극복한 힘 (통합) |
| `future_message` | Step 6 | 과거 자신에게 한 마디 |
| `photo_uploaded` | Step 7 | 사진 업로드 여부 (boolean) |
| `photo` | Step 7 | 사진 dataURL (업로드 시) |
