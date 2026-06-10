import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Select, Space,
  message, Divider, Spin, Alert, Input,
  Modal, List, Tag, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined,
  UserOutlined, CalendarOutlined, ToolOutlined,
  RobotOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ThunderboltOutlined, LoadingOutlined, WarningOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import {
  getTicket,
  changeTicketStatus,
  assignTicket,
  suggererIA,
  getSuggestions,
  feedbackSuggestion,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TicketStatusBadge, TicketPriorityBadge } from './TicketStatusBadge';

const { TextArea } = Input;

// ── Transitions autorisées par statut ────────────────────────────────────────
const STATUS_TRANSITIONS = {
  ouvert: ['en_cours'],
  en_cours: ['attente_pieces', 'resolu'],
  attente_pieces: ['en_cours', 'resolu'],
  resolu: [],
};

const STATUS_LABELS = {
  en_cours: 'En cours',
  attente_pieces: 'Attente pièces',
  resolu: 'Résolu',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convertit un texte multi-lignes en tableau de chaînes non vides. */
const texteVersListe = (texte = '') =>
  texte.split('\n').map((l) => l.trim()).filter(Boolean);

/** Formate un score de confiance en pourcentage lisible. */
const formatConfiance = (valeur) =>
  valeur != null ? `${Math.round(Number(valeur) * 100)} %` : '—';

// ── Sous-composant : ligne de métadonnée ──────────────────────────────────────
const MetaRow = ({ icon, label, value }) => (
  <div style={st.metaRow}>
    <span style={st.metaIcon}>{icon}</span>
    <span style={st.metaLabel}>{label}</span>
    <span style={st.metaValue}>
      {value ?? <span style={{ color: 'var(--ocp-cool-grey)' }}>—</span>}
    </span>
  </div>
);

// ── Sous-composant : badge "Non assigné" ──────────────────────────────────────
const UnassignedBadge = () => (
  <span style={st.unassignedBadge}>Non assigné</span>
);

// ── Sous-composant : libellé de section ───────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p style={st.sectionLabel}>{children}</p>
);

// ── Sous-composant : panneau diagnostic IA (CDC §3.3) ─────────────────────────
const PanneauIA = ({ suggestion, onAccepter, onIgnorer, onModifier, loadingFeedback }) => {
  const lignesChecklist = texteVersListe(suggestion.liste_controle);
  const lignesPieces = texteVersListe(suggestion.pieces_detachees);

  return (
    <div style={st.panneauIA}>
      {/* ── En-tête panneau ── */}
      <div style={st.panneauIAHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={st.iconIA}><RobotOutlined style={{ fontSize: 18, color: '#fff' }} /></div>
          <div>
            <div style={st.panneauIATitre}>Diagnostic IA</div>
            <div style={st.panneauIASousTitre}>
              Confiance : {formatConfiance(suggestion.confiance)}
              {suggestion.modele_ia && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>· {suggestion.modele_ia}</span>
              )}
            </div>
          </div>
        </div>

        {/* Badge statut feedback */}
        {suggestion.acceptee && (
          <Tag color="success" icon={<CheckCircleOutlined />}>Accepté</Tag>
        )}
        {suggestion.modifiee && (
          <Tag color="processing" icon={<EditOutlined />}>Modifié</Tag>
        )}
        {suggestion.acceptee === false && !suggestion.modifiee && (
          <Tag color="default" icon={<CloseCircleOutlined />}>Ignoré</Tag>
        )}
      </div>

      <Divider style={{ margin: '14px 0', borderColor: 'rgba(19,165,56,0.15)' }} />

      {/* ── Cause racine ── */}
      <SectionLabel>
        <WarningOutlined style={{ marginRight: 6, color: 'var(--ocp-orange)' }} />
        Cause racine probable
      </SectionLabel>
      <div style={st.causeRacineBox}>
        {suggestion.cause_racine || '—'}
      </div>

      {/* ── Liste de contrôle ── */}
      {lignesChecklist.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 14 }}>
            <CheckOutlined style={{ marginRight: 6, color: 'var(--ocp-green)' }} />
            Liste de contrôle d'inspection
          </SectionLabel>
          <List
            size="small"
            dataSource={lignesChecklist}
            renderItem={(item, index) => (
              <List.Item style={st.checklistItem}>
                <span style={st.checklistNum}>{index + 1}</span>
                <span style={st.checklistTexte}>{item}</span>
              </List.Item>
            )}
            style={st.checklistBox}
          />
        </>
      )}

      {/* ── Pièces de rechange ── */}
      {lignesPieces.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 14 }}>
            <ToolOutlined style={{ marginRight: 6, color: 'var(--ocp-info)' }} />
            Pièces de rechange potentielles
          </SectionLabel>
          <div style={st.piecesBox}>
            {lignesPieces.map((piece, i) => (
              <Tag key={i} style={st.pieceTag}>{piece}</Tag>
            ))}
          </div>
        </>
      )}

      {/* ── Commentaire technicien (si modifiée) ── */}
      {suggestion.modifiee && suggestion.commentaire_technicien && (
        <>
          <Divider style={{ margin: '14px 0', borderColor: 'rgba(19,165,56,0.15)' }} />
          <SectionLabel>Notes du technicien</SectionLabel>
          <div style={st.notesBox}>{suggestion.commentaire_technicien}</div>
        </>
      )}

      {/* ── Actions ── */}
      <Divider style={{ margin: '16px 0 12px', borderColor: 'rgba(19,165,56,0.15)' }} />
      <Space wrap>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={loadingFeedback === 'accepter'}
          onClick={onAccepter}
          disabled={suggestion.acceptee}
        >
          Accepter
        </Button>
        <Button
          icon={<EditOutlined />}
          loading={loadingFeedback === 'modifier'}
          onClick={onModifier}
        >
          Modifier
        </Button>
        <Button
          danger
          icon={<CloseCircleOutlined />}
          loading={loadingFeedback === 'ignorer'}
          onClick={onIgnorer}
          disabled={suggestion.acceptee === false && !suggestion.modifiee}
        >
          Ignorer
        </Button>
      </Space>
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────
const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isRole } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // ── État panneau IA ──
  const [suggestion, setSuggestion] = useState(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(null); // 'accepter' | 'modifier' | 'ignorer'
  const [modifierVisible, setModifierVisible] = useState(false);
  const [checklistEditee, setChecklistEditee] = useState('');

  const isTechnicien = isRole('technicien');

  // ── Chargement du ticket ──────────────────────────────────────────────────
  const fetchTicket = useCallback(async () => {
    try {
      const { data } = await getTicket(id);
      setTicket(data);
      setNotes(data.notes_technicien || '');
    } catch {
      message.error('Ticket introuvable.');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // ── Chargement de la suggestion existante ─────────────────────────────────
  const fetchSuggestion = useCallback(async () => {
    try {
      const { data } = await getSuggestions(id);
      setSuggestion(data);
    } catch {
      // 404 = pas encore de suggestion, état normal
      setSuggestion(null);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket();
    fetchSuggestion();
  }, [fetchTicket, fetchSuggestion]);

  // ── Actions ticket ────────────────────────────────────────────────────────
  const handleStatusChange = async () => {
    if (!newStatus) return;
    setChangingStatus(true);
    try {
      await changeTicketStatus(id, newStatus, notes);
      message.success('Statut mis à jour.');
      setNewStatus('');
      fetchTicket();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Erreur lors du changement de statut.');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleAssign = async () => {
    setAssigning(true);
    try {
      await assignTicket(id);
      message.success('Ticket assigné avec succès.');
      fetchTicket();
    } catch (err) {
      message.error(err.response?.data?.detail || "Erreur lors de l'assignation.");
    } finally {
      setAssigning(false);
    }
  };

  // ── Actions IA ────────────────────────────────────────────────────────────
  const handleSuggererIA = async () => {
    setLoadingIA(true);
    try {
      const { data } = await suggererIA(id);
      setSuggestion(data);
      message.success('Diagnostic IA généré.');
    } catch (err) {
      message.error(err.response?.data?.detail || 'Erreur lors de la génération du diagnostic.');
    } finally {
      setLoadingIA(false);
    }
  };

  const envoyerFeedback = async (type, payload) => {
    setLoadingFeedback(type);
    try {
      const { data } = await feedbackSuggestion(suggestion.id, payload);
      setSuggestion(data);
      message.success(
        type === 'accepter' ? 'Suggestion acceptée.'
          : type === 'modifier' ? 'Suggestion modifiée.'
            : 'Suggestion ignorée.'
      );
    } catch {
      message.error('Erreur lors de la mise à jour du feedback.');
    } finally {
      setLoadingFeedback(null);
    }
  };

  const handleAccepter = () =>
    envoyerFeedback('accepter', { acceptee: true });

  const handleIgnorer = () =>
    envoyerFeedback('ignorer', { acceptee: false });

  const handleOuvrirModifier = () => {
    setChecklistEditee(suggestion?.liste_controle || '');
    setModifierVisible(true);
  };

  const handleValiderModification = async () => {
    await envoyerFeedback('modifier', {
      modifiee: true,
      commentaire_technicien: checklistEditee,
    });
    setModifierVisible(false);
  };

  // ── États de rendu ────────────────────────────────────────────────────────
  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />;
  if (!ticket) return null;

  const availableTransitions = STATUS_TRANSITIONS[ticket.statut] || [];
  const transitionOptions = availableTransitions.map((s) => ({
    label: STATUS_LABELS[s] || s,
    value: s,
  }));

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* ── Bouton retour ── */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/tickets')}
        style={st.backBtn}
      >
        Retour aux tickets
      </Button>

      {/* ── Carte principale ── */}
      <Card bordered={false} style={{ marginBottom: 16 }}>

        {/* En-tête */}
        <div style={st.titleRow}>
          <div>
            <span style={st.ticketNumber}>Ticket #{ticket.id}</span>
            <h2 style={st.ticketTitle}>{ticket.titre}</h2>
          </div>
          <Space wrap>
            <TicketStatusBadge status={ticket.statut} />
            <TicketPriorityBadge priority={ticket.priorite} />
          </Space>
        </div>

        <Divider style={st.divider} />

        {/* Description */}
        <SectionLabel>Description</SectionLabel>
        <p style={st.descText}>{ticket.description}</p>

        {/* Métadonnées */}
        <div style={st.metaGrid}>
          <MetaRow
            icon={<ToolOutlined style={{ color: 'var(--ocp-green)' }} />}
            label="Équipement"
            value={ticket.equipement?.nom}
          />
          <MetaRow
            icon={<CalendarOutlined style={{ color: 'var(--ocp-info)' }} />}
            label="Créé le"
            value={dayjs(ticket.date_creation).format('DD/MM/YYYY à HH:mm')}
          />
          <MetaRow
            icon={<UserOutlined style={{ color: 'var(--ocp-orange)' }} />}
            label="Créé par"
            value={ticket.createur?.username}
          />
          <MetaRow
            icon={<UserOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
            label="Assigné à"
            value={ticket.technicien?.username ?? <UnassignedBadge />}
          />
          {ticket.date_resolution && (
            <MetaRow
              icon={<CalendarOutlined style={{ color: 'var(--ocp-success)' }} />}
              label="Résolu le"
              value={dayjs(ticket.date_resolution).format('DD/MM/YYYY à HH:mm')}
            />
          )}
        </div>

        {/* Notes technicien */}
        {ticket.notes_technicien && (
          <>
            <Divider style={st.divider} />
            <SectionLabel>Notes d'intervention</SectionLabel>
            <div style={st.notesBox}>{ticket.notes_technicien}</div>
          </>
        )}
      </Card>

      {/* ── Panneau IA — visible uniquement pour le technicien ── */}
      {isTechnicien && (
        <Card
          bordered={false}
          style={{ marginBottom: 16 }}
          title={
            <span style={st.cardTitle}>
              <RobotOutlined style={{ marginRight: 8, color: 'var(--ocp-green)' }} />
              Diagnostic IA
            </span>
          }
        >
          {/* Bouton de génération */}
          {!suggestion && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontFamily: 'var(--font-family)', fontSize: 13, color: 'var(--ocp-cool-grey)', margin: 0 }}>
                Générez un diagnostic automatique basé sur les symptômes décrits et l'historique de l'équipement.
              </p>
              <Button
                type="primary"
                icon={loadingIA ? <LoadingOutlined /> : <ThunderboltOutlined />}
                loading={loadingIA}
                onClick={handleSuggererIA}
                style={{ alignSelf: 'flex-start' }}
              >
                Obtenir un diagnostic IA
              </Button>
            </div>
          )}

          {/* Résultat de la suggestion */}
          {suggestion && (
            <>
              <PanneauIA
                suggestion={suggestion}
                onAccepter={handleAccepter}
                onIgnorer={handleIgnorer}
                onModifier={handleOuvrirModifier}
                loadingFeedback={loadingFeedback}
              />
              {/* Option pour régénérer */}
              <div style={{ marginTop: 12 }}>
                <Button
                  size="small"
                  icon={<ThunderboltOutlined />}
                  loading={loadingIA}
                  onClick={handleSuggererIA}
                  style={{ color: 'var(--ocp-cool-grey)', borderColor: 'var(--ocp-cool-grey-2)' }}
                >
                  Régénérer le diagnostic
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Actions technicien ── */}
      {isTechnicien && (
        <Card
          bordered={false}
          title={
            <span style={st.cardTitle}>
              <EditOutlined style={{ marginRight: 8, color: 'var(--ocp-green)' }} />
              Actions technicien
            </span>
          }
        >
          {/* Assignation */}
          {ticket.statut === 'ouvert' && (
            <div style={{ marginBottom: availableTransitions.length ? 16 : 0 }}>
              <p style={{ fontFamily: 'var(--font-family)', fontSize: 13, color: 'var(--ocp-cool-grey)', marginBottom: 10 }}>
                Ce ticket n'est pas encore assigné à un technicien.
              </p>
              <Button type="primary" onClick={handleAssign} loading={assigning}>
                M'assigner ce ticket
              </Button>
            </div>
          )}

          {/* Changement de statut */}
          {availableTransitions.length > 0 && (
            <>
              {ticket.statut !== 'ouvert' && <Divider style={st.divider} />}
              <SectionLabel>Changer le statut</SectionLabel>
              <Select
                placeholder="Sélectionner un nouveau statut"
                options={transitionOptions}
                value={newStatus || undefined}
                onChange={setNewStatus}
                size="large"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <SectionLabel>Notes d'intervention</SectionLabel>
              <TextArea
                rows={3}
                placeholder="Décrivez les actions réalisées, les pièces changées, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ marginBottom: 16 }}
              />
              <Button
                type="primary"
                disabled={!newStatus}
                loading={changingStatus}
                onClick={handleStatusChange}
              >
                Confirmer le changement
              </Button>
            </>
          )}

          {/* Ticket résolu */}
          {ticket.statut === 'resolu' && (
            <Alert
              message="Ce ticket est résolu."
              type="success"
              showIcon
              style={{ borderRadius: 8 }}
            />
          )}
        </Card>
      )}

      {/* ── Modal modification checklist ── */}
      <Modal
        title={
          <span style={{ fontFamily: 'var(--font-family)', fontWeight: 700, color: 'var(--ocp-dark-green)' }}>
            <EditOutlined style={{ marginRight: 8, color: 'var(--ocp-green)' }} />
            Modifier la liste de contrôle
          </span>
        }
        open={modifierVisible}
        onCancel={() => setModifierVisible(false)}
        footer={null}
        destroyOnClose
        width={540}
      >
        <div style={{ marginTop: 12 }}>
          <p style={{ fontFamily: 'var(--font-family)', fontSize: 12, color: 'var(--ocp-cool-grey)', marginBottom: 8 }}>
            Chaque ligne correspond à une étape de la checklist. Modifiez ou ajoutez des étapes selon votre expertise.
          </p>
          <TextArea
            rows={10}
            value={checklistEditee}
            onChange={(e) => setChecklistEditee(e.target.value)}
            placeholder="Une étape par ligne..."
            style={{ resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button onClick={() => setModifierVisible(false)}>Annuler</Button>
            <Button
              type="primary"
              loading={loadingFeedback === 'modifier'}
              onClick={handleValiderModification}
            >
              Enregistrer les modifications
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  backBtn: {
    color: 'var(--ocp-green)',
    fontFamily: 'var(--font-family)',
    fontWeight: 500,
    paddingLeft: 0,
    marginBottom: 16,
    border: 'none',
    boxShadow: 'none',
    background: 'transparent',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  ticketNumber: {
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    color: 'var(--ocp-cool-grey)',
    fontWeight: 500,
    display: 'block',
    marginBottom: 4,
  },
  ticketTitle: {
    fontFamily: 'var(--font-family)',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
    margin: 0,
  },
  divider: {
    borderColor: 'var(--ocp-cool-grey-3)',
    margin: '16px 0',
  },
  sectionLabel: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ocp-cool-grey)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 8,
  },
  descText: {
    fontFamily: 'var(--font-family)',
    fontSize: 14,
    color: 'var(--ocp-dark-grey)',
    lineHeight: 1.6,
    marginBottom: 20,
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '0 24px',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 0',
    borderBottom: '1px solid var(--ocp-cool-grey-4)',
  },
  metaIcon: { width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15 },
  metaLabel: { fontFamily: 'var(--font-family)', fontSize: 12, color: 'var(--ocp-cool-grey)', fontWeight: 500, width: 90, flexShrink: 0 },
  metaValue: { fontFamily: 'var(--font-family)', fontSize: 13, color: 'var(--ocp-dark-grey)', fontWeight: 500 },
  notesBox: {
    background: 'var(--ocp-cool-grey-4)',
    border: '1px solid var(--ocp-cool-grey-3)',
    borderRadius: 8,
    padding: '12px 16px',
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  unassignedBadge: {
    background: 'rgba(226,121,84,0.12)',
    color: 'var(--ocp-orange)',
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-family)',
  },
  cardTitle: {
    fontFamily: 'var(--font-family)',
    fontWeight: 700,
    fontSize: 15,
    color: 'var(--ocp-dark-green)',
  },

  // ── Panneau IA ──
  panneauIA: {
    background: 'linear-gradient(135deg, rgba(19,165,56,0.04) 0%, rgba(8,144,254,0.04) 100%)',
    border: '1px solid rgba(19,165,56,0.18)',
    borderRadius: 10,
    padding: '18px 20px',
  },
  panneauIAHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconIA: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'var(--ocp-green)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  panneauIATitre: {
    fontFamily: 'var(--font-family)',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ocp-dark-green)',
    lineHeight: 1.2,
  },
  panneauIASousTitre: {
    fontFamily: 'var(--font-family)',
    fontSize: 11,
    color: 'var(--ocp-cool-grey)',
    marginTop: 2,
  },
  causeRacineBox: {
    background: 'rgba(226,121,84,0.07)',
    border: '1px solid rgba(226,121,84,0.2)',
    borderRadius: 8,
    padding: '10px 14px',
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
    lineHeight: 1.6,
  },
  checklistBox: {
    background: 'var(--ocp-white)',
    border: '1px solid var(--ocp-cool-grey-3)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  checklistItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 14px',
    borderBottom: '1px solid var(--ocp-cool-grey-4)',
  },
  checklistNum: {
    minWidth: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--ocp-green)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-family)',
  },
  checklistTexte: {
    fontFamily: 'var(--font-family)',
    fontSize: 13,
    color: 'var(--ocp-dark-grey)',
    lineHeight: 1.5,
  },
  piecesBox: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  pieceTag: {
    background: 'rgba(8,144,254,0.08)',
    border: '1px solid rgba(8,144,254,0.2)',
    color: 'var(--ocp-info)',
    fontFamily: 'var(--font-family)',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 6,
    padding: '3px 10px',
  },
};

export default TicketDetail;