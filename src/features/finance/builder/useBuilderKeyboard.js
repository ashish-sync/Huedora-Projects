import { useEffect } from 'react';

/**
 * Global keyboard shortcuts for the invoice builder.
 * Mod = Cmd on Mac, Ctrl on Windows/Linux.
 */
export function useBuilderKeyboard({
  onTogglePanel,
  onPrint,
  onExportPdf,
  onNewInvoice,
  onShowShortcuts,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === '?' && !mod) {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }

      if (!mod) return;

      if (e.key === '\\' || e.key === '|') {
        e.preventDefault();
        onTogglePanel?.();
        return;
      }

      if (e.key === 'p') {
        e.preventDefault();
        onPrint?.();
        return;
      }

      if (e.key === 's') {
        e.preventDefault();
        onExportPdf?.();
        return;
      }

      if (e.shiftKey && e.key === 'N') {
        e.preventDefault();
        onNewInvoice?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onTogglePanel, onPrint, onExportPdf, onNewInvoice, onShowShortcuts]);
}
