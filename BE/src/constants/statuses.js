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
  FAILED_DELIVERY: ['RETURNED'],
  RETURNED: ['OUT_FOR_DELIVERY']
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
  
  // SENDER can only cancel before pickup
  if (role === 'SENDER') {
    return next === 'CANCELLED' && ['DRAFT', 'CREATED', 'ASSIGNED'].includes(current);
  }
  
  // DISPATCHER and ADMIN can make any allowed transition
  if (role === 'DISPATCHER' || role === 'ADMIN') {
    return nextAllowed;
  }
  
  // COURIER can only transition statuses they're allowed to, and only if it's a valid transition
  if (role === 'COURIER') {
    return nextAllowed && roleAllowed;
  }
  
  return false;
};

const getAllowedTransitions = (current, role) => {
  if (!ALLOWED_TRANSITIONS[current]) return [];
  const allowed = ALLOWED_TRANSITIONS[current];
  
  if (role === 'SENDER') {
    return allowed.filter(s => s === 'CANCELLED' && ['DRAFT', 'CREATED', 'ASSIGNED'].includes(current));
  }
  
  if (role === 'DISPATCHER' || role === 'ADMIN') {
    return allowed;
  }
  
  if (role === 'COURIER') {
    return allowed.filter(s => ROLE_TRANSITIONS.COURIER.includes(s));
  }
  
  return [];
};

module.exports = { STATUS_FLOW, ALLOWED_TRANSITIONS, ROLE_TRANSITIONS, canTransition, getAllowedTransitions };
