/**
 * ResponsableDashboard.js
 * =======================
 * Tableau de bord enrichi pour le rôle Responsable.
 *
 * Sections :
 *   1. KPI Cards        — totaux globaux (inchangés)
 *   2. Sélecteur        — filtrer l'évolution sur 1, 3 ou 12 mois
 *   3. AreaChart        — évolution mensuelle tickets créés / résolus
 *   4. PieChart         — répartition actuelle par statut (avec filtre année)
 *   5. Top équipements  — tableau amélioré
 *
 * Données :
 *   - getDashboardStats()            → KPIs + top équipements
 *   - getDashboardStatsMensuelles()  → série temporelle 12 mois
 *   - getDashboardStatsParStatut()   → répartition par statut (avec année)
 *
 * Chaque source est chargée indépendamment pour éviter qu'une erreur
 * partielle ne bloque l'ensemble du dashboard.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Table, Spin,
  Alert, Select, Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  ToolOutlined,
  FileTextOutlined,
  RiseOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

import {
  getDashboardStats,
  getDashboardStatsMensuelles,
  getDashboardStatsParStatut,
  getDashboardStatsParMois,
} from '../../services/api';

const { Option } = Select;

// ── Palette OCP ───────────────────────────────────────────────────────────────

const COLOR = {
  green: '#13A538',
  darkGreen: '#004129',
  orange: '#E27954',
  info: '#0890FE',
  grey: '#9DB0BF',
  success: '#52D579',
  error: '#F4364F',
  warning: '#FFAF2A',
  grey3: '#D8DFE5',
  grey4: '#EBEFF2',
  white: '#FFFFFF',
};

/** Couleurs et libellés pour chaque statut de ticket. */
const STATUT_CONFIG = {
  ouvert: { label: 'Ouvert', color: COLOR.orange, bg: 'rgba(226,121,84,0.12)' },
  en_cours: { label: 'En cours', color: COLOR.info, bg: 'rgba(8,144,254,0.10)' },
  attente_pieces: { label: 'Attente pièces', color: COLOR.grey, bg: 'rgba(157,176,191,0.15)' },
  resolu: { label: 'Résolu', color: '#2baa55', bg: 'rgba(82,213,121,0.12)' },
};

/** Couleurs pour le PieChart (ordre identique à STATUT_CONFIG). */
const PIE_COLORS = [
  COLOR.orange,
  COLOR.info,
  COLOR.grey,
  '#2baa55',
];

const FONT = "'Montserrat', sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formate un nombre en % arrondi, retourne '—' si non calculable. */
const pct = (num, den) =>
  den > 0 ? `${Math.round((num / den) * 100)} %` : '—';

/** Badge criticité inline. */
const criticiteStyle = (v) => {
  const map = {
    basse: { background: 'rgba(82,213,121,0.12)', color: '#2baa55' },
    moyenne: { background: 'rgba(255,175,42,0.13)', color: '#c07d00' },
    haute: { background: 'rgba(226,121,84,0.12)', color: COLOR.orange },
    critique: { background: 'rgba(244,54,79,0.12)', color: COLOR.error },
  };
  return map[v] ?? { background: COLOR.grey4, color: COLOR.grey };
};

// ── Sous-composants ───────────────────────────────────────────────────────────

/**
 * KpiCard — carte OCP standard avec icône colorée.
 */
const KpiCard = ({ title, value, icon, color, suffix, precision, borderColor }) => (
  <Card
    bordered={false}
    style={{
      borderRadius: 10,
      boxShadow: '0px 4px 30px rgba(0,65,41,0.10)',
      borderTop: `4px solid ${borderColor ?? color}`,
      height: '100%',
    }}
  >
    <Statistic
      title={
        <span style={st.kpiLabel}>{title}</span>
      }
      value={value ?? '—'}
      prefix={React.cloneElement(icon, { style: { color, fontSize: 20 } })}
      suffix={suffix}
      precision={precision}
      valueStyle={st.kpiValue}
    />
  </Card>
);

/**
 * SectionCard — wrapper de section avec titre et icône.
 */
const SectionCard = ({ icon, titre, enfants, extra }) => (
  <Card
    bordered={false}
    style={st.sectionCard}
    title={
      <div style={st.sectionTitre}>
        {icon}
        <span>{titre}</span>
      </div>
    }
    extra={extra}
  >
    {enfants}
  </Card>
);

/**
 * TooltipOCPArea — tooltip personnalisé pour l'AreaChart.
 */
const TooltipOCPArea = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={st.tooltip}>
      <p style={st.tooltipLabel}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ ...st.tooltipLine, color: p.color }}>
          <span style={{ ...st.tooltipDot, background: p.color }} />
          {p.name} : <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

/**
 * TooltipOCPPie — tooltip personnalisé pour le PieChart.
 */
const TooltipOCPPie = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={st.tooltip}>
      <p style={{ ...st.tooltipLine, color: payload[0].payload.fill }}>
        <span style={{ ...st.tooltipDot, background: payload[0].payload.fill }} />
        {name} : <strong>{value}</strong>
      </p>
    </div>
  );
};

/**
 * LegendePie — légende custom sous le PieChart.
 */
const LegendePie = ({ donnees, totalTickets }) => (
  <div style={st.legendePie}>
    {donnees.map(({ name, value, fill }) => (
      <div key={name} style={st.legendeItem}>
        <span style={{ ...st.legendeDot, background: fill }} />
        <span style={st.legendeTexte}>{name}</span>
        <span style={{ ...st.legendeVal, color: fill }}>{value}</span>
      </div>
    ))}
    {/* Ligne TOTAL  */}
    <div style={st.legendeTotal}>
      <span style={st.legendeTexteTotal}>Total</span>
      <span style={st.legendeValTotal}>{totalTickets}</span>
    </div>
  </div>
);

// ── Composant principal ───────────────────────────────────────────────────────

const ResponsableDashboard = () => {
  // ── État KPIs globaux ─────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [loadingStats, setLS] = useState(true);
  const [erreurStats, setES] = useState(false);

  // ── État série mensuelle ──────────────────────────────────────────────────
  const [mensuel, setMensuel] = useState([]);
  const [loadingM, setLM] = useState(true);
  const [erreurM, setEM] = useState(false);

  // ── État répartition par statut ───────────────────────────────────────────
  const [parStatut, setParStatut] = useState(null);
  const [loadingP, setLP] = useState(true);
  const [erreurP, setEP] = useState(false);

  // ── Sélecteur de période ──────────────────────────────────────────────────
  const [periode, setPeriode] = useState(12); // 1 | 3 | 12

  // ── ⭐ NOUVEAU : Sélecteur d'année pour le PieChart ⭐ ────────────────────
  const [anneeStatut, setAnneeStatut] = useState(2026);

  // ── Mois sélectionné pour les KPIs ──────────────────────────────────────────
  const [moisSelectionne, setMoisSelectionne] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [statsMensuelles, setStatsMensuelles] = useState(null);
  const [loadingStatsMois, setLoadingStatsMois] = useState(true);
  const [erreurStatsMois, setErreurStatsMois] = useState(false);

  // ── Options pour le sélecteur d'année ──────────────────────────────────────
  const optionsAnnees = [
    { value: 2024, label: '2024' },
    { value: 2025, label: '2025' },
    { value: 2026, label: '2026' },
  ];

  // ── Chargements parallèles ────────────────────────────────────────────────
  useEffect(() => {
    // KPIs globaux
    setLS(true); setES(false);
    getDashboardStats()
      .then(({ data }) => setStats(data))
      .catch(() => setES(true))
      .finally(() => setLS(false));
    // Série mensuelle
    setLM(true); setEM(false);
    getDashboardStatsMensuelles()
      .then(({ data }) => setMensuel(Array.isArray(data) ? data : []))
      .catch(() => setEM(true))
      .finally(() => setLM(false));
  }, []);

  // ── ⭐ Chargement de la répartition par statut (filtrée par année) ⭐ ───────
  const fetchParStatut = useCallback(async (annee) => {
    setLP(true);
    setEP(false);
    try {
      const { data } = await getDashboardStatsParStatut(annee);
      setParStatut(data);
    } catch {
      setEP(true);
    } finally {
      setLP(false);
    }
  }, []);

  useEffect(() => {
    fetchParStatut(anneeStatut);
  }, [anneeStatut, fetchParStatut]);

  // ── Chargement des KPIs pour le mois sélectionné ────────────────────────────
  const fetchStatsParMois = useCallback(async (mois) => {
    setLoadingStatsMois(true);
    setErreurStatsMois(false);
    try {
      const { data } = await getDashboardStatsParMois(mois);
      setStatsMensuelles(data);
    } catch {
      setErreurStatsMois(true);
    } finally {
      setLoadingStatsMois(false);
    }
  }, []);

  useEffect(() => {
    fetchStatsParMois(moisSelectionne);
  }, [moisSelectionne, fetchStatsParMois]);

  // ── Données filtrées selon la période sélectionnée ────────────────────────
  const donneesGraphe = useMemo(
    () => mensuel.slice(-periode),
    [mensuel, periode]
  );

  // ── Données PieChart ──────────────────────────────────────────────────────
  const donneesPie = useMemo(() => {
    if (!parStatut) return [];
    return Object.entries(STATUT_CONFIG).map(([key, cfg], i) => ({
      name: cfg.label,
      value: parStatut[key] ?? 0,
      fill: PIE_COLORS[i],
    }));
  }, [parStatut]);
  // Calcul du total (à ajouter APRÈS donneesPie)
  const totalTickets = useMemo(() => {
    if (!parStatut) return 0;
    return Object.values(parStatut).reduce((acc, val) => acc + val, 0);
  }, [parStatut]);

  // ── Colonnes du tableau Top équipements ───────────────────────────────────
  const colonnesTop = [
    {
      title: 'Équipement',
      dataIndex: 'equipement__nom',
      render: (v) => (
        <span style={st.topNom}>{v}</span>
      ),
    },
    {
      title: 'Criticité',
      dataIndex: 'equipement__criticite',
      width: 110,
      render: (v) => {
        const s = criticiteStyle(v);
        return (
          <span style={{ ...s, ...st.topBadge }}>{v ?? '—'}</span>
        );
      },
    },
    {
      title: 'Tickets',
      dataIndex: 'total_tickets',
      width: 90,
      align: 'center',
      render: (v) => {
        const color = v > 5 ? COLOR.error : v > 2 ? COLOR.orange : '#2baa55';
        return (
          <span style={{ ...st.topCount, color }}>{v}</span>
        );
      },
    },
  ];

  const genererOptionsMois = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div style={st.page}>

      {/* ── Titre de page ── */}
      <div style={st.pageHeader}>
        <h2 style={st.pageTitre}>Tableau de bord — Vue d'ensemble</h2>
        <span style={st.pageDate}>Données en temps réel</span>
      </div>

      {/* ── Sélecteur de mois ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Select
          value={moisSelectionne}
          onChange={setMoisSelectionne}
          style={{ width: 180, fontFamily: FONT }}
          size="middle"
        >
          {genererOptionsMois().map((opt) => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      </div>

      {/* ── KPI Cards (mensuelles) ── */}
      {loadingStatsMois ? (
        <div style={st.centred}><Spin size="large" /></div>
      ) : erreurStatsMois ? (
        <Alert type="error" showIcon message="Impossible de charger les statistiques du mois." style={st.alert} />
      ) : statsMensuelles && (
        <>
          {/* Ligne 1 : statuts */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <KpiCard
                title="Tickets ouverts"
                value={statsMensuelles.tickets_ouverts}
                icon={<ExclamationCircleOutlined />}
                color={COLOR.orange}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <KpiCard
                title="En cours"
                value={statsMensuelles.tickets_en_cours}
                icon={<SyncOutlined spin={statsMensuelles.tickets_en_cours > 0} />}
                color={COLOR.info}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <KpiCard
                title="Attente pièces"
                value={statsMensuelles.tickets_attente_pieces}
                icon={<ClockCircleOutlined />}
                color={COLOR.grey}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <KpiCard
                title="Résolus"
                value={statsMensuelles.tickets_resolus}
                icon={<CheckCircleOutlined />}
                color="#2baa55"
              />
            </Col>
          </Row>

          {/* Ligne 2 : MTTR + Total + Taux résolution */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <KpiCard
                title="MTTR — Temps moyen de résolution"
                value={statsMensuelles.mttr_heures}
                icon={<ToolOutlined />}
                color={COLOR.info}
                suffix="h"
                precision={1}
              />
            </Col>
            <Col xs={24} sm={8}>
              <KpiCard
                title="Total tickets (mois)"
                value={statsMensuelles.total_tickets}
                icon={<FileTextOutlined />}
                color={COLOR.darkGreen}
              />
            </Col>
            <Col xs={24} sm={8}>
              <KpiCard
                title="Taux de résolution"
                value={
                  statsMensuelles.total_tickets > 0
                    ? Math.round((statsMensuelles.tickets_resolus / statsMensuelles.total_tickets) * 100)
                    : 0
                }
                icon={<RiseOutlined />}
                color={COLOR.green}
                suffix="%"
              />
            </Col>
          </Row>
        </>
      )}

      {/* ── Graphiques côte à côte ── */}
      <Row gutter={[16, 16]}>

        {/* AreaChart — évolution mensuelle */}
        <Col xs={24} xl={15}>
          <SectionCard
            icon={<RiseOutlined style={{ color: COLOR.green, marginRight: 8 }} />}
            titre="Évolution mensuelle des tickets"
            extra={
              <Select
                value={periode}
                onChange={setPeriode}
                style={{ width: 140, fontFamily: FONT }}
                size="small"
              >
                <Option value={1}>Dernier mois</Option>
                <Option value={3}>3 derniers mois</Option>
                <Option value={12}>12 derniers mois</Option>
              </Select>
            }
            enfants={
              loadingM ? (
                <div style={st.centred}><Spin /></div>
              ) : erreurM ? (
                <Alert type="warning" showIcon message="Données mensuelles indisponibles." style={st.alert} />
              ) : donneesGraphe.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucune donnée" style={{ paddingTop: 32 }} />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={donneesGraphe}
                    margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradCrees" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLOR.info} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={COLOR.info} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradResolus" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLOR.green} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={COLOR.green} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={COLOR.grey3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontFamily: FONT, fontSize: 10, fill: COLOR.grey }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontFamily: FONT, fontSize: 10, fill: COLOR.grey }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ReTooltip content={<TooltipOCPArea />} cursor={{ stroke: COLOR.grey3 }} />
                    <Legend
                      formatter={(value) => (
                        <span style={{ fontFamily: FONT, fontSize: 11, color: COLOR.grey }}>{value}</span>
                      )}
                      wrapperStyle={{ paddingTop: 12 }}
                    />

                    <Area
                      type="monotone"
                      dataKey="tickets_crees"
                      name="Créés"
                      stroke={COLOR.info}
                      strokeWidth={2}
                      fill="url(#gradCrees)"
                      dot={{ r: 3, fill: COLOR.info, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      animationDuration={700}
                    />
                    <Area
                      type="monotone"
                      dataKey="tickets_resolus"
                      name="Résolus"
                      stroke={COLOR.green}
                      strokeWidth={2}
                      fill="url(#gradResolus)"
                      dot={{ r: 3, fill: COLOR.green, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            }
          />
        </Col>

        {/* PieChart — répartition par statut AVEC SÉLECTEUR D'ANNÉE */}
        <Col xs={24} xl={9}>
          <SectionCard
            icon={<PieChartOutlined style={{ color: COLOR.info, marginRight: 8 }} />}
            titre="Répartition par statut"
            extra={
              <Select
                value={anneeStatut}
                onChange={setAnneeStatut}
                style={{ width: 100, fontFamily: FONT }}
                size="small"
              >
                {optionsAnnees.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            }
            enfants={
              loadingP ? (
                <div style={st.centred}><Spin /></div>
              ) : erreurP ? (
                <Alert type="warning" showIcon message="Répartition indisponible." style={st.alert} />
              ) : donneesPie.every((d) => d.value === 0) ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun ticket pour cette année" style={{ paddingTop: 32 }} />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={donneesPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        animationDuration={800}
                      >
                        {donneesPie.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.fill}
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                      <ReTooltip content={<TooltipOCPPie />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <LegendePie donnees={donneesPie} totalTickets={totalTickets} />
                </>
              )
            }
          />
        </Col>
      </Row>

      {/* ── Top équipements (mensuel) ── */}
      {!loadingStatsMois && !erreurStatsMois && statsMensuelles?.top_equipements?.length > 0 && (
        <SectionCard
          icon={<ToolOutlined style={{ color: COLOR.orange, marginRight: 8 }} />}
          titre={`Top 5 équipements en panne (${moisSelectionne.split('-').reverse().join('/')})`}
          enfants={
            <Table
              dataSource={statsMensuelles.top_equipements}
              columns={colonnesTop}
              rowKey={(r) => r['equipement__id']}
              pagination={false}
              size="small"
              style={{ fontFamily: FONT }}
            />
          }
        />
      )}

    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  // ── Page ──
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pageTitre: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: 700,
    color: COLOR.darkGreen,
    margin: 0,
  },
  pageDate: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLOR.grey,
    fontWeight: 500,
  },

  // ── KPIs ──
  kpiLabel: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.grey,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  kpiValue: {
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 32,
    color: '#4F5D6C',
    lineHeight: 1,
  },

  // ── Sections ──
  sectionCard: {
    borderRadius: 10,
    boxShadow: '0px 4px 30px rgba(0,65,41,0.10)',
    height: '100%',
  },
  sectionTitre: {
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 14,
    color: COLOR.darkGreen,
    display: 'flex',
    alignItems: 'center',
  },

  // ── Tooltip recharts ──
  tooltip: {
    background: COLOR.white,
    border: `1px solid ${COLOR.grey3}`,
    borderRadius: 8,
    padding: '10px 14px',
    boxShadow: '0 4px 16px rgba(0,65,41,0.10)',
  },
  tooltipLabel: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.grey,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '0 0 6px',
  },
  tooltipLine: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 500,
    margin: '2px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },

  // ── Légende PieChart ──
  legendePie: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTop: `1px solid ${COLOR.grey3}`,
  },
  legendeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  legendeDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendeTexte: {
    fontFamily: FONT,
    fontSize: 12,
    color: '#4F5D6C',
    flex: 1,
  },
  legendeVal: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 700,
  },
  // ⭐ NOUVEAU : styles pour le total ⭐
  legendeTotal: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTop: `1px dashed ${COLOR.grey3}`,
  },
  legendeTexteTotal: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.darkGreen,
    flex: 1,
  },
  legendeValTotal: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 800,
    color: COLOR.darkGreen,
  },
  // ── Top équipements ──
  topNom: {
    fontFamily: FONT,
    fontWeight: 500,
    color: '#4F5D6C',
    fontSize: 13,
  },
  topBadge: {
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: FONT,
  },
  topCount: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: 700,
  },

  // ── Utilitaires ──
  centred: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 160,
  },
  alert: {
    borderRadius: 8,
  },
};

export default ResponsableDashboard;