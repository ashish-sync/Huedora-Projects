import { useCallback, useRef, useState } from 'react';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import ProformaPreview from '../proformaGenerator/ProformaPreview.jsx';
import ProformaBuilderPanel from '../proformaGenerator/ProformaBuilderPanel.jsx';
import { useProformaBuilder } from '../proformaGenerator/useProformaBuilder.js';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';
import { useBuilderKeyboard } from './useBuilderKeyboard.js';

export default function ProformaBuilderPage() {
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
    newProforma,
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
  } = useProformaBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: () => printRef.current?.(),
    onExportPdf: () => exportRef.current?.(),
    onNewInvoice: newProforma,
    onShowShortcuts: showShortcuts,
  });

  return (
    <InvoiceBuilderShell
      docTypeLabel="Proforma Invoice"
      newDocLabel="New"
      newDocShortcutLabel="New proforma"
      panelAriaLabel="Proforma fields"
      exportFilePrefix="proforma"
      docNumber={form.document.documentNumber}
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
      documentType="proforma"
      documentCode={form.documentCode || form.company?.documentCode}
      documentDate={form.document?.issueDate}
      onReject={rejectDocument}
      onCancel={cancelDocument}
      onIssue={issueDocument}
      onNewInvoice={newProforma}
      shortcutsOpen={shortcutsOpen}
      onShortcutsClose={() => setShortcutsOpen(false)}
      onShowShortcuts={showShortcuts}
      exportRef={exportRef}
      printRef={printRef}
      panel={
        <ProformaBuilderPanel
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
        />
      }
    >
      {(previewRef) => (
        <ProformaPreview
          form={form}
          previewRef={previewRef}
          editable={!readOnly}
          onUpdate={update}
          onUpdateLine={updateLine}
          onAddLine={addLine}
          onUpdateTerm={updateTerm}
          onAddTerm={addTerm}
          onRemoveTerm={removeTerm}
        />
      )}
    </InvoiceBuilderShell>
  );
}
