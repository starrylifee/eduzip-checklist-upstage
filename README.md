# 에듀집 소프트웨어 선정기준 분석기

학습지원 소프트웨어 선정기준 체크리스트를 분석하고 정리하는 웹 도구입니다.

## 기능

- 📁 PDF/HWP 문서 업로드 (다중 파일 지원)
- 🔍 Upstage Document Parse API를 사용한 문서 분석
- 📊 선정기준 체크리스트 자동 추출
- ✏️ 데이터 수동 편집/추가
- 📥 CSV 다운로드 (UTF-8 한글 지원)
- 📋 테이블 복사 (엑셀 붙여넣기 가능)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## 환경 변수 설정

1. `.env.example` 파일을 복사하여 `.env` 파일 생성
2. Upstage API 키 입력

```bash
cp .env.example .env
```

```env
VITE_UPSTAGE_API_KEY=your_api_key_here
```

API 키는 [Upstage 콘솔](https://console.upstage.ai)에서 발급받을 수 있습니다.

## 데이터 양식

| 필드 | 설명 |
|------|------|
| 연번 | 순번 |
| 학습지원 소프트웨어명 | 소프트웨어 이름 |
| 공급자 | 공급 업체 |
| 유형 | 소프트웨어 유형 |
| 주요용도 | 사용 용도 |
| 필수기준 (1-1 ~ 5-3) | 체크리스트 항목 |

## 기술 스택

- HTML5 / CSS3 / JavaScript (ES Modules)
- Vite (빌드 도구)
- Upstage Document Parse API

## 라이선스

MIT License

© 2026 서울신답초등학교 정용석
"# eduzip-checklist-upstage" 
