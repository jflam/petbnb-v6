import { PrismaClient, Service, UserRole, PetSize, PetType } from '@prisma/client';
import { faker } from '@faker-js/faker';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Coordinates for Seattle and Austin metro areas
const LOCATIONS = {
  SEATTLE: {
    lat: { min: 47.49, max: 47.78 },
    lng: { min: -122.46, max: -122.22 }
  },
  AUSTIN: {
    lat: { min: 30.19, max: 30.52 },
    lng: { min: -97.94, max: -97.56 }
  }
};

// List of potential special needs for pets
const SPECIAL_NEEDS = [
  'medication',
  'senior',
  'anxiety',
  'dietary_restrictions',
  'requires_exercise',
  'not_house_trained',
  'separation_anxiety'
];

// Function to generate a random point within the given bounds
function generateRandomPoint(bounds: typeof LOCATIONS.SEATTLE) {
  const lat = faker.number.float({ 
    min: bounds.lat.min, 
    max: bounds.lat.max,
    precision: 0.0001 
  });
  
  const lng = faker.number.float({ 
    min: bounds.lng.min, 
    max: bounds.lng.max,
    precision: 0.0001 
  });
  
  return { lat, lng };
}

// Function to generate a PostGIS geography point from lat/lng
function createGeographyPoint(lat: number, lng: number): any {
  // This will be handled as a raw SQL query when inserted
  return `POINT(${lng} ${lat})`;
}

// Function to hash a password
function hashPassword(password: string): string {
  // In a real app, use bcrypt or argon2, but for demo we'll use sha256
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Function to generate an OpenAI image prompt for a pet sitter
function generateSitterImagePrompt(sitterData: any): string {
  const styles = [
    'Studio Ghibli style',
    'watercolor illustration',
    'cartoon character',
    'anime-inspired portrait',
    'illustrated character'
  ];
  
  const activities = [
    'playing with pets',
    'walking a dog',
    'holding a cat',
    'sitting with animals',
    'in a park with pets'
  ];
  
  const style = faker.helpers.arrayElement(styles);
  const activity = faker.helpers.arrayElement(activities);
  
  return `A friendly pet sitter ${activity}, ${style}. Cheerful and approachable, warm colors, detailed background with pet toys or a nice home setting.`;
}

// Mock function to generate images (in a production app, this would call OpenAI API)
async function generateSitterImage(sitterId: number, prompt: string): Promise<void> {
  // In a real implementation, this would call the OpenAI API
  // For demo purposes, we'll just use a placeholder image
  console.log(`[Mock] Generating image for sitter ${sitterId} with prompt: ${prompt}`);
  
  try {
    // Download a placeholder image from Lorem Picsum
    const imageUrl = `https://picsum.photos/seed/${sitterId}/300/300`;
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    // Save the image to the public folder
    const imagePath = path.resolve(__dirname, '../../client/public/sitters', `${sitterId}.jpg`);
    await fs.writeFile(imagePath, Buffer.from(response.data));
    
    console.log(`Saved image for sitter ${sitterId} at ${imagePath}`);
  } catch (error) {
    console.error(`Error generating image for sitter ${sitterId}:`, error);
  }
}

async function main() {
  console.log('🗑️ Deleting existing data...');
  
  // Delete all existing data in reverse order of dependencies
  await prisma.availability.deleteMany({});
  await prisma.sitterService.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.pet.deleteMany({});
  await prisma.sitter.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log('✅ Database cleaned');

  console.log('🌱 Seeding users, sitters, and pets...');
  
  // Create 10 demo sitters (5 in Seattle, 5 in Austin)
  const sitters = [];
  for (let i = 0; i < 10; i++) {
    const location = i < 5 ? LOCATIONS.SEATTLE : LOCATIONS.AUSTIN;
    const point = generateRandomPoint(location);
    
    // Create a user for each sitter
    const user = await prisma.user.create({
      data: {
        role: UserRole.sitter,
        email: faker.internet.email(),
        passwordHash: hashPassword('password123'),
      }
    });
    
    // Create the sitter profile
    const sitter = await prisma.sitter.create({
      data: {
        userId: user.id,
        bio: faker.lorem.paragraph(),
        rateBoarding: faker.number.int({ min: 30, max: 80 }) * 100, // $30-$80 in cents
        rateDaycare: faker.number.int({ min: 20, max: 50 }) * 100, // $20-$50 in cents
        responseTime: faker.number.int({ min: 15, max: 120 }), // 15-120 minutes
        repeatClient: faker.number.int({ min: 0, max: 80 }), // 0-80%
        radiusKm: faker.number.int({ min: 5, max: 15 }), // 5-15 km
        // Store the geography point using raw query in the seed script
        addressGeom: prisma.$queryRaw`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography`,
      }
    });
    
    // Add sitter services
    await prisma.sitterService.createMany({
      data: [
        {
          sitterId: sitter.id,
          service: Service.boarding,
          priceCents: faker.number.int({ min: 3000, max: 8000 }),
        },
        {
          sitterId: sitter.id,
          service: Service.daycare,
          priceCents: faker.number.int({ min: 2000, max: 5000 }),
        },
        // Add other services with random probability
        ...(faker.number.int({ min: 0, max: 10 }) > 3 ? [{
          sitterId: sitter.id,
          service: Service.walking,
          priceCents: faker.number.int({ min: 1500, max: 3000 }),
        }] : []),
        ...(faker.number.int({ min: 0, max: 10 }) > 5 ? [{
          sitterId: sitter.id,
          service: Service.house_sitting,
          priceCents: faker.number.int({ min: 3500, max: 7000 }),
        }] : []),
        ...(faker.number.int({ min: 0, max: 10 }) > 7 ? [{
          sitterId: sitter.id,
          service: Service.drop_in,
          priceCents: faker.number.int({ min: 2000, max: 4000 }),
        }] : []),
      ],
    });
    
    // Generate availability for the next 60 days
    const today = new Date();
    const availabilityData = [];
    
    for (let day = 0; day < 60; day++) {
      const date = new Date();
      date.setDate(today.getDate() + day);
      
      // 80% chance of being available on any given day
      const isAvailable = faker.number.int({ min: 0, max: 10 }) < 8;
      
      availabilityData.push({
        sitterId: sitter.id,
        date,
        isAvailable,
      });
    }
    
    await prisma.availability.createMany({
      data: availabilityData,
    });
    
    // Generate and save a sitter image
    const imagePrompt = generateSitterImagePrompt(sitter);
    await generateSitterImage(sitter.id, imagePrompt);
    
    sitters.push(sitter);
  }
  
  console.log(`✅ Created ${sitters.length} sitters`);
  
  // Create 10 demo pet owners
  const owners = [];
  for (let i = 0; i < 10; i++) {
    const user = await prisma.user.create({
      data: {
        role: UserRole.owner,
        email: faker.internet.email(),
        passwordHash: hashPassword('password123'),
      }
    });
    
    owners.push(user);
  }
  
  console.log(`✅ Created ${owners.length} pet owners`);
  
  // Create 25 pets with varied sizes and needs
  const pets = [];
  const petSizes = Object.values(PetSize);
  const petTypes = Object.values(PetType);
  
  for (let i = 0; i < 25; i++) {
    // Assign to a random owner
    const owner = faker.helpers.arrayElement(owners);
    
    // Generate 0-3 random special needs
    const needsCount = faker.number.int({ min: 0, max: 3 });
    const specialNeeds = faker.helpers.arrayElements(SPECIAL_NEEDS, needsCount);
    
    const pet = await prisma.pet.create({
      data: {
        ownerId: owner.id,
        name: faker.person.firstName(),
        type: faker.helpers.arrayElement(petTypes),
        size: faker.helpers.arrayElement(petSizes),
        specialNeeds: specialNeeds,
      }
    });
    
    pets.push(pet);
  }
  
  console.log(`✅ Created ${pets.length} pets`);
  
  // Generate 200 random reviews
  console.log('Generating reviews...');
  const reviewsData = [];
  
  for (let i = 0; i < 200; i++) {
    const sitter = faker.helpers.arrayElement(sitters);
    const owner = faker.helpers.arrayElement(owners);
    
    // Generate a random rating between 1 and 5
    const rating = faker.number.int({ min: 1, max: 5 });
    
    // Create a review
    const review = await prisma.review.create({
      data: {
        sitterId: sitter.id,
        ownerId: owner.id,
        rating,
        comment: faker.lorem.paragraph(),
        createdAt: faker.date.past(),
      }
    });
    
    reviewsData.push(review);
  }
  
  console.log(`✅ Created ${reviewsData.length} reviews`);
  console.log('✅ Seeding completed successfully');
}

main()
  .catch((e) => {
    console.error('Error in seed script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });