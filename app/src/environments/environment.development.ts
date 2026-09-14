/** Local development runs the real auth guards; /lab covers screen review without a session. */
export const environment = {
  storageKey: 'tc.trips.v1',
  isTest: false,
  designPreview: false,
  mapProvider: 'kakao' as 'kakao' | 'fixture',
};
