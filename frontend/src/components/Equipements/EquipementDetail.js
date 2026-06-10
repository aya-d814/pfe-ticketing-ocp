import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Tabs, Button, Alert, Spin, Divider, Card,
} from 'antd';
import {
  ArrowLeftOutlined,
  ToolOutlined,
  FileTextOutlined,
  HistoryOutlined,
  BarChartOutlined,
  RobotOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';

import {
  getEquipement,
  getEquipementStats,
} from '../../services/api';

import InfoGenerales from './Detail/InfoGenerales';
import KpiCards from './Detail/KpiCards';
import PannesParMoisChart from './Detail/PannesParMoisChart';
import TicketsTab from './Detail/TicketsTab';
import HistoriqueTab from './Detail/HistoriqueTab';
import PiecesTab from './Detail/PiecesTab';
import AnalyseIATab from './Detail/AnalyseIATab';

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  centred: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  erreurWrapper: {
    maxWidth: 600,
    margin: '80px auto',
  },
  headerWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  backBtn: {
    color: 'var(--ocp-green)',
    fontFamily: 'var(--font-family)',
    fontWeight: 500,
    paddingLeft: 0,
    border: 'none',
    boxShadow: 'none',
    background: 'transparent',
    alignSelf: 'flex-start',
  },
  headerTitre: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  iconEquipement: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'var(--ocp-green)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(19,165,56,0.25)',
  },
  titre: {
    fontFamily: 'var(--font-family)',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
    margin: 0,
    lineHeight: 1.2,
  },
  sousTitre: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-cool-grey)',
    margin: 0,
    marginTop: 3,
  },
  localisationSep: {
    marginLeft: 4,
  },
  card: {
    borderRadius: 10,
    boxShadow: 'var(--shadow-card)',
  },
  cardTitre: {
    fontFamily: 'var(--font-family)',
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--ocp-dark-green)',
  },
  tabs: {
    fontFamily: 'var(--font-family)',
  },
  tabLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  ongletCorps: {
    marginTop: 16,
    minHeight: 200,
  },
};

// ── Configuration des onglets ─────────────────────────────────────────────────

const ONGLETS = [
  {
    key: 'tickets',
    label: (
      <span style={st.tabLabel}>
        <FileTextOutlined /> Tickets
      </span>
    ),
  },
  {
    key: 'historique',
    label: (
      <span style={st.tabLabel}>
        <HistoryOutlined /> Historique
      </span>
    ),
  },
  {
    key: 'pieces',
    label: (
      <span style={st.tabLabel}>
        <ToolOutlined /> Pièces remplacées
      </span>
    ),
  },
  {
    key: 'ia',
    label: (
      <span style={st.tabLabel}>
        <RobotOutlined /> Analyse IA
      </span>
    ),
  },
];

// ── Sous-composant : en-tête de page ─────────────────────────────────────────

const PageHeader = ({ equipement, onBack }) => (
  <div style={st.headerWrapper}>
    <Button
      type="text"
      icon={<ArrowLeftOutlined />}
      onClick={onBack}
      style={st.backBtn}
    >
      Retour aux équipements
    </Button>

    <div style={st.headerTitre}>
      <div style={st.iconEquipement}>
        <AppstoreOutlined style={{ fontSize: 20, color: 'var(--ocp-white)' }} />
      </div>
      <div>
        <h1 style={st.titre}>{equipement.nom}</h1>
        <p style={st.sousTitre}>
          {equipement.type_equipement || 'Type non renseigné'}
          {equipement.localisation && (
            <span style={st.localisationSep}>
              · {equipement.localisation}
            </span>
          )}
        </p>
      </div>
    </div>
  </div>
);

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * EquipementDetail — page de détail d'un équipement.
 *
 * Charge en parallèle :
 *   - les données de l'équipement  (GET /equipements/:id/)
 *   - ses statistiques agrégées    (GET /equipements/:id/statistiques/)
 *
 * Le graphique des pannes par mois est géré de façon autonome
 * par PannesParMoisChart (chargement interne avec sélecteurs d'années).
 */
const EquipementDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── État des données ──────────────────────────────────────────────────────
  const [equipement, setEquipement] = useState(null);
  const [stats, setStats] = useState(null);
  const [ongletActif, setOngletActif] = useState('tickets');

  // ── État de chargement ────────────────────────────────────────────────────
  const [loadingEquipement, setLoadingEquipement] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  // ── Erreurs ───────────────────────────────────────────────────────────────
  const [erreurEquipement, setErreurEquipement] = useState(false);
  const [erreurStats, setErreurStats] = useState(false);

  // ── Chargements ───────────────────────────────────────────────────────────

  const chargerEquipement = useCallback(() => {
    setLoadingEquipement(true);
    setErreurEquipement(false);
    getEquipement(id)
      .then(({ data }) => setEquipement(data))
      .catch(() => setErreurEquipement(true))
      .finally(() => setLoadingEquipement(false));
  }, [id]);

  const chargerStats = useCallback(() => {
    setLoadingStats(true);
    setErreurStats(false);
    getEquipementStats(id)
      .then(({ data }) => setStats(data))
      .catch(() => setErreurStats(true))
      .finally(() => setLoadingStats(false));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    chargerEquipement();
    chargerStats();
  }, [user, chargerEquipement, chargerStats]);

  // ── Rafraîchissement après modification de l'historique ──────────────────
  const handleHistoriqueSauvegarde = useCallback(() => {
    chargerEquipement();
  }, [chargerEquipement]);

  // ── Rendu du contenu de l'onglet actif ───────────────────────────────────
  const renderOnglet = () => {
    switch (ongletActif) {
      case 'tickets':
        return <TicketsTab equipementId={id} />;
      case 'historique':
        return <HistoriqueTab equipementId={id} />;
      case 'pieces':
        return <PiecesTab equipementId={id} />;
      case 'ia':
        return <AnalyseIATab equipementId={id} />;
      default:
        return null;
    }
  };

  // ── Cas : chargement initial de l'équipement ──────────────────────────────
  if (loadingEquipement) {
    return (
      <div style={st.centred}>
        <Spin size="large" />
      </div>
    );
  }

  // ── Cas : erreur bloquante ────────────────────────────────────────────────
  if (erreurEquipement || !equipement) {
    return (
      <div style={st.erreurWrapper}>
        <Alert
          type="error"
          showIcon
          message="Équipement introuvable"
          description="Cet équipement n'existe pas ou vous n'avez pas les droits pour y accéder."
          action={
            <Button type="primary" onClick={() => navigate('/equipements')}>
              Retour à la liste
            </Button>
          }
          style={{ borderRadius: 8 }}
        />
      </div>
    );
  }

  // ── Rendu nominal ─────────────────────────────────────────────────────────
  return (
    <div style={st.page}>

      {/* ── En-tête ── */}
      <PageHeader
        equipement={equipement}
        onBack={() => navigate('/equipements')}
      />

      {/* ── Informations générales ── */}
      <Card bordered={false} style={st.card}>
        <InfoGenerales equipement={equipement} />
      </Card>

      {/* ── KPIs ── */}
      <KpiCards
        stats={stats}
        loading={loadingStats}
        erreur={erreurStats}
      />

      {/* ── Graphique comparatif des pannes (deux années) ── */}
      <Card
        bordered={false}
        style={st.card}
        title={
          <span style={st.cardTitre}>
            <BarChartOutlined style={{ color: 'var(--ocp-info)', marginRight: 8 }} />
            Comparaison des pannes par année
          </span>
        }
      >
        <PannesParMoisChart equipementId={id} />
      </Card>

      <Divider style={{ borderColor: 'var(--ocp-cool-grey-3)', margin: '8px 0 0' }} />

      {/* ── Onglets ── */}
      <Card bordered={false} style={{ ...st.card, marginTop: 0 }}>
        <Tabs
          activeKey={ongletActif}
          onChange={setOngletActif}
          items={ONGLETS}
          style={st.tabs}
        />
        <div style={st.ongletCorps}>
          {renderOnglet()}
        </div>
      </Card>

    </div>
  );
};

export default EquipementDetail;