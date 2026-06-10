import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Space, message, Tooltip } from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  UserAddOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getTickets, assignTicket } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TicketStatusBadge, TicketPriorityBadge } from './TicketStatusBadge';
import LoadingSpinner from '../Common/LoadingSpinner';
import TicketFilters from './TicketFilters';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatId = (id) => `TK-${String(id).padStart(3, '0')}`;
const formatDate = (d) => dayjs(d).format('DD/MM/YYYY HH:mm');

const normalizeData = (data) => {
  if (data?.results) return data.results;
  if (Array.isArray(data)) return data;
  return [];
};

// ── Colonne actions ───────────────────────────────────────────────────────────
const RowActions = ({ record, onAssign, onNavigate }) => (
  <Space size={4}>
    <Tooltip title="Voir le détail">
      <button
        className="action-btn view"
        onClick={() => onNavigate(`/tickets/${record.id}`)}
        aria-label="Voir le détail"
      >
        <EyeOutlined style={{ fontSize: 16 }} />
      </button>
    </Tooltip>

    {record.canAssign && (
      <Tooltip title="M'assigner ce ticket">
        <button
          className="action-btn assign"
          onClick={() => onAssign(record.id)}
          aria-label="Assigner"
        >
          <UserAddOutlined style={{ fontSize: 16 }} />
        </button>
      </Tooltip>
    )}

    {record.canProcess && (
      <Tooltip title="Traiter ce ticket">
        <button
          className="action-btn process"
          onClick={() => onNavigate(`/tickets/${record.id}`)}
          aria-label="Traiter"
        >
          <PlayCircleOutlined style={{ fontSize: 16 }} />
        </button>
      </Tooltip>
    )}
  </Space>
);

// ── Composant principal ───────────────────────────────────────────────────────
const TicketList = () => {
  const { isRole } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtreActifs, setFiltreActifs] = useState({});

  // ── Chargement avec paramètres de filtre ─────────────────────────────────
  const fetchTickets = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const { data } = await getTickets(params);
      setTickets(normalizeData(data));
    } catch {
      message.error('Impossible de charger les tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // ── Callback filtre ───────────────────────────────────────────────────────
  const handleFilter = useCallback((params) => {
    setFiltreActifs(params);
    fetchTickets(params);
  }, [fetchTickets]);

  // ── Assignation ───────────────────────────────────────────────────────────
  const handleAssign = async (id) => {
    try {
      await assignTicket(id);
      message.success('Ticket assigné avec succès.');
      fetchTickets(filtreActifs);
    } catch (err) {
      message.error(err.response?.data?.detail || "Erreur lors de l'assignation.");
    }
  };

  // ── Colonnes ──────────────────────────────────────────────────────────────
  const isTech = isRole('technicien');

  const columns = [
    {
      title: '#',
      dataIndex: 'id',
      width: 75,
      render: (v) => (
        <span className="text-cool-grey font-ocp" style={{ fontSize: 12 }}>
          {formatId(v)}
        </span>
      ),
    },
    {
      title: 'Titre',
      dataIndex: 'titre',
      ellipsis: true,
      render: (v) => <span className="fw-500 font-ocp text-dark-grey">{v}</span>,
    },
    {
      title: 'Équipement',
      dataIndex: ['equipement', 'nom'],
      ellipsis: true,
      render: (v) => (
        <span className="font-ocp text-dark-grey">
          {v || <span className="text-cool-grey">—</span>}
        </span>
      ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      render: (s) => <TicketStatusBadge status={s} />,
    },
    {
      title: 'Priorité',
      dataIndex: 'priorite',
      render: (p) => <TicketPriorityBadge priority={p} />,
    },
    {
      title: 'Créé le',
      dataIndex: 'date_creation',
      render: (d) => (
        <span className="text-cool-grey font-ocp" style={{ fontSize: 12 }}>
          {formatDate(d)}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <RowActions
          record={{
            ...record,
            canAssign: isTech && record.statut === 'ouvert',
            canProcess: isTech && record.statut === 'en_cours',
          }}
          onAssign={handleAssign}
          onNavigate={navigate}
        />
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* ── Barre supérieure ── */}
      <div style={st.topBar}>
        <div style={st.titleWrap}>
          <FileTextOutlined className="text-ocp-green" style={{ fontSize: 22 }} />
          <h2 className="page-title" style={{ marginBottom: 0 }}>
            Tickets de maintenance
          </h2>
        </div>

        {isRole('operateur', 'responsable') && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/tickets/nouveau')}
          >
            Nouveau ticket
          </Button>
        )}
      </div>

      {/* ── Filtres ── */}
      <TicketFilters onFilter={handleFilter} />

      {/* ── Tableau ── */}
      <Table
        dataSource={tickets}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800, y: 400 }}

      />
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
};

export default TicketList;
