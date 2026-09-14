# 로컬 LLM 연결 가이드

2026-09-10 작성. 사용자 제공 사양은 Windows 11, RTX 3090 24GB, i5-13600KF, RAM 64GB다. 이 문서는 설치·연결 절차와 기존 AI 설계의 실행 후보를 정리한다. 해당 PC의 설치 상태·접속 주소·실제 생성 성능은 아직 확인하지 않았다. 현재 AI 화면의 `generate()`는 고정 샘플을 표시하며 실제 호출 서버는 미구현이다.

## 실행 후보와 비용

첫 검증은 **Ollama + `qwen3.5:9b`**를 권장한다. Ollama 공식 목록의 모델 파일은 약 6.6GB다. RTX 3090 24GB에서 모델 외 실행 메모리를 확보하기 위한 출발점이며, 한국어 일정 품질이나 응답 시간을 실측한 추천은 아니다. 품질 비교 후보는 `qwen3.5:27b`(약 17GB)다. 파일 크기와 실제 VRAM 사용량은 다르며 문맥 길이와 동시 요청 수에 따라 메모리가 증가한다. 35B 기본 태그는 파일만 약 24GB여서 첫 검증 대상으로 삼지 않는다. [공식 모델 목록](https://ollama.com/library/qwen3.5)

로컬 Ollama API는 제공자 API 키 없이 호출한다. 로컬 모델 실행에는 외부 AI의 토큰별 API 요금이 없지만 PC 전기료는 발생한다. 지도·검색·향후 서버/DB 비용은 별도다. 클라우드 모델 태그나 유료 API로 자동 전환하지 않는다. [인증 안내](https://docs.ollama.com/api/authentication)

## 3090 PC에서 먼저 할 일

1. [공식 Windows 설치 안내](https://docs.ollama.com/windows)에 따라 Ollama를 설치한다. Windows에서 NVIDIA GPU를 지원하며 설치 안내의 드라이버 요구사항을 확인한다.
2. Windows 사용자 환경변수에 `OLLAMA_NO_CLOUD=1`을 추가하고 트레이의 Ollama를 완전히 종료한 뒤 시작 메뉴에서 다시 실행한다. 이는 Ollama의 클라우드 모델·웹 검색 기능을 끄는 설정이다. [공식 설정 안내](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features)
3. 새 PowerShell 창에서 모델을 받는다.

```powershell
ollama pull qwen3.5:9b
ollama list
```

4. 아래 요청으로 **그 PC 자체에서** 실제 API 응답을 확인한다. `num_ctx=8192`와 추론 출력 비활성화는 첫 검사 설정이며 일정 전체 품질 검증을 대신하지 않는다. UTF-8 바이트로 보내 Windows PowerShell에서도 한국어 입력을 보존한다.

```powershell
$llmProbeJson = @{
    model = 'qwen3.5:9b'
    messages = @(@{
        role = 'user'
        content = '한국어로 한 문장만 답하세요: 여행 일정 초안 작성을 도울 준비가 되었나요?'
    })
    stream = $false
    think = $false
    options = @{ num_ctx = 8192; num_predict = 256 }
} | ConvertTo-Json -Depth 6

$llmProbeResponse = Invoke-RestMethod `
    -Uri 'http://127.0.0.1:11434/api/chat' `
    -Method Post `
    -ContentType 'application/json; charset=utf-8' `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($llmProbeJson)) `
    -TimeoutSec 180

$llmProbeResponse.message.content
ollama ps
```

실제 답변과 `ollama ps`의 PROCESSOR 값을 확인한다. `100% GPU`는 모델 전체가 GPU에 올라갔다는 뜻이다. CPU/GPU 혼합이면 다른 GPU 앱 사용량·문맥 설정 등을 확인한다. 호출 실패·빈 응답은 연결 성공으로 기록하지 않는다. [Chat API](https://docs.ollama.com/api/chat), [GPU 적재 확인](https://docs.ollama.com/faq#how-can-i-tell-if-my-model-was-loaded-onto-the-gpu)

## 앱 서버와 연결

기존 ARCHITECTURE.md의 구조를 유지한다.

### 친구 집 PC와 연결하는 구조

2026-09-14 설명 추가. Tailscale을 사설 VPN으로 사용할 때의 구조다. 아래 그림은 연결할 구성을 설명하며 실제 연결 완료를 뜻하지 않는다.

```text
       우리 집                              친구 집
┌─────────────────────┐             ┌─────────────────────┐
│ 내 PC               │             │ 친구 PC (RTX 3090)  │
│                     │             │                     │
│ 여행 앱 화면        │             │ Ollama              │
│ “일정 만들어줘”     │             │ └ Qwen AI 모델      │
│         ↓           │             │   여행 일정 생성    │
│ 여행 앱 서버        │             │                     │
└─────────┬───────────┘             └──────────┬──────────┘
          │                                    │
          │       Tailscale 사설 VPN 연결      │
          ├─────── 일정 생성 요청 ────────────→│
          │←────── AI가 만든 일정 ─────────────┤
          │                                    │
          ↓
   앱 서버에서 결과 검증
          ↓
     앱 화면에 초안 표시
```

- **Tailscale:** 서로 다른 집의 두 PC를 암호화된 사설 네트워크로 연결하는 통로다. AI 모델을 실행하지 않는다. [공식 안내](https://tailscale.com/docs/how-to/quickstart)
- **Ollama:** 친구 PC에서 Qwen 같은 AI 모델을 실행하고 요청을 받는 프로그램이다.
- **Qwen 모델:** 전달받은 여행 조건과 장소 후보를 바탕으로 일정 초안을 생성한다.
- **여행 앱 서버:** VPN을 통해 친구 PC의 Ollama에 요청하고, 응답을 검증해 화면에 전달한다. 브라우저가 Ollama를 직접 호출하지 않는다.

사용 중에는 친구 PC와 Ollama가 켜져 있고 두 PC의 Tailscale이 연결되어 있어야 한다. 친구 PC가 절전 모드에 들어가면 요청을 처리하지 못할 수 있다. VPN 연결만으로 현재 앱의 샘플 AI가 실제 AI로 바뀌지는 않으며, 앱 서버 구현과 실제 생성·선택 저장 검증은 아직 미완료다.

### 실행 위치별 연결 주소

```text
휴대폰 또는 PC 브라우저 → 여행 앱의 AI 서버 → 3090 PC의 Ollama
```

- **앱 서버도 3090 PC에서 실행:** 서버가 `http://127.0.0.1:11434`를 사용한다. 휴대폰이 이 localhost 주소를 직접 호출하지 않는다.
- **앱 서버와 3090 PC가 같은 LAN의 다른 PC:** Ollama의 `OLLAMA_HOST`를 해당 PC의 LAN IP와 포트로 설정하고 재시작한다. Windows 방화벽은 앱 서버의 접속 출처만 허용한다.
- **친구 집 등 서로 다른 네트워크:** 두 서버 PC를 사설 VPN으로 연결하고 Ollama를 VPN 주소에서 접근하게 한다. 공인 IP의 11434 포트 포워딩이나 인증 없는 공개 터널을 기본 연결 방식으로 사용하지 않는다. VPN 제품·주소·접근 권한은 실제 환경 확인 후 설정한다.

Ollama는 기본적으로 `127.0.0.1:11434`에서만 듣는다. `OLLAMA_HOST` 변경 후 재시작이 필요하며 로컬 API에 제공자 인증이 기본으로 없으므로 원격 접근 범위를 함께 설정한다. [네트워크 설정](https://docs.ollama.com/faq#how-can-i-expose-ollama-on-my-network)

앱 서버에는 아래 설정 이름을 사용할 예정이다. **아직 구현된 환경변수 계약이 아니므로 값만 추가해도 현재 화면이 연결되지는 않는다.** 실제 주소는 서버의 로컬 설정에만 기록하고 브라우저 번들에 넣지 않는다.

```dotenv
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434
LOCAL_LLM_MODEL=qwen3.5:9b
```

친구 PC를 사용하는 경우 필요한 정보는 실행 프로그램·버전, 정확한 모델 태그, 앱 서버에서 접근 가능한 사설 주소와 포트, 접속 허용 범위, PC를 켜둘 시간이다. 계정 비밀번호는 필요 없다. 친구 PC로 전달한 여행 입력은 그 PC에서 처리되므로 예약번호·사진 등 생성에 불필요한 개인정보를 요청에 넣지 않는다.

## 앱 구현·검증 기준

기존 OpenSpec tasks 6.5에서 이어서 구현한다. 이 문서 작성이나 Ollama 단독 응답만으로 해당 작업을 완료 처리하지 않는다.

- 서버의 제공자 어댑터가 `/api/chat`을 호출한다. 브라우저 요청이 호출 대상 URL이나 모델을 임의로 바꾸지 못하게 한다. 첫 검증은 동시 생성 1건으로 시작하고 크기·시간 제한과 취소 처리를 둔다.
- 공식 장소 검색으로 얻은 후보의 식별자와 사용자 조건을 입력하고, 모델은 후보의 날짜 배치와 설명을 반환한다. 응답은 JSON Schema로 제한한 뒤 서버에서 별도로 검증한다. [구조화 응답 안내](https://docs.ollama.com/capabilities/structured-outputs)
- 응답의 후보 ID, 날짜 범위, 지역 순서와 숙박 구간을 검사한다. 모델이 만든 좌표·영업시간·예약 가능 여부·이동시간을 검증된 사실로 저장하지 않는다. 현재 카카오 JS 검색과 서버 사이의 후보 전달 계약을 구현 시 구체화한다.
- 검증된 결과를 처음 전체 선택하고 해제한 항목은 담기에서 제외한다. 선택 변경은 LLM 재호출을 유발하지 않는다. 숙소 등록은 체크인/체크아웃을 확인한 초안에 사용자가 적용해야 저장한다.
- PC 꺼짐·연결 실패·잘못된 JSON·시간 초과 시 실패 상태를 표시하고 입력과 기존 여행을 보존한다. 샘플 성공이나 유료 API 결과로 바꾸지 않는다. 수동 일정 편집은 계속 사용할 수 있다.
- 테스트 앱은 외부 호출 없는 제공자로 검증하고 실제 Ollama 검사는 별도로 기록한다. 실제 생성 → 일부 해제 → 선택 항목만 저장, 3박 4일·복수 지역·숙소 조건을 확인한다. 9B/27B 비교 시 모델 태그, Ollama 버전, 문맥 크기, GPU 적재, 첫/반복 요청 시간과 조건 위반 여부를 남긴다.
- Supabase 연결과 Angular 21 리팩터링을 설치 전제조건으로 묶지 않는다. 친구들의 실제 앱 사용 전에는 기존 계획대로 앱 API 접근 제한과 데이터 권한을 검증한다.

## 현재 상태

- 하드웨어 사양: 사용자 제공 정보로 확인.
- 모델 후보·설치 및 연결 절차: 문서 준비.
- 실행 PC 위치·설치 상태·접속 주소: 확인 필요.
- Ollama 설치·모델 다운로드·GPU 적재·API 실응답: 미검증.
- 앱 서버 어댑터·실제 AI 화면 연결·선택 저장 검증: 미완료.
