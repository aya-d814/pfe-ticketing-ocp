import React from 'react';
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

/* ─────────────────────────────────────────
   CONFIG — utilise les classes App.css
   badge-statut  +  badge-{clé}
   badge-priorite + badge-{clé}
───────────────────────────────────────── */
const STATUS_CONFIG = {
  ouvert: { className: 'badge-statut badge-ouvert', label: 'Ouvert', icon: <ExclamationCircleOutlined /> },
  en_cours: { className: 'badge-statut badge-en-cours', label: 'En cours', icon: <SyncOutlined spin /> },
  attente_pieces: { className: 'badge-statut badge-attente', label: 'Attente pièces', icon: <ClockCircleOutlined /> },
  resolu: { className: 'badge-statut badge-resolu', label: 'Résolu', icon: <CheckCircleOutlined /> },
};

const PRIORITY_CONFIG = {
  urgente: { className: 'badge-priorite badge-urgente', label: 'Urgente' },
  haute: { className: 'badge-priorite badge-haute', label: 'Haute' },
  moyenne: { className: 'badge-priorite badge-moyenne', label: 'Moyenne' },
  basse: { className: 'badge-priorite badge-basse', label: 'Basse' },
};

const FALLBACK_STATUS = { className: 'badge-statut badge-attente', label: '—', icon: null };
const FALLBACK_PRIORITY = { className: 'badge-priorite badge-moyenne', label: '—' };

/* ─────────────────────────────────────────
   Composants exportés
───────────────────────────────────────── */
export const TicketStatusBadge = ({ status }) => {
  const { className, label, icon } = STATUS_CONFIG[status] ?? { ...FALLBACK_STATUS, label: status };
  return (
    <span className={className}>
      {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
      {label}
    </span>
  );
};

export const TicketPriorityBadge = ({ priority }) => {
  const { className, label } = PRIORITY_CONFIG[priority] ?? { ...FALLBACK_PRIORITY, label: priority };
  return <span className={className}>{label}</span>;
};

export default TicketStatusBadge;
