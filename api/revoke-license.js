// revoke-license.js
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

    const { licenseId, reason } = req.body;
    if (!licenseId || !reason || reason.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'License ID and reason (min 3 chars) required' });
    }

    // Get license data
    const licenseDoc = await admin.firestore().collection('licenses').doc(licenseId).get();
    if (!licenseDoc.exists) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    const license = licenseDoc.data();
    if (license.revoked) {
      return res.status(400).json({ success: false, error: 'License already revoked' });
    }

    // Get user role for permission check
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userRole = userDoc.data()?.role || 'member';

    // Permission check
    let canRevoke = false;
    if (userRole === 'owner') canRevoke = true;
    else if (userRole === 'admin') {
      if (license.createdBy === userId) canRevoke = true;
      else if (license.creatorRole === 'member' || license.creatorRole === 'vip') canRevoke = true;
    } else if (license.createdBy === userId) canRevoke = true;

    if (!canRevoke) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    // Update license
    await admin.firestore().collection('licenses').doc(licenseId).update({
      revoked: true,
      revokedReason: reason,
      revokedBy: userId,
      revokedByRole: userRole,
      revokedAt: Date.now()
    });

    // Log revoke action
    await admin.firestore().collection('logs').add({
      licenseId,
      action: 'REVOKE_LICENSE',
      type: 'revoke',
      reason,
      revokedByRole: userRole,
      time: Date.now(),
      userId
    });

    res.status(200).json({ success: true, message: 'License revoked' });
  } catch (error) {
    console.error('Revoke license error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};