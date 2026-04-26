// create-license.js
const admin = require('firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { gameId, placeId, mapName, duration } = req.body;

    if (!gameId || !placeId || !mapName) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Get user role from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userRole = userData?.role || 'member';

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
      revokedByRole: null
    };

    await admin.firestore().collection('licenses').doc(licenseId).set(licenseData);

    // Log activity
    await admin.firestore().collection('logs').add({
      licenseId,
      action: 'CREATE_LICENSE',
      type: 'create',
      time: Date.now(),
      userId
    });

    res.status(200).json({
      success: true,
      licenseId,
      mapName,
      gameId,
      placeId,
      expiresAt
    });
  } catch (error) {
    console.error('Create license error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};