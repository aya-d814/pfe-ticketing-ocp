import React, { useEffect, useState } from 'react';
import { Modal, Button, Row, Col, Spin, Divider, Alert } from 'antd';
import {
  BarChartOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { getEquipementStatsMensuelles } from '../../services/api';

dayjs.locale('fr');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formate "YYYY-MM" en "juin 2026". */
const labelMois = (mois) => {
  if (!mois) return '';
  return dayjs(mois + '-01').format('MMMM YYYY');
};

/** Formate une date ISO en "JJ/MM/AAAA". */
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : null);

// ── Configuration des KPI ─────────────────────────────────────────────────────

const KPI_CONFIG = {
  total: { color: 'var(--ocp-dark-green)', bg: 'rgba(0,65,41,0.06)', border: 'var(--ocp-dark-green)' },
  ouvert: { color: 'var(--ocp-orange)', bg: 'rgba(226,121,84,0.08)', border: 'var(--ocp-orange)' },
  resolu: { color: '#2baa55', bg: 'rgba(82,213,121,0.08)', border: '#2baa55' },
  mttr: { color: 'var(--ocp-info)', bg: 'rgba(8,144,254,0.06)', border: 'var(--ocp-info)' },
  taux: { color: 'var(--ocp-green)', bg: 'rgba(19,165,56,0.06)', border: 'var(--ocp-green)' },
};

// ── Sous-composants ───────────────────────────────────────────────────────────

const KpiMini = ({ titre, valeur, suffixe, icone, colorKey }) => {
  const cfg = KPI_CONFIG[colorKey] ?? KPI_CONFIG.total;
  return (
    <div style={{ ...st.kpiMini, background: cfg.bg, borderLeft: `3px solid ${cfg.border}` }}>
      <div style={{ ...st.kpiIcone, color: cfg.color }}>{icone}</div>
      <div>
        <p style={st.kpiLabel}>{titre}</p>
        <p style={{ ...st.kpiValeur, color: cfg.color }}>
          {valeur ?? <span style={st.kpiVide}>—</span>}
          {valeur != null && suffixe ? (
            <span style={st.kpiSuffixe}> {suffixe}</span>
          ) : null}
        </p>
      </div>
    </div>
  );
};

const InfoLigne = ({ label, valeur }) => (
  <div style={st.infoLigne}>
    <span style={st.infoLabel}>{label}</span>
    <span style={st.infoValeur}>{valeur ?? '—'}</span>
  </div>
);

const AucunTicketNotice = ({ moisLabel }) => (
  <div style={st.aucunTicket}>
    <CalendarOutlined style={{ fontSize: 28, color: 'var(--ocp-cool-grey-2)', marginBottom: 8 }} />
    <p style={st.aucunTicketTexte}>
      Aucune panne enregistrée pour {moisLabel}.
    </p>
  </div>
);

// ── Helper badge criticité ────────────────────────────────────────────────────

const criticiteStyle = (v) => {
  const map = {
    basse: { background: 'rgba(82,213,121,0.12)', color: '#2baa55' },
    moyenne: { background: 'rgba(255,175,42,0.13)', color: '#c07d00' },
    haute: { background: 'rgba(226,121,84,0.12)', color: '#E27954' },
    critique: { background: 'rgba(244,54,79,0.12)', color: '#F4364F' },
  };
  return map[v] ?? { background: 'var(--ocp-cool-grey-4)', color: 'var(--ocp-cool-grey)' };
};

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * StatistiquesModal — statistiques de l'équipement pour le mois en cours.
 *
 * Props :
 *   equipement  {object}    — équipement sélectionné (id, nom, criticite).
 *   open        {boolean}   — état d'ouverture.
 *   onClose     {function}  — callback de fermeture.
 */
const StatistiquesModal = ({ equipement, open, onClose }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(false);

  // ── Chargement à l'ouverture ─────────────────────────────────────────────
  useEffect(() => {
    if (!open || !equipement?.id) return;

    setLoading(true);
    setErreur(false);
    setStats(null);

    getEquipementStatsMensuelles(equipement.id)
      .then(({ data }) => setStats(data))
      .catch(() => setErreur(true))
      .finally(() => setLoading(false));
  }, [open, equipement?.id]);

  const moisLabel = stats?.mois ? labelMois(stats.mois) : '';

  // ── Rendu corps ──────────────────────────────────────────────────────────
  const renderCorps = () => {
    if (loading) {
      return (
        <div style={st.centred}>
          <Spin size="large" />
        </div>
      );
    }

    if (erreur) {
      return (
        <Alert
          type="error"
          message="Impossible de charger les statistiques du mois."
          showIcon
          style={{ borderRadius: 8 }}
        />
      );
    }

    if (!stats) return null;

    const aucunePanne = stats.nombre_pannes === 0;

    return (
      <>
        {/* ── Bandeau mois ── */}
        <div style={st.moisBandeau}>
          <CalendarOutlined style={{ color: 'var(--ocp-info)', fontSize: 14 }} />
          <span style={st.moisTexte}>
            Période analysée : <strong>{moisLabel}</strong>
          </span>
        </div>

        {aucunePanne ? (
          <AucunTicketNotice moisLabel={moisLabel} />
        ) : (
          <>
            {/* ── KPIs principaux ── */}
            <Row gutter={[10, 10]}>
              <Col xs={12} sm={8}>
                <KpiMini
                  titre="Total pannes"
                  valeur={stats.nombre_pannes}
                  icone={<ExclamationCircleOutlined />}
                  colorKey="total"
                />
              </Col>
              <Col xs={12} sm={8}>
                <KpiMini
                  titre="Tickets ouverts"
                  valeur={stats.tickets_ouverts}
                  icone={<SyncOutlined spin={stats.tickets_ouverts > 0} />}
                  colorKey="ouvert"
                />
              </Col>
              <Col xs={12} sm={8}>
                <KpiMini
                  titre="Tickets résolus"
                  valeur={stats.tickets_resolus}
                  icone={<CheckCircleOutlined />}
                  colorKey="resolu"
                />
              </Col>
              <Col xs={12} sm={8}>
                <KpiMini
                  titre="MTTR"
                  valeur={stats.mttr_heures}
                  suffixe="h"
                  icone={<ClockCircleOutlined />}
                  colorKey="mttr"
                />
              </Col>
              <Col xs={12} sm={8}>
                <KpiMini
                  titre="Taux de résolution"
                  valeur={stats.taux_resolution}
                  suffixe="%"
                  icone={<RiseOutlined />}
                  colorKey="taux"
                />
              </Col>
            </Row>

            <Divider style={{ margin: '16px 0', borderColor: 'var(--ocp-cool-grey-3)' }} />
          </>
        )}

        {/* ── Infos complémentaires (toujours visibles) ── */}
        <div style={st.infoBloc}>
          <InfoLigne
            label="Dernière panne"
            valeur={
              stats.derniere_panne ? (
                <span style={{ color: 'var(--ocp-orange)', fontWeight: 600 }}>
                  {formatDate(stats.derniere_panne)}
                </span>
              ) : (
                <span style={{ color: 'var(--ocp-cool-grey)' }}>
                  Aucune panne ce mois
                </span>
              )
            }
          />
          <InfoLigne
            label="Criticité"
            valeur={
              <span style={{
                ...criticiteStyle(equipement?.criticite),
                padding: '2px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-family)',
              }}>
                {equipement?.criticite ?? '—'}
              </span>
            }
          />
        </div>
      </>
    );
  };

  return (
    <Modal
      title={
        <div style={st.modalTitre}>
          <BarChartOutlined style={{ color: 'var(--ocp-info)', fontSize: 16 }} />
          <span>
            Statistiques — {equipement?.nom}
            {moisLabel && (
              <span style={st.modalTitreMois}> ({moisLabel})</span>
            )}
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          Fermer
        </Button>
      }
      width={520}
      destroyOnClose
    >
      <div style={{ marginTop: 12 }}>
        {renderCorps()}
      </div>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  modalTitre: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-family)',
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
    fontSize: 15,
  },
  modalTitreMois: {
    fontWeight: 400,
    color: 'var(--ocp-cool-grey)',
    fontSize: 13,
  },
  centred: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 160,
  },

  // ── Bandeau mois ──
  moisBandeau: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(8,144,254,0.06)',
    border: '1px solid rgba(8,144,254,0.15)',
    borderRadius: 8,
    padding: '8px 14px',
    marginBottom: 16,
  },
  moisTexte: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
  },

  // ── Aucune panne ──
  aucunTicket: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 0 16px',
  },
  aucunTicketTexte: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-cool-grey)',
    margin: 0,
  },

  // ── KPIs ──
  kpiMini: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    padding: '10px 12px',
  },
  kpiIcone: {
    fontSize: 18,
    flexShrink: 0,
  },
  kpiLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--ocp-cool-grey)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: 0,
    marginBottom: 2,
  },
  kpiValeur: {
    fontFamily: 'var(--font-family)',
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1,
    margin: 0,
  },
  kpiVide: {
    color: 'var(--ocp-cool-grey)',
    fontWeight: 400,
  },
  kpiSuffixe: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--ocp-cool-grey)',
  },

  // ── Infos complémentaires ──
  infoBloc: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--ocp-white)',
    border: '1px solid var(--ocp-cool-grey-3)',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 4,
  },
  infoLigne: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid var(--ocp-cool-grey-4)',
  },
  infoLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ocp-cool-grey)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoValeur: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
    fontWeight: 500,
  },
};

export default StatistiquesModal;