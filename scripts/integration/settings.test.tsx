import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AiSettings from '../../components/AiSettings';
import ChartRecords from '../../components/ChartRecords';
const settings=renderToStaticMarkup(createElement(AiSettings,{onChange:()=>{throw new Error('SSR must not emit settings or call AI');}}));
assert.ok(/<details\b/.test(settings));assert.ok(!/<details[^>]*\bopen(?:=|\s|>)/.test(settings));assert.ok(settings.includes('<summary'));assert.ok(settings.includes('未配置完整'));
const records=renderToStaticMarkup(createElement(ChartRecords,{records:[],warning:'',onRestore:()=>{},onDelete:()=>{},onClear:()=>{}}));assert.ok(records.includes('命盘记录'));assert.ok(records.includes('仅此浏览器本机保存'));assert.ok(records.includes('恢复记录不会自动调用'));
console.log('Settings/history SSR passed: accessible details closed by default, unconfigured summary, no SSR config/AI callback, local-only privacy and no-auto-restore copy. Browser interaction not exercised.');
