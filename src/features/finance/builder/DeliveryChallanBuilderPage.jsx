import { useCallback, useRef, useState } from 'react';
import DeliveryChallanBuilderPanel from '../deliveryChallan/DeliveryChallanBuilderPanel.jsx';
import DeliveryChallanPreview from '../deliveryChallan/DeliveryChallanPreview.jsx';
import { useDeliveryChallanBuilder } from '../deliveryChallan/useDeliveryChallanBuilder.js';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';
import { useBuilderKeyboard } from './useBuilderKeyboard.js';

export default function DeliveryChallanBuilderPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const exportRef = useRef(null);
  const printRef = useRef(null);
  const {
    form,
    saveState,
    savedAt,
    saveNow,
    update,
    updateLine,
    addLine,
    removeLine,
    applyClientMasterRecipient,
    clearClientMasterRecipient,
    newDeliveryChallan,
    status,
    error,
    busyAction,
    readOnly,
    loadingDoc,
    submitDocument,
    approveDocument,
    rejectDocument,
    issueDocument,
  } = useDeliveryChallanBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: () => printRef.current?.(),
    onExportPdf: () => exportRef.current?.(),
    onNewInvoice: newDeliveryChallan,
    onShowShortcuts: showShortcuts,
  });

  return (
    <InvoiceBuilderShell
      docTypeLabel="Delivery Challan"
      newDocLabel="New"
      newDocShortcutLabel="New delivery challan"
      panelAriaLabel="Delivery challan fields"
      exportFilePrefix="delivery-challan"
      docNumber={form.invoice.documentNumber}
      status={status}
      grandTotal={null}
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
      onNewInvoice={newDeliveryChallan}
      shortcutsOpen={shortcutsOpen}
      onShortcutsClose={() => setShortcutsOpen(false)}
      onShowShortcuts={showShortcuts}
      exportRef={exportRef}
      printRef={printRef}
      panel={
        <DeliveryChallanBuilderPanel
          form={form}
          update={update}
          updateLine={updateLine}
          addLine={addLine}
          removeLine={removeLine}
          applyClientMasterRecipient={applyClientMasterRecipient}
          clearClientMasterRecipient={clearClientMasterRecipient}
        />
      }
    >
      {(previewRef) => (
        <DeliveryChallanPreview
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
