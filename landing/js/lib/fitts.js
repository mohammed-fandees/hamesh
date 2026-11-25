/**
 * How long a hand takes to reach something: Fitts's law. The time grows with
 * the logarithm of the distance relative to the size of the target, which is
 * why a long sweep is not proportionally slower than a short hop.
 */

const REACTION = 0.16;
const PER_BIT = 0.1;
const DEFAULT_WIDTH = 24;

/** Seconds to travel `distance` pixels onto a target `width` pixels wide. */
export function travelTime(distance, width = DEFAULT_WIDTH) {
  return REACTION + PER_BIT * Math.log2(1 + distance / width);
}
