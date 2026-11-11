import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import HeaderPhotoEditorModal from './HeaderPhotoEditorModal.jsx';

describe('HeaderPhotoEditorModal', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let originalImage;
  let mockFile;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-photo-uuid');
    URL.revokeObjectURL = vi.fn();

    originalImage = global.Image;
    class MockImage {
      constructor() {
        this.naturalWidth = 800;
        this.naturalHeight = 600;
        this.onload = null;
        this.onerror = null;
        this._src = '';
      }
      set src(val) {
        this._src = val;
        setTimeout(() => this.onload?.(), 5);
      }
      get src() {
        return this._src;
      }
    }
    global.Image = MockImage;

    mockFile = new File(['dummy-image-bytes'], 'avatar-test.png', { type: 'image/png' });

    // Mock HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    }));

    HTMLCanvasElement.prototype.toBlob = vi.fn((callback, mimeType) => {
      const blob = new Blob(['mock-cropped-jpeg-bytes'], { type: mimeType || 'image/jpeg' });
      callback(blob);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    global.Image = originalImage;
  });

  it('does not render dialog when open is false', () => {
    render(
      <HeaderPhotoEditorModal
        open={false}
        file={mockFile}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders photo editor modal with crop viewport, zoom controls, and live previews', async () => {
    render(
      <HeaderPhotoEditorModal
        open={true}
        file={mockFile}
        userName="Priya Sharma"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Adjust Header Photo/i })).toBeTruthy();
    expect(screen.getByText(/Drag to reposition, use the slider to zoom/i)).toBeTruthy();
    expect(screen.getByText('Live Previews')).toBeTruthy();
    expect(screen.getByText('Profile Card (72px)')).toBeTruthy();
    expect(screen.getByText('Header Bar (30px)')).toBeTruthy();
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('adjusts zoom level when clicking zoom in and zoom out buttons', async () => {
    render(
      <HeaderPhotoEditorModal
        open={true}
        file={mockFile}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const zoomInBtn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom out' });

    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.click(zoomInBtn);
    expect(screen.getByText('110%')).toBeTruthy();

    fireEvent.click(zoomInBtn);
    expect(screen.getByText('120%')).toBeTruthy();

    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('110%')).toBeTruthy();
  });

  it('calls onCancel when clicking Cancel or the Close icon button', async () => {
    const onCancel = vi.fn();
    render(
      <HeaderPhotoEditorModal
        open={true}
        file={mockFile}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: 'Close photo editor' });
    fireEvent.click(closeBtn);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('resets zoom when clicking Reset', async () => {
    render(
      <HeaderPhotoEditorModal
        open={true}
        file={mockFile}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const zoomInBtn = screen.getByRole('button', { name: 'Zoom in' });
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('120%')).toBeTruthy();

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    expect(resetBtn.disabled).toBe(false);
    fireEvent.click(resetBtn);

    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('crops image and calls onSave with a 1:1 JPEG File when clicking Save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <HeaderPhotoEditorModal
        open={true}
        file={mockFile}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByAltText('Original upload')).toBeTruthy();
    });

    const saveBtn = screen.getByRole('button', { name: 'Save Header Photo' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });

    const savedFile = onSave.mock.calls[0][0];
    expect(savedFile).toBeInstanceOf(File);
    expect(savedFile.name).toBe('avatar-test-cropped.jpg');
    expect(savedFile.type).toBe('image/jpeg');
  });
});
