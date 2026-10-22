import { useCallback, useRef, useState } from 'react';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import InvoiceBuilderPanel from './InvoiceBuilderPanel.jsx';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';
import { useBuilderKeyboard } from './useBuilderKeyboard.js';
import CreditNotePreview from '../creditNote/CreditNotePreview.jsx';
import { useCreditNoteBuilder } from '../creditNote/useCreditNoteBuilder.js';

export default function CreditNoteBuilderPage() {
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
    removeTerm,
    applyClientMasterRecipient,
    clearClientMasterRecipient,
    newCreditNote,
    status,
    error,
    busyAction,
    readOnly,
    loadingDoc,
    submitDocument,
    approveDocument,
    docMeta,
    orgList,
    orgProfileId,
    changeOrgProfileId,
    rejectDocument,
    cancelDocument,
    issueDocument,
    docId,
    correctIssuedNumber,
  } = useCreditNoteBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: () => printRef.current?.(),
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
      docMeta={docMeta}
      orgList={orgList}
      orgProfileId={orgProfileId}
      onOrgProfileIdChange={changeOrgProfileId}
      docId={docId}
      onCorrectDocumentNumber={correctIssuedNumber}
      documentType="credit_note"
      documentCode={form.documentCode || form.company?.documentCode}
      documentDate={form.invoice?.issueDate}
      onReject={rejectDocument}
      onCancel={cancelDocument}
      onIssue={issueDocument}
      onNewInvoice={newCreditNote}
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
          removeTerm={removeTerm}
          applyClientMasterRecipient={applyClientMasterRecipient}
          clearClientMasterRecipient={clearClientMasterRecipient}
          issued={status === 'Issued' || status === 'Approved' || status === 'Cancelled'}
          documentType="credit_note"
          panelConfig={{
            panelLayout: 'parties',
            documentType: 'credit_note',
            docSectionTitle: 'Header',
            docNoLabel: 'Credit note no.',
            projectLabel: 'Project / Service Period',
            dateLabel: 'Credit Note Date',
            dueLabel: 'Due Date',
            recipientTitle: 'Bill To',
            shipToTitle: 'Ship To',
            termsSectionTitle: 'Terms',
            hideAdjustmentAmounts: true,
            showOriginalInvoice: true,
            originalInvoiceLabel: 'Original invoice no.',
            showPoFields: true,
            showShipTo: true,
            showCreditReason: true,
            showOriginalInvoiceDate: true,
            lockOriginalInvoiceFromSystem: true,
            hideReverseCharge: true,
            hideReceiptVoucher: true,
            issued: status === 'Issued' || status === 'Approved' || status === 'Cancelled',
          }}
        />
      }
    >
      {(previewRef) => (
        <CreditNotePreview
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
