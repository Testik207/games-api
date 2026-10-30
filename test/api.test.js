const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../index');

let server;
let base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
});
const post = body => fetch(`${base}/games`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

test('list returns names only', async () => {
  const response = await fetch(`${base}/games`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), ['The Witcher 3', 'Cyberpunk 2077', 'Minecraft']);
});

test('existing game returns all details', async () => {
  const response = await fetch(`${base}/games/1`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: 1, name: 'The Witcher 3', price: 29.99 });
});

test('missing game returns 404', async () => {
  const response = await fetch(`${base}/games/999`);
  assert.equal(response.status, 404);
  assert.equal(typeof (await response.json()).error, 'string');
});

test('invalid IDs return 400 for GET and DELETE', async () => {
  for (const method of ['GET', 'DELETE']) {
    for (const id of ['abc', '0', '-1', '1.5', '1e2', '9007199254740992']) {
      const response = await fetch(`${base}/games/${id}`, { method });
      assert.equal(response.status, 400, `${method} ${id}`);
    }
  }
});

test('POST validates fields without rejecting a zero price', async () => {
  for (const body of [{}, { name: 'Test' }, { price: 1 }, { name: '', price: 1 },
    { name: '   ', price: 1 }, { name: 'Test', price: '1' },
    { name: 'Test', price: -1 }, { name: 5, price: 1 }, null]) {
    const response = await post(body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  const response = await post({ name: ' Free game ', price: 0 });
  assert.equal(response.status, 201);
  const game = await response.json();
  assert.equal(game.name, 'Free game');
  assert.equal(game.price, 0);
  const location = response.headers.get('location');
  assert.equal(location, `${base}/games/${game.id}`);
  const created = await fetch(location);
  assert.equal(created.status, 200);
  assert.deepEqual(await created.json(), game);
});

test('malformed JSON and missing body return JSON errors', async () => {
  for (const body of ['{oops', undefined]) {
    const response = await fetch(`${base}/games`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body
    });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
});

test('DELETE returns an empty 204 response and removed game becomes 404', async () => {
  const response = await fetch(`${base}/games/2`, { method: 'DELETE' });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal((await fetch(`${base}/games/2`)).status, 404);
  assert.equal((await fetch(`${base}/games/2`, { method: 'DELETE' })).status, 404);
});

test('creating after deletion does not reuse an existing ID', async () => {
  const response = await post({ name: 'Tetris', price: 0.99 });
  assert.equal(response.status, 201);
  const game = await response.json();
  assert.ok(game.id > 4);
  assert.deepEqual(await (await fetch(`${base}/games/${game.id}`)).json(), game);
  assert.equal((await (await fetch(`${base}/games/3`)).json()).name, 'Minecraft');
});

test('Swagger UI HTML and assets are served', async () => {
  const response = await fetch(`${base}/docs/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /swagger-ui/);
  const css = await fetch(`${base}/docs/swagger-ui.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /css/);
});

test('unknown endpoint returns JSON 404', async () => {
  const response = await fetch(`${base}/unknown`);
  assert.equal(response.status, 404);
  assert.equal(typeof (await response.json()).error, 'string');
});
