import React, { useState } from 'react';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const { Text } = Typography;

const ROLE_REDIRECT = {
  responsable: '/dashboard',
  technicien: '/tickets',
  operateur: '/tickets',
};

const extractErrorMessage = (responseData) => {
  if (!responseData) return 'Identifiants incorrects. Veuillez réessayer.';
  if (responseData.detail) return responseData.detail;
  if (responseData.non_field_errors) return responseData.non_field_errors[0];
  const firstField = Object.values(responseData)[0];
  if (Array.isArray(firstField)) return firstField[0];
  return 'Identifiants incorrects. Veuillez réessayer.';
};

/* Icône hexagonale OCP en SVG inline */
const OcpHexLogo = () => (

  <img
    src="/OCP_Group.svg"
    alt="Logo OCP"
    style={{ width: '80px', height: '80px', objectFit: 'contain' }}
  />
);

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setError('');
    setLoading(true);
    try {
      const user = await login(values);
      navigate(ROLE_REDIRECT[user.role] || '/tickets');
    } catch (err) {
      setError(extractErrorMessage(err.response?.data));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Logo hexagonal + Titre */}
        <div style={styles.header}>
          <OcpHexLogo />
          <h2 style={styles.title}>OCP Ticketing</h2>
          <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>
        </div>

        {/* Message d'erreur */}
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 20, borderRadius: 8 }}
          />
        )}

        {/* Formulaire */}
        <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email requis' },
              { type: 'email', message: 'Email invalide' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
              placeholder="votre@email.com"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mot de passe"
            rules={[{ required: true, message: 'Mot de passe requis' }]}
            style={{ marginBottom: 24 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
              placeholder="Mot de passe"
              size="large"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
            className="login-btn"
          >
            Se connecter
          </Button>
        </Form>

      </div>
    </div>
  );
};

const styles = {
  header: {
    textAlign: 'center',
    marginBottom: 28,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: 'var(--font-family)',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-cool-grey)',
  },
};

export default Login;
