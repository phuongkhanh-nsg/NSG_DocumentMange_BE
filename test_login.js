const http = require('https');

const data = JSON.stringify({
  email: 'rongcon@rongcon.net',
  password: 'Nsg@2025'
});

const options = {
  hostname: 'nsg-document-mange-be-ebon.vercel.app',
  port: 443,
  path: '/api/auth/signin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
