# 하루네컷

짧은 일기를 4컷 만화로 바꿔 저장하고 공유하는 모바일 우선 MVP입니다.

현재 생성 파이프라인은 기본 Codex 경로와 외부 이미지 API 경로를 함께 지원합니다.

- `codex-scene`: Codex CLI가 4컷 스크립트와 `scene JSON`을 만들고, 서버가 이를 바탕으로 PNG 컷을 합성합니다.
- `gemini-image`: Gemini 텍스트 모델이 4컷 스크립트를 만들고, Gemini 이미지 모델로 실제 컷 이미지를 생성합니다.
- `openai-image` / `sora`: Codex CLI가 컷 설계를 만들고, OpenAI 이미지 또는 Sora 썸네일 생성으로 연결합니다.

## 현재 지원하는 백엔드

- 기본값: `codex-scene`
- 대체 API 백엔드: `gemini-image`, `openai-image`, `sora`
- 테스트/개발용: `mock`
- Gemini 별칭: `gemini`, `nano-banana`, `nano-banana-2`, `nano-banana-pro`

참고:

- 현재 문서와 `.env.example`에 포함된 대체 API는 **실제로 코드에서 지원하는 값만** 적어둡니다.
- `midjourney` 같은 이름은 아직 내장 백엔드로 구현되어 있지 않습니다.
- 나노 바나나 계열(`nano-banana*`)은 Gemini 이미지 경로의 별칭입니다.

## 실행 방법

GitHub에서 받아와 처음 설치하는 순서:

```bash
git clone https://github.com/krnomad/harunecut.git
cd harunecut
npm install
cp .env.example .env.local
```

그 다음 원하는 백엔드에 맞게 `.env.local`을 수정하고 실행합니다.

```bash
npm run dev
```

직접 현재 폴더에서 바로 실행만 할 경우:

```bash
npm run dev
```

특정 포트로 로컬 실행하려면 `run.sh`를 쓰는 것이 가장 간단합니다.

```bash
chmod +x run.sh
WEB_PORT=4099 API_PORT=5174 ./run.sh
```

위 명령은 다음처럼 동작합니다.

- 웹 앱: `http://localhost:4099`
- 로컬 API: `http://localhost:5174/api/health`
- 웹 앱은 `/api`, `/generated` 요청을 `5174`로 프록시합니다.

직접 명령으로 실행하고 싶다면 아래처럼 나눠서 실행할 수도 있습니다.

```bash
PORT=5174 npm run dev:api
VITE_API_PORT=5174 npx vite --host 0.0.0.0 --port 4099
```

기본 접속 주소:

- 웹 앱: [http://localhost:4173](http://localhost:4173)
- 로컬 API: [http://localhost:4174/api/health](http://localhost:4174/api/health)

## 권장 기본값

API 키 없이 바로 테스트하려면 `codex-scene`이 가장 좋습니다.

특징:

- 외부 이미지 API 키가 없어도 동작합니다.
- SVG 직출력 대신 `scene JSON -> PNG 합성`이라 이전보다 컷 정보량이 많습니다.
- 생성물은 `server-data/generations/<jobId>/media/` 아래에 저장됩니다.

`.env.local` 예시:

```dotenv
MEDIA_BACKEND=codex-scene
CODEX_MODEL=gpt-5.3-codex-spark
CODEX_REASONING_EFFORT=low
```

## 빠른 설정 예시

### 1. 기본 로컬 모드 (`codex-scene`)

외부 이미지 API 키 없이 가장 빨리 확인할 때 권장합니다.

```dotenv
MEDIA_BACKEND=codex-scene
CODEX_MODEL=gpt-5.3-codex-spark
CODEX_REASONING_EFFORT=low
```

### 2. Gemini / Nano Banana 이미지 모드

현재 나노 바나나 계열 API 구매 후 실제 이미지 생성까지 확인한 경로입니다.

```dotenv
MEDIA_BACKEND=gemini-image
GEMINI_API_KEY=your_key_here
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
GEMINI_IMAGE_ASPECT_RATIO=1:1
GEMINI_IMAGE_SIZE=2K
```

별칭을 쓰려면 다음처럼 둘 수도 있습니다.

```dotenv
MEDIA_BACKEND=nano-banana
GEMINI_API_KEY=your_key_here
GEMINI_TEXT_MODEL=gemini-2.5-flash
```

### 3. OpenAI 이미지 모드

```dotenv
MEDIA_BACKEND=openai-image
OPENAI_API_KEY=your_key_here
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_IMAGE_SIZE=1024x1536
```

### 4. Sora 썸네일 모드

```dotenv
MEDIA_BACKEND=sora
OPENAI_API_KEY=your_key_here
OPENAI_VIDEO_MODEL=sora-2
OPENAI_VIDEO_SECONDS=4
OPENAI_VIDEO_SIZE=720x1280
```

## 환경 변수 가이드

앱은 `.env.local`을 우선 읽습니다. 아래 예시를 복사해 시작하는 것을 권장합니다.

```dotenv
MEDIA_BACKEND=codex-scene

CODEX_MODEL=gpt-5.3-codex-spark
CODEX_REASONING_EFFORT=low

GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
GEMINI_IMAGE_ASPECT_RATIO=1:1
GEMINI_IMAGE_SIZE=2K
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_VIDEO_MODEL=sora-2
OPENAI_VIDEO_SECONDS=4
OPENAI_VIDEO_SIZE=720x1280
OPENAI_IMAGE_SIZE=1024x1536
```

### 공통

- `MEDIA_BACKEND`
  - 추천값: `codex-scene`
  - 지원값: `codex-scene`, `mock`, `gemini-image`, `openai-image`, `sora`
  - 별칭도 지원합니다: `codex`, `codex-png`, `codex-svg`, `svg`, `gemini`, `nano-banana`, `nano-banana-2`, `nano-banana-pro`
- `OPENAI_MEDIA_BACKEND`
  - 예전 호환용입니다.
  - 가능하면 `MEDIA_BACKEND`를 사용하세요.

### 개발 포트 설정

- `PORT`
  - 서버 API 포트로 사용합니다.
  - 기본값: `4174`
- `API_PORT`
  - `run.sh`에서 API 포트를 지정할 때 쓰는 셸 변수입니다.
  - 내부적으로 `PORT`로 전달됩니다.
- `VITE_API_PORT`
  - 프런트 dev 서버가 프록시할 API 대상 포트입니다.
  - 기본값: `4174`
- `WEB_PORT`
  - `run.sh`에서 웹 포트를 지정할 때 쓰는 셸 변수입니다.
  - 기본값: `4173`
- 웹 dev 서버 포트를 바꾸고 싶다면 `npm run dev:web -- --port 4099`처럼 실행 인자로 덮어쓰는 것이 가장 확실합니다.

### Codex 설정

- `CODEX_MODEL`
  - 기본값: `gpt-5.3-codex-spark`
  - 장면 JSON 설계 속도를 우선할 때 적합합니다.
- `CODEX_REASONING_EFFORT`
  - 기본값: `low`
  - 너무 높게 잡으면 생성 화면에서 오래 멈춘 것처럼 보일 수 있습니다.

## Gemini / Nano Banana 설정

Gemini를 쓰려면 최소한 `GEMINI_API_KEY`가 필요합니다.

- `GEMINI_TEXT_MODEL`
  - 기본값: `gemini-2.5-flash`
  - 4컷 스크립트 JSON 생성을 담당합니다.
- `GEMINI_IMAGE_MODEL`
  - 기본값: `gemini-3.1-flash-image-preview`
  - 실제 컷 이미지 생성을 담당합니다.

가장 간단한 예시:

```dotenv
MEDIA_BACKEND=gemini-image
GEMINI_API_KEY=your_key_here
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
GEMINI_IMAGE_ASPECT_RATIO=1:1
GEMINI_IMAGE_SIZE=2K
```

자주 쓰는 모델:

- `gemini-3.1-flash-image-preview`: Nano Banana 2
- `gemini-2.5-flash-image`: Nano Banana
- `gemini-3-pro-image-preview`: Nano Banana Pro

별칭 기반 선택도 가능합니다.

```dotenv
MEDIA_BACKEND=nano-banana
GEMINI_API_KEY=your_key_here
```

이 경우 `GEMINI_IMAGE_MODEL`을 따로 지정하지 않으면 기본적으로 `gemini-2.5-flash-image`를 사용합니다.

다른 별칭:

- `MEDIA_BACKEND=nano-banana-2` -> `gemini-3.1-flash-image-preview`
- `MEDIA_BACKEND=nano-banana-pro` -> `gemini-3-pro-image-preview`

## OpenAI 설정

OpenAI 이미지 생성으로 테스트하려면:

```dotenv
MEDIA_BACKEND=openai-image
OPENAI_API_KEY=your_key_here
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_IMAGE_SIZE=1024x1536
```

Sora 썸네일 기반 장면 생성으로 테스트하려면:

```dotenv
MEDIA_BACKEND=sora
OPENAI_API_KEY=your_key_here
OPENAI_VIDEO_MODEL=sora-2
OPENAI_VIDEO_SECONDS=4
OPENAI_VIDEO_SIZE=720x1280
```

## 현재 생성 흐름

### 1. `codex-scene`

1. 사용자가 일기를 입력합니다.
2. Codex CLI가 4컷 스크립트와 컷별 `sceneSpec` JSON을 생성합니다.
3. 서버 렌더러가 `sceneSpec`과 감정/팔레트를 바탕으로 PNG 컷을 합성합니다.
4. 결과 화면에서 4컷 시트, 제목, 요약, 편집 UI를 보여줍니다.

### 2. `gemini-image`

1. Gemini 텍스트 모델이 4컷 스크립트와 이미지 프롬프트를 생성합니다.
2. 서버가 Gemini 이미지 모델에 컷별 프롬프트를 전달합니다.
3. Gemini가 반환한 이미지 바이트를 컷 파일로 저장합니다.

### 3. `openai-image` / `sora`

1. Codex CLI가 4컷 스크립트와 컷별 프롬프트를 생성합니다.
2. 서버가 OpenAI 이미지 또는 Sora API에 컷별 요청을 보냅니다.
3. 반환된 이미지/썸네일을 컷 파일로 저장합니다.

## QA 체크 포인트

- 생성 버튼 클릭 후 `/generate`로 이동하는지
- 생성 중 로딩 오버레이가 뜨는지
- 생성 중 다른 메뉴 이동이 막히는지
- 생성 완료 후 `/result`로 자동 전환되는지
- `server-data/generations/<jobId>/media/` 아래에 실제 이미지 파일이 생기는지

## 참고

- 로컬 기본 모드는 `codex-scene`입니다.
- `.env.example`에는 기본값과 대체 API 설정 예시를 함께 적어두었습니다.
- 과거에 생성된 `codex-svg` 결과는 읽을 수 있지만, 새 기본 생성 경로는 PNG 합성입니다.
- 생성 실패 시 원문 텍스트는 프런트 상태와 서버 작업 파일에 그대로 남습니다.
