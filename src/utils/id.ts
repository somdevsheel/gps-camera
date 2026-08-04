/**
 * Monotonic, collision-resistant identifier. Uses time prefix so records sort
 * naturally, plus randomness for uniqueness within the same millisecond.
 */
export function createId(prefix = 'cap'): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const rand2 = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${time}_${rand}${rand2}`;
}
