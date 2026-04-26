import axios from 'axios';

// Siempre rutas relativas — en dev Vite proxea /webhook → n8n,
// en prod el servidor Express hace lo mismo. La URL de n8n nunca queda en el bundle.
const api = axios.create({
    baseURL: '',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getOrders = () => api.get('/webhook/orders');
export const updateOrderStatus = (orderId, status) => api.post('/webhook/orders/update', { orderId, status });
export const getCustomers = () => api.get('/webhook/customers');

export default api;
