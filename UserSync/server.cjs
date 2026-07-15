const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const app = express();
const port = 7860;

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist')));

const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const OAUTH_SCOPES = process.env.OAUTH_SCOPES || "openid profile";
const OPENID_PROVIDER_URL = process.env.OPENID_PROVIDER_URL || "https://huggingface.co";
const SPACE_HOST = process.env.SPACE_HOST;

const REDIRECT_URI = SPACE_HOST
  ? `https://${SPACE_HOST}/oauth/callback`
  : `http://localhost:${port}/oauth/callback`;

app.post('/api/craft', async (req, res) => {
  const { content, variation } = req.body;
  const apiKey = process.env.BLABLADOR_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'BLABLADOR_API_KEY is not configured on the server.' });
  }

  const model = content.length > 500 ? 'alias-large' : 'alias-fast';
  const prompt = `You are a professional content creator. Help me craft a ${variation || 'social media post'} based on the following content:\n\n${content}\n\nProvide 3 distinct and engaging variations.`;

  try {
    const response = await fetch('https://api.helmholtz-blablador.fz-juelich.de/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that helps craft engaging marketing and social media content.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    res.json({ result: data.choices[0].message.content });
  } catch (error) {
    console.error('Blablador API error:', error);
    res.status(500).json({ error: 'Failed to connect to Blablador API.' });
  }
});


const tabEvents = [];

const openApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Nova Act Suite API', version: '1.0.0', description: 'FastAPI-compatible contract for shared HF auth, tab communication, Nova Act actions, and DataHub records.' },
  paths: {
    '/api/user': { get: { summary: 'Resolve the shared Hugging Face user for every tab.' } },
    '/api/tabs/events': { get: { summary: 'List cross-tab events sorted newest first.' }, post: { summary: 'Publish a cross-tab event.' } },
    '/api/nova-act/session': { post: { summary: 'Create a Nova Act browser automation session placeholder.' } },
    '/api/datahub/records': { get: { summary: 'List persisted DataHub records.' } },
    '/api/mindwalk/graph': { get: { summary: 'Describe the Mindwalk-inspired UI navigation graph contract.' } },
    '/api/omniparser/parse': { post: { summary: 'Parse UI elements into LLM-grounded language for Nova Act.' } },
    '/api/nova-act/limitations': { post: { summary: 'Inject persona-specific limitation functions into Nova Act prompt context.' } }
  }
};

app.get('/api/openapi.json', (req, res) => res.json(openApiDocument));
app.get('/api/docs', (req, res) => res.type('html').send(`<!doctype html><title>Nova Act Suite API</title><redoc spec-url="/api/openapi.json"></redoc><script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>`));
app.post('/api/tabs/events', (req, res) => {
  const event = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), source: req.body.source || 'unknown', target: req.body.target || 'broadcast', action: req.body.action || 'message', payload: req.body.payload || {} };
  tabEvents.unshift(event); tabEvents.splice(100); res.status(201).json(event);
});
app.get('/api/tabs/events', (req, res) => res.json(tabEvents));
app.post('/api/nova-act/session', (req, res) => res.status(202).json({ id: crypto.randomUUID(), status: 'queued', sharedAuth: Boolean(req.cookies.hf_user), targetUrl: req.body.targetUrl || 'https://nova.amazon.com/', message: 'Nova Act session accepted by the suite API.' }));
app.get('/api/datahub/records', (req, res) => res.redirect(307, `/api/list-data${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));


const mindwalkLimitations = [
  { id: 'limit-safe-navigation', label: 'Safe navigation', guardrail: 'Only navigate, read, extract, and verify unless the active persona explicitly allows mutation.', injectInto: ['nova-act', 'graph'] },
  { id: 'limit-sensitive-fields', label: 'Sensitive-field pause', guardrail: 'Pause and request supervisor review before entering passwords, tokens, payment data, or private identifiers.', injectInto: ['nova-act', 'usersync', 'datahub'] },
  { id: 'limit-evidence-first', label: 'Evidence-first output', guardrail: 'Return file, DOM, API, or screenshot evidence with every persona-facing recommendation.', injectInto: ['dev', 'graph', 'oasis'] }
];

app.get('/api/mindwalk/graph', (req, res) => {
  res.json({
    source: 'cosmtrek/mindwalk-inspired-adapter',
    model: 'tabs-subviews-personas-limitations',
    touchStates: ['unvisited', 'seen', 'read', 'edited', 'limited'],
    limitations: mindwalkLimitations
  });
});


app.post('/api/omniparser/parse', (req, res) => {
  const screenName = req.body.screenName || 'Nova Act Suite';
  const elements = Array.isArray(req.body.elements) ? req.body.elements : [
    { id: 'viewport', type: 'panel', label: screenName, bbox: [0, 0, 100, 100], interactable: false, description: 'current application viewport' }
  ];
  const interactable = elements.filter((element) => element.interactable);
  res.json({
    source: 'microsoft/OmniParser-adapter',
    screenshotId: `${String(screenName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-synthetic`,
    elements,
    llmLanguage: [`Screen: ${screenName}.`, `Detected ${elements.length} UI elements; ${interactable.length} are interactable.`]
      .concat(interactable.map((element) => `Use ${element.type || 'element'} "${element.label || element.id}" at bbox [${(element.bbox || []).join(', ')}] to ${element.description || 'continue the task'}.`))
      .join(' ')
  });
});

app.post('/api/nova-act/limitations', (req, res) => {
  const requested = Array.isArray(req.body.limitationIds) ? req.body.limitationIds : [];
  const selected = mindwalkLimitations.filter((limitation) => requested.length === 0 || requested.includes(limitation.id));
  res.status(202).json({ accepted: true, selected, prompt: req.body.prompt || null });
});

app.get('/api/config', (req, res) => {
  res.json({
    clientId: OAUTH_CLIENT_ID,
    scopes: OAUTH_SCOPES,
  });
});

app.get('/login', (req, res) => {
  if (!OAUTH_CLIENT_ID) {
    return res.status(500).json({ error: "OAuth is not configured (missing OAUTH_CLIENT_ID)" });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000 }); // 10 mins

  const authUrl = `${OPENID_PROVIDER_URL}/oauth/authorize` +
    `?client_id=${OAUTH_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(OAUTH_SCOPES)}` +
    `&response_type=code` +
    `&state=${state}`;

  res.redirect(authUrl);
});

app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies.oauth_state;

  if (!state || state !== savedState) {
    console.error("State mismatch:", { state, savedState });
    return res.status(403).json({ error: "Invalid OAuth state" });
  }
  res.clearCookie('oauth_state');
  const tokenUrl = `${OPENID_PROVIDER_URL}/oauth/token`;

  const authStr = Buffer.from(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`).toString('base64');

  try {
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authStr}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: OAUTH_CLIENT_ID,
      })
    });

    if (!tokenResp.ok) {
      const errorText = await tokenResp.text();
      console.error("Token exchange failed:", errorText);
      return res.status(400).json({ error: "Failed to retrieve access token" });
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;

    const userResp = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const userInfo = await userResp.json();

    // Set cookie and redirect back to app
    res.cookie('hf_user', JSON.stringify(userInfo), { path: '/', httpOnly: false });
    res.redirect('/');
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

app.get('/api/user', (req, res) => {
  if (req.cookies.hf_user) {
    try {
      res.json(JSON.parse(req.cookies.hf_user));
    } catch (e) {
      res.status(400).json({ error: "Invalid user cookie" });
    }
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

app.get('/api/logout', (req, res) => {
  res.clearCookie('hf_user');
  res.redirect('/');
});

app.post('/api/save-data', (req, res) => {
  let { type, data, user } = req.body;

  // Sanitize inputs to prevent path traversal
  user = String(user).replace(/[^a-z0-9]/gi, '_');
  type = String(type).replace(/[^a-z0-9]/gi, '_');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${user}_${type}_${timestamp}.json`;
  const dirPath = path.join(__dirname, 'data');

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const filePath = path.join(dirPath, filename);

  try {
    fs.writeFileSync(filePath, JSON.stringify({ user, type, timestamp, data }, null, 2));
    console.log(`Saved data to ${filePath}`);
    res.json({ success: true, message: `Data saved as ${filename}` });
  } catch (error) {
    console.error('Failed to save data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.get('/api/list-data', (req, res) => {
  let { type, user } = req.query;
  const dirPath = path.join(__dirname, 'data');

  // Sanitize inputs
  if (user) user = String(user).replace(/[^a-z0-9]/gi, '_');
  if (type) type = String(type).replace(/[^a-z0-9]/gi, '_');

  if (!fs.existsSync(dirPath)) {
    return res.json([]);
  }

  try {
    const files = fs.readdirSync(dirPath);
    const results = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
          return JSON.parse(content);
        } catch (e) {
          return null;
        }
      })
      .filter(d => d && (!type || d.type === type) && (!user || d.user === user));

    res.json(results);
  } catch (error) {
    console.error('Failed to list data:', error);
    res.status(500).json({ error: 'Failed to list data' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api-docs', (req, res) => {
  res.json({
    openapi: "3.0.0",
    info: {
      title: "SyncUsers & NovaAct API Documentation",
      version: "1.0.0",
      description: "Functional REST endpoints for multi-agent simulation and AI-assisted content crafting."
    },
    endpoints: [
      {
        path: "/api/craft",
        method: "POST",
        description: "Generate engaging social media variations using Helmholtz-Blablador LLMs.",
        request: {
          content: "string (raw input text)",
          variation: "string (e.g. 'LinkedIn Post', 'X Post')"
        },
        response: {
          result: "string (generated variations)"
        }
      },
      {
        path: "/api/config",
        method: "GET",
        description: "Retrieve Hugging Face Space OAuth Client ID and scopes configuration."
      },
      {
        path: "/api/user",
        method: "GET",
        description: "Retrieve authenticated Hugging Face user information (from oauth session)."
      },
      {
        path: "/api/logout",
        method: "GET",
        description: "Clear authenticated user cookies."
      },
      {
        path: "/api/save-data",
        method: "POST",
        description: "Save custom configurations, focus groups, or test inputs to server local storage.",
        request: {
          type: "string",
          data: "object",
          user: "string"
        }
      },
      {
        path: "/api/list-data",
        method: "GET",
        description: "List previously saved data documents filtered by owner or type."
      }
    ]
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
