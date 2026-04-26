// licenses.js
const admin = require('firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const licensesSnapshot = await admin.firestore().collection('licenses').get();
    const licenses = [];
    
    licensesSnapshot.forEach(doc => {
      licenses.push(doc.data());
    });

    // Sort by createdAt descending
    licenses.sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json({
      success: true,
      licenses
    });
  } catch (error) {
    console.error('Get licenses error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};