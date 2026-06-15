import assert from "node:assert/strict";
import test from "node:test";
import {
  autocorrPeriodicity,
  pathCircularity,
  principalExcursion,
  shoelaceArea,
  zeroCrossingFreq,
} from "../src/live/dsp";
import type { Pt } from "../src/live/types";

const fps = 30;

test("autocorrPeriodicity: strong on a sinusoid, near-zero on noise", () => {
  const sine = Array.from({ length: 45 }, (_, i) => Math.sin((2 * Math.PI * 2.5 * i) / fps));
  const r = autocorrPeriodicity(sine, fps);
  assert.ok(r.periodicity > 0.7, `periodicity ${r.periodicity}`);
  assert.ok(Math.abs(r.freqHz - 2.5) < 0.6, `freq ${r.freqHz}`);

  let s = 1;
  const noise = Array.from({ length: 45 }, () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 2 ** 32 - 0.5;
  });
  assert.ok(autocorrPeriodicity(noise, fps).periodicity < 0.5);
});

test("pathCircularity: ~1 on a circle, ~0 on a line", () => {
  const circle: Pt[] = Array.from({ length: 40 }, (_, i) => ({
    x: Math.cos((2 * Math.PI * i) / 40),
    y: Math.sin((2 * Math.PI * i) / 40),
    z: 0,
  }));
  assert.ok(pathCircularity(circle) > 0.85, `circle ${pathCircularity(circle)}`);
  const line: Pt[] = Array.from({ length: 40 }, (_, i) => ({ x: 0, y: i / 40, z: 0 }));
  assert.ok(pathCircularity(line) < 0.05, `line ${pathCircularity(line)}`);
});

test("principalExcursion: line is anisotropic, circle is isotropic", () => {
  const line: Pt[] = Array.from({ length: 30 }, (_, i) => ({ x: 0, y: i / 10, z: 0 }));
  const eLine = principalExcursion(line);
  assert.ok(eLine.ratio < 0.1, `line ratio ${eLine.ratio}`);
  assert.ok(Math.abs(Math.abs(Math.sin(eLine.angle)) - 1) < 0.05, "line dominant axis is vertical");

  const circle: Pt[] = Array.from({ length: 40 }, (_, i) => ({
    x: Math.cos((2 * Math.PI * i) / 40),
    y: Math.sin((2 * Math.PI * i) / 40),
    z: 0,
  }));
  assert.ok(principalExcursion(circle).ratio > 0.8, "circle ratio near 1");
});

test("shoelaceArea ~ πr² on a unit circle; zeroCrossingFreq recovers frequency", () => {
  const circle: Pt[] = Array.from({ length: 200 }, (_, i) => ({
    x: Math.cos((2 * Math.PI * i) / 200),
    y: Math.sin((2 * Math.PI * i) / 200),
    z: 0,
  }));
  assert.ok(Math.abs(Math.abs(shoelaceArea(circle)) - Math.PI) < 0.05);
  const sine = Array.from({ length: 60 }, (_, i) => Math.sin((2 * Math.PI * 3 * i) / fps));
  assert.ok(Math.abs(zeroCrossingFreq(sine, fps) - 3) < 0.6);
});
