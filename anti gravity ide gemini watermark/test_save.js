// Test script to save the processed image by loading in browser
// and extracting canvas data

const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple HTTP server to receive the saved image
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.end(); return; }
    if (req.method === 'POST' && (req.url === '/save' || req.url === '/save_all')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.crop) {
                    const b64 = data.crop.replace(/^data:image\/png;base64,/, '');
                    const buf = Buffer.from(b64, 'base64');
                    fs.writeFileSync(path.join(__dirname, 'crop_result.png'), buf);
                }
                if (data.full) {
                    const b64 = data.full.replace(/^data:image\/png;base64,/, '');
                    const buf = Buffer.from(b64, 'base64');
                    fs.writeFileSync(path.join(__dirname, 'full_result.png'), buf);
                }
                if (data.image) {
                    const b64 = data.image.replace(/^data:image\/png;base64,/, '');
                    const buf = Buffer.from(b64, 'base64');
                    fs.writeFileSync(path.join(__dirname, 'processed_watermark_area.png'), buf);
                }
                console.log('Saved files at', new Date().toISOString());
                res.writeHead(200);
                res.end(JSON.stringify({status:'ok',pos:data.pos,op:data.op}));
            } catch(e) {
                console.error(e.message);
                res.writeHead(400);
                res.end(e.message);
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(18765, () => {
    console.log('Save server on 18765');
});
