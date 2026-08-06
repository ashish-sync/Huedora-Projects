import { useCallback, useRef, useState } from 'react';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import InvoiceBuilderPanel from './InvoiceBuilderPanel.jsx';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';
import { useBuilderKeyboard } from './useBuilderKeyboard.js';
import DebitNotePreview from '../debitNote/DebitNotePreview.jsx';
import { useDebitNoteBuilder } from '../debitNote/useDebitNoteBuilder.js';

export default function DebitNoteBuilderPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const exportRef = useRef(null);
  const printRef = useRef(null);
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
    applyClientMasterRecipient,
    clearClientMasterRecipient,
    newDebitNote,
    status,
    error,
    busyAction,
    readOnly,
    loadingDoc,
    submitDocument,
    approveDocument,
    rejectDocument,
    issueDocument,
  } = useDebitNoteBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: () => printRef.current?.(),
    onExportPdf: () => exportRef.current?.(),
    onNewInvoice: newDebitNote,
    onShowShortcuts: showShortcuts,
  });

  return (
    <InvoiceBuilderShell
      docTypeLabel="Debit Note"
      newDocLabel="New"
      newDocShortcutLabel="New debit note"
      panelAriaLabel="Debit note fields"
      exportFilePrefix="debit-note"
      docNumber={form.invoice.documentNumber}
      status={status}
      grandTotal={formatMoney(totals?.grandTotal)}
      saveState={saveState}
      savedAt={savedAt}
      error={error}
      busyAction={busyAction}
      readOnly={readOnly}
      loadingDoc={loadingDoc}
      panelOpen={panelOpen}
      onTogglePanel={togglePanel}
      onSaveNow={saveNow}
      onSubmit={submitDocument}
      onApprove={approveDocument}
      onReject={rejectDocument}
      onIssue={issueDocument}
      onNewInvoice={newDebitNote}
      shortcutsOpen={shortcutsOpen}
      onShortcutsClose={() => setShortcutsOpen(false)}
      onShowShortcuts={showShortcuts}
      exportRef={exportRef}
      printRef={printRef}
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
          applyClientMasterRecipient={applyClientMasterRecipient}
          clearClientMasterRecipient={clearClientMasterRecipient}
          panelConfig={{
            panelLayout: 'parties',
            docSectionTitle: 'Header',
            docNoLabel: 'Debit note no.',
            projectLabel: 'Project / Service Period',
            dateLabel: 'Debit Note Date',
            dueLabel: 'Due Date',
            recipientTitle: 'Bill To',
            shipToTitle: 'Ship To',
            termsSectionTitle: 'Terms',
            hideAdjustmentAmounts: true,
            showOriginalInvoice: true,
            originalInvoiceLabel: 'Original invoice no.',
            originalInvoiceField: 'dnReference',
            showPoFields: true,
            showShipTo: true,
            showDebitReason: true,
            showOriginalInvoiceDate: true,
            lockOriginalInvoiceFromSystem: true,
            hideReverseCharge: true,
            hideReceiptVoucher: true,
          }}
        />
      }
    >
      {(previewRef) => (
        <DebitNotePreview
          form={form}
          previewRef={previewRef}
          editable={!readOnly}
          onUpdate={update}
          onUpdateLine={updateLine}
          onAddLine={addLine}
        />
      )}
    </InvoiceBuilderShell>
  );
}
