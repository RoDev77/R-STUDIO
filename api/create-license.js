// /api/create-license.js
import { getFirestore, getAuth } from './lib/firebase.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
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
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { gameId, placeId, mapName, duration } = req.body;

    if (!gameId || !placeId || !mapName) {
      return res.status(400).json({ success: false, error: 'Missing required fields: gameId, placeId, mapName' });
    }

    // Get user role from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userRole = userData.role || 'member';

    // Generate unique license ID
    const licenseId = 'LIC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = duration === 0 ? null : Date.now() + (duration * 24 * 60 * 60 * 1000);

    const licenseData = {
      licenseId,
      gameId: Number(gameId),
      placeId: Number(placeId),
      mapName,
      createdBy: userId,
      creatorRole: userRole,
      createdAt: Date.now(),
      expiresAt,
      revoked: false,
      revokedReason: null,
      revokedBy: null,
      revokedByRole: null,
      revokedAt: null
    };

    // Save to Firestore
    await db.collection('licenses').doc(licenseId).set(licenseData);

    // Log activity
    await db.collection('logs').add({
      licenseId,
      action: 'CREATE_LICENSE',
      type: 'create',
      time: Date.now(),
      userId,
      details: { gameId, placeId, mapName, duration }
    });

    res.status(200).json({
      success: true,
      licenseId,
      mapName,
      gameId: Number(gameId),
      placeId: Number(placeId),
      expiresAt
    });
  } catch (error) {
    console.error('Create license error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}