import React, { useState } from 'react';
import { Input, Select, Button, Space, Row, Col } from 'antd';
import { SearchOutlined, FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';

const { Option } = Select;

const CRITICITE_OPTIONS = [
    { value: 'basse', label: 'Basse' },
    { value: 'moyenne', label: 'Moyenne' },
    { value: 'haute', label: 'Haute' },
    { value: 'critique', label: 'Critique' },
];

/**
 * EquipementFilters — barre de filtres synchronisée avec l'URL.
 *
 * Props :
 *   onFilter(params) — callback appelé à chaque changement.
 */
const EquipementFilters = ({ onFilter }) => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [typeEquipement, setTypeEquipement] = useState(searchParams.get('type_equipement') || '');
    const [localisation, setLocalisation] = useState(searchParams.get('localisation') || '');
    const [criticite, setCriticite] = useState(searchParams.get('criticite') || undefined);

    // ── Construction des params (valeurs vides exclues) ───────────────────────
    const construireParams = (overrides = {}) => {
        const base = {
            search,
            type_equipement: typeEquipement,
            localisation,
            criticite,
            ...overrides,
        };
        return Object.fromEntries(
            Object.entries(base).filter(([, v]) => v !== undefined && v !== '')
        );
    };

    const appliquerFiltres = (overrides = {}) => {
        const params = construireParams(overrides);
        setSearchParams(params);
        onFilter(params);
    };

    const reinitialiser = () => {
        setSearch('');
        setTypeEquipement('');
        setLocalisation('');
        setCriticite(undefined);
        setSearchParams({});
        onFilter({});
    };

    return (
        <div style={st.conteneur}>
            <Row gutter={[12, 12]} align="middle">

                {/* Recherche texte */}
                <Col xs={24} sm={12} md={7} lg={6}>
                    <Input
                        placeholder="Rechercher un équipement…"
                        prefix={<SearchOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onPressEnter={() => appliquerFiltres({ search })}
                        allowClear
                        onClear={() => appliquerFiltres({ search: '' })}
                    />
                </Col>

                {/* Type équipement */}
                <Col xs={12} sm={8} md={5} lg={4}>
                    <Input
                        placeholder="Type (ex : pompe)"
                        value={typeEquipement}
                        onChange={(e) => setTypeEquipement(e.target.value)}
                        onPressEnter={() => appliquerFiltres({ type_equipement: typeEquipement })}
                        allowClear
                        onClear={() => appliquerFiltres({ type_equipement: '' })}
                    />
                </Col>

                {/* Localisation */}
                <Col xs={12} sm={8} md={5} lg={4}>
                    <Input
                        placeholder="Localisation"
                        value={localisation}
                        onChange={(e) => setLocalisation(e.target.value)}
                        onPressEnter={() => appliquerFiltres({ localisation })}
                        allowClear
                        onClear={() => appliquerFiltres({ localisation: '' })}
                    />
                </Col>

                {/* Criticité */}
                <Col xs={12} sm={6} md={4} lg={3}>
                    <Select
                        placeholder="Criticité"
                        value={criticite}
                        onChange={(v) => { setCriticite(v); appliquerFiltres({ criticite: v }); }}
                        allowClear
                        onClear={() => appliquerFiltres({ criticite: undefined })}
                        style={{ width: '100%' }}
                    >
                        {CRITICITE_OPTIONS.map((o) => (
                            <Option key={o.value} value={o.value}>{o.label}</Option>
                        ))}
                    </Select>
                </Col>

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
                        <Button icon={<ClearOutlined />} onClick={reinitialiser}>
                            Réinitialiser
                        </Button>
                    </Space>
                </Col>
            </Row>
        </div>
    );
};

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

export default EquipementFilters;
