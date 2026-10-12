import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(new URL('../package.json', import.meta.url));
const source = readFileSync(new URL('../components/SuggestedQuestions.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
} }).outputText;
const componentModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, componentModule, componentModule.exports);
const SuggestedQuestions = componentModule.exports.default;
const manuscript = JSON.parse(readFileSync(new URL('../data/manuscript.json', import.meta.url), 'utf8'));
const questions = manuscript.suggestedQuestions;
const arabicQuestions = manuscript.suggestedQuestionsArabic;

// Exercise the actual rendered button content and selection handlers, without
// adding a browser/test framework for this small stateless component.
test('Arabic selection displays translated prompts right-to-left and inserts Arabic text', () => {
  let selected;
  const tree = SuggestedQuestions({ questions, arabicQuestions, language: 'ar', onSelect: question => { selected = question; } });
  assert.equal(tree.props.dir, 'rtl');
  assert.equal(tree.props.lang, 'ar');
  const buttons = tree.props.children[1].props.children;
  assert.deepEqual(buttons.map(button => button.props.children[0]), [
    'كلمني عن نفسك.', 'مين اللي صنعك؟', 'وش نقدر نتعلم من صفحاتك؟', 'وش الأشياء اللي ما نعرفها عنك؟',
  ]);
  buttons[1].props.onClick();
  assert.equal(selected, 'مين اللي صنعك؟');
});
test('switching back to English restores English prompt selection', () => {
  let selected;
  const props = { questions, arabicQuestions, onSelect: question => { selected = question; } };
  SuggestedQuestions({ ...props, language: 'ar' });
  const tree = SuggestedQuestions({ ...props, language: 'en' });
  assert.equal(tree.props.dir, 'ltr');
  const first = tree.props.children[1].props.children[0];
  assert.equal(first.props.children[0], 'Tell me about yourself.');
  first.props.onClick();
  assert.equal(selected, 'Tell me about yourself.');
});
