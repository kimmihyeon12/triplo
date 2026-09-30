/** 로그인 전에도 보는 초대 미리보기. 메모·예약·금액·주소·가계부는 없다. */
export interface InvitePreview {
  /** 지금 로그인한 사람의 역할. 로그인 전이거나 멤버가 아니면 null. */
  myRole?: 'owner' | 'editor' | null;
  title: string;
  startDate: string | null;
  endDate: string | null;
  ownerNickname: string;
  regions: { id: string; name: string; order: number }[];
  stops: {
    name: string;
    kind: string;
    date: string | null;
    order: number;
    fixedTime: string | null;
    regionId: string | null;
  }[];
  stays: { name: string; checkIn: string; checkOut: string }[];
}
