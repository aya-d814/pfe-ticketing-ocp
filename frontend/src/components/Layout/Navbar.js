import React from 'react';
import { Menu } from 'antd';
import { ProfileOutlined, ToolOutlined, DashboardOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* ─────────────────────────────────────────
   Bandeau supérieur vert OCP avec filigrane
───────────────────────────────────────── */
const SidebarBrand = ({ collapsed }) => (
  <div style={brandStyles.wrapper}>
    {/* Filigrane SVG étoile + couronne */}
    <img
      src="/OCP_Group.svg"
      alt="OCP"
      style={{ width: 50, height: 50, marginBottom: 8, filter: 'brightness(0) invert(1)' }}
    />

    {!collapsed && (
      <div style={brandStyles.textWrap}>
        <span style={brandStyles.title}>OCP</span>
        <span style={brandStyles.sub}>TICKETING</span>
      </div>
    )}
  </div>
);

/* ─────────────────────────────────────────
   Composant Navbar
───────────────────────────────────────── */
const Navbar = ({ collapsed = false }) => {
  const { isRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/tickets', icon: <ProfileOutlined style={iconSz} />, label: 'Tickets' },
    isRole('technicien', 'responsable') && {
      key: '/equipements',
      icon: <ToolOutlined style={iconSz} />,
      label: 'Équipements',
    },
    isRole('responsable') && {
      key: '/dashboard',
      icon: <DashboardOutlined style={iconSz} />,
      label: 'Dashboard',
    },
  ].filter(Boolean);

  return (
    <div style={navSt.container}>
      <SidebarBrand collapsed={collapsed} />
      <div style={navSt.blueLine} />
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        inlineCollapsed={collapsed}
        style={navSt.menu}
      />
    </div>
  );
};

/* ─── Styles ─── */
const iconSz = { fontSize: 17 };

const brandStyles = {
  wrapper: {
    position: 'relative',
    background: 'var(--ocp-green)',
    height: 130,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  watermark: {
    position: 'absolute',
    width: 110,
    height: 110,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  textWrap: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
  },
  title: {
    fontFamily: 'var(--font-family)',
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.14em',
    lineHeight: 1,
    textShadow: '0 1px 6px rgba(0,0,0,0.2)',
  },
  sub: {
    fontFamily: 'var(--font-family)',
    fontSize: 9,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
  },
};

const navSt = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  blueLine: {
    height: 3,
    background: 'var(--ocp-info)',   /* #0890FE */
    flexShrink: 0,
  },
  menu: {
    background: 'transparent',
    borderRight: 'none',
    marginTop: 8,
    flex: 1,
  },
};

export default Navbar;