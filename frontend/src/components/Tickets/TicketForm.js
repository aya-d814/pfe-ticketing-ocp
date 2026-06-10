import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, Card, message, Alert } from 'antd';
import {
  ArrowLeftOutlined,
  PlusCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createTicket, getEquipements } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';

const { TextArea } = Input;

/* ─────────────────────────────────────────
   Helper — normalise la réponse DRF paginée
───────────────────────────────────────── */
const normalizeData = (data) => {
  if (data?.results) return data.results;
  if (Array.isArray(data)) return data;
  return [];
};

/* ─────────────────────────────────────────
   Helper — extrait le premier message d'erreur DRF
───────────────────────────────────────── */
const extractError = (responseData) =>
  responseData
    ? Object.values(responseData).flat()[0]
    : 'Erreur lors de la création du ticket.';

/* ─────────────────────────────────────────
   Bandeau info priorité automatique
───────────────────────────────────────── */
const PrioriteInfo = () => (
  <div style={st.infoBox}>
    <InfoCircleOutlined className="text-info" style={{ fontSize: 14, flexShrink: 0 }} />
    <span className="font-ocp text-cool-grey" style={{ fontSize: 12 }}>
      La priorité est calculée automatiquement selon la criticité de l'équipement et les mots-clés détectés.
    </span>
  </div>
);

/* ─────────────────────────────────────────
   TicketForm
───────────────────────────────────────── */
const TicketForm = () => {
  const navigate = useNavigate();
  const [equipements, setEquipements] = useState([]);
  const [loadingEquipements, setLoadingEquipements] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  /* ── Chargement des équipements ── */
  useEffect(() => {
    getEquipements()
      .then(({ data }) => setEquipements(normalizeData(data)))
      .catch(() => message.error('Impossible de charger les équipements.'))
      .finally(() => setLoadingEquipements(false));
  }, []);

  /* ── Soumission du formulaire ── */
  const handleSubmit = async (values) => {
    setError('');
    setSubmitting(true);
    try {
      await createTicket({
        titre: values.titre,
        description: values.description,
        equipement_id: values.equipement,   // ← champ attendu par le backend DRF
      });
      message.success('Ticket créé avec succès !');
      navigate('/tickets');
    } catch (err) {
      setError(extractError(err.response?.data));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEquipements) return <LoadingSpinner />;

  const equipementOptions = equipements.map((eq) => ({
    label: `${eq.nom}${eq.type_equipement ? ` — ${eq.type_equipement}` : ''}`,
    value: eq.id,
  }));

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>

      {/* ── Bouton retour ── */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/tickets')}
        className="text-ocp-green font-ocp fw-500"
        style={{ paddingLeft: 0, marginBottom: 16, border: 'none', boxShadow: 'none', background: 'transparent' }}
      >
        Retour aux tickets
      </Button>

      {/* ── Titre de la page ── */}
      <div style={st.titleWrap}>
        <PlusCircleOutlined className="text-ocp-green" style={{ fontSize: 22 }} />
        <h2 className="page-title" style={{ marginBottom: 0 }}>
          Nouveau ticket de maintenance
        </h2>
      </div>

      {/* ── Formulaire ── */}
      <Card bordered={false}>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 20, borderRadius: 8 }}
          />
        )}

        <Form layout="vertical" onFinish={handleSubmit}>

          <Form.Item
            label="Titre"
            name="titre"
            rules={[{ required: true, message: 'Titre requis' }]}
          >
            <Input
              placeholder="Décrivez brièvement le problème"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            rules={[{ required: true, message: 'Description requise' }]}
          >
            <TextArea
              rows={4}
              placeholder="Décrivez le problème en détail : symptômes, contexte, urgence..."
            />
          </Form.Item>

          <Form.Item
            label="Équipement concerné"
            name="equipement"
            rules={[{ required: true, message: 'Veuillez sélectionner un équipement' }]}
          >
            <Select
              placeholder="Sélectionner un équipement"
              size="large"
              options={equipementOptions}
              showSearch
              filterOption={(input, opt) =>
                opt.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          {/* Info priorité */}
          <PrioriteInfo />

          {/* Boutons */}
          <div style={st.formFooter}>
            <Button onClick={() => navigate('/tickets')}>
              Annuler
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Créer le ticket
            </Button>
          </div>

        </Form>
      </Card>
    </div>
  );
};

/* ─── Styles (layout uniquement — pas de couleurs hardcodées) ─── */
const st = {
  titleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    background: 'rgba(8,144,254,0.06)',
    border: '1px solid rgba(8,144,254,0.18)',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 24,
  },
  formFooter: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
};

export default TicketForm;
