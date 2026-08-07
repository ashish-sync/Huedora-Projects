import { useCallback, useRef, useState } from 'react';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import InvoiceBuilderPanel from './InvoiceBuilderPanel.jsx';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';
import { useBuilderKeyboard } from './useBuilderKeyboard.js';
import BillOfSupplyPreview from '../billOfSupply/BillOfSupplyPreview.jsx';
import { useBillOfSupplyBuilder } from '../billOfSupply/useBillOfSupplyBuilder.js';

export default function BillOfSupplyBuilderPage() {
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
    newBillOfSupply,
    status,
    error,
    busyAction,
    readOnly,
    loadingDoc,
    docId,
    submitDocument,
    approveDocument,
    rejectDocument,
    issueDocument,
  } = useBillOfSupplyBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: () => printRef.current?.(),
    onExportPdf: () => exportRef.current?.(),
    onNewInvoice: newBillOfSupply,
    onShowShortcuts: showShortcuts,
  });

  return (
    <InvoiceBuilderShell
      docTypeLabel="Bill of Supply"
      newDocLabel="New"
      newDocShortcutLabel="New bill of supply"
      panelAriaLabel="Bill of supply fields"
      exportFilePrefix="bill-of-supply"
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
      onNewInvoice={newBillOfSupply}
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
          docId={docId}
          panelConfig={{
            panelLayout: 'parties',
            docSectionTitle: 'Header',
            docNoLabel: 'Bill of supply no.',
            projectLabel: 'Project / Service Period',
            dateLabel: 'Bill of Supply Date',
            dueLabel: 'Due Date',
            datesFromApproval: true,
            recipientTitle: 'Bill To',
            shipToTitle: 'Ship To',
            termsSectionTitle: 'Terms',
            hideAdjustmentAmounts: true,
            showOriginalInvoice: false,
            showPoFields: true,
            showShipTo: true,
            hideReverseCharge: true,
            hideReceiptVoucher: true,
            hideTaxColumnTitles: true,
          }}
        />
      }
    >
      {(previewRef) => (
        <BillOfSupplyPreview
          form={form}
          previewRef={previewRef}
          editable={!readOnly}
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
