import { describe, expect, it } from 'vitest';
import {
  moduleMatrixFromPermissions,
  permissionsFromModuleMatrix,
  preserveUnmappedPermissions,
  tierIsOn,
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
      all: ['agreements:read', 'agreements:write', 'documents:write'],
      view: ['agreements:read'],
      add: ['agreements:write'],
      delete: ['agreements:write'],
      upload: ['documents:write'],
    },
  },
  {
    id: 'finance',
    label: 'Finance One',
    actions: {
      all: [
        'finance:read',
        'finance:write',
        'finance:verify',
        'finance:approve',
        'finance:pay',
      ],
      view: ['finance:read'],
      add: ['finance:write'],
      delete: ['finance:write'],
      verify: ['finance:verify'],
      approve: ['finance:approve'],
      pay: ['finance:pay'],
    },
  },
  {
    id: 'logistics',
    label: 'Movement One',
    actions: {
      view: ['logistics:read'],
      add: ['logistics:write'],
      delete: ['logistics:write'],
      all: ['logistics:read', 'logistics:write', 'logistics:master'],
    },
  },
];

describe('moduleAccessTiers', () => {
  it('lists View / Edit / Request style tiers per module', () => {
    expect(tiersForModule(modules[0]).map((t) => t.label)).toEqual([
      'All',
      'View',
      'Request',
      'Approve',
    ]);
    expect(tiersForModule(modules[1]).map((t) => t.label)).toEqual(['All', 'View', 'Edit']);
    expect(tiersForModule(modules[2]).map((t) => t.label)).toEqual([
      'All',
      'View',
      'Edit',
      'Approve',
      'Verify',
      'Pay',
    ]);
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
      ['agreements:write', 'camps:read', 'documents:write'].sort()
    );
  });

  it('does not mark Edit on when only a partial write key is present', () => {
    expect(tierIsOn(modules[1], { id: 'editor', actionIds: ['add', 'delete', 'upload'] }, [
      'agreements:write',
    ])).toBe(false);
    expect(
      tierIsOn(modules[1], { id: 'editor', actionIds: ['add', 'delete', 'upload'] }, [
        'agreements:write',
        'documents:write',
      ])
    ).toBe(true);
  });

  it('Finance All includes verify and pay', () => {
    const matrix = {
      finance: ['viewer', 'editor', 'approver', 'verifier', 'payer'],
    };
    expect(permissionsFromModuleMatrix(modules, matrix).sort()).toEqual(
      ['finance:approve', 'finance:pay', 'finance:read', 'finance:verify', 'finance:write'].sort()
    );
  });

  it('Movement All includes logistics:master from catalog all', () => {
    const matrix = {
      logistics: ['viewer', 'editor'],
    };
    expect(permissionsFromModuleMatrix(modules, matrix).sort()).toEqual(
      ['logistics:master', 'logistics:read', 'logistics:write'].sort()
    );
  });

  it('preserves unmapped legacy keys on save', () => {
    const granted = ['camps:read'];
    const previous = ['camps:read', 'imports:execute', 'masters:read'];
    expect(preserveUnmappedPermissions(modules, granted, previous).sort()).toEqual(
      ['camps:read', 'imports:execute', 'masters:read'].sort()
    );
  });
});
