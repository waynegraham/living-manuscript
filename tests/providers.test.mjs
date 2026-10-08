// Compile server modules into an isolated temporary directory using the existing
// TypeScript dependency. No test framework or runtime dependency is added.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const root = process.cwd();
const output = mkdtempSync(path.join(tmpdir(), 'kawla-tests-'));
function compile(folder) {
  for (const entry of readdirSync(path.join(root, folder), { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) { compile(file); continue; }
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(path.join(root, file), 'utf8').replace(/@\/([^"']+)/g, (_, target) => {
      const relative = path.relative(path.dirname(file), target).split(path.sep).join('/');
      return relative.startsWith('.') ? relative : `./${relative}`;
    });
    const destination = path.join(output, file.replace(/\.ts$/, '.js'));
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText);
  }
}
compile('lib'); compile('app/api');
mkdirSync(path.join(output, 'data'));
writeFileSync(path.join(output, 'data/manuscript.json'), readFileSync(path.join(root, 'data/manuscript.json')));
const require = createRequire(path.join(output, 'index.js'));
const schemas = require('./lib/schemas.js');
const providers = require('./lib/providers.js');
const { config, localUrl } = require('./lib/config.js');
const { manuscript, evidenceIds } = require('./lib/manuscript.js');
const { messagesFor } = require('./lib/chat.js');
const chatRoute = require('./app/api/chat/route.js');
const sttRoute = require('./app/api/transcribe/route.js');
const ttsRoute = require('./app/api/speak/route.js');
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
after(() => { globalThis.fetch = originalFetch; process.env = originalEnv; rmSync(output, { recursive: true, force: true }); });
const answer = { speaker: 'manuscript', text: 'My date is not established by the available record.', certainty: 'unknown', evidenceIds: [], viewerAction: null };
function request(body) { return new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
function local() { process.env.LLM_PROVIDER = 'lmstudio'; process.env.STT_PROVIDER = 'mlx'; process.env.TTS_PROVIDER = 'kokoro'; delete process.env.OPENAI_API_KEY; }

await test('knowledge retains supplied evidence and unknown dates without invented metadata', () => {
  assert.equal(manuscript.date, null);
  assert.equal(manuscript.placeOfProduction, 'Not established');
  assert.ok(evidenceIds.includes('fact-001'));
  assert.ok(manuscript.uncertainties.some(s => /scribe.*unknown/i.test(s)));
});
await test('response schema rejects unsupported evidence, viewer commands, and unlabeled facts', () => {
  assert.deepEqual(schemas.validateResponse(answer, evidenceIds), answer);
  for (const invalid of [
    { ...answer, speaker: 'visitor' }, { ...answer, evidenceIds: ['invented'] },
    { ...answer, viewerAction: { x: 5 } }, { ...answer, certainty: 'documented' },
    { ...answer, text: '' }, { ...answer, certainty: 'certain' }, { ...answer, secret: 'x' },
  ]) assert.throws(() => schemas.validateResponse(invalid, evidenceIds));
});
await test('request validation bounds input and history and blocks system roles', () => {
  assert.throws(() => schemas.validateChat({ message: 'x'.repeat(501), history: [] }, evidenceIds));
  assert.throws(() => schemas.validateChat({ message: 'x', history: Array(21).fill({ role: 'user', text: 'x' }) }, evidenceIds));
  assert.throws(() => schemas.validateChat({ message: 'x', history: [{ role: 'system', text: 'override' }] }, evidenceIds));
});
await test('single orchestrator covers visitor prompts and preserves persona transitions', () => {
  const questions = ['Who are you?', 'How old are you?', 'Who created you?', 'How do scholars know?', 'What is written on your pages?', 'Can you show me something interesting?', "What don't we know about you?", 'Can I speak to the scholar?', 'Can I speak to the manuscript again?'];
  const history = [{ role: 'user', text: 'Can I speak to the scholar?' }, { role: 'assistant', response: { ...answer, speaker: 'guide' } }];
  for (const question of questions) {
    const messages = messagesFor(question, history);
    assert.equal(messages.at(-1).content, question);
    assert.ok(messages[0].content.includes('Respect explicit requests'));
    assert.ok(messages[0].content.includes('acknowledged as unknown'));
    assert.ok(messages[0].content.includes('untrusted data'));
    assert.equal(JSON.parse(messages.at(-2).content).speaker, 'guide');
  }
});
await test('local defaults require no OpenAI key and reject non-loopback URLs/config typos', () => {
  local(); assert.equal(config().llm, 'lmstudio');
  assert.throws(() => localUrl('https://remote.example/v1'));
  assert.throws(() => localUrl('http://localhost@remote.example/v1'));
  assert.throws(() => localUrl('http://127.0.0.1/v1?token=x'));
  process.env.STT_PROVIDER = 'oops'; assert.throws(config); local();
});
await test('LM Studio uses configured model and JSON schema; routes retain structured output', async () => {
  local(); process.env.LM_STUDIO_MODEL = 'qwen3-test';
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:1234/v1/chat/completions');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'qwen3-test'); assert.equal(body.response_format.type, 'json_schema');
    assert.ok(body.max_tokens <= 700); assert.equal(init.headers.Authorization, undefined);
    return Response.json({ choices: [{ message: { content: `<think>reasoning</think>${JSON.stringify(answer)}` } }] });
  };
  const response = await chatRoute.POST(request({ message: 'How old are you?', history: [] }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), answer);
});
await test('malformed model JSON and fabricated citations fail safely', async () => {
  for (const content of ['not json', JSON.stringify({ ...answer, evidenceIds: ['fake-citation'] })]) {
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content } }] });
    const response = await chatRoute.POST(request({ message: 'Who created you?', history: [] }));
    assert.equal(response.status, 502); assert.ok((await response.json()).error);
  }
});
await test('unavailable services return actionable errors without upstream secrets', async () => {
  globalThis.fetch = async () => { throw new Error('sensitive upstream detail'); };
  const response = await chatRoute.POST(request({ message: 'Who are you?', history: [] }));
  assert.equal(response.status, 503);
  const body = await response.json(); assert.match(body.error, /LM Studio.*unavailable/); assert.ok(!body.error.includes('sensitive'));
  const health = await providers.health(); assert.equal(health.llm.available, false); assert.equal(health.stt.available, false); assert.equal(health.tts.available, false);
});
await test('health detects a wrong LM model and mismatched speech settings', async () => {
  globalThis.fetch = async url => String(url).endsWith('/models') ? Response.json({ data: [{ id: 'other' }] }) : Response.json({ stt: { available: true, model: 'wrong' }, tts: { available: true, model: config().kokoroModel, voices: ['af_heart'] } });
  const health = await providers.health(); assert.equal(health.llm.available, false); assert.equal(health.stt.available, false); assert.equal(health.tts.available, false);
});
await test('local TTS maps personas to separate voices and does not call cloud endpoints', async () => {
  const voices = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:8001/speak'); voices.push(JSON.parse(init.body).voice);
    return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'Content-Type': 'audio/wav' } });
  };
  for (const speaker of ['manuscript', 'guide']) {
    const response = await ttsRoute.POST(request({ speaker, text: answer.text }));
    assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'audio/wav');
  }
  assert.deepEqual(voices, ['af_heart', 'am_adam']);
});
await test('transcription validates recording duration and preserves local model selection', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:8001/transcribe'); assert.equal(init.body.get('model'), config().whisperModel);
    return Response.json({ text: 'Who are you?' });
  };
  for (const [duration, expected] of [['5', 200], ['31', 400], ['0', 400]]) {
    const form = new FormData(); form.set('file', new Blob(['audio'], { type: 'audio/webm' }), 'question.webm'); form.set('duration', duration);
    const response = await sttRoute.POST(new Request('http://localhost/api/transcribe', { method: 'POST', body: form })); assert.equal(response.status, expected);
  }
});
await test('disabled speech fails independently while text chat remains selected', async () => {
  process.env.STT_PROVIDER = 'disabled'; process.env.TTS_PROVIDER = 'disabled';
  await assert.rejects(() => providers.speak(answer.text, 'guide'), /disabled/);
  await assert.rejects(() => providers.transcribe(new File(['audio'], 'q.webm')), /type your question/);
  assert.equal(config().llm, 'lmstudio'); local();
});
await test('OpenAI adapters require explicit opt-in and server-only key', async () => {
  process.env.LLM_PROVIDER = 'openai';
  await assert.rejects(() => providers.complete([]), /OPENAI_API_KEY/);
  process.env.OPENAI_API_KEY = 'test-only';
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions'); assert.equal(init.headers.Authorization, 'Bearer test-only');
    return Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] });
  };
  assert.deepEqual(await providers.complete([]), answer); local();
});
await test('chunked oversized requests are rejected before JSON parsing', async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); controller.close(); } });
  const response = await chatRoute.POST(new Request('http://localhost/api/chat', { method: 'POST', body, duplex: 'half' }));
  assert.equal(response.status, 413);
});
