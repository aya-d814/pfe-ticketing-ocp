/**
 * PannesParMoisChart.js
 * =====================
 * Graphique à barres groupées comparant les pannes de deux années
 * pour un équipement donné.
 *
 * Fonctionnalités :
 *   - Deux Select Ant Design pour choisir chaque année (5 dernières années)
 *   - BarChart Recharts avec deux séries colorées (vert OCP / bleu OCP)
 *   - Tooltip personnalisé, légende, animation
 *   - États loading / erreur / vide gérés indépendamment par année
 *
 * Props :
 *   equipementId {string|number} — identifiant de l'équipement.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Row, Col, Select, Alert, Spin, Empty } from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getEquipementPannesParMois } from '../../../services/api';

const { Option } = Select;

// ── Palette OCP (valeurs résolues — CSS vars inaccessibles dans Recharts SVG) ──
const COLOR_ANNEE_A = '#13A538';   // --ocp-green   (année courante)
const COLOR_ANNEE_B = '#0890FE';   // --ocp-info    (année précédente)
const COLOR_GRID = '#D8DFE5';   // --ocp-cool-grey-3
const COLOR_AXIS = '#9DB0BF';   // --ocp-cool-grey
const FONT = "'Montserrat', sans-serif";

/** Noms courts des 12 mois français, alignés sur l'index 1–12 du backend. */
const MOIS_LABELS = [
  '', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Retourne l'année courante sous forme d'entier. */
const anneeActuelle = () => new Date().getFullYear();

/**
 * Génère la liste des N dernières années (de la plus récente à la plus ancienne).
 * @param {number} n — nombre d'années à retourner (défaut 5).
 */
const dernieresAnnees = (n = 5) => {
  const courante = anneeActuelle();
  return Array.from({ length: n }, (_, i) => courante - i);
};

/**
 * Fusionne deux tableaux de données annuelles en un tableau mensuel
 * prêt pour BarChart.
 *
 * @param {Array} dataA — résultat API pour l'année A : [{ mois, label, total }]
 * @param {Array} dataB — résultat API pour l'année B
 * @param {number} anneeA
 * @param {number} anneeB
 * @returns {Array} [{ mois: "Jan", anneeA: number, anneeB: number }, ...]
 */
const fusionnerDonnees = (dataA, dataB, anneeA, anneeB) => {
  // Créer une map mois → total pour chaque année (clé = numéro de mois "01"…"12")
  const mapA = Object.fromEntries(
    (dataA ?? []).map((d) => [d.mois.slice(-2), d.total])
  );
  const mapB = Object.fromEntries(
    (dataB ?? []).map((d) => [d.mois.slice(-2), d.total])
  );

  return Array.from({ length: 12 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    return {
      mois: MOIS_LABELS[i + 1],
      [String(anneeA)]: mapA[num] ?? 0,
      [String(anneeB)]: mapB[num] ?? 0,
    };
  });
};

// ── Tooltip personnalisé ──────────────────────────────────────────────────────

/**
 * TooltipOCP — tooltip Recharts aux couleurs de la charte OCP.
 */
const TooltipOCP = ({ active, payload, label, anneeA, anneeB }) => {
  if (!active || !payload?.length) return null;

  return (
    <div style={st.tooltip}>
      <p style={st.tooltipLabel}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ ...st.tooltipLigne, color: p.fill }}>
          <span style={{ ...st.tooltipDot, background: p.fill }} />
          {p.dataKey} : <strong>{p.value} panne{p.value !== 1 ? 's' : ''}</strong>
        </p>
      ))}
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * PannesParMoisChart — graphique comparatif deux années.
 *
 * Props :
 *   equipementId {string|number} — id de l'équipement.
 */
const PannesParMoisChart = ({ equipementId }) => {
  const annees = useMemo(() => dernieresAnnees(5), []);
  const courante = anneeActuelle();

  // ── Années sélectionnées ──────────────────────────────────────────────────
  const [anneeA, setAnneeA] = useState(courante);
  const [anneeB, setAnneeB] = useState(courante - 1);

  // ── Données brutes par année ──────────────────────────────────────────────
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);

  // ── États de chargement et d'erreur (indépendants) ────────────────────────
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [erreurA, setErreurA] = useState(false);
  const [erreurB, setErreurB] = useState(false);

  // ── Chargement d'une année ────────────────────────────────────────────────

  /**
   * Charge les pannes par mois pour une année donnée.
   *
   * @param {number} annee        — année à charger.
   * @param {Function} setData    — setter d'état pour les données.
   * @param {Function} setLoading — setter d'état de chargement.
   * @param {Function} setErreur  — setter d'état d'erreur.
   */
  const chargerAnnee = useCallback(async (annee, setData, setLoading, setErreur) => {
    if (!equipementId) return;
    setLoading(true);
    setErreur(false);
    try {
      const { data } = await getEquipementPannesParMois(equipementId, { annee });
      setData(Array.isArray(data) ? data : []);
    } catch {
      setErreur(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [equipementId]);

  // Recharge l'année A quand elle change
  useEffect(() => {
    chargerAnnee(anneeA, setDataA, setLoadingA, setErreurA);
  }, [anneeA, chargerAnnee]);

  // Recharge l'année B quand elle change
  useEffect(() => {
    chargerAnnee(anneeB, setDataB, setLoadingB, setErreurB);
  }, [anneeB, chargerAnnee]);

  // ── Données fusionnées pour Recharts ──────────────────────────────────────
  const donneesGraphe = useMemo(
    () => fusionnerDonnees(dataA, dataB, anneeA, anneeB),
    [dataA, dataB, anneeA, anneeB]
  );

  // ── Vérification des données vides ────────────────────────────────────────
  const sansData =
    dataA !== null &&
    dataB !== null &&
    donneesGraphe.every((d) => d[String(anneeA)] === 0 && d[String(anneeB)] === 0);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const enChargement = loadingA || loadingB;

  return (
    <div>

      {/* ── Sélecteurs d'années ── */}
      <Row gutter={[12, 12]} align="middle" style={st.selecteurs}>
        <Col>
          <div style={st.selectWrapper}>
            <span style={{ ...st.selectLabel, color: COLOR_ANNEE_A }}>
              ● Année A
            </span>
            <Select
              value={anneeA}
              onChange={(v) => setAnneeA(v)}
              style={st.select}
              size="small"
            >
              {annees.map((a) => (
                <Option key={a} value={a} disabled={a === anneeB}>
                  {a}
                </Option>
              ))}
            </Select>
          </div>
        </Col>

        <Col>
          <div style={st.selectWrapper}>
            <span style={{ ...st.selectLabel, color: COLOR_ANNEE_B }}>
              ● Année B
            </span>
            <Select
              value={anneeB}
              onChange={(v) => setAnneeB(v)}
              style={st.select}
              size="small"
            >
              {annees.map((a) => (
                <Option key={a} value={a} disabled={a === anneeA}>
                  {a}
                </Option>
              ))}
            </Select>
          </div>
        </Col>
      </Row>

      {/* ── Alertes d'erreur (non bloquantes) ── */}
      {erreurA && (
        <Alert
          type="warning"
          showIcon
          message={`Impossible de charger les données pour ${anneeA}.`}
          style={{ ...st.alert, marginBottom: 8 }}
        />
      )}
      {erreurB && (
        <Alert
          type="warning"
          showIcon
          message={`Impossible de charger les données pour ${anneeB}.`}
          style={st.alert}
        />
      )}

      {/* ── État chargement ── */}
      {enChargement && (
        <div style={st.centred}>
          <Spin size="default" />
        </div>
      )}

      {/* ── État vide ── */}
      {!enChargement && sansData && !erreurA && !erreurB && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={st.videDesc}>
              Aucune panne enregistrée pour {anneeA} ni pour {anneeB}
            </span>
          }
          style={{ padding: '32px 0' }}
        />
      )}

      {/* ── Graphique ── */}
      {!enChargement && !sansData && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={donneesGraphe}
            margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
            barCategoryGap="30%"
            barGap={4}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={COLOR_GRID}
              vertical={false}
            />

            <XAxis
              dataKey="mois"
              tick={{ fontFamily: FONT, fontSize: 10, fill: COLOR_AXIS }}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              allowDecimals={false}
              tick={{ fontFamily: FONT, fontSize: 10, fill: COLOR_AXIS }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              content={({ active, payload, label }) => (
                <TooltipOCP
                  active={active}
                  payload={payload}
                  label={label}
                  anneeA={anneeA}
                  anneeB={anneeB}
                />
              )}
              cursor={{ fill: 'rgba(156,176,191,0.10)' }}
            />

            <Legend
              formatter={(value) => (
                <span style={{ fontFamily: FONT, fontSize: 11, color: COLOR_AXIS }}>
                  {value}
                </span>
              )}
              wrapperStyle={{ paddingTop: 12 }}
            />

            <Bar
              dataKey={String(anneeA)}
              fill={COLOR_ANNEE_A}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              animationDuration={600}
            />

            <Bar
              dataKey={String(anneeB)}
              fill={COLOR_ANNEE_B}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  selecteurs: {
    marginBottom: 16,
  },
  selectWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  selectLabel: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  select: {
    width: 90,
    fontFamily: FONT,
  },
  centred: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 260,
  },
  videDesc: {
    fontFamily: FONT,
    color: '#9DB0BF',
    fontSize: 13,
  },
  alert: {
    borderRadius: 8,
    marginBottom: 4,
  },
  tooltip: {
    background: '#FFFFFF',
    border: '1px solid #D8DFE5',
    borderRadius: 8,
    padding: '10px 14px',
    boxShadow: '0 4px 16px rgba(0,65,41,0.10)',
  },
  tooltipLabel: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 600,
    color: '#9DB0BF',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 6px',
  },
  tooltipLigne: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 500,
    margin: '3px 0',
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
};

export default PannesParMoisChart;