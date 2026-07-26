import { useCallback, useRef, useState } from 'react';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import TaxInvoicePreview from '../invoiceGenerator/TaxInvoicePreview.jsx';
import InvoiceBuilderPanel from './InvoiceBuilderPanel.jsx';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';
import { useBuilderKeyboard } from './useBuilderKeyboard.js';
import { useCreditNoteBuilder } from '../creditNote/useCreditNoteBuilder.js';

export default function CreditNoteBuilderPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const exportRef = useRef(null);
  const {
    form,
    totals,
    saveState,
    savedAt,
    saveNow,
    update,
    updateLine,
    addLine,
    removeLine,
    updateTerm,
    addTerm,
    newCreditNote,
  } = useCreditNoteBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const handlePrint = useCallback(() => window.print(), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: handlePrint,
    onExportPdf: () => exportRef.current?.(),
    onNewInvoice: newCreditNote,
    onShowShortcuts: showShortcuts,
  });

  return (
    <InvoiceBuilderShell
      docTypeLabel="Credit Note"
      newDocLabel="New"
      newDocShortcutLabel="New credit note"
      panelAriaLabel="Credit note fields"
      exportFilePrefix="credit-note"
      docNumber={form.invoice.documentNumber}
      grandTotal={formatMoney(totals?.grandTotal)}
      saveState={saveState}
      savedAt={savedAt}
      panelOpen={panelOpen}
      onTogglePanel={togglePanel}
      onPrint={handlePrint}
      onSaveNow={saveNow}
      onNewInvoice={newCreditNote}
      shortcutsOpen={shortcutsOpen}
      onShortcutsClose={() => setShortcutsOpen(false)}
      onShowShortcuts={showShortcuts}
      exportRef={exportRef}
      panel={
        <InvoiceBuilderPanel
          form={form}
          totals={totals}
          update={update}
          updateLine={updateLine}
          addLine={addLine}
          removeLine={removeLine}
          updateTerm={updateTerm}
          addTerm={addTerm}
          panelConfig={{
            docSectionTitle: 'Credit note',
            docNoLabel: 'Credit note no.',
            showOriginalInvoice: true,
            originalInvoiceLabel: 'Original invoice',
          }}
        />
      }
    >
      {(previewRef) => (
        <TaxInvoicePreview
          form={form}
          previewRef={previewRef}
          editable
          documentTitle="CREDIT NOTE"
          totalAmountLabel="Total Credit Amount"
          detailsCardTitle="Credit Note Details"
          fieldLabels={{
            docNo: 'Credit Note No',
            docDate: 'Credit Note Date',
            project: 'Reference',
            originalInvoice: 'Original Invoice No',
          }}
          showPaymentDetails={false}
          showReverseCharge={false}
          onUpdate={update}
          onUpdateLine={updateLine}
          onAddLine={addLine}
          onUpdateTerm={updateTerm}
          onAddTerm={addTerm}
        />
      )}
    </InvoiceBuilderShell>
  );
}
