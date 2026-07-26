import { useCallback, useRef, useState } from 'react';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import TaxInvoicePreview from '../invoiceGenerator/TaxInvoicePreview.jsx';
import InvoiceBuilderPanel from './InvoiceBuilderPanel.jsx';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';
import { useBuilderKeyboard } from './useBuilderKeyboard.js';
import { useInvoiceBuilder } from './useInvoiceBuilder.js';

export default function InvoiceBuilderPage() {
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
    newInvoice,
  } = useInvoiceBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const handlePrint = useCallback(() => window.print(), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: handlePrint,
    onExportPdf: () => exportRef.current?.(),
    onNewInvoice: newInvoice,
    onShowShortcuts: showShortcuts,
  });

  return (
    <InvoiceBuilderShell
      docTypeLabel="Invoice"
      newDocLabel="New"
      newDocShortcutLabel="New invoice"
      exportFilePrefix="invoice"
      docNumber={form.invoice.documentNumber}
      grandTotal={formatMoney(totals?.grandTotal)}
      saveState={saveState}
      savedAt={savedAt}
      panelOpen={panelOpen}
      onTogglePanel={togglePanel}
      onPrint={handlePrint}
      onSaveNow={saveNow}
      onNewInvoice={newInvoice}
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
        />
      }
    >
      {(previewRef) => (
        <TaxInvoicePreview
          form={form}
          previewRef={previewRef}
          editable
          documentTitle="INVOICE"
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
