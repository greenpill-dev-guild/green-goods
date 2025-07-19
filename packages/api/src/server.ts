import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrivyClient } from '@privy-io/server-auth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://greengoods.app', 'https://www.greengoods.app']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Users route
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    // For development, return mock data if Privy isn't configured
    if (!process.env.VITE_PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET_ID) {
      console.log('⚠️  Privy not configured, returning mock data');
      res.json([
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
      return;
    }

    // Use real Privy client if configured
    const privy = new PrivyClient(
      process.env.VITE_PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET_ID
    );

    const users = await privy.getUsers();
    res.json(users);
  } catch (error) {
    console.error('Users API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Internal server error', 
      message: errorMessage 
    });
  }
});

// Subscribe route
app.post('/api/subscribe', async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    });
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ 
      success: false, 
      error: 'Invalid email format' 
    });
    return;
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
      res.status(200).json({ 
        success: true, 
        message: "Subscription successful!" 
      });
    } else {
      res.status(response.status).json({ 
        success: false, 
        message: "Subscription failed." 
      });
    }
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error" 
    });
  }
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: PORT,
    version: process.env.npm_package_version || '0.0.0'
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Green Goods API',
    version: process.env.npm_package_version || '0.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      subscribe: '/api/subscribe'
    }
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.all('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Green Goods API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👥 Users endpoint: http://localhost:${PORT}/api/users`);
  console.log(`📧 Subscribe endpoint: http://localhost:${PORT}/api/subscribe`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 