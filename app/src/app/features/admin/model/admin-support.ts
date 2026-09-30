import type { Inquiry } from '../../support/model/support';

/** 관리자가 보는 문의. 보낸 사람은 서버가 채운 닉네임으로만 보인다. 이메일은 쓰지 않는다. */
export interface AdminInquiry extends Inquiry {
  senderNickname: string;
}

/** 서버 clean_text의 상한과 같은 값. */
export const NOTICE_TITLE_MAX = 100;
export const NOTICE_BODY_MAX = 5000;
export const REPLY_BODY_MAX = 2000;
