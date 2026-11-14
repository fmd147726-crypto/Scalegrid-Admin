const http = require('http');

const PORT = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'Online', systemHealth: '99.9%' }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ message: 'Endpoint not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Admin Server running on port ${PORT}`);
});
