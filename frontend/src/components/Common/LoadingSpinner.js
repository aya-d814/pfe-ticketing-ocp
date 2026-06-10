import React from 'react';
import { Spin } from 'antd';

const LoadingSpinner = ({ tip = 'Chargement...' }) => (
  <div style={styles.wrapper}>
    <Spin size="large" description={tip} />
  </div>
);

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
};

export default LoadingSpinner;
