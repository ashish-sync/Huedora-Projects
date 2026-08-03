import { describe, expect, it } from 'vitest';
import {
  moduleMatrixFromPermissions,
  permissionsFromModuleMatrix,
  tierIsOnInMatrix,
  tiersForModule,
  toggleModuleTierInMatrix,
} from './moduleAccessTiers.js';

const modules = [
  {
    id: 'camps',
    label: 'Camp One',
    actions: {
      all: ['camps:read', 'camps:request', 'camps:approve'],
      view: ['camps:read'],
      request: ['camps:request'],
      approve: ['camps:approve'],
    },
  },
  {
    id: 'agreements',
    label: 'Document One',
    actions: {
      all: ['agreements:read', 'agreements:write'],
      view: ['agreements:read'],
      add: ['agreements:write'],
    },
  },
];

describe('moduleAccessTiers', () => {
  it('lists tiers available per module', () => {
    expect(tiersForModule(modules[0]).map((t) => t.label)).toEqual([
      'All',
      'Viewer',
      'Requester',
      'Approver',
    ]);
    expect(tiersForModule(modules[1]).map((t) => t.label)).toEqual(['All', 'Viewer', 'Editor']);
  });

  it('toggles access per module without affecting other modules', () => {
    let matrix = moduleMatrixFromPermissions(modules, ['camps:read', 'agreements:read']);
    expect(tierIsOnInMatrix(modules[0], { id: 'viewer' }, matrix)).toBe(true);
    expect(tierIsOnInMatrix(modules[1], { id: 'viewer' }, matrix)).toBe(true);

    matrix = toggleModuleTierInMatrix(matrix, modules[0], { id: 'viewer' });
    expect(tierIsOnInMatrix(modules[0], { id: 'viewer' }, matrix)).toBe(false);
    expect(tierIsOnInMatrix(modules[1], { id: 'viewer' }, matrix)).toBe(true);
  });

  it('compiles independent module picks into permission keys', () => {
    const matrix = {
      camps: ['viewer'],
      agreements: ['editor'],
    };
    expect(permissionsFromModuleMatrix(modules, matrix).sort()).toEqual(
      ['agreements:write', 'camps:read'].sort()
    );
  });
});
