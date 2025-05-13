import express from 'express';
import cors from 'cors';
import { prisma, getRandomFortune, migrate } from './db';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

app.get('/api/fortunes/random', async (_req, res) => {
  try {
    const fortune = await getRandomFortune();
    if (!fortune) return res.status(404).json({ error: 'No fortunes found.' });
    res.json(fortune);
  } catch (err) {
    console.error('Error fetching fortune:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Start server with migrations
(async () => {
  console.log('🚀 Starting server initialization...');

  try {
    console.log('🔄 Running database migrations and seed...');
    await migrate();
    console.log('✅ Database setup completed successfully');
  } catch (e) {
    console.error('❌ Database setup failed:', e);
    process.exit(1); // fail fast – Azure will restart the container
  }

  const server = app.listen(PORT, () => {
    console.log(`🪄 Fortune API listening at http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(async () => {
      await prisma.$disconnect();
      console.log('👋 Server shut down gracefully');
    });
  });
})();
