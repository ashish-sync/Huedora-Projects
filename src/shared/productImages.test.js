import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  collectProductImages,
  isImageFile,
  resolveProductImageFilename,
  removeProductImage,
  uploadProductImages,
} from './productImages.js';

vi.mock('./api.js', () => ({
  api: vi.fn(),
}));

vi.mock('./uploadViewUrl.js', () => ({
  isDirectUploadPath: (url = '') => /\/uploads\//i.test(String(url)),
  resolveUploadViewUrl: vi.fn(async (url) => url),
}));

import { api } from './api.js';

describe('productImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveProductImageFilename prefers filename then uploads path segment', () => {
    expect(resolveProductImageFilename({ filename: 'a.jpg', url: '/uploads/x/b.jpg' })).toBe('a.jpg');
    expect(resolveProductImageFilename({
      url: '/uploads/logistics/products/photo%20one.png',
    })).toBe('photo one.png');
    expect(resolveProductImageFilename({
      url: '/api/v1/files/signed?token=abc',
    })).toBe('');
  });

  it('collectProductImages de-dupes primary and gallery by url', () => {
    const product = {
      image: { filename: 'a.jpg', url: '/uploads/a.jpg' },
      documents: {
        images: [
          { filename: 'a.jpg', url: '/uploads/a.jpg' },
          { filename: 'b.jpg', url: '/uploads/b.jpg' },
        ],
      },
    };
    expect(collectProductImages(product)).toHaveLength(2);
  });

  it('isImageFile checks mime type', () => {
    expect(isImageFile({ type: 'image/png' })).toBe(true);
    expect(isImageFile({ type: 'application/pdf' })).toBe(false);
  });

  it('uploadProductImages posts FormData with images slot', async () => {
    api.mockResolvedValue({ data: { _id: 'p1' } });
    const file = new File(['x'], 'shot.jpg', { type: 'image/jpeg' });
    const data = await uploadProductImages('p1', [file]);
    expect(data).toEqual({ _id: 'p1' });
    expect(api).toHaveBeenCalledWith(
      '/logistics/products/p1/files',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const fd = api.mock.calls[0][1].body;
    expect(fd.get('slot')).toBe('images');
    expect(fd.getAll('images')).toHaveLength(1);
  });

  it('removeProductImage deletes by filename and accepts ref objects', async () => {
    api.mockResolvedValue({ data: { _id: 'p1', image: null } });
    await removeProductImage('p1', { filename: 'gone.jpg', url: '/uploads/gone.jpg' });
    expect(api).toHaveBeenCalledWith('/logistics/products/p1/files', {
      method: 'DELETE',
      body: { filename: 'gone.jpg' },
    });
  });

  it('removeProductImage throws when filename cannot be resolved', async () => {
    await expect(removeProductImage('p1', { url: '/api/v1/files/signed?token=x' }))
      .rejects.toThrow(/Image reference is missing/);
    expect(api).not.toHaveBeenCalled();
  });
});
