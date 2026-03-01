/**
 * WindParticleSystem -- lightweight particle renderer for visualizing
 * wind flow as animated trails on a canvas overlay.
 *
 * Architecture:
 *  - 50-500 particles drift across the viewport (density scales with wind speed)
 *  - Particles spawn at the upwind edge and are recycled when they exit
 *  - Motion blur via partial canvas clear each frame
 *  - Uniform wind field (single observation point)
 */

const MAX_PARTICLES = 500;     // Pool size (allocated once)
const MIN_ACTIVE = 50;         // Active at 0 mph wind
const MAX_ACTIVE = 500;        // Active at 30+ mph wind
const SPEED_FOR_MAX = 30;      // mph at which we hit max density
const MIN_LIFESPAN = 2000; // ms
const MAX_LIFESPAN = 5000; // ms
const TRAIL_COLOR = 'rgba(34, 211, 238, 0.45)'; // cyan-400 semi-transparent
const FADE_ALPHA = 0.06; // motion blur intensity (lower = longer trails)

export class WindParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.windSpeed = 0;       // mph
    this.windFromDeg = 0;     // direction wind blows FROM
    this.vx = 0;              // pixels per ms (screen space)
    this.vy = 0;
    this.running = false;
    this.lastFrame = 0;
    this.rafId = null;
    this.activeCount = MIN_ACTIVE;
    this.targetActiveCount = MIN_ACTIVE;
  }

  /**
   * Update wind parameters and recalculate pixel velocity.
   * @param {number} speedMph - Wind speed in mph
   * @param {number} fromDeg - Direction wind blows FROM (meteorological convention)
   * @param {number} zoom - Map zoom level (affects pixel velocity scaling)
   */
  setWind(speedMph, fromDeg, zoom = 11) {
    this.windSpeed = speedMph;
    this.windFromDeg = fromDeg;

    // Wind blows TO = (fromDeg + 180) % 360
    const toDeg = (fromDeg + 180) % 360;
    const toRad = toDeg * Math.PI / 180;

    // Scale: at zoom 11, 10 mph ~ 1.5 px/ms; scales with 2^(zoom-11)
    const zoomScale = Math.pow(2, zoom - 11);
    const baseSpeed = (speedMph / 10) * 1.5 * zoomScale;

    // Screen coordinates: x = east, y = south (canvas y-axis is inverted)
    this.vx = baseSpeed * Math.sin(toRad);
    this.vy = -baseSpeed * Math.cos(toRad); // negative because canvas y is down for north

    // Scale active particle count with wind speed (quadratic easing)
    const speedFraction = Math.min(speedMph / SPEED_FOR_MAX, 1);
    this.targetActiveCount = Math.round(
      MIN_ACTIVE + (MAX_ACTIVE - MIN_ACTIVE) * (speedFraction * speedFraction)
    );
  }

  /**
   * Resize canvas to match container dimensions.
   */
  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
    this.width = width;
    this.height = height;
  }

  /**
   * Spawn a particle at a random position along the upwind edge.
   */
  _spawnParticle() {
    const w = this.width;
    const h = this.height;

    // Determine upwind edge based on wind TO direction
    const toDeg = (this.windFromDeg + 180) % 360;
    let x, y;

    if (toDeg >= 315 || toDeg < 45) {
      // Wind blows north (upward on screen): spawn at bottom
      x = Math.random() * w;
      y = h + Math.random() * 20;
    } else if (toDeg >= 45 && toDeg < 135) {
      // Wind blows east (rightward): spawn at left
      x = -Math.random() * 20;
      y = Math.random() * h;
    } else if (toDeg >= 135 && toDeg < 225) {
      // Wind blows south (downward): spawn at top
      x = Math.random() * w;
      y = -Math.random() * 20;
    } else {
      // Wind blows west (leftward): spawn at right
      x = w + Math.random() * 20;
      y = Math.random() * h;
    }

    return {
      x,
      y,
      life: 0,
      maxLife: MIN_LIFESPAN + Math.random() * (MAX_LIFESPAN - MIN_LIFESPAN),
      // Slight random variation for natural look
      vxJitter: (Math.random() - 0.5) * 0.15,
      vyJitter: (Math.random() - 0.5) * 0.15,
    };
  }

  /**
   * Initialize all particles.
   */
  _initParticles() {
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this._spawnParticle();
      // Stagger initial positions by giving random initial life
      p.life = Math.random() * p.maxLife;
      // Advance position accordingly
      p.x += (this.vx + p.vxJitter) * p.life;
      p.y += (this.vy + p.vyJitter) * p.life;
      this.particles.push(p);
    }
    this.activeCount = this.targetActiveCount;
  }

  /**
   * Start the animation loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this._initParticles();
    this.lastFrame = performance.now();
    this._loop();
  }

  /**
   * Stop the animation loop.
   */
  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Clear canvas
    if (this.ctx && this.width && this.height) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  /**
   * Main render loop.
   */
  _loop() {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min(now - this.lastFrame, 50); // cap at 50ms to avoid jumps
    this.lastFrame = now;

    this._update(dt);
    this._render();

    this.rafId = requestAnimationFrame(() => this._loop());
  }

  /**
   * Update particle positions.
   */
  _update(dt) {
    const w = this.width;
    const h = this.height;

    // Smoothly adjust active count toward target
    if (this.activeCount !== this.targetActiveCount) {
      const step = Math.max(1, Math.round(Math.abs(this.targetActiveCount - this.activeCount) * 0.05));
      if (this.activeCount < this.targetActiveCount) {
        this.activeCount = Math.min(this.activeCount + step, this.targetActiveCount);
      } else {
        this.activeCount = Math.max(this.activeCount - step, this.targetActiveCount);
      }
    }

    for (let i = 0; i < this.activeCount; i++) {
      const p = this.particles[i];
      p.life += dt;

      // Move
      p.x += (this.vx + p.vxJitter) * dt;
      p.y += (this.vy + p.vyJitter) * dt;

      // Recycle if expired or offscreen
      const margin = 30;
      if (
        p.life > p.maxLife ||
        p.x < -margin || p.x > w + margin ||
        p.y < -margin || p.y > h + margin
      ) {
        this.particles[i] = this._spawnParticle();
      }
    }
  }

  /**
   * Render particles with motion blur.
   */
  _render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Partial clear for trail effect
    ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
    ctx.fillRect(0, 0, w, h);

    // Draw particles as small dots
    ctx.fillStyle = TRAIL_COLOR;
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.particles[i];
      // Fade in/out at edges of lifespan
      const lifeFrac = p.life / p.maxLife;
      const alpha = lifeFrac < 0.1
        ? lifeFrac / 0.1
        : lifeFrac > 0.85
          ? (1 - lifeFrac) / 0.15
          : 1;

      if (alpha <= 0) continue;

      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.stop();
    this.particles = [];
  }
}
