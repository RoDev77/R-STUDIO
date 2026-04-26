// undo-revoke-license.js
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

    // Check if user is owner
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userRole = userDoc.data()?.role;

    if (userRole !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owner can undo revoke' });
    }

    const { licenseId } = req.body;
    if (!licenseId) {
      return res.status(400).json({ success: false, error: 'License ID required' });
    }

    const licenseDoc = await admin.firestore().collection('licenses').doc(licenseId).get();
    if (!licenseDoc.exists) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    await admin.firestore().collection('licenses').doc(licenseId).update({
      revoked: false,
      revokedReason: null,
      revokedBy: null,
      revokedByRole: null,
      revokedAt: null
    });

    await admin.firestore().collection('logs').add({
      licenseId,
      action: 'UNDO_REVOKE',
      type: 'undo_revoke',
      time: Date.now(),
      userId
    });

    res.status(200).json({ success: true, message: 'Revoke undone' });
  } catch (error) {
    console.error('Undo revoke error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};