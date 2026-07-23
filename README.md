# Maskit API

문서를 업로드하면 개인정보/블라인드 채용 위반 표현을 탐지하고, 승인된 항목만 마스킹한 안전 사본을 생성하는 백엔드입니다.

- API 명세: [API_SPEC.md](./API_SPEC.md)
- 대화형 문서(Swagger UI): 서버 실행 후 `/api-docs`

## 지원 파일 형식

PDF, DOCX, HWPX, TXT, PNG, JPG/JPEG (최대 20MB). **구버전 HWP(바이너리 포맷)는 미지원**입니다 — HWPX(한글 2014+)만 지원합니다.

## 로컬 실행

```bash
npm install
cp .env.example .env   # GROQ_API_KEY 채우기 (https://console.groq.com/keys 무료 발급)
npm run dev            # http://localhost:3000
```

## 빌드/실행

```bash
npm run build
npm run start
```

## 프로덕션 배포 (GitHub Actions CD)

`main`에 push하면 `.github/workflows/deploy.yml`이 자동으로:

1. bastion에 SSH 접속 (SSH 전용, 22번 포트만 사용)
2. bastion을 경유해 ALB 뒤 웹서버 EC2 인스턴스 2대 각각에 접속
3. 각 인스턴스에서 `git clone`(최초) 또는 `git pull`, `.env`의 `GROQ_API_KEY` 동기화, `npm ci`, `npm run build`
4. `pm2`로 프로세스 (재)시작 + `pm2 save`
5. 서버 내부에서 `/health` 호출로 기동 확인

필요한 GitHub Secrets:

| Secret | 설명 |
| --- | --- |
| `BASTION_HOST` / `BASTION_USER` / `BASTION_SSH_KEY` | bastion 접속 정보 |
| `WEBSERVER_HOST` / `WEBSERVER_2_HOST` | 웹서버 EC2 인스턴스 2대의 사설 IP |
| `WEBSERVER_USER` / `WEBSERVER_KEY_PATH` | 웹서버 SSH 사용자 및 pem 키 경로 (bastion 안에 이미 있는 키 경로, 두 인스턴스 공용) |
| `GROQ_API_KEY` | Groq API 키 — 배포 시 각 인스턴스의 `.env`에 자동 반영 |

인스턴스 앞에는 ALB(HTTP/HTTPS)가 있고, EC2 보안그룹은 ALB 보안그룹을 소스로 하는 3000번 포트만 허용합니다.

### Docker (선택)

```bash
docker build -t maskit-api .
docker run -p 3000:3000 --env-file .env maskit-api
```

현재 운영 배포는 위 GitHub Actions 경로를 사용하며, Dockerfile은 별도 컨테이너 환경에 배포하고 싶을 때를 위한 대안입니다.

## 알려진 제약

- **⚠️ 세션 저장소가 인메모리라 인스턴스 간 공유가 안 됩니다.** 지금 ALB 뒤에 인스턴스가 2대라서, 업로드(`POST /scans`)와 후속 요청(수정/사본생성/삭제)이 서로 다른 인스턴스로 라우팅되면 `SCAN_NOT_FOUND`가 발생할 수 있습니다. 완전히 고치려면 세션을 Redis 등 공유 저장소로 옮기거나, ALB에 sticky session(같은 클라이언트를 항상 같은 인스턴스로 라우팅)을 설정해야 합니다.
- **안전 사본(PDF/DOCX)은 원본 레이아웃을 보존하지 않고**, 마스킹이 반영된 텍스트를 새 문서로 재구성합니다.
- **HWPX 파싱은 기본적인 텍스트 런 추출만** 지원합니다 (표/이미지 등 복잡한 구조는 텍스트만 추출됨). 구버전 HWP는 아예 미지원.
- **이미지 OCR(tesseract.js)은 최초 호출 시 언어 데이터를 온라인에서 내려받습니다.** 배포 환경이 아웃바운드 네트워크를 허용해야 합니다.
- Groq(LLM) 기반 탐지는 원문과 정확히 일치하는 문자열만 위치를 찾아 마스킹할 수 있어, 모델이 원문을 그대로 인용하지 않고 바꿔 말한 항목은 결과에서 제외됩니다.
- 접근권한 분리(기능별 최소 권한)와 텍스트 직접 입력(파일 없이) API는 아직 없습니다.
