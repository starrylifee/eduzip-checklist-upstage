# 에듀집 소프트웨어 선정기준 분석기

학습지원 소프트웨어 선정기준 체크리스트를 분석하고 정리하는 웹 도구입니다.

## 기능

- 📁 PDF/HWP 문서 업로드 (다중 파일 지원)
- 🔍 Upstage Document Parse API를 사용한 문서 분석
- 📊 선정기준 체크리스트 자동 추출
- ✏️ 데이터 수동 편집/추가
- 📥 CSV 다운로드 (UTF-8 한글 지원)
- 📋 테이블 복사 (엑셀 붙여넣기 가능)

## 데이터 양식

| 필드 | 설명 |
|------|------|
| 연번 | 순번 |
| 학습지원 소프트웨어명 | 소프트웨어 이름 |
| 공급자 | 공급 업체 |
| 유형 | 소프트웨어 유형 |
| 주요용도 | 사용 용도 |
| 필수기준 (1-1 ~ 5-3) | 체크리스트 항목 |

## 사용 방법

### 1. API 키 설정

1. [Upstage 콘솔](https://console.upstage.ai)에서 API 키를 발급받습니다.
2. 웹앱에서 ⚙️ 설정 버튼을 클릭합니다.
3. API 키를 입력하고 저장합니다.

### 2. 문서 분석

1. PDF 또는 HWP 파일을 드래그 앤 드롭하거나 클릭하여 업로드합니다.
2. "문서 분석 시작" 버튼을 클릭합니다.
3. 분석 결과를 확인하고 필요시 편집합니다.

### 3. 데이터 내보내기

- **CSV 다운로드**: UTF-8 인코딩 CSV 파일로 저장
- **테이블 복사**: 클립보드에 복사 후 엑셀에 붙여넣기

## 로컬 실행

```bash
# Python 사용
python -m http.server 8080

# 또는 Node.js 사용
npx serve
```

브라우저에서 `http://localhost:8080` 접속

## 기술 스택

- HTML5
- CSS3 (Vanilla CSS)
- JavaScript (Vanilla JS)
- Upstage Document Parse API

## 라이선스

MIT License
"# eduzip-checklist-upstage" 
