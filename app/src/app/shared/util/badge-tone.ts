/**
 * 배지 색 이름. 컴포넌트가 아니라 순수 계층에 둔다. 어떤 색을 쓸지 고르는 일은
 * 계산이므로 util에서 하는데, 그 코드가 색 이름을 알려고 컴포넌트 파일을
 * 가져오면 계산만 하는 코드가 화면 코드에 묶인다.
 */
export type BadgeTone =
  | 'accent'
  | 'place'
  | 'region'
  | 'stay'
  | 'warn'
  | 'danger'
  | 'ok'
  | 'meal'
  | 'cafe'
  | 'neutral';
