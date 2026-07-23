import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '../shared/auth.jsx';
import Layout from './Layout.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import ModulesHomePage from '../features/dashboards/DashboardPage.jsx';
import TrackingDashboardPage from '../features/dashboards/TrackingDashboardPage.jsx';
import RecipientSignPage from '../features/agreements/RecipientSignPage.jsx';
import SelfVerifyPage from '../features/verifications/SelfVerifyPage.jsx';
import AssetDetailPage from '../features/assets/AssetDetailPage.jsx';
import AgreementsPage from '../features/agreements/AgreementsPage.jsx';
import AgreementCreatePage from '../features/agreements/AgreementCreatePage.jsx';
import AgreementDetailPage from '../features/agreements/AgreementDetailPage.jsx';
import RolePermissionMasterPage from '../features/users/RolePermissionMasterPage.jsx';
import VerificationsPage from '../features/verifications/VerificationsPage.jsx';
import AssetRequestsPage from '../features/assetRequests/AssetRequestsPage.jsx';
import RequestProductUploadPage from '../features/assetRequests/RequestProductUploadPage.jsx';
import ImportsPage from '../features/imports/ImportsPage.jsx';
import AuditPage from '../features/audit/AuditPage.jsx';
import NotificationsPage from '../features/notifications/NotificationsPage.jsx';
import CampOpsLayout from '../features/camps/CampOpsLayout.jsx';
import CampDashboardPage from '../features/camps/CampDashboardPage.jsx';
import CampManagePage from '../features/camps/CampManagePage.jsx';
import CampFormPage from '../features/camps/CampFormPage.jsx';
import ClientMasterFormRoute from '../features/camps/ClientMasterFormRoute.jsx';
import { CLIENT_MASTER_ENTITY, CLIENT_MASTER_SCOPE } from '../features/camps/clientMasterPaths.js';
import CampImportPage from '../features/camps/CampImportPage.jsx';
import CommunicationsLayout from '../features/camps/CommunicationsLayout.jsx';
import CommunicationsEmailPage from '../features/camps/CommunicationsEmailPage.jsx';
import CommunicationsPastePage from '../features/camps/CommunicationsPastePage.jsx';
import CampChargesheetPage from '../features/camps/CampChargesheetPage.jsx';
import CampPayoutPage from '../features/camps/CampPayoutPage.jsx';
import LogisticsLayout from '../features/logistics/LogisticsLayout.jsx';
import LogisticsHubPage from '../features/logistics/LogisticsHubPage.jsx';
import LogisticsInwardPage from '../features/logistics/LogisticsInwardPage.jsx';
import LogisticsOutwardPage from '../features/logistics/LogisticsOutwardPage.jsx';
import LogisticsUsagePage from '../features/logistics/LogisticsUsagePage.jsx';
import LogisticsOutputPage from '../features/logistics/LogisticsOutputPage.jsx';
import AssetInventoryLayout from '../features/assets/AssetInventoryLayout.jsx';
import AssetOverviewPage from '../features/assets/AssetOverviewPage.jsx';
import AssetTypeStockPage from '../features/assets/AssetTypeStockPage.jsx';
import MasterDataPage from '../features/masters/MasterDataPage.jsx';
import FinanceLayout from '../features/finance/FinanceLayout.jsx';
import FinanceOverviewPage from '../features/finance/FinanceOverviewPage.jsx';
import FinanceExpensesPage from '../features/finance/FinanceExpensesPage.jsx';
import FinanceInvoicesPage from '../features/finance/FinanceInvoicesPage.jsx';
import FinanceGenerateInvoicePage from '../features/finance/FinanceGenerateInvoicePage.jsx';
import FinanceProformaPage from '../features/finance/FinanceProformaPage.jsx';
import FinancePurchaseOrdersPage from '../features/finance/FinancePurchaseOrdersPage.jsx';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-page">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function CampClientMasterEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/master-data/client-masters/${id}/edit`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/v/:token" element={<SelfVerifyPage />} />
      <Route path="/verify/:token" element={<SelfVerifyPage />} />
      <Route path="/s/:token" element={<RecipientSignPage />} />
      <Route path="/sign/:token" element={<RecipientSignPage />} />
      <Route path="/request-upload/:token" element={<RequestProductUploadPage />} />
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
                  <Route path="types/:typeSlug" element={<AssetTypeStockPage />} />
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
                  element={<Navigate to="/master-data?scope=document&entity=pin-codes" replace />}
                />
                <Route
                  path="/locations"
                  element={<Navigate to="/master-data?scope=document&entity=pin-codes" replace />}
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
                  <Route index element={<CampDashboardPage />} />
                  <Route path="manage" element={<CampManagePage />} />
                  <Route path="manage/new" element={<CampFormPage />} />
                  <Route path="manage/:id/edit" element={<CampFormPage />} />
                  <Route path="import" element={<CampImportPage />} />
                  <Route path="chargesheet" element={<CampChargesheetPage />} />
                  <Route path="payout" element={<CampPayoutPage />} />
                  <Route path="communications" element={<CommunicationsLayout />}>
                    <Route index element={<Navigate to="paste" replace />} />
                    <Route path="paste" element={<CommunicationsPastePage />} />
                    <Route path="email" element={<CommunicationsEmailPage />} />
                  </Route>
                  <Route path="communications/whatsapp" element={<Navigate to="/camps/communications/paste" replace />} />
                  <Route path="client-masters" element={<Navigate to={`/master-data?scope=${CLIENT_MASTER_SCOPE}&entity=${CLIENT_MASTER_ENTITY}`} replace />} />
                  <Route path="client-masters/new" element={<Navigate to="/master-data/client-masters/new" replace />} />
                  <Route path="client-masters/:id/edit" element={<CampClientMasterEditRedirect />} />
                  <Route path="users" element={<Navigate to="/role-permission-master" replace />} />
                </Route>
                <Route path="/finance" element={<FinanceLayout />}>
                  <Route index element={<FinanceOverviewPage />} />
                  <Route path="expenses" element={<FinanceExpensesPage />} />
                  <Route path="invoices" element={<FinanceInvoicesPage />} />
                  <Route path="proforma" element={<FinanceProformaPage />} />
                  <Route path="purchase-orders" element={<FinancePurchaseOrdersPage />} />
                  <Route path="generate-invoice" element={<FinanceGenerateInvoicePage />} />
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
