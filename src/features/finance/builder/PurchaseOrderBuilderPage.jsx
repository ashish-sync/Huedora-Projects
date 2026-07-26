import { useCallback, useRef, useState } from 'react';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import PurchaseOrderPreview from '../purchaseOrder/PurchaseOrderPreview.jsx';
import PurchaseOrderBuilderPanel from '../purchaseOrder/PurchaseOrderBuilderPanel.jsx';
import { usePurchaseOrderBuilder } from '../purchaseOrder/usePurchaseOrderBuilder.js';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';
import { useBuilderKeyboard } from './useBuilderKeyboard.js';

export default function PurchaseOrderBuilderPage() {
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
    newPurchaseOrder,
  } = usePurchaseOrderBuilder();

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const handlePrint = useCallback(() => window.print(), []);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useBuilderKeyboard({
    onTogglePanel: togglePanel,
    onPrint: handlePrint,
    onExportPdf: () => exportRef.current?.(),
    onNewInvoice: newPurchaseOrder,
    onShowShortcuts: showShortcuts,
  });

  return (
    <InvoiceBuilderShell
      docTypeLabel="Purchase Order"
      newDocLabel="New"
      newDocShortcutLabel="New purchase order"
      panelAriaLabel="Purchase order fields"
      exportFilePrefix="purchase-order"
      docNumber={form.documentNumber}
      grandTotal={formatMoney(totals?.total)}
      saveState={saveState}
      savedAt={savedAt}
      panelOpen={panelOpen}
      onTogglePanel={togglePanel}
      onPrint={handlePrint}
      onSaveNow={saveNow}
      onNewInvoice={newPurchaseOrder}
      shortcutsOpen={shortcutsOpen}
      onShortcutsClose={() => setShortcutsOpen(false)}
      onShowShortcuts={showShortcuts}
      exportRef={exportRef}
      panel={
        <PurchaseOrderBuilderPanel
          form={form}
          totals={totals}
          update={update}
          updateLine={updateLine}
          addLine={addLine}
          removeLine={removeLine}
        />
      }
    >
      {(previewRef) => (
        <PurchaseOrderPreview
          form={form}
          totals={totals}
          previewRef={previewRef}
          editable
          onUpdate={update}
          onUpdateLine={updateLine}
          onAddLine={addLine}
        />
      )}
    </InvoiceBuilderShell>
  );
}
