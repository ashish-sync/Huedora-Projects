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
    newProforma,
  } = useProformaBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const handlePrint = useCallback(() => window.print(), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: handlePrint,
    onExportPdf: () => exportRef.current?.(),
    onNewInvoice: newProforma,
    onShowShortcuts: showShortcuts,
  });

  return (
    <InvoiceBuilderShell
      docTypeLabel="Proforma"
      newDocLabel="New"
      newDocShortcutLabel="New proforma"
      panelAriaLabel="Proforma fields"
      exportFilePrefix="proforma"
      docNumber={form.document.documentNumber}
      grandTotal={formatMoney(totals?.grandTotal)}
      saveState={saveState}
      savedAt={savedAt}
      panelOpen={panelOpen}
      onTogglePanel={togglePanel}
      onPrint={handlePrint}
      onSaveNow={saveNow}
      onNewInvoice={newProforma}
      shortcutsOpen={shortcutsOpen}
      onShortcutsClose={() => setShortcutsOpen(false)}
      onShowShortcuts={showShortcuts}
      exportRef={exportRef}
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
        />
      }
    >
      {(previewRef) => (
        <ProformaPreview
          form={form}
          previewRef={previewRef}
          editable
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
