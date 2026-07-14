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

app.get('/api-docs', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>API Documentation</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
        h1 { color: #111; border-bottom: 2px solid #eaecef; padding-bottom: 10px; }
        h2 { color: #2f363d; margin-top: 30px; border-bottom: 1px solid #eaecef; padding-bottom: 5px; }
        code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; background-color: #f6f8fa; padding: .2em .4em; border-radius: 3px; font-size: 85%; }
        pre { background-color: #f6f8fa; padding: 16px; overflow: auto; border-radius: 6px; }
        .method { font-weight: bold; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-right: 10px; color: #fff; }
        .get { background-color: #2ea44f; }
        .post { background-color: #0366d6; }
        .endpoint { background-color: #fafbfc; border: 1px solid #e1e4e8; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h1>API Documentation</h1>
      <p>This page lists all the available functional and mandatory API endpoints of the application.</p>

      <div class="endpoint">
        <h2><span class="method get">GET</span> /health</h2>
        <p><strong>Purpose:</strong> Simple healthcheck endpoint returning HTTP 200 OK. Mandatory for Hugging Face Space startup.</p>
        <p><strong>Response Example:</strong></p>
        <pre><code>OK</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method get">GET</span> /api-docs</h2>
        <p><strong>Purpose:</strong> Documents all available API endpoints.</p>
        <p><strong>Response Example:</strong></p>
        <pre><code>HTML page displaying this documentation.</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method post">POST</span> /api/craft</h2>
        <p><strong>Purpose:</strong> Help craft marketing and social media content based on input content and variation using Blablador API.</p>
        <p><strong>Request Example:</strong></p>
        <pre><code>{
  "content": "hello world",
  "variation": "social media post"
}</code></pre>
        <p><strong>Response Example:</strong></p>
        <pre><code>{
  "result": "..."
}</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method get">GET</span> /api/config</h2>
        <p><strong>Purpose:</strong> Retrieve OAuth client configuration.</p>
        <p><strong>Response Example:</strong></p>
        <pre><code>{
  "clientId": "some-client-id",
  "scopes": "openid profile"
}</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method get">GET</span> /login</h2>
        <p><strong>Purpose:</strong> Initiate OAuth login redirect flow to Hugging Face.</p>
        <p><strong>Response Example:</strong></p>
        <pre><code>Redirects user to Hugging Face authorize page.</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method get">GET</span> /oauth/callback</h2>
        <p><strong>Purpose:</strong> OAuth callback endpoint to exchange authorization code for an access token and retrieve user info.</p>
        <p><strong>Response Example:</strong></p>
        <pre><code>Redirects user back to root / with hf_user cookie.</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method get">GET</span> /api/user</h2>
        <p><strong>Purpose:</strong> Retrieve authenticated Hugging Face user details from hf_user cookie.</p>
        <p><strong>Response Example:</strong></p>
        <pre><code>{
  "name": "Jane Doe",
  "preferred_username": "janedoe",
  "picture": "https://..."
}</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method get">GET</span> /api/logout</h2>
        <p><strong>Purpose:</strong> Log out the user by clearing the hf_user cookie and redirecting to root /.</p>
        <p><strong>Response Example:</strong></p>
        <pre><code>Redirects user to root /.</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method post">POST</span> /api/save-data</h2>
        <p><strong>Purpose:</strong> Save JSON data to server's data directory with a unique timestamped filename under the user.</p>
        <p><strong>Request Example:</strong></p>
        <pre><code>{
  "type": "branding",
  "data": { "theme": "dark" },
  "user": "janedoe"
}</code></pre>
        <p><strong>Response Example:</strong></p>
        <pre><code>{
  "success": true,
  "message": "Data saved as janedoe_branding_2026-07-14-19-12-35-123Z.json"
}</code></pre>
      </div>

      <div class="endpoint">
        <h2><span class="method get">GET</span> /api/list-data</h2>
        <p><strong>Purpose:</strong> Retrieve list of saved JSON data files filtered optionally by type and user.</p>
        <p><strong>Query Parameters:</strong> <code>type</code> (optional), <code>user</code> (optional)</p>
        <p><strong>Response Example:</strong></p>
        <pre><code>[
  {
    "user": "janedoe",
    "type": "branding",
    "timestamp": "2026-07-14T19-12-35-123Z",
    "data": { "theme": "dark" }
  }
]</code></pre>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
