// /api/verify-license.js
import { getFirestore } from './lib/firebase.js';

export default async function handler(req, res) {
  // Set CORS headers (important for Roblox)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const db = getFirestore();
    const { licenseId, universeId, placeId } = req.query;

    // Validate required parameters
    if (!licenseId || !universeId) {
      return res.status(400).json({ 
        valid: false, 
        reason: 'License ID and Universe ID are required' 
      });
    }

    // Get license from Firestore
    const licenseDoc = await db.collection('licenses').doc(licenseId).get();
    
    if (!licenseDoc.exists) {
      // Log failed verification
      await db.collection('logs').add({
        licenseId,
        action: 'VERIFY_FAILED',
        type: 'verify',
        reason: 'License not found',
        universeId: Number(universeId),
        placeId: placeId ? Number(placeId) : null,
        time: Date.now()
      });
      
      return res.status(200).json({ 
        valid: false, 
        reason: 'License not found' 
      });
    }

    const license = licenseDoc.data();
    const now = Date.now();

    // Check if revoked
    if (license.revoked) {
      await db.collection('logs').add({
        licenseId,
        action: 'VERIFY_FAILED',
        type: 'verify',
        reason: 'License revoked',
        universeId: Number(universeId),
        placeId: placeId ? Number(placeId) : null,
        time: Date.now()
      });
      
      return res.status(200).json({ 
        valid: false, 
        reason: 'License has been revoked' 
      });
    }

    // Check expiration
    if (license.expiresAt !== null && license.expiresAt <= now) {
      await db.collection('logs').add({
        licenseId,
        action: 'VERIFY_FAILED',
        type: 'verify',
        reason: 'License expired',
        universeId: Number(universeId),
        placeId: placeId ? Number(placeId) : null,
        time: Date.now()
      });
      
      return res.status(200).json({ 
        valid: false, 
        reason: 'License has expired' 
      });
    }

    // Check universe ID match
    if (Number(license.gameId) !== Number(universeId)) {
      await db.collection('logs').add({
        licenseId,
        action: 'VERIFY_FAILED',
        type: 'verify',
        reason: 'Game ID mismatch',
        expectedGameId: license.gameId,
        receivedGameId: Number(universeId),
        time: Date.now()
      });
      
      return res.status(200).json({ 
        valid: false, 
        reason: `Game ID mismatch. Expected: ${license.gameId}` 
      });
    }

    // Optional: check place ID if provided
    if (placeId && Number(license.placeId) !== Number(placeId)) {
      await db.collection('logs').add({
        licenseId,
        action: 'VERIFY_FAILED',
        type: 'verify',
        reason: 'Place ID mismatch',
        expectedPlaceId: license.placeId,
        receivedPlaceId: Number(placeId),
        time: Date.now()
      });
      
      return res.status(200).json({ 
        valid: false, 
        reason: `Place ID mismatch. Expected: ${license.placeId}` 
      });
    }

    // Log successful verification
    await db.collection('logs').add({
      licenseId,
      action: 'VERIFY_SUCCESS',
      type: 'verify',
      universeId: Number(universeId),
      placeId: placeId ? Number(placeId) : null,
      time: Date.now(),
      mapName: license.mapName
    });

    // Return success response
    res.status(200).json({
      valid: true,
      mapName: license.mapName,
      gameId: license.gameId,
      placeId: license.placeId,
      expiresAt: license.expiresAt,
      message: 'License is valid'
    });
    
  } catch (error) {
    console.error('Verify license error:', error);
    res.status(500).json({ 
      valid: false, 
      reason: 'Internal server error' 
    });
  }
}