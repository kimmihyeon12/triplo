/**
 * 지도 링크 규칙을 앱으로 가져온다(2026-10-01). 원본은 Edge Function 쪽에 있다.
 * 서버와 앱이 같은 규칙을 쓰는데, Deno가 확장자를 요구해 서버가 앱 코드를 가져오기 어려워 앱이 가져온다.
 * 화면과 어댑터는 이 경로로만 쓴다.
 */
export {
  linkProvider,
  type LinkProvider,
  type LinkedPlace,
} from '../../../../../../supabase/functions/resolve-place/place-link';
