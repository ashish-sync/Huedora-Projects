import { useCallback, useMemo } from 'react';
import LandscapeInvoiceLikePreview from '../shared/LandscapeInvoiceLikePreview.jsx';
import { LANDSCAPE_DOC_CONFIGS } from '../shared/landscapeDocConfigs.js';
import { invoicePathToProforma, proformaToInvoiceView } from './proformaFormAdapter.js';

export default function ProformaPreview({
  form,
  previewRef,
  editable = false,
  onUpdate,
  onUpdateLine,
  onAddLine,
}) {
  const view = useMemo(() => proformaToInvoiceView(form), [form]);
  const lineIds = useMemo(
    () => (form.rows || []).filter((r) => r.type === 'line').map((r) => r.id),
    [form.rows]
  );

  const setPath = useCallback(
    (invoicePath, value) => {
      onUpdate?.(invoicePathToProforma(invoicePath), value);
    },
    [onUpdate]
  );

  const setLine = useCallback(
    (index, patch) => {
      const id = lineIds[index];
      if (id) onUpdateLine?.(id, patch);
    },
    [lineIds, onUpdateLine]
  );

  return (
    <LandscapeInvoiceLikePreview
      form={view}
      previewRef={previewRef}
      editable={editable}
      onUpdate={setPath}
      onUpdateLine={setLine}
      onAddLine={onAddLine}
      config={LANDSCAPE_DOC_CONFIGS.proforma}
    />
  );
}
