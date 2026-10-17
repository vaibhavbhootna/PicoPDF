/**
 * Cross-Platform Local Server for PicoPDF
 * Runs with Node.js built-in modules (http, fs, path, child_process).
 * Compatible with macOS, Windows, and Linux.
 * 
 * Provides:
 * - Static file serving for client-side tools (Compress, Split, PDF-to-Image)
 * - Zero-config API bridge for Military-Grade AES-256 PDF Encryption & Decryption / Lock Removal
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

// Auto-detect python command
function getPythonCommand() {
  if (process.platform === 'win32') return 'python';
  return 'python3';
}

function parseJsonBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    // Limit to 120MB to prevent memory abuse
    if (body.length > 120 * 1024 * 1024) {
      req.connection.destroy();
    }
  });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      callback(null, data);
    } catch (e) {
      callback(e, null);
    }
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// -------------------------------------------------------------
// API Endpoints: Encrypt, Decrypt / Remove Lock
// -------------------------------------------------------------
function handleEncryptApi(req, res) {
  parseJsonBody(req, (err, data) => {
    if (err || !data.pdfBase64 || !data.password) {
      return sendJson(res, 400, { error: 'Invalid payload: pdfBase64 and password required.' });
    }

    const pdfBuffer = Buffer.from(data.pdfBase64, 'base64');
    const password = data.password;
    const algorithm = data.algorithm || 'AES-256';

    const pyScript = `
import sys, pypdf, io, json

try:
    data = sys.stdin.buffer.read()
    reader = pypdf.PdfReader(io.BytesIO(data))
    writer = pypdf.PdfWriter()
    for p in reader.pages:
        writer.add_page(p)

    writer.encrypt(${JSON.stringify(password)}, algorithm=${JSON.stringify(algorithm)})
    out = io.BytesIO()
    writer.write(out)
    sys.stdout.buffer.write(out.getvalue())
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;

    const py = spawn(getPythonCommand(), ['-c', pyScript]);
    let chunks = [];
    let errOutput = '';

    py.stdout.on('data', chunk => chunks.push(chunk));
    py.stderr.on('data', chunk => { errOutput += chunk.toString(); });

    py.on('close', code => {
      if (code !== 0) {
        return sendJson(res, 500, { error: 'Encryption failed: ' + (errOutput || 'Unknown error') });
      }

      const encryptedBuf = Buffer.concat(chunks);
      sendJson(res, 200, {
        success: true,
        encryptedBase64: encryptedBuf.toString('base64'),
        size: encryptedBuf.length,
        originalSize: pdfBuffer.length
      });
    });

    py.stdin.write(pdfBuffer);
    py.stdin.end();
  });
}

function handleDecryptApi(req, res) {
  parseJsonBody(req, (err, data) => {
    if (err || !data.pdfBase64) {
      return sendJson(res, 400, { error: 'Invalid payload: pdfBase64 required.' });
    }

    const pdfBuffer = Buffer.from(data.pdfBase64, 'base64');
    const password = data.password || '';

    const pyScript = `
import sys, pypdf, io, json

try:
    data = sys.stdin.buffer.read()
    reader = pypdf.PdfReader(io.BytesIO(data))
    
    if reader.is_encrypted:
        res = reader.decrypt(${JSON.stringify(password)})
        if res == 0:
            sys.stderr.write("INCORRECT_PASSWORD")
            sys.exit(2)

    writer = pypdf.PdfWriter()
    for p in reader.pages:
        writer.add_page(p)

    out = io.BytesIO()
    writer.write(out)
    sys.stdout.buffer.write(out.getvalue())
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;

    const py = spawn(getPythonCommand(), ['-c', pyScript]);
    let chunks = [];
    let errOutput = '';

    py.stdout.on('data', chunk => chunks.push(chunk));
    py.stderr.on('data', chunk => { errOutput += chunk.toString(); });

    py.on('close', code => {
      if (code === 2 || errOutput.includes('INCORRECT_PASSWORD')) {
        return sendJson(res, 401, { error: 'Incorrect password entered. Please verify and try again.' });
      }
      if (code !== 0) {
        return sendJson(res, 500, { error: 'Decryption failed: ' + (errOutput || 'Could not decrypt PDF') });
      }

      const decryptedBuf = Buffer.concat(chunks);
      sendJson(res, 200, {
        success: true,
        decryptedBase64: decryptedBuf.toString('base64'),
        size: decryptedBuf.length,
        originalSize: pdfBuffer.length,
        isEncrypted: false
      });
    });

    py.stdin.write(pdfBuffer);
    py.stdin.end();
  });
}

function handleCheckStatusApi(req, res) {
  parseJsonBody(req, (err, data) => {
    if (err || !data.pdfBase64) {
      return sendJson(res, 400, { error: 'Invalid payload: pdfBase64 required.' });
    }

    const pdfBuffer = Buffer.from(data.pdfBase64, 'base64');
    const pyScript = `
import sys, pypdf, io, json

try:
    data = sys.stdin.buffer.read()
    reader = pypdf.PdfReader(io.BytesIO(data))
    result = {
        "isEncrypted": bool(reader.is_encrypted),
        "pageCount": len(reader.pages) if not reader.is_encrypted else 0
    }
    sys.stdout.write(json.dumps(result))
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;

    const py = spawn(getPythonCommand(), ['-c', pyScript]);
    let stdoutData = '';
    let errOutput = '';

    py.stdout.on('data', chunk => { stdoutData += chunk.toString(); });
    py.stderr.on('data', chunk => { errOutput += chunk.toString(); });

    py.on('close', code => {
      if (code !== 0) {
        return sendJson(res, 500, { error: 'Status check failed: ' + errOutput });
      }
      try {
        const result = JSON.parse(stdoutData);
        sendJson(res, 200, result);
      } catch (e) {
        sendJson(res, 500, { error: 'Failed parsing status output' });
      }
    });

    py.stdin.write(pdfBuffer);
    py.stdin.end();
  });
}

// -------------------------------------------------------------
// Static File Serving
// -------------------------------------------------------------
function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// -------------------------------------------------------------
// Main HTTP Server
// -------------------------------------------------------------
const server = http.createServer((req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // API Routes
  if (req.method === 'POST') {
    if (req.url === '/api/encrypt') {
      return handleEncryptApi(req, res);
    }
    if (req.url === '/api/decrypt') {
      return handleDecryptApi(req, res);
    }
    if (req.url === '/api/check-status') {
      return handleCheckStatusApi(req, res);
    }
  }

  // Static File Routing
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  serveFile(req, res, filePath);
});

function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log(`Open in your browser: ${url}`);
    }
  });
}

server.listen(PORT, () => {
  const localUrl = `http://localhost:${PORT}`;
  console.log('====================================================');
  console.log('  PicoPDF - Minimalist & Private Local PDF Suite');
  console.log('  Compress • Split • PDF to Image • Encrypt • Decrypt');
  console.log('  Running locally on macOS & Windows');
  console.log('====================================================');
  console.log(`  Local URL:  ${localUrl}`);
  console.log(`  Static Dir: ${PUBLIC_DIR}`);
  console.log('  Press Ctrl+C to stop the server.');
  console.log('====================================================\n');

  if (process.argv.includes('--open')) {
    openBrowser(localUrl);
  }
});
