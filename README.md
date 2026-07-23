# Maskit API

문서를 업로드하면 개인정보/블라인드 채용 위반 표현을 탐지하고, 승인된 항목만 마스킹한 안전 사본을 생성하는 백엔드입니다.

- API 명세: [API_SPEC.md](./API_SPEC.md)
- 대화형 문서(Swagger UI): 서버 실행 후 `/api-docs`

## 지원 파일 형식

PDF, DOCX, HWPX, TXT, PNG, JPG/JPEG (최대 20MB).

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
