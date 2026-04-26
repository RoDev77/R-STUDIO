// /api/meta.js
import { getFirestore } from './lib/firebase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const db = getFirestore();
    
    // Test Firestore connection
    await db.collection('licenses').limit(1).get();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0',
      endpoints: [
        '/api/create-license.js',
        '/api/licenses.js',
        '/api/revoke-license.js',
        '/api/undo-revoke-license.js',
        '/api/verify-license.js',
        '/api/logs.js',
        '/api/meta.js'
      ]
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
}