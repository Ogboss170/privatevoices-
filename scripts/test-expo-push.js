const https = require('https');

// Expo push test utility
async function testExpoPushNotification(targetToken) {
  console.log('====================================================');
  console.log('📣 TESTING EXPO PUSH NOTIFICATION DELIVERY');
  console.log('====================================================\n');

  // Verify Expo push token format
  const isExpoToken = targetToken && (targetToken.startsWith('ExponentPushToken[') || targetToken.startsWith('ExpoPushToken['));
  
  console.log(`Target Token: ${targetToken}`);
  console.log(`Valid Expo Token Format: ${isExpoToken ? 'YES' : 'NO'}\n`);

  const payload = JSON.stringify([
    {
      to: targetToken,
      sound: 'default',
      title: 'Private Voices 🔔',
      body: 'Test push notification: Your identity and device are synchronized!',
      badge: 1,
      priority: 'high',
      channelId: 'default',
      data: {
        targetUrl: '/notifications',
        type: 'test_delivery',
        timestamp: new Date().toISOString(),
      },
    },
  ]);

  const options = {
    hostname: 'exp.host',
    port: 443,
    path: '/--/api/v2/push/send',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(`Expo Server Status Code: ${res.statusCode}`);
      try {
        const responseJson = JSON.parse(data);
        console.log('Expo Push Response:', JSON.stringify(responseJson, null, 2));
      } catch {
        console.log('Raw Response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Push delivery error:', e);
  });

  req.write(payload);
  req.end();
}

// Simulated sample Expo token for testing delivery pipeline
const sampleToken = process.argv[2] || 'ExponentPushToken[SampleTestToken_123456789]';
testExpoPushNotification(sampleToken);
