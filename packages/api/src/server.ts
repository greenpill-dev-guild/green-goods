import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { PrivyClient } from '@privy-io/server-auth';

// Load environment variables
dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }
});

const PORT = Number(process.env.PORT) || 3000;

// Register CORS plugin
await fastify.register(cors, {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://greengoods.app', 'https://www.greengoods.app']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
});

// Users route
fastify.get('/api/users', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // For development, return mock data if Privy isn't configured
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET_ID) {
      fastify.log.warn('Privy not configured, returning mock data');
      return reply.send([
        {
          id: 'mock-user-1',
          createdAt: new Date().toISOString(),
          smartWallet: { address: '0x1234567890123456789012345678901234567890' },
          email: { address: 'gardener1@example.com' },
          phone: { number: '+1234567890' },
          customMetadata: { 
            username: 'gardener1',
            avatar: 'https://avatar.placeholder.com/150'
          },
          farcaster: { pfp: 'https://avatar.placeholder.com/150' }
        },
        {
          id: 'mock-user-2', 
          createdAt: new Date().toISOString(),
          smartWallet: { address: '0x0987654321098765432109876543210987654321' },
          email: { address: 'gardener2@example.com' },
          customMetadata: {
            username: 'gardener2',
            avatar: 'https://avatar.placeholder.com/150'
          }
        }
      ]);
    }

    // Use real Privy client if configured
    const privy = new PrivyClient(
      process.env.PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET_ID
    );

    const users = await privy.getUsers();
    return reply.send(users);
  } catch (error) {
    fastify.log.error('Users API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return reply.status(500).send({ 
      error: 'Internal server error', 
      message: errorMessage 
    });
  }
});

// Subscribe route
fastify.post<{
  Body: { email: string }
}>('/api/subscribe', async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
  const { email } = request.body;
  
  if (!email) {
    return reply.status(400).send({ 
      success: false, 
      error: 'Email is required' 
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return reply.status(400).send({ 
      success: false, 
      error: 'Invalid email format' 
    });
  }

  try {
    const mailchimpUrl = `https://app.us13.list-manage.com/subscribe/post?u=16db3a1a92dd56e81459cd500&id=c6c12d1a3f&f_id=0021fae1f0`;

    const data = new URLSearchParams();
    data.append("EMAIL", email);
    data.append("b_16db3a1a92dd56e81459cd500_c6c12d1a3f", "");

    const response = await fetch(mailchimpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: data.toString(),
    });

    if (response.ok) {
      return reply.status(200).send({ 
        success: true, 
        message: "Subscription successful!" 
      });
    } else {
      return reply.status(response.status).send({ 
        success: false, 
        message: "Subscription failed." 
      });
    }
  } catch (error) {
    fastify.log.error('Subscribe error:', error);
    return reply.status(500).send({ 
      success: false, 
      message: "Internal Server Error" 
    });
  }
});

// Health check
fastify.get('/api/health', async (request: FastifyRequest, reply: FastifyReply) => {
  return reply.send({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: PORT,
    version: process.env.npm_package_version || '0.0.0'
  });
});

// Root endpoint
fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
  return reply.send({
    name: 'Green Goods API',
    version: process.env.npm_package_version || '0.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      subscribe: '/api/subscribe'
    }
  });
});

// Global error handler
fastify.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
  fastify.log.error('Global error:', error);
  return reply.status(500).send({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
  return reply.status(404).send({ error: 'Not found' });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`🚀 Green Goods API running on port ${PORT}`);
    fastify.log.info(`📊 Health check: http://localhost:${PORT}/api/health`);
    fastify.log.info(`👥 Users endpoint: http://localhost:${PORT}/api/users`);
    fastify.log.info(`📧 Subscribe endpoint: http://localhost:${PORT}/api/subscribe`);
    fastify.log.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start(); 