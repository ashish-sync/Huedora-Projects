import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton from './Skeleton.jsx';

describe('Skeleton Primitive', () => {
  it('renders skeleton element with aria-hidden', () => {
    const { container } = render(<Skeleton width="200px" height="24px" />);
    const el = container.querySelector('.skeleton');
    expect(el).toBeTruthy();
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders Skeleton.Table with correct row and column count', () => {
    const { container } = render(<Skeleton.Table rows={4} cols={3} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);
    const cells = container.querySelectorAll('tbody td');
    expect(cells.length).toBe(12);
  });
});

