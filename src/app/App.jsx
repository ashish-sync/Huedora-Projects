import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '../shared/auth.jsx';
import { isBootSequenceEnabled } from '../shared/loginExperienceConfig.js';
import Layout from './Layout.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import { CLIENT_MASTER_ENTITY, CLIENT_MASTER_SCOPE } from '../features/camps/clientMasterPaths.js';

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
const FinanceOverviewPage = lazy(() => import('../features/finance/FinanceOverviewPage.jsx'));
const FinanceBuilderPickerPage = lazy(() => import('../features/finance/FinanceBuilderPickerPage.jsx'));
const InvoiceBuilderPage = lazy(() => import('../features/finance/builder/InvoiceBuilderPage.jsx'));
const ProformaBuilderPage = lazy(() => import('../features/finance/builder/ProformaBuilderPage.jsx'));
const PurchaseOrderBuilderPage = lazy(() => import('../features/finance/builder/PurchaseOrderBuilderPage.jsx'));
const CreditNoteBuilderPage = lazy(() => import('../features/finance/builder/CreditNoteBuilderPage.jsx'));
const FinanceCommercialMasterPage = lazy(() => import('../features/finance/FinanceCommercialMasterPage.jsx'));
const FinanceCampPayoutsPage = lazy(() => import('../features/finance/FinanceCampPayoutsPage.jsx'));
const FinanceVendorBillsPage = lazy(() => import('../features/finance/FinanceVendorBillsPage.jsx'));
const FinanceVendorBillDetailPage = lazy(() => import('../features/finance/FinanceVendorBillDetailPage.jsx'));
const FinanceGeneratePage = lazy(() => import('../features/finance/FinanceGeneratePage.jsx'));

function PageLoader() {
  return <div className="login-page">Loading…</div>;
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
  return <Navigate to={`/master-data/client-masters/${id}/edit`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
                <Route path="/dashboard" element={<TrackingDashboardPage />} />
                <Route path="/role-permission-master" element={<RolePermissionMasterPage />} />
                <Route
                  path="/agreements/role-permission-master"
                  element={<Navigate to="/role-permission-master" replace />}
                />
                <Route path="/master-data" element={<MasterDataPage />} />
                <Route path="/master-data/client-masters/new" element={<ClientMasterFormRoute />} />
                <Route path="/master-data/client-masters/:id/edit" element={<ClientMasterFormRoute />} />
                <Route path="/asset-inventory" element={<AssetInventoryLayout />}>
                  <Route index element={<AssetOverviewPage />} />
                  <Route path="types/:typeSlug" element={<Navigate to="/asset-inventory" replace />} />
                  <Route path="balance" element={<Navigate to="/asset-inventory" replace />} />
                  <Route
                    path="masters"
                    element={<Navigate to="/master-data?scope=inventory" replace />}
                  />
                </Route>
                <Route path="/assets" element={<Navigate to="/asset-inventory" replace />} />
                <Route
                  path="/assets/asset-master"
                  element={<Navigate to="/asset-inventory" replace />}
                />
                <Route
                  path="/assets/product-master"
                  element={<Navigate to="/master-data?scope=inventory&entity=products" replace />}
                />
                <Route path="/assets/:id" element={<AssetDetailPage />} />
                <Route path="/devices" element={<Navigate to="/asset-inventory" replace />} />
                <Route path="/agreements" element={<AgreementsPage />} />
                <Route
                  path="/agreements/contacts"
                  element={<Navigate to="/master-data?scope=document&entity=contacts" replace />}
                />
                <Route
                  path="/agreements/location-master"
                  element={<Navigate to="/master-data?scope=camp&entity=pin-codes" replace />}
                />
                <Route
                  path="/locations"
                  element={<Navigate to="/master-data?scope=camp&entity=pin-codes" replace />}
                />
                <Route
                  path="/agreements/document-master"
                  element={<Navigate to="/master-data?scope=document&entity=templates" replace />}
                />
                <Route
                  path="/agreements/signature-master"
                  element={<Navigate to="/master-data?scope=document&entity=signatures" replace />}
                />
                <Route path="/agreements/new" element={<AgreementCreatePage />} />
                <Route path="/agreements/:id" element={<AgreementDetailPage />} />
                <Route path="/hcws" element={<Navigate to="/master-data?scope=document&entity=contacts" replace />} />
                <Route path="/verifications" element={<VerificationsPage />} />
                <Route path="/camps" element={<CampOpsLayout />}>
                  <Route index element={<Navigate to="manage" replace />} />
                  <Route path="manage" element={<CampManagePage />} />
                  <Route path="manage/new" element={<CampFormPage />} />
                  <Route path="manage/:id/edit" element={<CampFormPage />} />
                  <Route path="import" element={<Navigate to="/camps/communications/upload" replace />} />
                  <Route path="chargesheet" element={<Navigate to="/camps/manage" replace />} />
                  <Route path="payout" element={<Navigate to="/finance/payouts" replace />} />
                  <Route path="communications" element={<CommunicationsLayout />}>
                    <Route index element={<Navigate to="paste" replace />} />
                    <Route path="paste" element={<CommunicationsPastePage />} />
                    <Route path="email" element={<CommunicationsEmailPage />} />
                    <Route path="upload" element={<CampImportPage />} />
                    <Route path="download" element={<CampDownloadPage />} />
                  </Route>
                  <Route path="communications/whatsapp" element={<Navigate to="/camps/communications/paste" replace />} />
                  <Route path="client-masters" element={<Navigate to={`/master-data?scope=${CLIENT_MASTER_SCOPE}&entity=${CLIENT_MASTER_ENTITY}`} replace />} />
                  <Route path="client-masters/new" element={<Navigate to="/master-data/client-masters/new" replace />} />
                  <Route path="client-masters/:id/edit" element={<CampClientMasterEditRedirect />} />
                  <Route path="users" element={<Navigate to="/role-permission-master" replace />} />
                </Route>
                <Route path="/finance" element={<FinanceLayout />}>
                  <Route index element={<FinanceOverviewPage />} />
                  <Route path="build" element={<FinanceBuilderPickerPage />} />
                  <Route path="build/invoice" element={<InvoiceBuilderPage />} />
                  <Route path="build/invoice/:id" element={<InvoiceBuilderPage />} />
                  <Route path="build/proforma" element={<ProformaBuilderPage />} />
                  <Route path="build/proforma/:id" element={<ProformaBuilderPage />} />
                  <Route path="build/purchase-order" element={<PurchaseOrderBuilderPage />} />
                  <Route path="build/purchase-order/:id" element={<PurchaseOrderBuilderPage />} />
                  <Route path="build/credit-note" element={<CreditNoteBuilderPage />} />
                  <Route path="build/credit-note/:id" element={<CreditNoteBuilderPage />} />
                  <Route path="master" element={<FinanceCommercialMasterPage />} />
                  <Route path="payouts" element={<FinanceCampPayoutsPage />} />
                  <Route path="camp-payouts" element={<Navigate to="/finance/payouts" replace />} />
                  <Route path="vendor-bills" element={<FinanceVendorBillsPage />} />
                  <Route path="vendor-bills/:id" element={<FinanceVendorBillDetailPage />} />
                  <Route path="generate" element={<FinanceGeneratePage />} />
                  <Route path="generate/:docSlug" element={<FinanceGeneratePage />} />
                  <Route path="expenses" element={<Navigate to="/finance" replace />} />
                  <Route path="invoices" element={<Navigate to="/finance/vendor-bills" replace />} />
                  <Route path="proforma" element={<Navigate to="/finance" replace />} />
                  <Route path="purchase-orders" element={<Navigate to="/finance" replace />} />
                  <Route path="generate-invoice" element={<Navigate to="/finance/build/invoice" replace />} />
                </Route>
                <Route path="/asset-requests" element={<AssetRequestsPage />} />
                <Route path="/movements" element={<Navigate to="/asset-requests" replace />} />
                <Route path="/repairs" element={<Navigate to="/asset-requests" replace />} />
                <Route path="/logistics" element={<LogisticsLayout />}>
                  <Route index element={<LogisticsHubPage />} />
                  <Route path="inward" element={<LogisticsInwardPage />} />
                  <Route path="outward" element={<LogisticsOutwardPage />} />
                  <Route path="in-out" element={<Navigate to="/logistics/inward" replace />} />
                  <Route path="balance" element={<Navigate to="/asset-inventory" replace />} />
                  <Route path="usage" element={<LogisticsUsagePage />} />
                  <Route path="output" element={<LogisticsOutputPage />} />
                  <Route
                    path="master"
                    element={<Navigate to="/master-data?scope=movement" replace />}
                  />
                </Route>
                <Route path="/imports" element={<ImportsPage />} />
                <Route path="/users" element={<Navigate to="/role-permission-master" replace />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
