import mongoose from 'mongoose';
import { orderItemSchema } from './Order.js';

// OrderItem is embedded inside Order in MongoDB.
// This standalone model is provided for backwards compatibility if needed.
const OrderItem = mongoose.models.OrderItem || mongoose.model('OrderItem', orderItemSchema);

export default OrderItem;
