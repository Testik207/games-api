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
