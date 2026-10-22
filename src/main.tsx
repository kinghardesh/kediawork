import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/Toast';

// Pages load on demand so the first screen doesn't wait for every page (and the chart library).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Claims = lazy(() => import('./pages/Claims'));
const ClaimForm = lazy(() => import('./pages/ClaimForm'));
const ClaimDetail = lazy(() => import('./pages/ClaimDetail'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'));
const Reconciliation = lazy(() => import('./pages/Reconciliation'));
const EmailDraft = lazy(() => import('./pages/EmailDraft'));
const NotFound = lazy(() => import('./pages/NotFound'));

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
