# 설계: 사진으로 지출 입력

## 흐름

```text
사진 선택 → (선택) 형광펜 칠하기 → 읽기
  → 브라우저가 긴 변 1600px JPEG로 줄이고 형광펜을 사진에 합성
  → receipt-scan Edge Function(로그인 확인·크기 검증) → Gemini 구조화 응답
  → 앱이 응답을 검증해 후보 목록으로 변환
  → 사용자가 확인·수정·체크 → 지출 저장
```

## 결정

**형광펜은 사진에 합성해서 보낸다.** 칠한 좌표를 따로 보내면 모델이 좌표와 글자를 다시 맞춰야 한다. 반투명 노란색을 사진에 그대로 입히고, 요청에 `highlighted: true`를 붙여 서버 지시문이 "칠해진 줄만 읽는다"를 추가하게 한다. 지시문은 서버가 가지므로 브라우저는 이 플래그 하나만 고른다.

**모델 값은 후보일 뿐이다.** AGENTS.md 규칙대로 모델이 읽은 금액을 확인 없이 저장하지 않는다. 후보는 저장 전 목록에서 모두 보이고 고칠 수 있다. 저장한 지출의 메모에 `사진에서 읽음`을 남겨 출처를 구분한다.

**응답 검증은 앱에서 한다.** 금액은 1원 이상 1억 원 이하 정수, 제목은 공백 제거 후 1~40자, 분류는 `EXPENSE_CATEGORIES` 키가 아니면 `other`, 날짜는 실제 달력 날짜가 아니면 빈 값으로 두고 확인 화면에서 여행 첫날로 채운다. 한 장에서 최대 30건만 받는다. 규칙을 어긴 항목은 버리고 몇 건을 뺐는지 알린다.

**합계 줄은 항목에서 뺀다.** 지시문이 "합계·부가세·할인 줄은 항목으로 내지 않는다"를 요구하고, 앱은 영수증 합계(`total`)를 따로 받아 체크한 항목 합과 다르면 안내만 한다.

**분담 기본값.** 결제자는 "나"(`self`), 분담은 정산할 사람 전원 균등. 확인 화면에서 결제자와 개인 지출 여부를 한 번에 바꾼다. 항목별 분담 조정이 필요하면 저장 후 기존 수정 화면을 쓴다.

**사진은 저장하지 않는다.** 이미지 데이터는 요청 본문에만 있고 Edge Function은 기록하지 않는다. 기본 비공개 원칙과 저장 용량 문제를 모두 피한다.

**요청 크기.** base64 기준 6MB를 넘으면 서버가 413 `image_too_large`로 거절한다. 브라우저가 먼저 줄이므로 일반 사진은 1MB 안팎이다. 형식은 JPEG·PNG·WebP만 받는다.

## 구성

| 파일 | 역할 |
| --- | --- |
| `supabase/functions/receipt-scan/handler.ts` | 인증·입력 검증·오류 코드. 앱 테스트에서 그대로 검증 |
| `supabase/functions/receipt-scan/prompt.ts` | 지시문·응답 스키마 |
| `supabase/functions/receipt-scan/index.ts` | Gemini 호출 |
| `app/.../expenses/data/receipt-scanner.ts` | `RECEIPT_SCANNER` 토큰과 인터페이스 |
| `app/.../expenses/data/edge-receipt-scanner.ts` | Edge Function 호출 |
| `app/.../expenses/data/fixture-receipt-scanner.ts` | 테스트 앱 고정 응답 |
| `app/.../expenses/util/receipt.ts` | 응답 검증·지출 변환 |
| `app/.../expenses/util/image.ts` | 축소·형광펜 합성 |
| `app/.../expenses/ui/receipt-scan/` | 사진·형광펜·확인 화면 |
