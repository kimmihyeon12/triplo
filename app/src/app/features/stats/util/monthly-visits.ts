/** Counts the recorded trip end month, not an inferred actual visit date. */
export function monthlyVisits(places: readonly { visitedOn: string }[], year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    return { month: index + 1, count: places.filter(place => place.visitedOn.slice(0, 7) === month).length };
  });
}
