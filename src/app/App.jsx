import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../shared/auth.jsx';
import Layout from './Layout.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import ModulesHomePage from '../features/dashboards/DashboardPage.jsx';
import TrackingDashboardPage from '../features/dashboards/TrackingDashboardPage.jsx';
import RecipientSignPage from '../features/agreements/RecipientSignPage.jsx';
import SelfVerifyPage from '../features/verifications/SelfVerifyPage.jsx';
import AssetsPage from '../features/assets/AssetsPage.jsx';
import AssetDetailPage from '../features/assets/AssetDetailPage.jsx';
import AgreementsPage from '../features/agreements/AgreementsPage.jsx';
import AgreementCreatePage from '../features/agreements/AgreementCreatePage.jsx';
import AgreementDetailPage from '../features/agreements/AgreementDetailPage.jsx';
import ContactDirectoryPage from '../features/agreements/ContactDirectoryPage.jsx';
import DocumentMasterPage from '../features/agreements/DocumentMasterPage.jsx';
import SignatureMasterPage from '../features/agreements/SignatureMasterPage.jsx';
import RolePermissionMasterPage from '../features/users/RolePermissionMasterPage.jsx';
import VerificationsPage from '../features/verifications/VerificationsPage.jsx';
import AssetRequestsPage from '../features/assetRequests/AssetRequestsPage.jsx';
import RequestProductUploadPage from '../features/assetRequests/RequestProductUploadPage.jsx';
import ImportsPage from '../features/imports/ImportsPage.jsx';
import AuditPage from '../features/audit/AuditPage.jsx';
import NotificationsPage from '../features/notifications/NotificationsPage.jsx';
import CampsPage from '../features/camps/CampsPage.jsx';
import LogisticsLayout from '../features/logistics/LogisticsLayout.jsx';
import LogisticsHubPage from '../features/logistics/LogisticsHubPage.jsx';
import LogisticsInwardPage from '../features/logistics/LogisticsInwardPage.jsx';
import LogisticsOutwardPage from '../features/logistics/LogisticsOutwardPage.jsx';
import LogisticsInventoryPage from '../features/logistics/LogisticsInventoryPage.jsx';
import LogisticsUsagePage from '../features/logistics/LogisticsUsagePage.jsx';
import LogisticsOutputPage from '../features/logistics/LogisticsOutputPage.jsx';
import LogisticsMasterPage from '../features/logistics/LogisticsMasterPage.jsx';
import LocationMasterPage from '../features/locations/LocationMasterPage.jsx';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-page">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
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
                <Route path="/assets" element={<AssetsPage />} />
                <Route
                  path="/assets/asset-master"
                  element={<Navigate to="/assets" replace />}
                />
                <Route
                  path="/assets/product-master"
                  element={<Navigate to="/assets" replace />}
                />
                <Route path="/assets/:id" element={<AssetDetailPage />} />
                <Route path="/hcws" element={<Navigate to="/agreements/contacts" replace />} />
                <Route path="/devices" element={<Navigate to="/assets" replace />} />
                <Route path="/agreements" element={<AgreementsPage />} />
                <Route path="/agreements/contacts" element={<ContactDirectoryPage />} />
                <Route path="/agreements/location-master" element={<LocationMasterPage />} />
                <Route path="/locations" element={<LocationMasterPage />} />
                <Route path="/agreements/document-master" element={<DocumentMasterPage />} />
                <Route path="/agreements/signature-master" element={<SignatureMasterPage />} />
                <Route path="/agreements/new" element={<AgreementCreatePage />} />
                <Route path="/agreements/:id" element={<AgreementDetailPage />} />
                <Route path="/verifications" element={<VerificationsPage />} />
                <Route path="/camps" element={<CampsPage />} />
                <Route path="/asset-requests" element={<AssetRequestsPage />} />
                <Route path="/movements" element={<Navigate to="/asset-requests" replace />} />
                <Route path="/repairs" element={<Navigate to="/asset-requests" replace />} />
                <Route path="/logistics" element={<LogisticsLayout />}>
                  <Route index element={<LogisticsHubPage />} />
                  <Route path="inward" element={<LogisticsInwardPage />} />
                  <Route path="outward" element={<LogisticsOutwardPage />} />
                  <Route path="in-out" element={<Navigate to="/logistics/inward" replace />} />
                  <Route path="balance" element={<LogisticsInventoryPage />} />
                  <Route path="usage" element={<LogisticsUsagePage />} />
                  <Route path="output" element={<LogisticsOutputPage />} />
                  <Route path="master" element={<LogisticsMasterPage />} />
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
