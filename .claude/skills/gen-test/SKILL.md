---
name: gen-test
description: Generate a Vitest test file for a source module following project conventions
disable-model-invocation: true
args: file_path
---

# /gen-test - Generate Vitest Tests

Generate a test file for the specified source module.

## Input

The user provides a file path (e.g., `src/api/currents.js` or `src/scoring/index.js`).

## Conventions

Follow these project testing conventions exactly:

### Imports

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

Import only the specific functions/exports being tested from the source module.

### File location

Place test files alongside their source: `<module>.test.js` (e.g., `src/api/currents.js` -> `src/api/currents.test.js`).

### Structure

- Use `describe` blocks grouped by exported function
- Use descriptive `it` descriptions starting with a verb (e.g., "interpolates level between...")
- Use `beforeEach` for shared setup when multiple tests need the same state
- Mock external dependencies with `vi.mock()` or `vi.fn()`

### Test patterns in this project

- **API modules** (`src/api/`): Mock `fetch` with `vi.fn()`, test data parsing/transformation, test error handling
- **Scoring modules** (`src/scoring/`): Test with boundary values (0, 50, 100), test zone-specific behavior, verify weight contributions
- **Data modules** (`src/data/`): Test data integrity, verify required fields exist
- **Hooks** (`src/hooks/`): Use `@testing-library/react` `renderHook`, mock localStorage

### Assertions

- Prefer `expect(x).toBe(y)` for primitives
- Use `toBeCloseTo` for floating point comparisons
- Use `toEqual` for objects/arrays
- Use `toBeGreaterThan` / `toBeLessThan` for range checks

## Steps

1. Read the source file to understand its exports and logic
2. Read any existing test file for that module (it may already exist)
3. If a test file exists, add missing test cases. If not, create a new one
4. Generate tests covering:
   - Happy path for each exported function
   - Edge cases and boundary values
   - Error handling paths
   - At least 3 test cases per exported function
5. Run `npx vitest run <test-file>` to verify all tests pass
6. Fix any failing tests
