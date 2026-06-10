import React, { useEffect, useState } from 'react';
import { Modal, Button, List, Tag, Spin, Alert, Empty, Input } from 'antd';
import { ToolOutlined, SearchOutlined } from '@ant-design/icons';
import { getEquipementStats } from '../../services/api';

const { Search } = Input;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Filtre la liste selon un terme de recherche (insensible à la casse). */
const filtrerPieces = (pieces, terme) => {
  if (!terme.trim()) return pieces;
  const termeNorme = terme.toLowerCase();
  return pieces.filter((p) => p.toLowerCase().includes(termeNorme));
};

// ── Sous-composants ───────────────────────────────────────────────────────────

const PieceItem = ({ piece }) => (
  <List.Item style={st.pieceItem}>
    <div style={st.pieceContenu}>
      <span style={st.pieceDot}>●</span>
      <span style={st.pieceTexte}>{piece}</span>
    </div>
    <Tag style={st.pieceTag}>IA validée</Tag>
  </List.Item>
);

const EtatVide = ({ recherche }) => (
  <Empty
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    description={
      <span style={st.videDesc}>
        {recherche.trim()
          ? `Aucune pièce ne correspond à « ${recherche} »`
          : 'Aucune pièce remplacée enregistrée'}
      </span>
    }
    style={{ marginTop: 24, marginBottom: 24 }}
  />
);

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * PiecesModal — liste les pièces remplacées extraites des suggestions IA acceptées.
 *
 * Props :
 *   equipement  {object}    — équipement sélectionné (id, nom).
 *   open        {boolean}   — état d'ouverture.
 *   onClose     {function}  — callback de fermeture.
 */
const PiecesModal = ({ equipement, open, onClose }) => {
  const [pieces, setPieces]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [erreur, setErreur]       = useState(false);
  const [recherche, setRecherche] = useState('');

  // ── Chargement à l'ouverture ─────────────────────────────────────────────
  useEffect(() => {
    if (!open || !equipement?.id) return;

    setLoading(true);
    setErreur(false);
    setPieces([]);
    setRecherche('');

    getEquipementStats(equipement.id)
      .then(({ data }) => setPieces(data.pieces_remplacees ?? []))
      .catch(() => setErreur(true))
      .finally(() => setLoading(false));
  }, [open, equipement?.id]);

  const piecesVisibles = filtrerPieces(pieces, recherche);

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
          message="Impossible de charger les pièces remplacées."
          showIcon
          style={{ borderRadius: 8 }}
        />
      );
    }

    return (
      <>
        {/* ── Barre de recherche (affichée seulement si données disponibles) ── */}
        {pieces.length > 0 && (
          <Search
            placeholder="Rechercher une pièce…"
            prefix={<SearchOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            allowClear
            style={{ marginBottom: 12 }}
          />
        )}

        {/* ── Compteur ── */}
        {pieces.length > 0 && (
          <p style={st.compteur}>
            {piecesVisibles.length} pièce{piecesVisibles.length !== 1 ? 's' : ''}
            {recherche.trim() ? ` sur ${pieces.length}` : ' enregistrée' + (pieces.length !== 1 ? 's' : '')}
          </p>
        )}

        {/* ── Liste ou état vide ── */}
        {piecesVisibles.length === 0 ? (
          <EtatVide recherche={recherche} />
        ) : (
          <div style={st.listeWrapper}>
            <List
              dataSource={piecesVisibles}
              renderItem={(piece) => <PieceItem key={piece} piece={piece} />}
              size="small"
            />
          </div>
        )}

        {/* ── Note de bas de modal ── */}
        <p style={st.note}>
          Les pièces listées proviennent des diagnostics IA acceptés par les techniciens.
        </p>
      </>
    );
  };

  return (
    <Modal
      title={
        <div style={st.modalTitre}>
          <ToolOutlined style={{ color: 'var(--ocp-warning)', fontSize: 16 }} />
          <span>Pièces remplacées — {equipement?.nom}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          Fermer
        </Button>
      }
      width={500}
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
  centred: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
  },
  compteur: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ocp-cool-grey)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
  },
  listeWrapper: {
    border: '1px solid var(--ocp-cool-grey-3)',
    borderRadius: 8,
    overflow: 'hidden',
    maxHeight: 340,
    overflowY: 'auto',
  },
  pieceItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid var(--ocp-cool-grey-4)',
    background: 'var(--ocp-white)',
    transition: 'background 0.15s',
  },
  pieceContenu: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pieceDot: {
    fontSize: 8,
    color: 'var(--ocp-warning)',
    flexShrink: 0,
  },
  pieceTexte: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
    fontWeight: 500,
  },
  pieceTag: {
    background: 'rgba(8,144,254,0.08)',
    border: '1px solid rgba(8,144,254,0.2)',
    color: 'var(--ocp-info)',
    fontFamily: 'var(--font-family)',
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 20,
    padding: '1px 8px',
    flexShrink: 0,
  },
  videDesc: {
    fontFamily: 'var(--font-family)',
    color: 'var(--ocp-cool-grey)',
    fontSize: 13,
  },
  note: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    color: 'var(--ocp-cool-grey)',
    marginTop: 12,
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
};

export default PiecesModal;
