import React, { useEffect, useState } from 'react';
import { Input, Select, DatePicker, Button, Space, Row, Col } from 'antd';
import { SearchOutlined, FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUtilisateurs } from '../../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

// ── Options statiques ─────────────────────────────────────────────────────────

const STATUT_OPTIONS = [
    { value: 'ouvert', label: 'Ouvert' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'attente_pieces', label: 'Attente pièces' },
    { value: 'resolu', label: 'Résolu' },
];

const PRIORITE_OPTIONS = [
    { value: 'basse', label: 'Basse' },
    { value: 'moyenne', label: 'Moyenne' },
    { value: 'haute', label: 'Haute' },
    { value: 'urgente', label: 'Urgente' },
];

// ── Composant ─────────────────────────────────────────────────────────────────

/**
 * TicketFilters — barre de filtres synchronisée avec l'URL.
 *
 * Props :
 *   onFilter(params) — callback appelé à chaque changement de filtre.
 *                      params est un objet prêt à passer à getTickets().
 */
const TicketFilters = ({ onFilter }) => {
    const { isRole } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const isResponsable = isRole('responsable');

    // ── État local des filtres ────────────────────────────────────────────────
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [statut, setStatut] = useState(searchParams.get('statut') || undefined);
    const [priorite, setPriorite] = useState(searchParams.get('priorite') || undefined);
    const [technicienId, setTechnicienId] = useState(searchParams.get('technicien_id') || undefined);
    const [createurId, setCreateurId] = useState(searchParams.get('createur_id') || undefined);
    const [dateDebut, setDateDebut] = useState(searchParams.get('date_debut') || undefined);
    const [dateFin, setDateFin] = useState(searchParams.get('date_fin') || undefined);

    // Listes pour les selects responsable
    const [techniciens, setTechniciens] = useState([]);
    const [operateurs, setOperateurs] = useState([]);

    // ── Chargement des utilisateurs (responsable uniquement) ─────────────────
    useEffect(() => {
        if (!isResponsable) return;

        getUtilisateurs()
            .then(({ data }) => {
                const liste = Array.isArray(data) ? data : (data.results ?? []);
                setTechniciens(liste.filter((u) => u.role === 'technicien'));
                setOperateurs(liste.filter((u) => ['operateur', 'responsable'].includes(u.role)));
            })
            .catch(() => { });
    }, [isResponsable]);

    // ── Construction et émission des params ──────────────────────────────────
    const construireParams = (overrides = {}) => {
        const base = {
            search,
            statut,
            priorite,
            ...(isResponsable && technicienId ? { technicien_id: technicienId } : {}),
            ...(isResponsable && createurId ? { createur_id: createurId } : {}),
            ...(isResponsable && dateDebut ? { date_debut: dateDebut } : {}),
            ...(isResponsable && dateFin ? { date_fin: dateFin } : {}),
            ...overrides,
        };

        // Supprimer les valeurs vides pour ne pas polluer l'URL
        return Object.fromEntries(
            Object.entries(base).filter(([, v]) => v !== undefined && v !== '')
        );
    };

    const appliquerFiltres = (overrides = {}) => {
        const params = construireParams(overrides);
        setSearchParams(params);
        onFilter(params);
    };

    // ── Réinitialisation ──────────────────────────────────────────────────────
    const reinitialiser = () => {
        setSearch('');
        setStatut(undefined);
        setPriorite(undefined);
        setTechnicienId(undefined);
        setCreateurId(undefined);
        setDateDebut(undefined);
        setDateFin(undefined);
        setSearchParams({});
        onFilter({});
    };

    // ── Rendu ─────────────────────────────────────────────────────────────────
    return (
        <div style={st.conteneur}>
            <Row gutter={[12, 12]} align="middle">

                {/* Recherche texte */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Input
                        placeholder="Rechercher un ticket…"
                        prefix={<SearchOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onPressEnter={() => appliquerFiltres({ search })}
                        allowClear
                        onClear={() => appliquerFiltres({ search: '' })}
                    />
                </Col>

                {/* Statut */}
                <Col xs={12} sm={6} md={4} lg={3}>
                    <Select
                        placeholder="Statut"
                        value={statut}
                        onChange={(v) => { setStatut(v); appliquerFiltres({ statut: v }); }}
                        allowClear
                        onClear={() => appliquerFiltres({ statut: undefined })}
                        style={{ width: '100%' }}
                    >
                        {STATUT_OPTIONS.map((o) => (
                            <Option key={o.value} value={o.value}>{o.label}</Option>
                        ))}
                    </Select>
                </Col>

                {/* Priorité */}
                <Col xs={12} sm={6} md={4} lg={3}>
                    <Select
                        placeholder="Priorité"
                        value={priorite}
                        onChange={(v) => { setPriorite(v); appliquerFiltres({ priorite: v }); }}
                        allowClear
                        onClear={() => appliquerFiltres({ priorite: undefined })}
                        style={{ width: '100%' }}
                    >
                        {PRIORITE_OPTIONS.map((o) => (
                            <Option key={o.value} value={o.value}>{o.label}</Option>
                        ))}
                    </Select>
                </Col>

                {/* ── Filtres avancés (responsable uniquement) ── */}
                {isResponsable && (
                    <>
                        {/* Technicien */}
                        <Col xs={12} sm={8} md={5} lg={4}>
                            <Select
                                placeholder="Technicien"
                                value={technicienId}
                                onChange={(v) => { setTechnicienId(v); appliquerFiltres({ technicien_id: v }); }}
                                allowClear
                                onClear={() => appliquerFiltres({ technicien_id: undefined })}
                                style={{ width: '100%' }}
                            >
                                {techniciens.map((t) => (
                                    <Option key={t.id} value={t.id}>{t.username}</Option>
                                ))}
                            </Select>
                        </Col>

                        {/* Créateur */}
                        <Col xs={12} sm={8} md={5} lg={4}>
                            <Select
                                placeholder="Créateur"
                                value={createurId}
                                onChange={(v) => { setCreateurId(v); appliquerFiltres({ createur_id: v }); }}
                                allowClear
                                onClear={() => appliquerFiltres({ createur_id: undefined })}
                                style={{ width: '100%' }}
                            >
                                {operateurs.map((o) => (
                                    <Option key={o.id} value={o.id}>{o.username}</Option>
                                ))}
                            </Select>
                        </Col>

                        {/* Intervalle de dates */}
                        <Col xs={24} sm={12} md={7} lg={6}>
                            <RangePicker
                                placeholder={['Date début', 'Date fin']}
                                format="DD/MM/YYYY"
                                style={{ width: '100%' }}
                                onChange={(_, strings) => {
                                    const debut = strings[0] ? strings[0].split('/').reverse().join('-') : undefined;
                                    const fin = strings[1] ? strings[1].split('/').reverse().join('-') : undefined;
                                    setDateDebut(debut);
                                    setDateFin(fin);
                                    appliquerFiltres({ date_debut: debut, date_fin: fin });
                                }}
                            />
                        </Col>
                    </>
                )}

                {/* Boutons */}
                <Col xs={24} sm="auto">
                    <Space>
                        <Button
                            type="primary"
                            icon={<FilterOutlined />}
                            onClick={() => appliquerFiltres()}
                        >
                            Filtrer
                        </Button>
                        <Button
                            icon={<ClearOutlined />}
                            onClick={reinitialiser}
                        >
                            Réinitialiser
                        </Button>
                    </Space>
                </Col>
            </Row>
        </div>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
    conteneur: {
        background: 'var(--ocp-white)',
        border: '1px solid var(--ocp-cool-grey-3)',
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 16,
        boxShadow: 'var(--shadow-card)',
    },
};

export default TicketFilters;