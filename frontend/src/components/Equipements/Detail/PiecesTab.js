import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Alert, Typography, Space, Input, Button } from 'antd';
import { SearchOutlined, WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { getEquipementPiecesDetail } from '../../../services/api';

const { Text } = Typography;

const PAGE_SIZE = 10;
const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

const PiecesTab = ({ equipementId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');

  const fetchPieces = useCallback(async () => {
    if (!equipementId) return;
    setLoading(true);
    setError(false);
    try {
      const params = { page: currentPage, page_size: PAGE_SIZE };
      if (searchText) params.search = searchText;
      const { data: response } = await getEquipementPiecesDetail(equipementId, params);
      setData(response.results || []);
      setTotal(response.count || 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [equipementId, currentPage, searchText]);

  useEffect(() => {
    fetchPieces();
  }, [fetchPieces]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

  const handleReset = () => {
    setSearchText('');
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      width: 110,
      render: (date) => formatDate(date),
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
    },
    {
      title: 'Pièce remplacée',
      dataIndex: 'piece',
      ellipsis: true,
      render: (piece, record) => (
        <Space>
          <span>{piece}</span>
          {record.nb_remplacements > 1 && (
            <Tag icon={<WarningOutlined />} color="warning">
              {record.nb_remplacements}x
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Ticket',
      dataIndex: 'ticket_id',
      width: 100,
      render: (id) => <Link to={`/tickets/${id}`}>TK-{String(id).padStart(3, '0')}</Link>,
    },
    {
      title: 'Titre du ticket',
      dataIndex: 'ticket_titre',
      ellipsis: true,
    },
    {
      title: 'Technicien',
      dataIndex: 'technicien_nom',
      width: 140,
      render: (name) => name || '—',
    },
    {
      title: 'Nb remplacements',
      dataIndex: 'nb_remplacements',
      width: 130,
      align: 'center',
      render: (count) => (
        <span style={{ color: count > 1 ? 'var(--ocp-error)' : 'inherit', fontWeight: count > 1 ? 600 : 400 }}>
          {count}
        </span>
      ),
    },
  ];

  if (error) {
    return <Alert type="error" message="Erreur de chargement des pièces" showIcon />;
  }

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="Rechercher une pièce..."
          prefix={<SearchOutlined style={{ color: 'var(--ocp-cool-grey)' }} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          Réinitialiser
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey={(record, index) => `${record.ticket_id}-${record.piece}-${index}`}
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: PAGE_SIZE,
          total,
          onChange: (page) => setCurrentPage(page),
          showSizeChanger: false,
          showTotal: (total) => `${total} pièce${total !== 1 ? 's' : ''} remplacée${total !== 1 ? 's' : ''}`,
        }}
        scroll={{ x: 850 }}
        sticky
        size="middle"
      />
    </div>
  );
};

export default PiecesTab;