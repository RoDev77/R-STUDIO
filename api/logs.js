// logs.js
const admin = require('firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    await admin.auth().verifyIdToken(token);

    const logsSnapshot = await admin.firestore()
      .collection('logs')
      .orderBy('time', 'desc')
      .limit(100)
      .get();
    
    const logs = [];
    logsSnapshot.forEach(doc => {
      logs.push(doc.data());
    });

    res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};