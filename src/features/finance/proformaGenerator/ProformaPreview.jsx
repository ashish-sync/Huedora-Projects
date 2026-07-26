import { useCallback, useMemo } from 'react';
import TaxInvoicePreview from '../invoiceGenerator/TaxInvoicePreview.jsx';
import { invoicePathToProforma, proformaToInvoiceView } from './proformaFormAdapter.js';

export default function ProformaPreview({
  form,
  previewRef,
  editable = false,
  onUpdate,
  onUpdateLine,
  onAddLine,
  onUpdateTerm,
  onAddTerm,
}) {
  const invoiceForm = useMemo(() => proformaToInvoiceView(form), [form]);
  const lineIds = useMemo(
    () => (form.rows || []).filter((r) => r.type === 'line').map((r) => r.id),
    [form.rows]
  );

  const handleUpdate = useCallback(
    (path, value) => {
      onUpdate?.(invoicePathToProforma(path), value);
    },
    [onUpdate]
  );

  const handleUpdateLine = useCallback(
    (index, patch) => {
      const id = lineIds[index];
      if (id) onUpdateLine?.(id, patch);
    },
    [lineIds, onUpdateLine]
  );

  return (
    <TaxInvoicePreview
      form={invoiceForm}
      previewRef={previewRef}
      editable={editable}
      documentTitle="PROFORMA INVOICE"
      totalAmountLabel="Total Proforma Amount"
      detailsCardTitle="Proforma Details"
      fieldLabels={{
        docNo: 'Proforma No',
        docDate: 'Proforma Date',
        project: 'Project',
      }}
      onUpdate={handleUpdate}
      onUpdateLine={handleUpdateLine}
      onAddLine={onAddLine}
      onUpdateTerm={onUpdateTerm}
      onAddTerm={onAddTerm}
    />
  );
}
