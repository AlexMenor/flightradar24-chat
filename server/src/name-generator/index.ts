import { adjectives } from "./adjectives";
import { aircrafts } from "./aircrafts";

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

export function generateName() {
  const adjectiveIndex = randomBetween(0, adjectives.length - 1);
  const aircraftIndex = randomBetween(0, aircrafts.length - 1);

  const adjective = adjectives[adjectiveIndex];
  const aircraft = aircrafts[aircraftIndex];

  return `${adjective} ${aircraft}`;
}
