import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/auth.jsx';
import { isBootSequenceEnabled } from '../shared/loginExperienceConfig.js';
import Layout from './Layout.jsx';
import { CLIENT_MASTER_ENTITY, CLIENT_MASTER_SCOPE } from '../features/camps/clientMasterPaths.js';
import {
  CAMP_PATH,
  FINANCE_PATH,
  MODULE_PATH,
  MOVEMENT_PATH,
  assetOneDetailPath,
} from '../shared/moduleRoutes.js';

const LoginPage = lazy(() => import('../features/auth/LoginPage.jsx'));
const TyloBootSequence = lazy(() => import('../features/auth/TyloBootSequence.jsx'));

const ModulesHomePage = lazy(() => import('../features/dashboards/DashboardPage.jsx'));
const TrackingDashboardPage = lazy(() => import('../features/dashboards/TrackingDashboardPage.jsx'));
const RecipientSignPage = lazy(() => import('../features/agreements/RecipientSignPage.jsx'));
const SelfVerifyPage = lazy(() => import('../features/verifications/SelfVerifyPage.jsx'));
const AssetDetailPage = lazy(() => import('../features/assets/AssetDetailPage.jsx'));
const AgreementsPage = lazy(() => import('../features/agreements/AgreementsPage.jsx'));
const AgreementCreatePage = lazy(() => import('../features/agreements/AgreementCreatePage.jsx'));
const AgreementDetailPage = lazy(() => import('../features/agreements/AgreementDetailPage.jsx'));
const RolePermissionMasterPage = lazy(() => import('../features/users/RolePermissionMasterPage.jsx'));
const VerificationsPage = lazy(() => import('../features/verifications/VerificationsPage.jsx'));
const AssetRequestsPage = lazy(() => import('../features/assetRequests/AssetRequestsPage.jsx'));
const RequestProductUploadPage = lazy(() => import('../features/assetRequests/RequestProductUploadPage.jsx'));
const ImportsPage = lazy(() => import('../features/imports/ImportsPage.jsx'));
const AuditPage = lazy(() => import('../features/audit/AuditPage.jsx'));
const NotificationsPage = lazy(() => import('../features/notifications/NotificationsPage.jsx'));
const CampOpsLayout = lazy(() => import('../features/camps/CampOpsLayout.jsx'));
const CampManagePage = lazy(() => import('../features/camps/CampManagePage.jsx'));
const CampFormPage = lazy(() => import('../features/camps/CampFormPage.jsx'));
const ClientMasterFormRoute = lazy(() => import('../features/camps/ClientMasterFormRoute.jsx'));
const CampImportPage = lazy(() => import('../features/camps/CampImportPage.jsx'));
const CampDownloadPage = lazy(() => import('../features/camps/CampDownloadPage.jsx'));
const CommunicationsLayout = lazy(() => import('../features/camps/CommunicationsLayout.jsx'));
const CommunicationsEmailPage = lazy(() => import('../features/camps/CommunicationsEmailPage.jsx'));
const CommunicationsPastePage = lazy(() => import('../features/camps/CommunicationsPastePage.jsx'));
const LogisticsLayout = lazy(() => import('../features/logistics/LogisticsLayout.jsx'));
const LogisticsHubPage = lazy(() => import('../features/logistics/LogisticsHubPage.jsx'));
const LogisticsInwardPage = lazy(() => import('../features/logistics/LogisticsInwardPage.jsx'));
const LogisticsOutwardPage = lazy(() => import('../features/logistics/LogisticsOutwardPage.jsx'));
const LogisticsUsagePage = lazy(() => import('../features/logistics/LogisticsUsagePage.jsx'));
const LogisticsOutputPage = lazy(() => import('../features/logistics/LogisticsOutputPage.jsx'));
const AssetInventoryLayout = lazy(() => import('../features/assets/AssetInventoryLayout.jsx'));
const AssetOverviewPage = lazy(() => import('../features/assets/AssetOverviewPage.jsx'));
const MasterDataPage = lazy(() => import('../features/masters/MasterDataPage.jsx'));
const FinanceLayout = lazy(() => import('../features/finance/FinanceLayout.jsx'));
const FinanceBuilderPickerPage = lazy(() => import('../features/finance/FinanceBuilderPickerPage.jsx'));
const InvoiceBuilderPage = lazy(() => import('../features/finance/builder/InvoiceBuilderPage.jsx'));
const ProformaBuilderPage = lazy(() => import('../features/finance/builder/ProformaBuilderPage.jsx'));
const PurchaseOrderBuilderPage = lazy(() => import('../features/finance/builder/PurchaseOrderBuilderPage.jsx'));
const CreditNoteBuilderPage = lazy(() => import('../features/finance/builder/CreditNoteBuilderPage.jsx'));
const DebitNoteBuilderPage = lazy(() => import('../features/finance/builder/DebitNoteBuilderPage.jsx'));
const DeliveryChallanBuilderPage = lazy(() => import('../features/finance/builder/DeliveryChallanBuilderPage.jsx'));
const BillOfSupplyBuilderPage = lazy(() => import('../features/finance/builder/BillOfSupplyBuilderPage.jsx'));
const QuotationBuilderPage = lazy(() => import('../features/finance/builder/QuotationBuilderPage.jsx'));
const FinanceCommercialMasterPage = lazy(() => import('../features/finance/FinanceCommercialMasterPage.jsx'));
const FinanceCampPayoutsPage = lazy(() => import('../features/finance/FinanceCampPayoutsPage.jsx'));
const FinanceVendorBillsPage = lazy(() => import('../features/finance/FinanceVendorBillsPage.jsx'));
const FinanceVendorBillDetailPage = lazy(() => import('../features/finance/FinanceVendorBillDetailPage.jsx'));
const FinanceGeneratePage = lazy(() => import('../features/finance/FinanceGeneratePage.jsx'));

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader__track" aria-hidden="true">
        <div className="page-loader__bar" />
      </div>
      <span className="page-loader__label">Loading</span>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading, bootSessionActive, completeLoginBoot } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (bootSessionActive && isBootSequenceEnabled()) {
    return (
      <Suspense fallback={<PageLoader />}>
        <TyloBootSequence user={user} onComplete={completeLoginBoot} />
      </Suspense>
    );
  }
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function CampClientMasterEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`${MODULE_PATH.MASTER_ONE}/client-masters/${id}/edit`} replace />;
}

function LegacyAssetDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={assetOneDetailPath(id)} replace />;
}

function LegacyAgreementDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`${MODULE_PATH.DOCUMENT_ONE}/${id}`} replace />;
}

function LegacyCampEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`${CAMP_PATH.MANAGE}/${id}/edit`} replace />;
}

function LegacyFinanceDocRedirect({ slug }) {
  const { id } = useParams();
  const base = `${FINANCE_PATH.BILLING}/${slug}`;
  return <Navigate to={id ? `${base}/${id}` : base} replace />;
}

function LegacyVendorBillRedirect() {
  const { id } = useParams();
  return <Navigate to={`${FINANCE_PATH.VENDOR_BILLS}/${id}`} replace />;
}

function LegacyPathRewrite({ fromPrefix, toPrefix }) {
  const location = useLocation();
  const rest = location.pathname.startsWith(fromPrefix)
    ? location.pathname.slice(fromPrefix.length)
    : '';
  return <Navigate to={`${toPrefix}${rest}${location.search || ''}${location.hash || ''}`} replace />;
}

function LegacyPrefixRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search || ''}${location.hash || ''}`} replace />;
}

export default function App() {
  const masterClientList = `${MODULE_PATH.MASTER_ONE}?scope=${CLIENT_MASTER_SCOPE}&entity=${CLIENT_MASTER_ENTITY}`;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageLoader />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route path="/v/:token" element={<Suspense fallback={<PageLoader />}><SelfVerifyPage /></Suspense>} />
      <Route path="/verify/:token" element={<Suspense fallback={<PageLoader />}><SelfVerifyPage /></Suspense>} />
      <Route path="/s/:token" element={<Suspense fallback={<PageLoader />}><RecipientSignPage /></Suspense>} />
      <Route path="/sign/:token" element={<Suspense fallback={<PageLoader />}><RecipientSignPage /></Suspense>} />
      <Route path="/request-upload/:token" element={<Suspense fallback={<PageLoader />}><RequestProductUploadPage /></Suspense>} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<ModulesHomePage />} />
                <Route path={MODULE_PATH.DASHBOARD} element={<TrackingDashboardPage />} />
                <Route path={MODULE_PATH.ACCESS_CONTROL} element={<RolePermissionMasterPage />} />

                {/* Master One */}
                <Route path={MODULE_PATH.MASTER_ONE} element={<MasterDataPage />} />
                <Route path={`${MODULE_PATH.MASTER_ONE}/client-masters/new`} element={<ClientMasterFormRoute />} />
                <Route path={`${MODULE_PATH.MASTER_ONE}/client-masters/:id/edit`} element={<ClientMasterFormRoute />} />

                {/* Asset One */}
                <Route path={MODULE_PATH.ASSET_ONE} element={<AssetInventoryLayout />}>
                  <Route index element={<AssetOverviewPage />} />
                  <Route path="types/:typeSlug" element={<Navigate to={MODULE_PATH.ASSET_ONE} replace />} />
                  <Route path="balance" element={<Navigate to={MODULE_PATH.ASSET_ONE} replace />} />
                  <Route
                    path="masters"
                    element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=inventory`} replace />}
                  />
                </Route>
                <Route path={`${MODULE_PATH.ASSET_ONE}/assets/:id`} element={<AssetDetailPage />} />

                {/* Document One */}
                <Route path={MODULE_PATH.DOCUMENT_ONE} element={<AgreementsPage />} />
                <Route path={`${MODULE_PATH.DOCUMENT_ONE}/new`} element={<AgreementCreatePage />} />
                <Route path={`${MODULE_PATH.DOCUMENT_ONE}/:id`} element={<AgreementDetailPage />} />

                <Route path={MODULE_PATH.VERIFICATION_ONE} element={<VerificationsPage />} />

                {/* Camp One */}
                <Route path={MODULE_PATH.CAMP_ONE} element={<CampOpsLayout />}>
                  <Route index element={<Navigate to="manage" replace />} />
                  <Route path="manage" element={<CampManagePage />} />
                  <Route path="manage/new" element={<CampFormPage />} />
                  <Route path="manage/:id/edit" element={<CampFormPage />} />
                  <Route
                    path="operations"
                    element={<Navigate to={`${MODULE_PATH.DASHBOARD}?tab=drilldown&module=camps`} replace />}
                  />
                  <Route
                    path="dashboard"
                    element={<Navigate to={`${MODULE_PATH.DASHBOARD}?tab=drilldown&module=camps`} replace />}
                  />
                  <Route path="import" element={<Navigate to={CAMP_PATH.UPLOAD} replace />} />
                  <Route path="chargesheet" element={<Navigate to={CAMP_PATH.MANAGE} replace />} />
                  <Route path="payout" element={<Navigate to={FINANCE_PATH.PAYOUTS} replace />} />
                  <Route path="communications" element={<CommunicationsLayout />}>
                    <Route index element={<Navigate to="paste" replace />} />
                    <Route path="paste" element={<CommunicationsPastePage />} />
                    <Route path="email" element={<CommunicationsEmailPage />} />
                    <Route path="upload" element={<CampImportPage />} />
                    <Route path="download" element={<CampDownloadPage />} />
                  </Route>
                  <Route path="communications/whatsapp" element={<Navigate to={CAMP_PATH.PASTE} replace />} />
                  <Route path="client-masters" element={<Navigate to={masterClientList} replace />} />
                  <Route
                    path="client-masters/new"
                    element={<Navigate to={`${MODULE_PATH.MASTER_ONE}/client-masters/new`} replace />}
                  />
                  <Route path="client-masters/:id/edit" element={<CampClientMasterEditRedirect />} />
                  <Route path="users" element={<Navigate to={MODULE_PATH.ACCESS_CONTROL} replace />} />
                </Route>

                {/* Finance One */}
                <Route path={MODULE_PATH.FINANCE_ONE} element={<FinanceLayout />}>
                  <Route index element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                  <Route path="billing" element={<FinanceBuilderPickerPage />} />
                  <Route path="billing/invoice" element={<InvoiceBuilderPage />} />
                  <Route path="billing/invoice/:id" element={<InvoiceBuilderPage />} />
                  <Route path="billing/proforma" element={<ProformaBuilderPage />} />
                  <Route path="billing/proforma/:id" element={<ProformaBuilderPage />} />
                  <Route path="billing/purchase-order" element={<PurchaseOrderBuilderPage />} />
                  <Route path="billing/purchase-order/:id" element={<PurchaseOrderBuilderPage />} />
                  <Route path="billing/credit-note" element={<CreditNoteBuilderPage />} />
                  <Route path="billing/credit-note/:id" element={<CreditNoteBuilderPage />} />
                  <Route path="billing/debit-note" element={<DebitNoteBuilderPage />} />
                  <Route path="billing/debit-note/:id" element={<DebitNoteBuilderPage />} />
                  <Route path="billing/delivery-challan" element={<DeliveryChallanBuilderPage />} />
                  <Route path="billing/delivery-challan/:id" element={<DeliveryChallanBuilderPage />} />
                  <Route path="billing/bill-of-supply" element={<BillOfSupplyBuilderPage />} />
                  <Route path="billing/bill-of-supply/:id" element={<BillOfSupplyBuilderPage />} />
                  <Route path="billing/quotation" element={<QuotationBuilderPage />} />
                  <Route path="billing/quotation/:id" element={<QuotationBuilderPage />} />
                  <Route path="organisation" element={<FinanceCommercialMasterPage />} />
                  <Route path="payouts" element={<FinanceCampPayoutsPage />} />
                  <Route path="vendor-bills" element={<FinanceVendorBillsPage />} />
                  <Route path="vendor-bills/:id" element={<FinanceVendorBillDetailPage />} />
                  <Route path="generate" element={<FinanceGeneratePage />} />
                  <Route path="generate/:docSlug" element={<FinanceGeneratePage />} />
                  <Route path="expenses" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                  <Route path="invoices" element={<Navigate to={FINANCE_PATH.VENDOR_BILLS} replace />} />
                  <Route path="proforma" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                  <Route path="purchase-orders" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                  <Route path="generate-invoice" element={<Navigate to={FINANCE_PATH.INVOICE} replace />} />
                  {/* Legacy finance subpaths under new module root */}
                  <Route path="build" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                  <Route
                    path="build/*"
                    element={<LegacyPathRewrite fromPrefix="/finance-one/build" toPrefix={FINANCE_PATH.BILLING} />}
                  />
                  <Route path="master" element={<Navigate to={FINANCE_PATH.ORGANISATION} replace />} />
                  <Route path="camp-payouts" element={<Navigate to={FINANCE_PATH.PAYOUTS} replace />} />
                </Route>

                <Route path={MODULE_PATH.REQUEST_ONE} element={<AssetRequestsPage />} />

                {/* Movement One */}
                <Route path={MODULE_PATH.MOVEMENT_ONE} element={<LogisticsLayout />}>
                  <Route index element={<LogisticsHubPage />} />
                  <Route path="inward" element={<LogisticsInwardPage />} />
                  <Route path="outward" element={<LogisticsOutwardPage />} />
                  <Route path="in-out" element={<Navigate to={MOVEMENT_PATH.INWARD} replace />} />
                  <Route path="balance" element={<Navigate to={MODULE_PATH.ASSET_ONE} replace />} />
                  <Route path="usage" element={<LogisticsUsagePage />} />
                  <Route path="output" element={<LogisticsOutputPage />} />
                  <Route
                    path="master"
                    element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=movement`} replace />}
                  />
                </Route>

                <Route path={MODULE_PATH.IMPORTS} element={<ImportsPage />} />
                <Route path={MODULE_PATH.AUDIT} element={<AuditPage />} />
                <Route path={MODULE_PATH.NOTIFICATIONS} element={<NotificationsPage />} />

                {/* ─── Legacy redirects (bookmarks / old links) ─── */}
                <Route path="/role-permission-master" element={<Navigate to={MODULE_PATH.ACCESS_CONTROL} replace />} />
                <Route path="/agreements/role-permission-master" element={<Navigate to={MODULE_PATH.ACCESS_CONTROL} replace />} />
                <Route path="/users" element={<Navigate to={MODULE_PATH.ACCESS_CONTROL} replace />} />

                <Route path="/master-data" element={<LegacyPathRewrite fromPrefix="/master-data" toPrefix={MODULE_PATH.MASTER_ONE} />} />
                <Route
                  path="/master-data/client-masters/new"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}/client-masters/new`} replace />}
                />
                <Route path="/master-data/client-masters/:id/edit" element={<CampClientMasterEditRedirect />} />

                <Route path="/asset-inventory/*" element={<LegacyPathRewrite fromPrefix="/asset-inventory" toPrefix={MODULE_PATH.ASSET_ONE} />} />
                <Route path="/asset-inventory" element={<Navigate to={MODULE_PATH.ASSET_ONE} replace />} />
                <Route path="/assets" element={<Navigate to={MODULE_PATH.ASSET_ONE} replace />} />
                <Route path="/assets/asset-master" element={<Navigate to={MODULE_PATH.ASSET_ONE} replace />} />
                <Route
                  path="/assets/product-master"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=inventory&entity=products`} replace />}
                />
                <Route path="/assets/:id" element={<LegacyAssetDetailRedirect />} />
                <Route path="/devices" element={<Navigate to={MODULE_PATH.ASSET_ONE} replace />} />

                <Route path="/agreements" element={<Navigate to={MODULE_PATH.DOCUMENT_ONE} replace />} />
                <Route
                  path="/agreements/contacts"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=document&entity=contacts`} replace />}
                />
                <Route
                  path="/agreements/location-master"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=camp&entity=pin-codes`} replace />}
                />
                <Route
                  path="/locations"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=camp&entity=pin-codes`} replace />}
                />
                <Route
                  path="/agreements/document-master"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=document&entity=templates`} replace />}
                />
                <Route
                  path="/agreements/signature-master"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=document&entity=signatures`} replace />}
                />
                <Route path="/agreements/new" element={<Navigate to={`${MODULE_PATH.DOCUMENT_ONE}/new`} replace />} />
                <Route path="/agreements/:id" element={<LegacyAgreementDetailRedirect />} />
                <Route
                  path="/hcws"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=document&entity=contacts`} replace />}
                />

                <Route path="/verifications" element={<Navigate to={MODULE_PATH.VERIFICATION_ONE} replace />} />

                <Route path="/camps" element={<Navigate to={CAMP_PATH.MANAGE} replace />} />
                <Route path="/camps/manage" element={<Navigate to={CAMP_PATH.MANAGE} replace />} />
                <Route path="/camps/manage/new" element={<Navigate to={CAMP_PATH.MANAGE_NEW} replace />} />
                <Route path="/camps/manage/:id/edit" element={<LegacyCampEditRedirect />} />
                <Route path="/camps/import" element={<Navigate to={CAMP_PATH.UPLOAD} replace />} />
                <Route path="/camps/chargesheet" element={<Navigate to={CAMP_PATH.MANAGE} replace />} />
                <Route path="/camps/payout" element={<Navigate to={FINANCE_PATH.PAYOUTS} replace />} />
                <Route path="/camps/communications" element={<Navigate to={CAMP_PATH.PASTE} replace />} />
                <Route
                  path="/camps/communications/*"
                  element={<LegacyPathRewrite fromPrefix="/camps/communications" toPrefix={CAMP_PATH.COMMUNICATIONS} />}
                />
                <Route path="/camps/client-masters" element={<Navigate to={masterClientList} replace />} />
                <Route
                  path="/camps/client-masters/new"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}/client-masters/new`} replace />}
                />
                <Route path="/camps/client-masters/:id/edit" element={<CampClientMasterEditRedirect />} />
                <Route path="/camps/users" element={<Navigate to={MODULE_PATH.ACCESS_CONTROL} replace />} />

                <Route path="/finance" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                <Route path="/finance/build" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                <Route path="/finance/build/invoice" element={<Navigate to={FINANCE_PATH.INVOICE} replace />} />
                <Route path="/finance/build/invoice/:id" element={<LegacyFinanceDocRedirect slug="invoice" />} />
                <Route path="/finance/build/proforma" element={<Navigate to={FINANCE_PATH.PROFORMA} replace />} />
                <Route path="/finance/build/proforma/:id" element={<LegacyFinanceDocRedirect slug="proforma" />} />
                <Route
                  path="/finance/build/purchase-order"
                  element={<Navigate to={FINANCE_PATH.PURCHASE_ORDER} replace />}
                />
                <Route
                  path="/finance/build/purchase-order/:id"
                  element={<LegacyFinanceDocRedirect slug="purchase-order" />}
                />
                <Route path="/finance/build/credit-note" element={<Navigate to={FINANCE_PATH.CREDIT_NOTE} replace />} />
                <Route
                  path="/finance/build/credit-note/:id"
                  element={<LegacyFinanceDocRedirect slug="credit-note" />}
                />
                <Route path="/finance/build/debit-note" element={<Navigate to={FINANCE_PATH.DEBIT_NOTE} replace />} />
                <Route
                  path="/finance/build/debit-note/:id"
                  element={<LegacyFinanceDocRedirect slug="debit-note" />}
                />
                <Route
                  path="/finance/build/delivery-challan"
                  element={<Navigate to={FINANCE_PATH.DELIVERY_CHALLAN} replace />}
                />
                <Route
                  path="/finance/build/delivery-challan/:id"
                  element={<LegacyFinanceDocRedirect slug="delivery-challan" />}
                />
                <Route
                  path="/finance/build/bill-of-supply"
                  element={<Navigate to={FINANCE_PATH.BILL_OF_SUPPLY} replace />}
                />
                <Route
                  path="/finance/build/bill-of-supply/:id"
                  element={<LegacyFinanceDocRedirect slug="bill-of-supply" />}
                />
                <Route
                  path="/finance/build/quotation"
                  element={<Navigate to={FINANCE_PATH.QUOTATION} replace />}
                />
                <Route
                  path="/finance/build/quotation/:id"
                  element={<LegacyFinanceDocRedirect slug="quotation" />}
                />
                <Route path="/finance/master" element={<Navigate to={FINANCE_PATH.ORGANISATION} replace />} />
                <Route path="/finance/payouts" element={<Navigate to={FINANCE_PATH.PAYOUTS} replace />} />
                <Route path="/finance/camp-payouts" element={<Navigate to={FINANCE_PATH.PAYOUTS} replace />} />
                <Route path="/finance/vendor-bills" element={<Navigate to={FINANCE_PATH.VENDOR_BILLS} replace />} />
                <Route path="/finance/vendor-bills/:id" element={<LegacyVendorBillRedirect />} />
                <Route path="/finance/generate" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                <Route path="/finance/generate/:docSlug" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                <Route path="/finance/expenses" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                <Route path="/finance/invoices" element={<Navigate to={FINANCE_PATH.VENDOR_BILLS} replace />} />
                <Route path="/finance/proforma" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                <Route path="/finance/purchase-orders" element={<Navigate to={FINANCE_PATH.BILLING} replace />} />
                <Route path="/finance/generate-invoice" element={<Navigate to={FINANCE_PATH.INVOICE} replace />} />

                <Route path="/asset-requests" element={<Navigate to={MODULE_PATH.REQUEST_ONE} replace />} />
                <Route path="/movements" element={<Navigate to={MODULE_PATH.REQUEST_ONE} replace />} />
                <Route path="/repairs" element={<Navigate to={MODULE_PATH.REQUEST_ONE} replace />} />

                <Route path="/logistics" element={<Navigate to={MODULE_PATH.MOVEMENT_ONE} replace />} />
                <Route path="/logistics/inward" element={<Navigate to={MOVEMENT_PATH.INWARD} replace />} />
                <Route path="/logistics/outward" element={<Navigate to={MOVEMENT_PATH.OUTWARD} replace />} />
                <Route path="/logistics/usage" element={<Navigate to={MOVEMENT_PATH.USAGE} replace />} />
                <Route path="/logistics/output" element={<Navigate to={MOVEMENT_PATH.OUTPUT} replace />} />
                <Route path="/logistics/in-out" element={<Navigate to={MOVEMENT_PATH.INWARD} replace />} />
                <Route path="/logistics/balance" element={<Navigate to={MODULE_PATH.ASSET_ONE} replace />} />
                <Route
                  path="/logistics/master"
                  element={<Navigate to={`${MODULE_PATH.MASTER_ONE}?scope=movement`} replace />}
                />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
