import { describe, expect, it } from 'vitest';
import { formatTaskLabel } from './legacy-format';

describe('formatTaskLabel', () => {
  it('formats priority and owner', () => {
    expect(formatTaskLabel({ priority: 'high', owner: 'student' })).toBe('HIGH · STUDENT');
  });

  it('provides defaults when task fields are missing', () => {
    expect(formatTaskLabel({})).toBe('NORMAL · SIN-ASIGNAR');
  });

  it('handles a missing task', () => {
    expect(formatTaskLabel(null)).toBe('SIN-DATOS');
  });
});
