// /api/logs.js
import { getFirestore, getAuth } from './lib/firebase.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const auth = getAuth();
    const db = getFirestore();
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    await auth.verifyIdToken(token); // Verify but don't need user data for logs

    // Get logs from last 7 days for performance
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const logsSnapshot = await db.collection('logs')
      .where('time', '>=', sevenDaysAgo)
      .orderBy('time', 'desc')
      .limit(200)
      .get();
    
    const logs = [];
    logsSnapshot.forEach(doc => {
      logs.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({ 
      success: true, 
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}