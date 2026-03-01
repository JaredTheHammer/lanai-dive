/**
 * WindParticles -- Canvas overlay component that renders animated
 * wind flow particles on top of the MapLibre map.
 *
 * - Positioned absolutely, pointer-events: none
 * - Pauses when not visible (map view inactive)
 * - Handles resize via ResizeObserver
 * - Recalculates velocity on wind or zoom change
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { WindParticleSystem } from '../utils/particleSystem.js';

export default function WindParticles({ windSpeedMph, windFromDeg, zoom, active }) {
  const canvasRef = useRef(null);
  const systemRef = useRef(null);
  const containerRef = useRef(null);

  // Initialize particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const system = new WindParticleSystem(canvas);
    systemRef.current = system;

    return () => {
      system.destroy();
      systemRef.current = null;
    };
  }, []);

  // Handle container resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          systemRef.current?.resize(width, height);
        }
      }
    });

    observer.observe(container);

    // Initial size
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      systemRef.current?.resize(rect.width, rect.height);
    }

    return () => observer.disconnect();
  }, []);

  // Update wind parameters
  useEffect(() => {
    const system = systemRef.current;
    if (!system) return;
    system.setWind(windSpeedMph || 0, windFromDeg || 0, zoom || 11);
  }, [windSpeedMph, windFromDeg, zoom]);

  // Start/stop based on active state and wind speed
  useEffect(() => {
    const system = systemRef.current;
    if (!system) return;

    if (active && windSpeedMph > 0) {
      system.start();
    } else {
      system.stop();
    }
  }, [active, windSpeedMph]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none', zIndex: 5 }}
    />
  );
}
