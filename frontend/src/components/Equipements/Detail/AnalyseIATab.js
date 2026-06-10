/**
 * AnalyseIATab.js
 * ===============
 * Onglet "Analyse IA" de la page détail d'un équipement.
 *
 * Trois fonctionnalités indépendantes, déclenchées chacune par un bouton :
 *   1. Résumé IA (Gemini) — texte narratif sur l'historique de maintenance.
 *   2. Pannes récurrentes — détection par familles de mots-clés (sans LLM).
 *   3. Cas similaires — recherche TF-IDF sur les tickets d'autres équipements.
 *
 * Les résultats ne s'affichent qu'après le clic sur le bouton correspondant.
 * Les états loading / error sont indépendants par fonctionnalité.
 *
 * Props :
 *   equipementId {string|number} — identifiant de l'équipement courant.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Tabs, Button, Select, Alert, Spin, Empty, Tag, List,
  Typography, Progress,
} from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  BugOutlined,
  ApartmentOutlined,
  LoadingOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

import {
  getTickets,
  getPannesRecurrentes,
  getCasSimilaires,
  getResumeIA,
} from '../../../services/api';

const { Text, Paragraph } = Typography;
const { Option } = Select;

// ── Constantes ────────────────────────────────────────────────────────────────

/** Couleur associée à chaque famille de panne (palette OCP). */
const FAMILLE_COLORS = {
  fuite: { color: '#0890FE', bg: 'rgba(8,144,254,0.08)', border: 'rgba(8,144,254,0.25)' },
  électrique: { color: '#E27954', bg: 'rgba(226,121,84,0.08)', border: 'rgba(226,121,84,0.25)' },
  moteur: { color: '#13A538', bg: 'rgba(19,165,56,0.08)', border: 'rgba(19,165,56,0.25)' },
  usure: { color: '#c07d00', bg: 'rgba(255,175,42,0.08)', border: 'rgba(255,175,42,0.25)' },
  capteur: { color: '#78675A', bg: 'rgba(120,103,90,0.08)', border: 'rgba(120,103,90,0.25)' },
  encrassement: { color: '#F4364F', bg: 'rgba(244,54,79,0.08)', border: 'rgba(244,54,79,0.25)' },
};

const STATUT_COLORS = {
  ouvert: { color: '#E27954', bg: 'rgba(226,121,84,0.10)' },
  en_cours: { color: '#0890FE', bg: 'rgba(8,144,254,0.10)' },
  attente_pieces: { color: '#9DB0BF', bg: 'rgba(157,176,191,0.15)' },
  resolu: { color: '#2baa55', bg: 'rgba(82,213,121,0.12)' },
};

const STATUT_LABELS = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  attente_pieces: 'Attente pièces',
  resolu: 'Résolu',
};

// ── Sous-composants ───────────────────────────────────────────────────────────

/**
 * PlaceholderVide — message affiché avant qu'une action soit déclenchée.
 */
const PlaceholderVide = ({ texte }) => (
  <div style={st.placeholder}>
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <span style={st.placeholderTexte}>{texte}</span>
      }
    />
  </div>
);

/**
 * ZoneErreur — alerte non-bloquante affichée en cas d'échec d'appel API.
 */
const ZoneErreur = ({ message }) => (
  <Alert
    type="error"
    showIcon
    message={message}
    style={{ borderRadius: 8, marginTop: 8 }}
  />
);

/**
 * ZoneChargement — spinner centré pendant un appel API.
 */
const ZoneChargement = () => (
  <div style={st.centred}>
    <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: 'var(--ocp-green)' }} spin />} />
  </div>
);

/**
 * ResumeIA — affiche le texte narratif retourné par Gemini.
 */
const ResumeIA = ({ texte }) => (
  <div style={st.resumeWrapper}>
    <div style={st.resumeHeader}>
      <RobotOutlined style={{ color: 'var(--ocp-green)', fontSize: 16 }} />
      <span style={st.resumeHeaderTitre}>Résumé analytique</span>
      <Tag style={st.tagIA}>Gemini</Tag>
    </div>
    <Paragraph style={st.resumeTexte}>{texte}</Paragraph>
  </div>
);

/**
 * PannesRecurrentesListe — barres de progression colorées par famille.
 */
const PannesRecurrentesListe = ({ pannes }) => {
  if (!pannes.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span style={st.placeholderTexte}>
            Aucune famille de panne détectée dans le corpus de tickets.
          </span>
        }
        style={{ marginTop: 16 }}
      />
    );
  }

  const max = pannes[0].occurrences; // déjà trié par occurrences décroissantes

  return (
    <div style={st.pannesWrapper}>
      {pannes.map(({ famille, occurrences }) => {
        const cfg = FAMILLE_COLORS[famille] ?? {
          color: 'var(--ocp-cool-grey)',
          bg: 'var(--ocp-cool-grey-4)',
          border: 'var(--ocp-cool-grey-2)',
        };
        const pct = max > 0 ? Math.round((occurrences / max) * 100) : 0;

        return (
          <div key={famille} style={st.panneLigne}>
            <div style={{ ...st.panneBadge, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
              {famille}
            </div>
            <div style={st.panneBarreWrapper}>
              <Progress
                percent={pct}
                strokeColor={cfg.color}
                trailColor="var(--ocp-cool-grey-3)"
                showInfo={false}
                size="small"
                style={{ flex: 1 }}
              />
            </div>
            <span style={{ ...st.panneCount, color: cfg.color }}>
              {occurrences} ticket{occurrences > 1 ? 's' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * CasSimilairesListe — liste des tickets similaires avec score de similarité.
 */
const CasSimilairesListe = ({ cas }) => {
  if (!cas.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span style={st.placeholderTexte}>
            Aucun cas similaire trouvé sur les autres équipements.
          </span>
        }
        style={{ marginTop: 16 }}
      />
    );
  }

  return (
    <List
      dataSource={cas}
      rowKey="ticket_id"
      size="small"
      renderItem={(item) => {
        const statutCfg = STATUT_COLORS[item.statut] ?? STATUT_COLORS.ouvert;
        const similaritePct = Math.round(item.similarite * 100);

        return (
          <List.Item style={st.casItem}>
            <div style={st.casContenu}>
              {/* Titre + équipement */}
              <div style={st.casTitreRow}>
                <span style={st.casTitre}>{item.titre}</span>
                <span style={st.casEquipement}>
                  <ApartmentOutlined style={{ marginRight: 4, fontSize: 11 }} />
                  {item.equipement_nom}
                </span>
              </div>

              {/* Statut + score */}
              <div style={st.casMetaRow}>
                <span style={{
                  ...st.casStatutBadge,
                  background: statutCfg.bg,
                  color: statutCfg.color,
                }}>
                  {STATUT_LABELS[item.statut] ?? item.statut}
                </span>

                <div style={st.casScore}>
                  <span style={st.casScoreLabel}>Similarité</span>
                  <Progress
                    percent={similaritePct}
                    size="small"
                    strokeColor="var(--ocp-green)"
                    trailColor="var(--ocp-cool-grey-3)"
                    showInfo={false}
                    style={{ width: 80 }}
                  />
                  <span style={st.casScoreValeur}>{similaritePct}%</span>
                </div>
              </div>
            </div>
          </List.Item>
        );
      }}
    />
  );
};

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * AnalyseIATab — onglet complet d'analyse IA pour un équipement.
 *
 * Props :
 *   equipementId {string|number} — identifiant de l'équipement.
 */
const AnalyseIATab = ({ equipementId }) => {
  // ── Tickets de l'équipement (pour le Select "cas similaires") ─────────────
  const [tickets, setTickets] = useState([]);
  const [ticketSelectionne, setTicketSel] = useState(null);
  const [loadingTickets, setLoadingTk] = useState(false);

  // ── État résumé IA ────────────────────────────────────────────────────────
  const [resume, setResume] = useState(null);
  const [loadingResume, setLoadingResume] = useState(false);
  const [erreurResume, setErreurResume] = useState(false);

  // ── État pannes récurrentes ───────────────────────────────────────────────
  const [pannes, setPannes] = useState(null);
  const [loadingPannes, setLoadingPannes] = useState(false);
  const [erreurPannes, setErreurPannes] = useState(false);

  // ── État cas similaires ───────────────────────────────────────────────────
  const [cas, setCas] = useState(null);
  const [loadingCas, setLoadingCas] = useState(false);
  const [erreurCas, setErreurCas] = useState(false);

  // ── Onglet IA actif ───────────────────────────────────────────────────────
  const [ongletIA, setOngletIA] = useState('resume');

  // ── Chargement des tickets (pour le Select) ───────────────────────────────
  useEffect(() => {
    if (!equipementId) return;
    setLoadingTk(true);
    getTickets({ equipement_id: equipementId, page_size: 100 })
      .then(({ data }) => {
        const liste = data?.results ?? (Array.isArray(data) ? data : []);
        setTickets(liste);
      })
      .catch(() => setTickets([]))
      .finally(() => setLoadingTk(false));
  }, [equipementId]);

  // ── Action : résumé IA ────────────────────────────────────────────────────
  const handleResumeIA = useCallback(async () => {
    setLoadingResume(true);
    setErreurResume(false);
    setResume(null);
    try {
      const { data } = await getResumeIA(equipementId);
      setResume(data.resume ?? '');
    } catch {
      setErreurResume(true);
    } finally {
      setLoadingResume(false);
    }
  }, [equipementId]);

  // ── Action : pannes récurrentes ───────────────────────────────────────────
  const handlePannesRecurrentes = useCallback(async () => {
    setLoadingPannes(true);
    setErreurPannes(false);
    setPannes(null);
    try {
      const { data } = await getPannesRecurrentes(equipementId);
      setPannes(Array.isArray(data) ? data : []);
    } catch {
      setErreurPannes(true);
    } finally {
      setLoadingPannes(false);
    }
  }, [equipementId]);

  // ── Action : cas similaires ───────────────────────────────────────────────
  const handleCasSimilaires = useCallback(async () => {
    if (!ticketSelectionne) return;
    setLoadingCas(true);
    setErreurCas(false);
    setCas(null);
    try {
      const { data } = await getCasSimilaires(equipementId, ticketSelectionne);
      setCas(Array.isArray(data) ? data : []);
    } catch {
      setErreurCas(true);
    } finally {
      setLoadingCas(false);
    }
  }, [equipementId, ticketSelectionne]);

  // ── Contenu des onglets ───────────────────────────────────────────────────

  const contenuResume = () => {
    if (loadingResume) return <ZoneChargement />;
    if (erreurResume) return <ZoneErreur message="Impossible de générer le résumé IA. Vérifiez la configuration Gemini." />;
    if (resume === null) return <PlaceholderVide texte="Cliquez sur 'Générer le résumé IA' pour obtenir une analyse narrative de l'historique de maintenance." />;
    return <ResumeIA texte={resume} />;
  };

  const contenuPannes = () => {
    if (loadingPannes) return <ZoneChargement />;
    if (erreurPannes) return <ZoneErreur message="Impossible d'analyser les pannes récurrentes." />;
    if (pannes === null) return <PlaceholderVide texte='Cliquez sur "Détecter les pannes récurrentes" pour analyser le corpus de tickets.' />;
    return <PannesRecurrentesListe pannes={pannes} />;
  };

  const contenuCas = () => {
    if (loadingCas) return <ZoneChargement />;
    if (erreurCas) return <ZoneErreur message="Impossible de rechercher les cas similaires." />;
    if (cas === null) return <PlaceholderVide texte='Sélectionnez un ticket de référence puis cliquez sur "Rechercher des cas similaires".' />;
    return <CasSimilairesListe cas={cas} />;
  };

  // ── Configuration des onglets IA ──────────────────────────────────────────

  const ongletItems = [
    {
      key: 'resume',
      label: (
        <span style={st.tabLabel}>
          <RobotOutlined /> Résumé IA
        </span>
      ),
    },
    {
      key: 'pannes',
      label: (
        <span style={st.tabLabel}>
          <BugOutlined /> Pannes récurrentes
        </span>
      ),
    },
    {
      key: 'similaires',
      label: (
        <span style={st.tabLabel}>
          <ApartmentOutlined /> Cas similaires
        </span>
      ),
    },
  ];

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div style={st.wrapper}>

      {/* ── Barre d'actions ── */}
      <div style={st.actionsBar}>

        {/* Bouton résumé IA */}
        <Button
          type="primary"
          icon={loadingResume ? <LoadingOutlined /> : <RobotOutlined />}
          loading={loadingResume}
          onClick={() => { setOngletIA('resume'); handleResumeIA(); }}
          style={st.btnPrimary}
        >
          Générer le résumé IA
        </Button>

        {/* Bouton pannes récurrentes */}
        <Button
          icon={loadingPannes ? <LoadingOutlined /> : <BugOutlined />}
          loading={loadingPannes}
          onClick={() => { setOngletIA('pannes'); handlePannesRecurrentes(); }}
          style={st.btnSecondary}
        >
          Détecter les pannes récurrentes
        </Button>

        {/* Sélecteur ticket + bouton cas similaires */}
        <div style={st.casActions}>
          <Select
            placeholder={loadingTickets ? 'Chargement…' : 'Choisir un ticket de référence'}
            loading={loadingTickets}
            value={ticketSelectionne}
            onChange={setTicketSel}
            style={{ minWidth: 260 }}
            showSearch
            filterOption={(input, opt) =>
              (opt?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
            allowClear
          >
            {tickets.map((t) => (
              <Option key={t.id} value={t.id}>
                {`TK-${String(t.id).padStart(3, '0')} — ${t.titre}`}
              </Option>
            ))}
          </Select>

          <Button
            icon={loadingCas ? <LoadingOutlined /> : <ApartmentOutlined />}
            loading={loadingCas}
            disabled={!ticketSelectionne}
            onClick={() => { setOngletIA('similaires'); handleCasSimilaires(); }}
            style={ticketSelectionne ? st.btnSecondary : st.btnDisabled}
          >
            Rechercher des cas similaires
          </Button>
        </div>
      </div>

      {/* ── Onglets de résultats ── */}
      <div style={st.resultatsWrapper}>
        <Tabs
          activeKey={ongletIA}
          onChange={setOngletIA}
          items={ongletItems}
          size="small"
          style={{ fontFamily: 'var(--font-family)' }}
        />

        <div style={st.contenuOnglet}>
          {ongletIA === 'resume' && contenuResume()}
          {ongletIA === 'pannes' && contenuPannes()}
          {ongletIA === 'similaires' && contenuCas()}
        </div>
      </div>

    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  // ── Barre d'actions ──
  actionsBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    background: 'var(--ocp-cool-grey-4)',
    border: '1px solid var(--ocp-cool-grey-3)',
    borderRadius: 10,
    padding: '14px 16px',
  },
  btnPrimary: {
    background: 'var(--ocp-green)',
    borderColor: 'var(--ocp-green)',
    fontFamily: 'var(--font-family)',
    fontWeight: 600,
  },
  btnSecondary: {
    borderColor: 'var(--ocp-green)',
    color: 'var(--ocp-green)',
    fontFamily: 'var(--font-family)',
    fontWeight: 600,
    background: 'transparent',
  },
  btnDisabled: {
    fontFamily: 'var(--font-family)',
    fontWeight: 600,
  },
  casActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  // ── Zone résultats ──
  resultatsWrapper: {
    background: 'var(--ocp-white)',
    border: '1px solid var(--ocp-cool-grey-3)',
    borderRadius: 10,
    padding: '12px 16px 16px',
    minHeight: 240,
  },
  contenuOnglet: {
    marginTop: 8,
    minHeight: 180,
  },

  // ── Labels onglets ──
  tabLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  // ── Placeholder vide ──
  placeholder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 160,
  },
  placeholderTexte: {
    fontFamily: 'var(--font-family)',
    color: 'var(--ocp-cool-grey)',
    fontSize: 13,
    maxWidth: 400,
    textAlign: 'center',
  },

  // ── Spinner centré ──
  centred: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 160,
  },

  // ── Résumé IA ──
  resumeWrapper: {
    background: 'linear-gradient(135deg, rgba(19,165,56,0.04) 0%, rgba(8,144,254,0.04) 100%)',
    border: '1px solid rgba(19,165,56,0.15)',
    borderRadius: 10,
    padding: '16px 20px',
  },
  resumeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resumeHeaderTitre: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
  },
  tagIA: {
    background: 'rgba(19,165,56,0.10)',
    border: '1px solid rgba(19,165,56,0.25)',
    color: 'var(--ocp-green)',
    fontFamily: 'var(--font-family)',
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 20,
    padding: '1px 8px',
  },
  resumeTexte: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
    lineHeight: 1.75,
    margin: 0,
    whiteSpace: 'pre-wrap',
  },

  // ── Pannes récurrentes ──
  pannesWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  panneLigne: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  panneBadge: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 20,
    padding: '3px 12px',
    whiteSpace: 'nowrap',
    minWidth: 110,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  panneBarreWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
  },
  panneCount: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    minWidth: 60,
    textAlign: 'right',
  },

  // ── Cas similaires ──
  casItem: {
    padding: '10px 0',
    borderBottom: '1px solid var(--ocp-cool-grey-4)',
  },
  casContenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  },
  casTitreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  casTitre: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ocp-dark-grey)',
    flex: 1,
  },
  casEquipement: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    color: 'var(--ocp-cool-grey)',
    background: 'var(--ocp-cool-grey-4)',
    padding: '2px 8px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
  },
  casMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  casStatutBadge: {
    fontFamily: 'var(--font-family)',
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 20,
    padding: '2px 10px',
    whiteSpace: 'nowrap',
  },
  casScore: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  casScoreLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    color: 'var(--ocp-cool-grey)',
    fontWeight: 500,
  },
  casScoreValeur: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--ocp-green)',
    minWidth: 32,
    textAlign: 'right',
  },
};

export default AnalyseIATab;