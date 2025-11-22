import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Teams
  console.log('Creating teams...');
  const redBull = await prisma.team.create({
    data: {
      name: 'Red Bull Racing',
      color: '#0600EF',
      logo: null,
    },
  });

  const ferrari = await prisma.team.create({
    data: {
      name: 'Scuderia Ferrari',
      color: '#DC0000',
      logo: null,
    },
  });

  console.log(`✅ Created ${2} teams`);

  // Create Drivers
  console.log('Creating drivers...');
  const drivers = await Promise.all([
    prisma.driver.create({
      data: {
        name: 'Max Verstappen',
        number: 1,
        email: 'max@redbull.com',
        color: '#0600EF',
        teamId: redBull.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Sergio Pérez',
        number: 11,
        email: 'checo@redbull.com',
        color: '#1E3A8A',
        teamId: redBull.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Charles Leclerc',
        number: 16,
        email: 'charles@ferrari.com',
        color: '#DC0000',
        teamId: ferrari.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Carlos Sainz',
        number: 55,
        email: 'carlos@ferrari.com',
        color: '#EF4444',
        teamId: ferrari.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Lewis Hamilton',
        number: 44,
        email: 'lewis@mercedes.com',
        color: '#00D2BE',
        teamId: null,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Lando Norris',
        number: 4,
        email: 'lando@mclaren.com',
        color: '#FF8700',
        teamId: null,
      },
    }),
  ]);

  console.log(`✅ Created ${drivers.length} drivers`);

  // Create Cars
  console.log('Creating cars...');
  const cars = await Promise.all([
    prisma.car.create({
      data: {
        brand: 'Red Bull',
        model: 'RB19',
        year: 2023,
        maxSpeed: 100,
        brakeForce: 55,
        fuelCapacity: 100,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'Ferrari',
        model: 'SF-23',
        year: 2023,
        maxSpeed: 98,
        brakeForce: 60,
        fuelCapacity: 105,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'Mercedes',
        model: 'W14',
        year: 2023,
        maxSpeed: 97,
        brakeForce: 58,
        fuelCapacity: 102,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'McLaren',
        model: 'MCL60',
        year: 2023,
        maxSpeed: 96,
        brakeForce: 56,
        fuelCapacity: 100,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'Porsche',
        model: '911 GT3',
        year: 2022,
        maxSpeed: 95,
        brakeForce: 62,
        fuelCapacity: 95,
      },
    }),
    prisma.car.create({
      data: {
        brand: 'BMW',
        model: 'M4 GT3',
        year: 2022,
        maxSpeed: 94,
        brakeForce: 60,
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
