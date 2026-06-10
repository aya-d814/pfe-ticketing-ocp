import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Button, Dropdown, Space, Badge, Drawer, List, Typography, Empty, message } from 'antd';
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from './Navbar';
import { getNotifications, markNotificationRead } from '../../services/api';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

// ── Constantes ────────────────────────────────────────────────────────────────
const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED = 72;
const POLL_INTERVAL_MS = 30000; // 30 secondes

const ROLE_LABELS = {
  operateur: 'Opérateur',
  technicien: 'Technicien',
  responsable: 'Responsable',
};

const getInitials = (username = '') => username.slice(0, 2).toUpperCase() || 'OC';

// ── Sous-composant : item de notification ─────────────────────────────────────
const NotificationItem = ({ notif, onRead }) => (
  <List.Item
    onClick={() => onRead(notif)}
    style={{
      cursor: 'pointer',
      padding: '10px 16px',
      background: notif.est_lue ? 'transparent' : 'rgba(19,165,56,0.06)',
      borderLeft: notif.est_lue ? '3px solid transparent' : '3px solid var(--ocp-green)',
      transition: 'background 0.2s',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text
        style={{
          fontFamily: 'var(--font-family)',
          fontSize: 13,
          fontWeight: notif.est_lue ? 400 : 600,
          color: 'var(--ocp-dark-grey)',
        }}
      >
        {notif.message}
      </Text>
      <Text style={{ fontFamily: 'var(--font-family)', fontSize: 11, color: 'var(--ocp-cool-grey)' }}>
        {new Date(notif.date_creation).toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        })}
      </Text>
    </div>
  </List.Item>
);

// ── Composant principal ───────────────────────────────────────────────────────
const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const unreadCount = notifications.filter((n) => !n.est_lue).length;

  // ── Chargement des notifications ──────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await getNotifications();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setNotifications(list);
    } catch {
      // Silencieux : les notifications ne bloquent pas l'UI
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // ── Marquer une notification comme lue ───────────────────────────────────
  const handleReadNotification = useCallback(async (notif) => {
    try {
      if (!notif.est_lue) {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, est_lue: true } : n))
        );
      }
      if (notif.lien) {
        setDrawerVisible(false);
        navigate(notif.lien);
      }
    } catch {
      message.error('Impossible de marquer la notification comme lue.');
    }
  }, [navigate]);

  // ── Menu utilisateur ──────────────────────────────────────────────────────
  const userMenuItems = [{
    key: 'logout',
    icon: <LogoutOutlined />,
    label: 'Se déconnecter',
    danger: true,
    onClick: logout,
  }];

  const siderWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* ── Barre latérale fixe ── */}
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={SIDEBAR_WIDTH}
        collapsedWidth={SIDEBAR_COLLAPSED}
        style={st.sider}
      >
        <Navbar collapsed={collapsed} />
      </Sider>

      {/* ── Zone principale ── */}
      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s ease' }}>

        {/* ── Header ── */}
        <Header style={st.header}>

          <Button
            type="text"
            onClick={() => setCollapsed(!collapsed)}
            icon={
              collapsed
                ? <MenuUnfoldOutlined style={st.collapseIcon} />
                : <MenuFoldOutlined style={st.collapseIcon} />
            }
            style={st.iconBtn}
          />

          <Space size={4} align="center">

            {/* ── Cloche notifications ── */}
            <Badge count={unreadCount} size="small" offset={[-4, 4]}>
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 20, color: 'var(--ocp-cool-grey)' }} />}
                style={st.iconBtn}
                onClick={() => setDrawerVisible(true)}
              />
            </Badge>

            {/* ── Avatar utilisateur ── */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer', gap: 10, padding: '0 8px' }}>
                <div style={st.avatar}>{getInitials(user?.username)}</div>
                <div style={{ lineHeight: 1.3 }}>
                  <div style={st.userName}>{user?.username}</div>
                  <div style={st.userRole}>{ROLE_LABELS[user?.role] || user?.role}</div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* ── Contenu ── */}
        <Content style={st.content}>
          <Outlet />
        </Content>
      </Layout>

      {/* ── Drawer notifications ── */}
      <Drawer
        title={
          <span style={{ fontFamily: 'var(--font-family)', fontWeight: 700, color: 'var(--ocp-dark-green)' }}>
            Notifications {unreadCount > 0 && `(${unreadCount} non lue${unreadCount > 1 ? 's' : ''})`}
          </span>
        }
        placement="right"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        styles={{
          body: { padding: 0 },
          wrapper: { width: 380 }  // Remplace width={380}
        }}
      >
        {notifications.length === 0 ? (
          <Empty
            description="Aucune notification"
            style={{ marginTop: 60 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(notif) => (
              <NotificationItem
                key={notif.id}
                notif={notif}
                onRead={handleReadNotification}
              />
            )}
          />
        )}
      </Drawer>
    </Layout>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  sider: {
    background: 'var(--ocp-dark-green)',
    boxShadow: 'var(--shadow-card)',
    position: 'fixed',
    height: '100vh',
    left: 0,
    top: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  header: {
    background: 'var(--ocp-white)',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: 20,
    height: 64,
    position: 'sticky',
    top: 0,
    zIndex: 99,
  },
  collapseIcon: { fontSize: 20, color: 'var(--ocp-dark-green)' },
  iconBtn: {
    border: 'none',
    boxShadow: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--ocp-green)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontFamily: 'var(--font-family)',
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
    userSelect: 'none',
  },
  userName: {
    fontFamily: 'var(--font-family)',
    fontWeight: 600,
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
  },
  userRole: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    color: 'var(--ocp-cool-grey)',
  },
  content: {
    margin: 24,
    minHeight: 'calc(100vh - 112px)',
  },
};

export default AppLayout;