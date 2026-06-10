import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Common/ProtectedRoute';
import AppLayout from './components/Layout/AppLayout';

import Login from './components/Auth/Login';
import TicketList from './components/Tickets/TicketList';
import TicketForm from './components/Tickets/TicketForm';
import TicketDetail from './components/Tickets/TicketDetail';
import EquipementList from './components/Equipements/EquipementList';
import EquipementDetail from './components/Equipements/EquipementDetail'; // ← AJOUTÉ
import ResponsableDashboard from './components/Dashboard/ResponsableDashboard';

const theme = {
  token: {
    colorPrimary: '#13A538',
    borderRadius: 6,
    fontFamily: "'Montserrat', sans-serif",
  },
};

const App = () => (
  <ConfigProvider locale={frFR} theme={theme}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes — shared layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/tickets" replace />} />

            <Route path="/tickets" element={<TicketList />} />
            <Route
              path="/tickets/nouveau"
              element={
                <ProtectedRoute roles={['operateur', 'responsable']}>
                  <TicketForm />
                </ProtectedRoute>
              }
            />
            <Route path="/tickets/:id" element={<TicketDetail />} />

            <Route
              path="/equipements"
              element={
                <ProtectedRoute roles={['technicien', 'responsable']}>
                  <EquipementList />
                </ProtectedRoute>
              }
            />

            {/* Nouvelle route : détail d’un équipement */}
            <Route
              path="/equipements/:id"
              element={
                <ProtectedRoute roles={['technicien', 'responsable']}>
                  <EquipementDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute roles={['responsable']}>
                  <ResponsableDashboard />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ConfigProvider>
);

export default App;