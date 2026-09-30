import { environment } from '../../environments/environment';

/**
 * 여행·가계부를 계정별 서버(Supabase)에 저장하는지. 테스트 앱과 디자인 미리보기는
 * 외부 서버 없이 기기에 저장한다(app.config의 저장소 선택과 같은 조건).
 *
 * 화면 안내는 이 값을 따라야 한다. 서버 저장이 붙은 뒤에도 '이 기기에만 저장'이라고
 * 적혀 있어 실제 동작과 달랐다(2026-09-30 감리 P1-05).
 */
export const SAVES_TO_SERVER = !(environment.isTest || environment.designPreview);
