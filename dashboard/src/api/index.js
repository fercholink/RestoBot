import axios from 'axios';

// La URL de n8n vendrá de las variables de entorno o será dinámica
const N8N_API_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_N8N_URL || 'https://tu-n8n-easypanel.com');

const api = axios.create({
    baseURL: N8N_API_URL,
    timeout: 10000, // 10 segundos timeout
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getOrders = () => api.get('/webhook/orders');
export const updateOrderStatus = (orderId, status) => api.post('/webhook/orders/update', { orderId, status });
export const getCustomers = () => api.get('/webhook/customers');

export default api;
