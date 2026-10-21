import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Claims from './pages/Claims';
import ClaimForm from './pages/ClaimForm';
import ClaimDetail from './pages/ClaimDetail';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import Reconciliation from './pages/Reconciliation';
import EmailDraft from './pages/EmailDraft';
import NotFound from './pages/NotFound';

// HashRouter keeps deep links working on any static host without rewrite rules.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="claims" element={<Claims />} />
              <Route path="claims/new" element={<ClaimForm />} />
              <Route path="claims/:id" element={<ClaimDetail />} />
              <Route path="claims/:id/edit" element={<ClaimForm />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="suppliers/:id" element={<SupplierDetail />} />
              <Route path="reconciliation" element={<Reconciliation />} />
              <Route path="email" element={<EmailDraft />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);
