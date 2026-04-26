// /api/licenses.js
import { getFirestore } from './lib/firebase.js';

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
    const db = getFirestore();
    
    const licensesSnapshot = await db.collection('licenses')
      .orderBy('createdAt', 'desc')
      .get();
    
    const licenses = [];
    
    licensesSnapshot.forEach(doc => {
      licenses.push({
        ...doc.data(),
        id: doc.id
      });
    });

    res.status(200).json({
      success: true,
      licenses
    });
  } catch (error) {
    console.error('Get licenses error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}