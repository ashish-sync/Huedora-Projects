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
import MovementsPage from '../features/movements/MovementsPage.jsx';
import RepairsPage from '../features/repairs/RepairsPage.jsx';
import ImportsPage from '../features/imports/ImportsPage.jsx';
import AuditPage from '../features/audit/AuditPage.jsx';
import NotificationsPage from '../features/notifications/NotificationsPage.jsx';
import CampsPage from '../features/camps/CampsPage.jsx';

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
                <Route path="/agreements/document-master" element={<DocumentMasterPage />} />
                <Route path="/agreements/signature-master" element={<SignatureMasterPage />} />
                <Route path="/agreements/new" element={<AgreementCreatePage />} />
                <Route path="/agreements/:id" element={<AgreementDetailPage />} />
                <Route path="/verifications" element={<VerificationsPage />} />
                <Route path="/camps" element={<CampsPage />} />
                <Route path="/movements" element={<MovementsPage />} />
                <Route path="/repairs" element={<RepairsPage />} />
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
