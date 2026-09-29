import type { StopKind, Trip } from '../../trips/model/trip';
import { createStay, createStop, createTrip } from '../../trips/util/factories';
import type { InvitePreview } from '../data/trip-members-repository';

const KINDS: readonly StopKind[] = ['place', 'meal', 'break', 'buffer'];

/**
 * 초대 미리보기를 일정 카드가 그릴 수 있는 여행 모양으로 바꾼다. 미리보기에는
 * 메모·예약·주소·좌표가 없으므로 빈 값으로 채운다. 저장하지 않는 화면용 값이다.
 */
export function tripFromPreview(preview: InvitePreview): Trip {
  return createTrip({
    id: 'preview',
    title: preview.title,
    startDate: preview.startDate,
    endDate: preview.endDate,
    regions: preview.regions.map((r) => ({ id: r.id, name: r.name, order: r.order })),
    stops: preview.stops.map((s, i) =>
      createStop({
        id: `preview-stop-${i}`,
        name: s.name,
        kind: KINDS.includes(s.kind as StopKind) ? (s.kind as StopKind) : 'place',
        date: s.date,
        order: s.order,
        fixedTime: s.fixedTime,
        regionId: s.regionId,
      }),
    ),
    stays: preview.stays.map((s, i) =>
      createStay({ id: `preview-stay-${i}`, name: s.name, checkIn: s.checkIn, checkOut: s.checkOut }),
    ),
  });
}
