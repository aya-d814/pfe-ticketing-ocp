import React from 'react';
import { Row, Col, Card, Statistic, Alert, Skeleton } from 'antd';
import {
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import HealthScoreBadge from '../HealthScoreBadge';

// ── Palette OCP par clé sémantique ────────────────────────────────────────────
// Miroir exact de ResponsableDashboard pour cohérence visuelle globale.

const KPI_COLORS = {
  total:    'var(--ocp-dark-green)',  /* #004129 */
  ouvert:   'var(--ocp-orange)',      /* #E27954 */
  resolu:   'var(--ocp-success)',     /* #52D579 */
  mttr:     'var(--ocp-info)',        /* #0890FE */
  health:   'var(--ocp-green)',       /* #13A538 */
};

// ── Sous-composants ───────────────────────────────────────────────────────────

/**
 * KpiCard — carte OCP standard avec Statistic Ant Design.
 * Réplique le pattern de ResponsableDashboard (classes CSS App.css).
 */
const KpiCard = ({ title, value, icon, colorKey, suffix, precision }) => {
  const color = KPI_COLORS[colorKey];
  return (
    <Card
      bordered={false}
      className={`kpi-card kpi-${colorKey}`}
      style={{ borderTopColor: color }}
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
};

/**
 * KpiCardHealth — variante pour le health score.
 * Affiche HealthScoreBadge (SVG circulaire) à la place d'un Statistic.
 */
const KpiCardHealth = ({ score }) => (
  <Card
    bordered={false}
    className="kpi-card kpi-health"
    style={{ borderTopColor: KPI_COLORS.health }}
  >
    <p style={st.kpiLabel}>Score de santé</p>
    <div style={st.healthCorps}>
      <HealthScoreBadge score={score} size="lg" />
      <span style={{ ...st.kpiValue, fontSize: 28, marginLeft: 12 }}>
        {score !== null && score !== undefined ? `${score} / 100` : '—'}
      </span>
    </div>
  </Card>
);

/**
 * Squelette de chargement — 5 cartes grises animées.
 */
const KpiSkeleton = () => (
  <Row gutter={[16, 16]}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Col key={i} xs={24} sm={12} lg={8} xl={Math.floor(24 / 5)}>
        <Card bordered={false} className="kpi-card">
          <Skeleton active paragraph={{ rows: 1 }} />
        </Card>
      </Col>
    ))}
  </Row>
);

// ── Calculs dérivés ───────────────────────────────────────────────────────────

/**
 * Calcule le taux de résolution arrondi à l'entier.
 * Retourne null si aucun ticket n'existe.
 */
const calculerTauxResolution = (resolus, total) => {
  if (!total) return null;
  return Math.round((resolus / total) * 100);
};

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * KpiCards — bande de 5 KPIs pour la page détail d'un équipement.
 *
 * Props :
 *   stats    {object|null}  — objet retourné par GET /equipements/:id/statistiques/.
 *   loading  {boolean}      — affichage skeleton pendant le chargement.
 *   erreur   {boolean}      — affichage d'une alerte si l'appel a échoué.
 */
const KpiCards = ({ stats, loading, erreur }) => {
  if (loading) return <KpiSkeleton />;

  if (erreur) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Les statistiques sont temporairement indisponibles."
        style={{ borderRadius: 8 }}
      />
    );
  }

  if (!stats) return null;

  const tauxResolution = calculerTauxResolution(
    stats.tickets_resolus,
    stats.nombre_pannes,
  );

  return (
    <Row gutter={[16, 16]}>

      {/* Total pannes */}
      <Col xs={24} sm={12} lg={8} xl={5}>
        <KpiCard
          title="Total pannes"
          value={stats.nombre_pannes}
          icon={<ExclamationCircleOutlined />}
          colorKey="total"
        />
      </Col>

      {/* Tickets ouverts */}
      <Col xs={24} sm={12} lg={8} xl={5}>
        <KpiCard
          title="Tickets ouverts"
          value={stats.tickets_ouverts}
          icon={<SyncOutlined spin={stats.tickets_ouverts > 0} />}
          colorKey="ouvert"
        />
      </Col>

      {/* Taux de résolution */}
      <Col xs={24} sm={12} lg={8} xl={5}>
        <KpiCard
          title="Taux de résolution"
          value={tauxResolution}
          suffix={tauxResolution !== null ? '%' : ''}
          icon={<CheckCircleOutlined />}
          colorKey="resolu"
        />
      </Col>

      {/* MTTR */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <KpiCard
          title="MTTR"
          value={stats.mttr_heures}
          suffix={stats.mttr_heures !== null ? 'h' : ''}
          precision={stats.mttr_heures !== null ? 1 : 0}
          icon={<ClockCircleOutlined />}
          colorKey="mttr"
        />
      </Col>

      {/* Health score */}
      <Col xs={24} sm={12} lg={8} xl={5}>
        <KpiCardHealth score={stats.health_score} />
      </Col>

    </Row>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  kpiLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ocp-cool-grey)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  kpiValue: {
    fontFamily: 'var(--font-family)',
    fontWeight: 700,
    fontSize: 32,
    color: 'var(--ocp-dark-grey)',
    lineHeight: 1,
  },
  healthCorps: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 8,
  },
};

export default KpiCards;
