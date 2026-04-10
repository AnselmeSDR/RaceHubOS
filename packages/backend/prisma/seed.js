import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Simulator Device
  console.log('Creating simulator device...');
  await prisma.device.upsert({
    where: { address: 'SIMULATOR' },
    update: {},
    create: {
      address: 'SIMULATOR',
      name: 'Simulateur',
      type: 'simulator',
    },
  });
  console.log('✅ Simulator device created');

  // Create Teams
  console.log('Creating teams...');
  const redBull = await prisma.team.create({
    data: {
      name: 'Red Bull Racing',
      color: '#1E3A5F',
      img: null,
    },
  });

  const ferrari = await prisma.team.create({
    data: {
      name: 'Scuderia Ferrari',
      color: '#DC0000',
      img: null,
    },
  });

  const porsche = await prisma.team.create({
    data: {
      name: 'Porsche Motorsport',
      color: '#C9A227',
      img: null,
    },
  });

  console.log(`✅ Created ${3} teams`);

  // Create Drivers
  console.log('Creating drivers...');
  const drivers = await Promise.all([
    prisma.driver.create({
      data: {
        name: 'Anselme SDR',
        number: 42,
        email: 'anselme@example.com',
        color: '#060d08',
        teamId: null,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Fanny Benoit',
        number: 2,
        email: 'fanny@example.com',
        color: '#f12835',
        teamId: null,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Romain Danna',
        number: 71,
        email: 'romain@example.com',
        color: '#74b9d2',
        teamId: null,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Lisa Furnari',
        number: 7,
        email: 'lisa@example.com',
        color: '#c5b9d5',
        teamId: null,
      },
    }),
  ]);

  console.log(`✅ Created ${drivers.length} drivers`);

  // Create Cars (Carrera 1:32 models)
  console.log('Creating cars...');
  const cars = await Promise.all([
    prisma.car.create({
      data: {
        brand: 'Mercedes-Benz',
        model: 'CLK DTM Vodafone',
        year: 2005,
        color: '#C0C0C0',
        maxSpeed: 95,
        brakeForce: 55,
        fuelCapacity: 100,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'Ferrari',
        model: '488 GT3 #68',
        year: 2018,
        color: '#DC0000',
        maxSpeed: 98,
        brakeForce: 60,
        fuelCapacity: 105,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'McLaren',
        model: '720S GT3 #03',
        year: 2020,
        color: '#FF8C00',
        maxSpeed: 97,
        brakeForce: 58,
        fuelCapacity: 102,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'Porsche',
        model: '911 RSR Project 1 #56',
        year: 2018,
        color: '#FFD700',
        maxSpeed: 96,
        brakeForce: 62,
        fuelCapacity: 95,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'Red Bull',
        model: 'RB12 F1 #33',
        year: 2016,
        color: '#1E3A5F',
        maxSpeed: 100,
        brakeForce: 65,
        fuelCapacity: 100,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'BMW',
        model: 'M4 DTM BMW Bank #7',
        year: 2017,
        color: '#1C1C1C',
        maxSpeed: 94,
        brakeForce: 58,
        fuelCapacity: 98,
      },
    }),
  ]);

  console.log(`✅ Created ${cars.length} cars`);

  // Create Tracks
  console.log('Creating tracks...');
  const tracks = await Promise.all([
    prisma.track.create({
      data: {
        name: 'Monaco Grand Prix',
        length: 12.5,
        corners: 18,
        bestLap: null,
        bestLapBy: null,
      },
    }),
    prisma.track.create({
      data: {
        name: 'Spa-Francorchamps',
        length: 15.8,
        corners: 14,
        bestLap: null,
        bestLapBy: null,
      },
    }),
    prisma.track.create({
      data: {
        name: 'Nürburgring GP',
        length: 14.2,
        corners: 16,
        bestLap: null,
        bestLapBy: null,
      },
    }),
  ]);

  console.log(`✅ Created ${tracks.length} tracks`);

  console.log('\n✅ Seed completed successfully!');
  console.log(`
📊 Summary:
   Teams: ${2}
   Drivers: ${drivers.length}
   Cars: ${cars.length}
   Tracks: ${tracks.length}
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
