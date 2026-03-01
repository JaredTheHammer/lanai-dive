import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock MapLibre GL (not available in jsdom)
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(),
    NavigationControl: vi.fn(),
    Popup: vi.fn(),
  },
}));

// Mock react-map-gl/maplibre
vi.mock('react-map-gl/maplibre', () => ({
  default: vi.fn(() => null),
  Source: vi.fn(() => null),
  Layer: vi.fn(() => null),
}));

// Replace localStorage with a full implementation (jsdom 28 Proxy lacks clear())
const store = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  },
  writable: true,
  configurable: true,
});
