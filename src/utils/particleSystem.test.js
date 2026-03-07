/**
 * WindParticleSystem unit tests.
 *
 * Tests setWind velocity calculations, particle spawn/lifecycle,
 * start/stop lifecycle, and edge cases.
 * Canvas rendering is mocked since jsdom has no real canvas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WindParticleSystem } from './particleSystem.js';

// ---------------------------------------------------------------------------
// Helpers: mock canvas
// ---------------------------------------------------------------------------
function createMockCanvas() {
  const ctx = {
    scale: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
  return {
    getContext: vi.fn(() => ctx),
    width: 0,
    height: 0,
    style: {},
    _ctx: ctx,
  };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------
describe('WindParticleSystem - constructor', () => {
  it('initializes with default state', () => {
    const canvas = createMockCanvas();
    const system = new WindParticleSystem(canvas);

    expect(system.windSpeed).toBe(0);
    expect(system.windFromDeg).toBe(0);
    expect(system.vx).toBe(0);
    expect(system.vy).toBe(0);
    expect(system.running).toBe(false);
    expect(system.particles).toEqual([]);
  });

  it('gets 2d context from canvas', () => {
    const canvas = createMockCanvas();
    new WindParticleSystem(canvas);
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
  });
});

// ---------------------------------------------------------------------------
// setWind
// ---------------------------------------------------------------------------
describe('WindParticleSystem - setWind', () => {
  let system;

  beforeEach(() => {
    system = new WindParticleSystem(createMockCanvas());
  });

  it('updates windSpeed and windFromDeg', () => {
    system.setWind(15, 90);
    expect(system.windSpeed).toBe(15);
    expect(system.windFromDeg).toBe(90);
  });

  it('computes positive vx for eastward wind (wind FROM west, 270)', () => {
    // Wind from west (270) blows TO east (90)
    system.setWind(10, 270);
    expect(system.vx).toBeGreaterThan(0);
    expect(Math.abs(system.vy)).toBeLessThan(0.01);
  });

  it('computes negative vy for northward wind (wind FROM south, 180)', () => {
    // Wind from south (180) blows TO north (0)
    // Canvas y is inverted, so north = negative vy
    system.setWind(10, 180);
    expect(system.vy).toBeLessThan(0);
    expect(Math.abs(system.vx)).toBeLessThan(0.01);
  });

  it('computes positive vy for southward wind (wind FROM north, 0)', () => {
    // Wind from north (0) blows TO south (180)
    system.setWind(10, 0);
    expect(system.vy).toBeGreaterThan(0);
    expect(Math.abs(system.vx)).toBeLessThan(0.01);
  });

  it('scales velocity with wind speed', () => {
    system.setWind(5, 0);
    const slowVy = Math.abs(system.vy);

    system.setWind(20, 0);
    const fastVy = Math.abs(system.vy);

    expect(fastVy).toBeGreaterThan(slowVy);
  });

  it('scales velocity with zoom level', () => {
    system.setWind(10, 0, 11);
    const baseVy = Math.abs(system.vy);

    system.setWind(10, 0, 13);
    const zoomedVy = Math.abs(system.vy);

    // zoom 13 = 2^(13-11) = 4x the base speed
    expect(zoomedVy).toBeCloseTo(baseVy * 4, 5);
  });

  it('adjusts targetActiveCount based on wind speed (quadratic)', () => {
    system.setWind(0, 0);
    const calmCount = system.targetActiveCount;

    system.setWind(15, 0);
    const moderateCount = system.targetActiveCount;

    system.setWind(30, 0);
    const maxCount = system.targetActiveCount;

    expect(calmCount).toBe(50); // MIN_ACTIVE
    expect(maxCount).toBe(500); // MAX_ACTIVE
    expect(moderateCount).toBeGreaterThan(calmCount);
    expect(moderateCount).toBeLessThan(maxCount);
  });

  it('caps targetActiveCount at MAX_ACTIVE for wind > 30 mph', () => {
    system.setWind(50, 0);
    expect(system.targetActiveCount).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// resize
// ---------------------------------------------------------------------------
describe('WindParticleSystem - resize', () => {
  it('sets canvas dimensions with device pixel ratio', () => {
    const canvas = createMockCanvas();
    // Mock devicePixelRatio
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });

    const system = new WindParticleSystem(canvas);
    system.resize(400, 300);

    expect(canvas.width).toBe(800); // 400 * 2
    expect(canvas.height).toBe(600); // 300 * 2
    expect(canvas.style.width).toBe('400px');
    expect(canvas.style.height).toBe('300px');
    expect(system.width).toBe(400);
    expect(system.height).toBe(300);
    expect(canvas._ctx.scale).toHaveBeenCalledWith(2, 2);

    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, writable: true });
  });
});

// ---------------------------------------------------------------------------
// start / stop lifecycle
// ---------------------------------------------------------------------------
describe('WindParticleSystem - lifecycle', () => {
  let system;
  let canvas;

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame and cancelAnimationFrame
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb) => setTimeout(cb, 16)),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id) => clearTimeout(id)),
    );
    vi.stubGlobal('performance', { now: vi.fn(() => Date.now()) });

    canvas = createMockCanvas();
    system = new WindParticleSystem(canvas);
    system.resize(400, 300);
    system.setWind(10, 45);
  });

  afterEach(() => {
    system.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('start() sets running=true and initializes particles', () => {
    system.start();
    expect(system.running).toBe(true);
    expect(system.particles.length).toBe(500); // MAX_PARTICLES pool
  });

  it('start() is idempotent when already running', () => {
    system.start();
    const initialParticles = system.particles;
    system.start(); // should not re-initialize
    expect(system.particles).toBe(initialParticles);
  });

  it('stop() sets running=false and clears canvas', () => {
    system.start();
    system.stop();
    expect(system.running).toBe(false);
    expect(system.rafId).toBeNull();
    expect(canvas._ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 300);
  });

  it('destroy() stops and clears particles', () => {
    system.start();
    system.destroy();
    expect(system.running).toBe(false);
    expect(system.particles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Particle spawning
// ---------------------------------------------------------------------------
describe('WindParticleSystem - particle spawning', () => {
  let system;

  beforeEach(() => {
    system = new WindParticleSystem(createMockCanvas());
    system.resize(400, 300);
  });

  it('spawns particles at bottom edge when wind blows north', () => {
    system.setWind(10, 180); // from south -> blows north (toDeg=0)
    const p = system._spawnParticle();
    // Should spawn at bottom (y >= height)
    expect(p.y).toBeGreaterThanOrEqual(300);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(400);
  });

  it('spawns particles at left edge when wind blows east', () => {
    system.setWind(10, 270); // from west -> blows east (toDeg=90)
    const p = system._spawnParticle();
    expect(p.x).toBeLessThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(300);
  });

  it('spawns particles at top edge when wind blows south', () => {
    system.setWind(10, 0); // from north -> blows south (toDeg=180)
    const p = system._spawnParticle();
    expect(p.y).toBeLessThanOrEqual(0);
  });

  it('spawns particles at right edge when wind blows west', () => {
    system.setWind(10, 90); // from east -> blows west (toDeg=270)
    const p = system._spawnParticle();
    expect(p.x).toBeGreaterThanOrEqual(400);
  });

  it('particles have randomized jitter', () => {
    system.setWind(10, 0);
    const particles = Array.from({ length: 20 }, () => system._spawnParticle());
    const jitterValues = particles.map((p) => p.vxJitter);
    // Not all jitter values should be identical
    expect(new Set(jitterValues).size).toBeGreaterThan(1);
  });

  it('particles have life and maxLife properties', () => {
    system.setWind(10, 0);
    const p = system._spawnParticle();
    expect(p.life).toBe(0);
    expect(p.maxLife).toBeGreaterThanOrEqual(2000);
    expect(p.maxLife).toBeLessThanOrEqual(5000);
  });
});

// ---------------------------------------------------------------------------
// Update logic
// ---------------------------------------------------------------------------
describe('WindParticleSystem - update', () => {
  let system;

  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb) => setTimeout(cb, 16)),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id) => clearTimeout(id)),
    );
    vi.stubGlobal('performance', { now: vi.fn(() => Date.now()) });

    system = new WindParticleSystem(createMockCanvas());
    system.resize(400, 300);
    system.setWind(10, 0);
  });

  afterEach(() => {
    system.destroy();
    vi.unstubAllGlobals();
  });

  it('moves particles according to velocity over dt', () => {
    system.start();
    const p = system.particles[0];
    const initialX = p.x;
    const initialY = p.y;

    system._update(100); // 100ms

    // Particle should have moved
    const movedX = Math.abs(p.x - initialX) > 0 || Math.abs(p.vxJitter) < 0.001;
    const movedY = Math.abs(p.y - initialY) > 0;
    expect(movedX || movedY).toBe(true);
  });

  it('smoothly adjusts activeCount toward target', () => {
    system.start();
    system.activeCount = 100;
    system.targetActiveCount = 200;

    system._update(16);

    expect(system.activeCount).toBeGreaterThan(100);
    expect(system.activeCount).toBeLessThanOrEqual(200);
  });
});
