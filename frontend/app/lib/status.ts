export const statusFlow = [
  'CREATED',
  'ASSIGNED_FOR_PICKUP',
  'PICKED_UP',
  'ARRIVED_AT_HUB',
  'DEPARTED_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

export const statusLabels: Record<string, string> = {
  CREATED: 'Created',
  ASSIGNED_FOR_PICKUP: 'Assigned for pickup',
  PICKED_UP: 'Picked up',
  ARRIVED_AT_HUB: 'Arrived at hub',
  DEPARTED_HUB: 'Departed hub',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery failed'
};

export const priorityLabels: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High'
};
