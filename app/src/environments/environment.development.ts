/** Local development runs the real auth guards; screen review can use the explicit preview button. */
export const environment = {
  storageKey: 'tc.trips.v1',
  isTest: false,
  designPreview: false,
  mapProvider: 'kakao' as 'kakao' | 'fixture',
};
