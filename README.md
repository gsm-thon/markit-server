# Maskit API

민감 문구/개인정보를 탐지하고 안전 사본을 생성하는 백엔드. API 명세는 [API_SPEC.md](./API_SPEC.md) 참고.

## 로컬 실행

```bash
npm install
cp .env.example .env   # GROQ_API_KEY 채우기 (https://console.groq.com/keys 무료 발급)
npm run dev            # http://localhost:3000
```

## 빌드/배포

```bash
npm run build
npm run start
```

### Docker

```bash
docker build -t maskit-api .
docker run -p 3000:3000 --env-file .env maskit-api
```

Render/Railway/Fly.io 등에 배포 시: 이 저장소를 연결하고 `GROQ_API_KEY` 환경변수만 설정하면 Dockerfile을 그대로 사용해 배포됩니다.

## 알려진 제약 (MVP 범위)

- **세션 저장소가 메모리 기반**입니다. 인스턴스를 1개만 띄우는 배포에서만 정상 동작하며, 재시작 시 세션이 초기화됩니다. 여러 인스턴스로 스케일하려면 Redis 등 외부 저장소로 교체가 필요합니다.
- **안전 사본(PDF/DOCX)은 원본 레이아웃을 보존하지 않고**, 마스킹이 반영된 텍스트를 새 문서로 재구성합니다.
- **HWPX 파싱은 기본적인 텍스트 런 추출**만 지원합니다 (표/이미지 등 복잡한 구조는 텍스트만 추출됨).
- **이미지 OCR(tesseract.js)은 최초 호출 시 언어 데이터를 온라인에서 내려받습니다.** 배포 환경이 아웃바운드 네트워크를 허용해야 합니다.
- Groq(LLM) 기반 탐지는 텍스트 안에서 원문과 정확히 일치하는 부분만 offset을 계산할 수 있어, 모델이 원문과 다르게 바꿔 말한 경우 해당 항목은 결과에서 제외됩니다.
