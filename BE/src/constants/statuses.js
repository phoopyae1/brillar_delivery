const STATUS_FLOW = [
  'DRAFT',
  'CREATED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'FAILED_DELIVERY',
  'RETURNED'
];

const ALLOWED_TRANSITIONS = {
  DRAFT: ['CREATED', 'CANCELLED'],
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'RETURNED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY', 'RETURNED'],
  DELIVERED: [],
  CANCELLED: [],
  FAILED_DELIVERY: [],
  RETURNED: []
};

const ROLE_TRANSITIONS = {
  SENDER: ['CANCELLED'],
  DISPATCHER: STATUS_FLOW,
  COURIER: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED'],
  ADMIN: STATUS_FLOW
};

const canTransition = (current, next, role) => {
  if (!ALLOWED_TRANSITIONS[current]) return false;
  const nextAllowed = ALLOWED_TRANSITIONS[current].includes(next);
  const roleAllowed = ROLE_TRANSITIONS[role]?.includes(next);
  if (role === 'SENDER') {
    return nextAllowed && ['DRAFT', 'CREATED', 'ASSIGNED'].includes(current) && roleAllowed;
  }
  return nextAllowed && roleAllowed;
};

module.exports = { STATUS_FLOW, ALLOWED_TRANSITIONS, ROLE_TRANSITIONS, canTransition };
