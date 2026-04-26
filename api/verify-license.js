// verify-license.js
const admin = require('firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { licenseId, universeId, placeId } = req.query;

    if (!licenseId || !universeId) {
      return res.status(400).json({ 
        valid: false, 
        reason: 'License ID and Universe ID required' 
      });
    }

    const licenseDoc = await admin.firestore().collection('licenses').doc(licenseId).get();
    
    if (!licenseDoc.exists) {
      return res.status(200).json({ valid: false, reason: 'License not found' });
    }

    const license = licenseDoc.data();
    const now = Date.now();

    // Check if revoked
    if (license.revoked) {
      return res.status(200).json({ valid: false, reason: 'License has been revoked' });
    }

    // Check expiration
    if (license.expiresAt !== null && license.expiresAt <= now) {
      return res.status(200).json({ valid: false, reason: 'License has expired' });
    }

    // Check universe ID match
    if (Number(license.gameId) !== Number(universeId)) {
      return res.status(200).json({ 
        valid: false, 
        reason: `Game ID mismatch. Expected: ${license.gameId}` 
      });
    }

    // Optional: check place ID if provided
    if (placeId && Number(license.placeId) !== Number(placeId)) {
      return res.status(200).json({ 
        valid: false, 
        reason: `Place ID mismatch. Expected: ${license.placeId}` 
      });
    }

    // Log successful verification
    await admin.firestore().collection('logs').add({
      licenseId,
      action: 'VERIFY_SUCCESS',
      type: 'verify',
      universeId: Number(universeId),
      placeId: placeId ? Number(placeId) : null,
      time: Date.now()
    });

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
    res.status(500).json({ valid: false, reason: 'Internal server error' });
  }
};