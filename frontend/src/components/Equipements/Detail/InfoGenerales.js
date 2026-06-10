import React from 'react';
import { Divider } from 'antd';
import {
  AppstoreOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ToolOutlined,
  TagOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

// ── Configuration des badges criticité ───────────────────────────────────────

const CRITICITE_CONFIG = {
  basse:    { color: '#2baa55',            bg: 'rgba(82,213,121,0.12)',  label: 'Basse' },
  moyenne:  { color: '#c07d00',            bg: 'rgba(255,175,42,0.13)',  label: 'Moyenne' },
  haute:    { color: 'var(--ocp-orange)',  bg: 'rgba(226,121,84,0.12)',  label: 'Haute' },
  critique: { color: 'var(--ocp-error)',   bg: 'rgba(244,54,79,0.12)',   label: 'Critique' },
};

const CRITICITE_FALLBACK = {
  color: 'var(--ocp-cool-grey)',
  bg: 'var(--ocp-cool-grey-4)',
  label: '—',
};

// ── Sous-composants ───────────────────────────────────────────────────────────

/**
 * Ligne d'information : icône + libellé + valeur.
 * La valeur est rendue en gris si absente.
 */
const InfoLigne = ({ icon, label, value }) => (
  <div style={st.ligne}>
    <span style={st.ligneIcone}>{icon}</span>
    <span style={st.ligneLabel}>{label}</span>
    <span style={st.ligneValeur}>
      {value ?? <span style={st.ligneVide}>Non renseigné</span>}
    </span>
  </div>
);

/** Badge coloré selon la criticité de l'équipement. */
const CriticiteBadge = ({ criticite }) => {
  const cfg = CRITICITE_CONFIG[criticite] ?? CRITICITE_FALLBACK;
  return (
    <span style={{ ...st.badge, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
};

/**
 * Badge de statut opérationnel.
 * Logique : un équipement avec des tickets ouverts est considéré
 * "En maintenance", sinon "Opérationnel".
 * Ce champ n'existe pas en base — il est déduit côté frontend pour
 * ne pas surcharger le modèle avec une donnée dérivée.
 */
const StatutBadge = ({ ticketsOuverts }) => {
  const enMaintenance = ticketsOuverts > 0;
  return (
    <span
      style={{
        ...st.badge,
        background: enMaintenance
          ? 'rgba(255,175,42,0.13)'
          : 'rgba(82,213,121,0.12)',
        color: enMaintenance ? '#c07d00' : '#2baa55',
      }}
    >
      {enMaintenance ? 'En maintenance' : 'Opérationnel'}
    </span>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * InfoGenerales — grille des informations descriptives d'un équipement.
 *
 * Props :
 *   equipement      {object}        — objet équipement complet.
 *   ticketsOuverts  {number|null}   — nombre de tickets ouverts (pour le statut).
 */
const InfoGenerales = ({ equipement, ticketsOuverts = null }) => {
  const dateInstallation = equipement.date_installation
    ? dayjs(equipement.date_installation).format('DD/MM/YYYY')
    : null;

  return (
    <div>
      {/* ── Titre de section ── */}
      <p style={st.sectionLabel}>Informations générales</p>

      {/* ── Grille deux colonnes sur écrans larges ── */}
      <div style={st.grille}>

        {/* Colonne gauche */}
        <div style={st.colonne}>
          <InfoLigne
            icon={<AppstoreOutlined style={{ color: 'var(--ocp-green)' }} />}
            label="Nom"
            value={
              <span style={st.valeurNom}>{equipement.nom}</span>
            }
          />
          <Divider style={st.dividerLigne} />

          <InfoLigne
            icon={<ApartmentOutlined style={{ color: 'var(--ocp-info)' }} />}
            label="Type"
            value={equipement.type_equipement || null}
          />
          <Divider style={st.dividerLigne} />

          <InfoLigne
            icon={<TagOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
            label="Modèle"
            value={equipement.modele || null}
          />
          <Divider style={st.dividerLigne} />

          <InfoLigne
            icon={<EnvironmentOutlined style={{ color: 'var(--ocp-orange)' }} />}
            label="Localisation"
            value={equipement.localisation || null}
          />
        </div>

        {/* Colonne droite */}
        <div style={st.colonne}>
          <InfoLigne
            icon={<SafetyCertificateOutlined style={{ color: 'var(--ocp-warning)' }} />}
            label="Criticité"
            value={<CriticiteBadge criticite={equipement.criticite} />}
          />
          <Divider style={st.dividerLigne} />

          <InfoLigne
            icon={<ToolOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
            label="Statut"
            value={
              ticketsOuverts !== null
                ? <StatutBadge ticketsOuverts={ticketsOuverts} />
                : null
            }
          />
          <Divider style={st.dividerLigne} />

          <InfoLigne
            icon={<CalendarOutlined style={{ color: 'var(--ocp-info)' }} />}
            label="Installation"
            value={dateInstallation}
          />
          <Divider style={st.dividerLigne} />

          <InfoLigne
            icon={<AppstoreOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
            label="Fabricant"
            value={equipement.fabricant || null}
          />
        </div>

      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  sectionLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ocp-cool-grey)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 12,
  },

  // ── Grille responsive ──
  grille: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '0 32px',
  },
  colonne: {
    display: 'flex',
    flexDirection: 'column',
  },

  // ── Ligne d'information ──
  ligne: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 0',
    minHeight: 38,
  },
  ligneIcone: {
    width: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
  },
  ligneLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ocp-cool-grey)',
    width: 90,
    flexShrink: 0,
  },
  ligneValeur: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
    fontWeight: 500,
    flex: 1,
  },
  ligneVide: {
    color: 'var(--ocp-cool-grey)',
    fontStyle: 'italic',
    fontWeight: 400,
  },
  valeurNom: {
    fontFamily: 'var(--font-family)',
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
    fontSize: 13,
  },

  // ── Séparateur entre lignes ──
  dividerLigne: {
    margin: 0,
    borderColor: 'var(--ocp-cool-grey-4)',
  },

  // ── Badge générique ──
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-family)',
    whiteSpace: 'nowrap',
  },
};

export default InfoGenerales;
