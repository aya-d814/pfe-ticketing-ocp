import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Input, DatePicker, Space, Alert, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getEquipementInterventions } from '../../../services/api';
import { TicketStatusBadge } from '../../Tickets/TicketStatusBadge';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const PAGE_SIZE = 10;
const formatId = (id) => `TK-${String(id).padStart(3, '0')}`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '—');

const HistoriqueTab = ({ equipementId }) => {
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);

  const fetchInterventions = useCallback(async () => {
    if (!equipementId) return;
    setLoading(true);
    setError(false);
    try {
      const params = { page: currentPage, page_size: PAGE_SIZE };
      if (searchText) params.search = searchText;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.date_debut = dateRange[0].format('YYYY-MM-DD');
        params.date_fin = dateRange[1].format('YYYY-MM-DD');
      }
      const { data: response } = await getEquipementInterventions(equipementId, params);
      setData(response.results || []);
      setTotal(response.count || 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [equipementId, currentPage, searchText, dateRange]);

  useEffect(() => { fetchInterventions(); }, [fetchInterventions]);
  useEffect(() => { setCurrentPage(1); }, [searchText, dateRange]);

  const handleResetFilters = () => {
    setSearchText('');
    setDateRange(null);
  };

  const columns = [
    {
      title: 'Date ouverture',
      dataIndex: 'date_creation',
      width: 150,
      render: (date) => <Text style={{ fontSize: 12 }}>{formatDate(date)}</Text>,
    },
    {
      title: 'Ticket',
      dataIndex: 'id',
      width: 90,
      render: (id) => <a onClick={() => navigate(`/tickets/${id}`)}>{formatId(id)}</a>,
    },
    {
      title: 'Titre',
      dataIndex: 'titre',
      ellipsis: true,
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      width: 130,
      render: (statut) => <TicketStatusBadge status={statut} />,
    },
    {
      title: 'Intervention',
      dataIndex: 'notes_technicien',
      ellipsis: true,
      render: (notes) => notes || '—',
    },
    {
      title: 'Technicien',
      dataIndex: 'technicien_nom',
      width: 130,
      render: (tech) => tech || 'Non assigné',
    },
    {
      title: 'Temps résolution',
      dataIndex: 'duree_resolution_h',
      width: 110,
      align: 'center',
      render: (duree) => (duree !== null ? `${duree} h` : '—'),
    },
    {
      title: 'Actions',
      width: 70,
      render: (_, record) => (
        <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/tickets/${record.id}`)} />
      ),
    },
  ];

  if (error) {
    return <Alert type="error" message="Erreur de chargement des interventions" showIcon />;
  }

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="Rechercher"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
        <RangePicker
          placeholder={['Date début', 'Date fin']}
          format="DD/MM/YYYY"
          value={dateRange}
          onChange={(dates) => setDateRange(dates)}
        />
        <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
          Réinitialiser
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: PAGE_SIZE,
          total,
          onChange: setCurrentPage,
          showTotal: (t) => `${t} intervention${t !== 1 ? 's' : ''}`,
        }}
        scroll={{ x: 900 }}
        sticky
      />
    </div>
  );
};

export default HistoriqueTab;