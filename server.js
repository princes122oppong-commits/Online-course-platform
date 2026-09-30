const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const defaultPort = Number(process.env.PORT || 8000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

const sendFile = (res, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
};

const startServer = (port) => {
  const server = http.createServer((req, res) => {
    const requestedPath = decodeURIComponent(req.url.split('?')[0]);
    const safePath = requestedPath === '/' ? '/index.html' : requestedPath;
    const filePath = path.normalize(path.join(rootDir, safePath));

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      sendFile(res, filePath);
    });
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      startServer(port + 1);
      return;
    }

    console.error('Unable to start server:', error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`CourseHub is running at http://localhost:${port}`);
  });
};

startServer(defaultPort);
