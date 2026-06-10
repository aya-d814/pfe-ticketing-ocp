import React, { useEffect, useState, useCallback } from 'react';
import { Table, Alert, Tooltip, Empty } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { getTickets } from '../../../services/api';
import { TicketStatusBadge, TicketPriorityBadge } from '../../Tickets/TicketStatusBadge';

// ── Constantes ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatId = (id) => `TK-${String(id).padStart(3, '0')}`;
const formatDate = (d) => dayjs(d).format('DD/MM/YYYY');

// ── Sous-composants ───────────────────────────────────────────────────────────

const BoutonVoir = ({ ticketId, onNavigate }) => (
  <Tooltip title="Voir le détail">
    <button
      className="action-btn view"
      onClick={() => onNavigate(`/tickets/${ticketId}`)}
      aria-label="Voir le ticket"
    >
      <EyeOutlined style={{ fontSize: 15 }} />
    </button>
  </Tooltip>
);

// ── Définition des colonnes ───────────────────────────────────────────────────
// Fonction pure — évite la re-création à chaque render.

const buildColumns = (onNavigate) => [
  {
    title: '#',
    dataIndex: 'id',
    width: 80,
    render: (v) => (
      <span style={st.cellId}>{formatId(v)}</span>
    ),
  },
  {
    title: 'Titre',
    dataIndex: 'titre',
    ellipsis: true,
    render: (v) => (
      <span style={st.cellTitre}>{v}</span>
    ),
  },
  {
    title: 'Statut',
    dataIndex: 'statut',
    width: 140,
    render: (s) => <TicketStatusBadge status={s} />,
  },
  {
    title: 'Priorité',
    dataIndex: 'priorite',
    width: 110,
    render: (p) => <TicketPriorityBadge priority={p} />,
  },
  {
    title: 'Créé le',
    dataIndex: 'date_creation',
    width: 110,
    render: (d) => (
      <span style={st.cellDate}>{formatDate(d)}</span>
    ),
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 80,
    align: 'center',
    render: (_, record) => (
      <BoutonVoir ticketId={record.id} onNavigate={onNavigate} />
    ),
  },
];

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * TicketsTab — onglet "Tickets" de la page détail équipement.
 *
 * Charge les tickets filtrés par `equipement_id` avec pagination backend.
 * Le filtre `equipement_id` est supporté par `TicketFilter` (Django).
 *
 * Props :
 *   equipementId  {string|number}  — id de l'équipement courant.
 */
const TicketsTab = ({ equipementId }) => {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [pageCourante, setPageCourante] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);

  // ── Chargement paginé ────────────────
  // ────────────────────────────────────
  const chargerTickets = useCallback(async (page = 1) => {
    setLoading(true);
    setErreur(false);

    try {
      const { data } = await getTickets({
        equipement_id: equipementId,
        page,
        page_size: PAGE_SIZE,
      });

      // Support des deux formats : paginé { count, results } et tableau brut.
      if (data?.results !== undefined) {
        setTickets(data.results);
        setTotalTickets(data.count ?? 0);
      } else {
        setTickets(Array.isArray(data) ? data : []);
        setTotalTickets(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      setErreur(true);
    } finally {
      setLoading(false);
    }
  }, [equipementId]);

  // Chargement initial + rechargement si l'équipement change.
  useEffect(() => {
    setPageCourante(1);
    chargerTickets(1);
  }, [chargerTickets]);

  // ── Changement de page ───────────────────────────────────────────────────
  const handlePageChange = useCallback((page) => {
    setPageCourante(page);
    chargerTickets(page);
  }, [chargerTickets]);

  // ── État erreur ──────────────────────────────────────────────────────────
  if (erreur) {
    return (
      <Alert
        type="error"
        showIcon
        message="Impossible de charger les tickets de cet équipement."
        style={{ borderRadius: 8 }}
      />
    );
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <Table
      dataSource={tickets}
      columns={buildColumns(navigate)}
      rowKey="id"
      loading={loading}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={st.videDesc}>Aucun ticket pour cet équipement</span>
            }
          />
        ),
      }}
      pagination={{
        current: pageCourante,
        pageSize: PAGE_SIZE,
        total: totalTickets,
        onChange: handlePageChange,
        showSizeChanger: false,
        showTotal: (total) => (
          <span style={st.paginationTotal}>
            {total} ticket{total !== 1 ? 's' : ''}
          </span>
        ),
      }}
      scroll={{ x: 640 }}
      size="middle"
    />
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  cellId: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    color: 'var(--ocp-cool-grey)',
    fontWeight: 500,
  },
  cellTitre: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ocp-dark-grey)',
  },
  cellDate: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    color: 'var(--ocp-cool-grey)',
  },
  videDesc: {
    fontFamily: 'var(--font-family)',
    color: 'var(--ocp-cool-grey)',
    fontSize: 13,
  },
  paginationTotal: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    color: 'var(--ocp-cool-grey)',
  },
};

export default TicketsTab;
