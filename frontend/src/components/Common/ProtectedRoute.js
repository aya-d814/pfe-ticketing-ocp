import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Result, Button } from 'antd';

/**
 * Wraps a route requiring authentication.
 * Optionally restricts to specific roles via the `roles` prop.
 */
const ProtectedRoute = ({ children, roles }) => {
  const { user, isRole } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !isRole(...roles)) {
    return (
      <Result
        status="403"
        title="Accès refusé"
        subTitle="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
        extra={<Button type="primary" href="/tickets">Retour aux tickets</Button>}
      />
    );
  }

  return children;
};

export default ProtectedRoute;
