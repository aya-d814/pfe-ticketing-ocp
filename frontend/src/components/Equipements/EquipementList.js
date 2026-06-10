import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select,
  message, Space, Tooltip, Typography,
} from 'antd';
import {
  EyeOutlined,
  PlusOutlined,
  AppstoreOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getEquipements, createEquipement, getEquipementStats } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../Common/LoadingSpinner';
import EquipementFilters from './EquipementFilters';
import StatistiquesModal from './StatistiquesModal';
import HealthScoreBadge from './HealthScoreBadge';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Text } = Typography;

// ── Constantes ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const CRITICITE_STYLES = {
  basse: { bg: 'rgba(82,213,121,0.12)', color: '#2baa55' },
  moyenne: { bg: 'rgba(255,175,42,0.13)', color: '#c07d00' },
  haute: { bg: 'rgba(226,121,84,0.12)', color: '#E27954' },
  critique: { bg: 'rgba(244,54,79,0.12)', color: '#F4364F' },
};

// ── État initial des modals ───────────────────────────────────────────────────

const MODAL_INITIAL = {
  statistiques: false,
};

// ── Sous-composants purs ──────────────────────────────────────────────────────

const CriticiteBadge = ({ value }) => {
  const s = CRITICITE_STYLES[value] ?? {
    bg: 'var(--ocp-cool-grey-4)',
    color: 'var(--ocp-cool-grey)',
  };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      padding: '3px 12px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'var(--font-family)',
      whiteSpace: 'nowrap',
    }}>
      {value ?? '—'}
    </span>
  );
};

/** Affiche une date de panne en orange si elle existe, sinon '—' en gris. */
const DernierePanneCell = ({ date }) => {
  if (!date) {
    return (
      <Text style={st.cellGris}>—</Text>
    );
  }
  return (
    <span style={st.dernierePanne}>
      {dayjs(date).format('DD/MM/YYYY')}
    </span>
  );
};

/** Affiche le nombre de pannes avec coloration selon le seuil. */
const NombrePannesCell = ({ nombre }) => {
  if (nombre === undefined || nombre === null) {
    return <Text style={st.cellGris}>—</Text>;
  }
  const color = nombre === 0
    ? '#2baa55'
    : nombre <= 3
      ? '#c07d00'
      : 'var(--ocp-error)';
  return (
    <span style={{ ...st.compteurPannes, color }}>
      {nombre}
    </span>
  );
};

/**
 * Groupe des trois boutons d'action secondaires (historique, stats, pièces).
 * Utilisé dans la colonne "Actions".
 */
const BoutonsAction = ({ record, isResponsable, onStatistiques }) => (
  <Space size={2}>

    <Tooltip title="Voir les statistiques">
      <button
        className="action-btn assign"
        onClick={() => onStatistiques(record)}
        aria-label="Voir les statistiques"
      >
        <BarChartOutlined style={{ fontSize: 20 }} />
      </button>
    </Tooltip>
  </Space>
);

// ── Composant principal ───────────────────────────────────────────────────────

const EquipementList = () => {
  const navigate = useNavigate();
  const { isRole } = useAuth();
  const isResponsable = isRole('responsable');

  // ── État des données ──────────────────────────────────────────────────────
  const [equipements, setEquipements] = useState([]);
  const [statsCache, setStatsCache] = useState({});   // { [id]: statsObject }
  const [loading, setLoading] = useState(true);
  const [filtresActifs, setFiltresActifs] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // ── État des modals ───────────────────────────────────────────────────────
  const [modals, setModals] = useState(MODAL_INITIAL);
  const [equipementSelectionne, setEquipementSelectionne] = useState(null);

  // ── État du formulaire de création ───────────────────────────────────────
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  // ── Chargement de la liste ────────────────────────────────────────────────
  const fetchEquipements = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const { data } = await getEquipements(params);
      const liste = Array.isArray(data) ? data : (data.results ?? []);
      setEquipements(liste);
    } catch {
      message.error('Impossible de charger les équipements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEquipements(); }, [fetchEquipements]);

  // ── Chargement des stats d'un équipement (lazy, mis en cache) ────────────
  const fetchStats = useCallback(async (id) => {
    if (statsCache[id]) return;           // déjà en cache — pas de requête inutile
    try {
      const { data } = await getEquipementStats(id);
      setStatsCache((prev) => ({ ...prev, [id]: data }));
    } catch {
      // Silencieux : les stats sont affichées en mode dégradé (—)
    }
  }, [statsCache]);

  // ── Chargement des stats pour toute la page visible ──────────────────────
  useEffect(() => {
    equipements.forEach((eq) => fetchStats(eq.id));
  }, [equipements]);           // fetchStats volontairement omis pour éviter la boucle infinie

  // ── Callback filtre ───────────────────────────────────────────────────────
  const handleFilter = useCallback((params) => {
    setFiltresActifs(params);
    fetchEquipements(params);
  }, [fetchEquipements]);

  // ── Création d'un équipement ──────────────────────────────────────────────
  const handleCreate = async (values) => {
    setSubmitting(true);
    try {
      await createEquipement({
        nom: values.nom,
        type_equipement: values.type_equipement,
        localisation: values.localisation,
        criticite: values.criticite ?? 'moyenne',
        numero_serie: values.numero_serie,
      });
      message.success('Équipement ajouté avec succès.');
      form.resetFields();
      setCreateModalOpen(false);
      fetchEquipements(filtresActifs);
    } catch (err) {
      const data = err.response?.data;
      const firstError = data
        ? Object.values(data).flat()[0]
        : 'Erreur lors de la création.';
      message.error(firstError);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Ouverture / fermeture des modals ──────────────────────────────────────
  const ouvrirModal = useCallback((cle, equip) => {
    setEquipementSelectionne(equip);
    setModals((prev) => ({ ...prev, [cle]: true }));
  }, []);

  const fermerModal = useCallback((cle) => {
    setModals((prev) => ({ ...prev, [cle]: false }));
  }, []);

  // ── Définition des colonnes ───────────────────────────────────────────────
  const buildColumns = () => [
    {
      title: 'Nom',
      dataIndex: 'nom',
      width: 180,
      fixed: 'left',
      ellipsis: true,
      sorter: (a, b) => a.nom.localeCompare(b.nom),
      render: (v, record) => (
        <a
          href={`/equipements/${record.id}`}
          style={{ ...st.cellNom, cursor: 'pointer', textDecoration: 'none' }}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/equipements/${record.id}`);
          }}
        >
          {v}
        </a>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type_equipement',
      width: 130,
      ellipsis: true,
      render: (v) => (
        <span style={v ? st.cellTexte : st.cellGris}>
          {v || '—'}
        </span>
      ),
    },
    {
      title: 'Localisation',
      dataIndex: 'localisation',
      width: 150,
      ellipsis: true,
      render: (v) => (
        <span style={v ? st.cellTexte : st.cellGris}>
          {v || 'Non renseignée'}
        </span>
      ),
    },
    {
      title: 'Criticité',
      dataIndex: 'criticite',
      width: 110,
      render: (v) => <CriticiteBadge value={v} />,
    },
    {
      title: 'Pannes',
      key: 'nombre_pannes',
      width: 80,
      align: 'center',
      sorter: (a, b) => {
        const sa = statsCache[a.id]?.nombre_pannes ?? 0;
        const sb = statsCache[b.id]?.nombre_pannes ?? 0;
        return sa - sb;
      },
      render: (_, record) => (
        <NombrePannesCell nombre={statsCache[record.id]?.nombre_pannes} />
      ),
    },
    {
      title: 'Dernière panne',
      key: 'derniere_panne',
      width: 130,
      render: (_, record) => (
        <DernierePanneCell date={statsCache[record.id]?.derniere_panne} />
      ),
    },
    {
      title: 'Santé',
      key: 'health_score',
      width: 70,
      align: 'center',
      sorter: (a, b) => {
        const sa = statsCache[a.id]?.health_score ?? 100;
        const sb = statsCache[b.id]?.health_score ?? 100;
        return sa - sb;
      },
      render: (_, record) => (
        <HealthScoreBadge
          score={statsCache[record.id]?.health_score ?? null}
          size="sm"
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size={2}>
          {/* Bouton Détail */}
          <Tooltip title="Voir le détail">
            <button
              className="action-btn view"
              onClick={() => navigate(`/equipements/${record.id}`)}
              aria-label="Voir le détail"
            >
              <EyeOutlined style={{ fontSize: 20 }} />
            </button>
          </Tooltip>

          {/* Boutons existants (stats) */}
          <BoutonsAction
            record={record}
            isResponsable={isResponsable}
            onStatistiques={(eq) => ouvrirModal('statistiques', eq)}
          />
        </Space>
      ),
    },
  ];

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* ── Barre supérieure ── */}
      <div style={st.topBar}>
        <div style={st.titreLigne}>
          <AppstoreOutlined style={{ fontSize: 22, color: 'var(--ocp-green)' }} />
          <h2 style={st.pageTitle}>Équipements</h2>
        </div>

        {isResponsable && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Ajouter un équipement
          </Button>
        )}
      </div>

      {/* ── Filtres ── */}
      <EquipementFilters onFilter={handleFilter} />

      {/* ── Tableau ── */}
      <Table
        dataSource={equipements}
        columns={buildColumns()}
        rowKey="id"
        pagination={{
          pageSize: PAGE_SIZE,
          showSizeChanger: false,
          showTotal: (total) => (
            <span style={st.paginationTotal}>
              {total} équipement{total !== 1 ? 's' : ''}
            </span>
          ),
        }}
        scroll={{ x: 960 }}
        sticky
        size="middle"
      />

      {/* ── Modal création ── */}
      <Modal
        title={
          <span style={st.modalTitre}>
            Ajouter un équipement
          </span>
        }
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            label="Nom"
            name="nom"
            rules={[{ required: true, message: 'Nom requis' }]}
          >
            <Input placeholder="Ex : Pompe P-101" />
          </Form.Item>

          <Form.Item label="Type" name="type_equipement">
            <Input placeholder="Ex : pompe, mélangeur, compresseur…" />
          </Form.Item>

          <Form.Item label="Localisation" name="localisation">
            <Input placeholder="Ex : Atelier A — Zone 3" />
          </Form.Item>

          <Form.Item label="Criticité" name="criticite" initialValue="moyenne">
            <Select>
              <Option value="basse">
                <Space><span style={{ color: '#2baa55', fontWeight: 600 }}>●</span> Basse</Space>
              </Option>
              <Option value="moyenne">
                <Space><span style={{ color: '#c07d00', fontWeight: 600 }}>●</span> Moyenne</Space>
              </Option>
              <Option value="haute">
                <Space><span style={{ color: '#E27954', fontWeight: 600 }}>●</span> Haute</Space>
              </Option>
              <Option value="critique">
                <Space><span style={{ color: '#F4364F', fontWeight: 600 }}>●</span> Critique</Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item label="Numéro de série" name="numero_serie">
            <Input placeholder="Ex : SN-20241101 (optionnel)" />
          </Form.Item>

          <div style={st.formFooter}>
            <Button onClick={() => { setCreateModalOpen(false); form.resetFields(); }}>
              Annuler
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Ajouter
            </Button>
          </div>
        </Form>
      </Modal>


      {/* ── Modal statistiques ── */}
      <StatistiquesModal
        equipement={equipementSelectionne}
        open={modals.statistiques}
        onClose={() => fermerModal('statistiques')}
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
  titreLigne: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  pageTitle: {
    fontFamily: 'var(--font-family)',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
    margin: 0,
  },
  // ── Cellules tableau ──
  cellNom: {
    fontFamily: 'var(--font-family)',
    fontWeight: 600,
    color: 'var(--ocp-dark-green)',
    fontSize: 13,
  },
  cellTexte: {
    fontFamily: 'var(--font-family)',
    color: 'var(--ocp-dark-grey)',
    fontSize: 13,
  },
  cellGris: {
    fontFamily: 'var(--font-family)',
    color: 'var(--ocp-cool-grey)',
    fontSize: 12,
  },
  dernierePanne: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    color: 'var(--ocp-orange)',
    fontWeight: 600,
  },
  compteurPannes: {
    fontFamily: 'var(--font-family)',
    fontSize: 14,
    fontWeight: 700,
  },
  // ── Modal ──
  modalTitre: {
    fontFamily: 'var(--font-family)',
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
  },
  formFooter: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  // ── Pagination ──
  paginationTotal: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    color: 'var(--ocp-cool-grey)',
  },
};

export default EquipementList;