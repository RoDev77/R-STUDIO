// /api/undo-revoke-license.js
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

    // Check if user is owner
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userRole = userData?.role;

    if (userRole !== 'owner') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only owner can undo revoke' 
      });
    }

    const { licenseId } = req.body;
    
    if (!licenseId) {
      return res.status(400).json({ success: false, error: 'License ID required' });
    }

    const licenseDoc = await db.collection('licenses').doc(licenseId).get();
    if (!licenseDoc.exists) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    // Update license - remove revoke status
    await db.collection('licenses').doc(licenseId).update({
      revoked: false,
      revokedReason: null,
      revokedBy: null,
      revokedByRole: null,
      revokedAt: null
    });

    // Log undo revoke action
    await db.collection('logs').add({
      licenseId,
      action: 'UNDO_REVOKE',
      type: 'undo_revoke',
      time: Date.now(),
      userId,
      restoredBy: userId,
      restoredByRole: userRole
    });

    res.status(200).json({ 
      success: true, 
      message: 'Revoke undone successfully' 
    });
  } catch (error) {
    console.error('Undo revoke error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}