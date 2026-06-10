import React, { useState } from 'react';
import { Modal, Button, Input, Empty, Divider, message } from 'antd';
import { HistoryOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { updateEquipement } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { TextArea } = Input;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse le texte historique en entrées datées. */
const parseEntrees = (texte) => {
  if (!texte?.trim()) return [];
  return texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean);
};

// ── Sous-composants ───────────────────────────────────────────────────────────

const EntreeHistorique = ({ ligne }) => {
  // Détecte le format [JJ/MM/AAAA HH:MM] - Ticket #N - …
  const matchDate = ligne.match(/^\[([^\]]+)\]/);
  const date      = matchDate ? matchDate[1] : null;
  const corps     = date ? ligne.slice(matchDate[0].length).replace(/^[\s-]+/, '') : ligne;

  return (
    <div style={st.entree}>
      {date && (
        <span style={st.entreeDate}>{date}</span>
      )}
      <span style={st.entreeCorps}>{corps}</span>
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * HistoriqueModal — affiche l'historique textuel d'un équipement.
 *
 * Props :
 *   equipement  {object}      — équipement sélectionné (id, nom, historique).
 *   open        {boolean}     — état d'ouverture.
 *   onClose     {function}    — callback de fermeture.
 *   onSaved     {function}    — callback après sauvegarde réussie.
 */
const HistoriqueModal = ({ equipement, open, onClose, onSaved }) => {
  const { isRole } = useAuth();
  const isResponsable = isRole('responsable');

  const [modeEdition, setModeEdition] = useState(false);
  const [texteEdite, setTexteEdite]   = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const entrees = parseEntrees(equipement?.historique);

  // ── Ouverture en mode lecture ────────────────────────────────────────────
  const handleOpenEdition = () => {
    setTexteEdite(equipement?.historique ?? '');
    setModeEdition(true);
  };

  const handleAnnulerEdition = () => {
    setModeEdition(false);
  };

  const handleSauvegarder = async () => {
    if (!equipement) return;
    setSubmitting(true);
    try {
      await updateEquipement(equipement.id, { historique: texteEdite });
      message.success('Historique mis à jour.');
      setModeEdition(false);
      onSaved?.();
    } catch {
      message.error("Erreur lors de la mise à jour de l'historique.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setModeEdition(false);
    onClose();
  };

  // ── Footer ───────────────────────────────────────────────────────────────
  const footerLecture = [
    isResponsable && (
      <Button
        key="edit"
        icon={<EditOutlined />}
        onClick={handleOpenEdition}
      >
        Modifier
      </Button>
    ),
    <Button key="close" type="primary" onClick={handleClose}>
      Fermer
    </Button>,
  ].filter(Boolean);

  const footerEdition = [
    <Button key="annuler" icon={<CloseOutlined />} onClick={handleAnnulerEdition}>
      Annuler
    </Button>,
    <Button
      key="save"
      type="primary"
      icon={<SaveOutlined />}
      loading={submitting}
      onClick={handleSauvegarder}
    >
      Enregistrer
    </Button>,
  ];

  return (
    <Modal
      title={
        <div style={st.modalTitre}>
          <HistoryOutlined style={{ color: 'var(--ocp-green)', fontSize: 16 }} />
          <span>Historique — {equipement?.nom}</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={modeEdition ? footerEdition : footerLecture}
      width={580}
      destroyOnClose
    >
      {modeEdition ? (
        <div style={{ marginTop: 12 }}>
          <p style={st.aide}>
            Chaque ligne correspond à une entrée. Le format recommandé est&nbsp;:
            <code style={st.code}>[JJ/MM/AAAA HH:MM] - Ticket #N - Description</code>
          </p>
          <TextArea
            rows={10}
            value={texteEdite}
            onChange={(e) => setTexteEdite(e.target.value)}
            placeholder="Ex : [15/01/2025 09:30] - Ticket #42 - Remplacement joint mécanique"
            style={{ resize: 'vertical', fontFamily: 'var(--font-family)', fontSize: 12 }}
          />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {entrees.length === 0 ? (
            <Empty
              description={
                <span style={{ fontFamily: 'var(--font-family)', color: 'var(--ocp-cool-grey)', fontSize: 13 }}>
                  Aucun historique enregistré
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 24, marginBottom: 24 }}
            />
          ) : (
            <div style={st.timeline}>
              {entrees.map((ligne, index) => (
                <React.Fragment key={index}>
                  <EntreeHistorique ligne={ligne} />
                  {index < entrees.length - 1 && (
                    <Divider style={{ margin: '8px 0', borderColor: 'var(--ocp-cool-grey-3)' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
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
  timeline: {
    maxHeight: 400,
    overflowY: 'auto',
    padding: '4px 0',
  },
  entree: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '6px 0',
  },
  entreeDate: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ocp-cool-grey)',
    letterSpacing: '0.02em',
  },
  entreeCorps: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
    lineHeight: 1.5,
  },
  aide: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    color: 'var(--ocp-cool-grey)',
    marginBottom: 8,
    lineHeight: 1.6,
  },
  code: {
    display: 'block',
    marginTop: 4,
    background: 'var(--ocp-cool-grey-4)',
    padding: '4px 8px',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 11,
    color: 'var(--ocp-dark-grey)',
  },
};

export default HistoriqueModal;
