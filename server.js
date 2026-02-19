#!/usr/bin/env node
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');

const app = express();
const PORT = 3000;
const KB_ROOT = path.join(__dirname, 'knowledge_base');
const SCAN_FILE = 'scan.xml';
const INDEXER_API = 'http://localhost:5000/api/search'; // Your indexer's endpoint

app.set('view engine', 'ejs');
app.use(express.static('public'));

// 1. Helper: Parse Nmap XML
async function getServicesFromNmap() {
    if (!fs.existsSync(SCAN_FILE)) return [];
    const xmlData = fs.readFileSync(SCAN_FILE, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);
    
    let services = [];
    result.nmaprun.host.forEach(host => {
        const ip = host.address[0].$.addr;
        host.ports[0].port.forEach(port => {
            if (port.state[0].$.state === 'open') {
                const service = port.service ? port.service[0].$ : {};
                services.push({
                    ip,
                    port: port.$.portid,
                    name: service.name || 'unknown',
                    banner: `${service.product || ''} ${service.version || ''}`.trim()
                });
            }
        });
    });
    return services;
}

// 2. Main Route
app.get('/', async (req, res) => {
    const services = await getServicesFromNmap();
    // Check if .md file exists for each service
    services.forEach(svc => {
        svc.hasMd = fs.existsSync(path.join(KB_ROOT, `${svc.port}.md`)) || 
                     fs.existsSync(path.join(KB_ROOT, `${svc.name}.md`));
    });
    res.render('index', { services });
});

app.get('/tactical/:ip/:port/:name/:banner', async (req, res) => {
    const { ip, port, name, banner } = req.params;
    
    // Look for Port file first, then service name
    let mdPath = path.join(KB_ROOT, `${port}.md`);
    if (!fs.existsSync(mdPath)) mdPath = path.join(KB_ROOT, `${name}.md`);
    
    let mdContent = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : `# No Playbook Found\nCreate \`${port}.md\` in your knowledge base.`;

    // THE HOLE FIXER: Replace all placeholders
    mdContent = mdContent.replace(/{{target}}/g, ip)
                         .replace(/{{port}}/g, port)
                         .replace(/{{banner}}/g, banner);

    // Call your Indexer API
    let indexerData = [];
    try {
        const response = await axios.get(`${INDEXER_API}?q=${encodeURIComponent(banner)}`, { timeout: 1500 });
        indexerData = response.data; // Ensure this returns an array of {title, link}
    } catch (e) {
        indexerData = []; // Fallback if API is down
    }

    res.json({ mdContent, indexerData });
});

// 3. Tactical API (Fetches local MD + Online Indexer)
app.get('/tactical/:ip/:port/:name/:banner', async (req, res) => {
    const { ip, port, name, banner } = req.params;
    
    // Get Local Markdown
    let mdPath = path.join(KB_ROOT, `${port}.md`);
    if (!fs.existsSync(mdPath)) mdPath = path.join(KB_ROOT, `${name}.md`);
    
    let mdContent = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : "No methodology found.";
    mdContent = mdContent.replace(/{{target}}/g, ip); // Variable injection

    // Fetch Indexer Intel
    let indexerData = [];
    try {
        const response = await axios.get(`${INDEXER_API}?q=${encodeURIComponent(banner)}`);
        indexerData = response.data;
    } catch (err) {
        indexerData = [{ title: "Indexer Offline", link: "#" }];
    }

    res.json({ mdContent, indexerData });
});

app.listen(PORT, () => console.log(`Dashboard active at http://localhost:${PORT}`));