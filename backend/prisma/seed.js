require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { generateTrackingCode } = require('../src/utils/trackingCode');

const prisma = new PrismaClient();

const users = [
  { name: 'Alice Sender', email: 'sender@example.com', role: 'SENDER' },
  { name: 'Bob Dispatcher', email: 'dispatcher@example.com', role: 'DISPATCHER' },
  { name: 'Cory Courier', email: 'courier@example.com', role: 'COURIER' },
  { name: 'Ana Admin', email: 'admin@example.com', role: 'ADMIN' },
  { name: 'Sara Sender', email: 'sender2@example.com', role: 'SENDER' },
  { name: 'Curt Courier', email: 'courier2@example.com', role: 'COURIER' }
];

const statusOrder = [
  'CREATED',
  'ASSIGNED_FOR_PICKUP',
  'PICKED_UP',
  'ARRIVED_AT_HUB',
  'DEPARTED_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

async function main() {
  await prisma.deliveryEvent.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('password123', 10);
  const createdUsers = {};
  for (const user of users) {
    createdUsers[user.email] = await prisma.user.create({ data: { ...user, password } });
  }

  const sender = createdUsers['sender@example.com'];
  const dispatcher = createdUsers['dispatcher@example.com'];
  const courier = createdUsers['courier@example.com'];
  const courier2 = createdUsers['courier2@example.com'];

  for (let i = 1; i <= 10; i++) {
    const trackingCode = generateTrackingCode();
    const status = statusOrder[i % statusOrder.length];
    const delivery = await prisma.delivery.create({
      data: {
        trackingCode,
        title: `Office Package ${i}`,
        description: `Package description ${i}`,
        priority: i % 2 === 0 ? 'HIGH' : 'MEDIUM',
        status,
        senderId: sender.id,
        receiverName: `Receiver ${i}`,
        receiverPhone: '555-0000',
        pickupAddress: `500 Pickup Ave Floor ${i}`,
        deliveryAddress: `123 Office St Suite ${i}`,
        packageWeight: 1.2 + i,
        packageDimensions: '10x8x4',
        serviceType: 'STANDARD'
      }
    });

    const assignmentCourier = i % 2 === 0 ? courier2 : courier;
    await prisma.assignment.create({ data: { deliveryId: delivery.id, courierId: assignmentCourier.id } });

    for (let s = 0; s <= statusOrder.indexOf(status); s++) {
      const type = statusOrder[s];
      await prisma.deliveryEvent.create({
        data: {
          deliveryId: delivery.id,
          type,
          note: `Status changed to ${type}`,
          locationText: 'HQ',
          createdById: s === 0 ? sender.id : assignmentCourier.id
        }
      });
    }

    await prisma.deliveryEvent.create({
      data: {
        deliveryId: delivery.id,
        type: 'ASSIGNED_FOR_PICKUP',
        note: 'Assigned to courier',
        createdById: dispatcher.id
      }
    });

    if (i % 3 === 0) {
      await prisma.supportTicket.create({
        data: {
          deliveryId: delivery.id,
          category: 'DELAY',
          description: 'Customer asked about pickup timing',
          status: 'OPEN',
          createdById: sender.id
        }
      });
    }
  }

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
