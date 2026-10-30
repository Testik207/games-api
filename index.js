const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('node:path');
const fs = require('node:fs');

const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'swagger.yaml'));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/', (req, res) => res.redirect('/docs'));

  // BEGIN STEP 2
  // The course uses in-memory data. Restarting resets this array.
  const games = [
    { id: 1, name: 'The Witcher 3', price: 29.99 },
    { id: 2, name: 'Cyberpunk 2077', price: 59.99 },
    { id: 3, name: 'Minecraft', price: 19.99 }
  ];

  // The list story requires names only, without full game details.
  app.get('/games', (req, res) => res.json(games.map(game => game.name)));
  // END STEP 2

  // BEGIN STEP 3
  function parseId(req, res) {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({ error: 'id must be a positive integer.' });
      return null;
    }
    return id;
  }

  app.get('/games/:id', (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    const game = games.find(game => game.id === id);
    if (!game) return res.status(404).json({ error: `Game ${id} was not found.` });
    return res.json(game);
  });
  // END STEP 3

  // BEGIN STEP 4
  // Keep IDs unique even after deleting games.
  let nextId = Math.max(...games.map(game => game.id)) + 1;

  app.post('/games', (req, res) => {
    if (!req.is('application/json')) {
      return res.status(400).json({ error: 'Send an application/json request body.' });
    }
    const { name, price } = req.body || {};
    if (typeof name !== 'string' || !name.trim() ||
        typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        error: 'name must be a non-empty string and price must be a non-negative number.'
      });
    }
    const game = { id: nextId++, name: name.trim(), price };
    games.push(game);
    return res.status(201)
      .location(`${req.protocol}://${req.get('host')}/games/${game.id}`)
      .json(game);
  });
  // END STEP 4


  app.use((req, res) => res.status(404).json({ error: 'Endpoint was not found.' }));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body contains invalid JSON.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  });
  return app;
}

if (require.main === module) {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  const port = Number(process.env.PORT || 8080);
  createApp().listen(port, () => {
    console.log(`API: http://localhost:${port}/games`);
    console.log(`Swagger: http://localhost:${port}/docs`);
  });
}

module.exports = { createApp };
