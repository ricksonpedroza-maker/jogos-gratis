import test from 'node:test'; import assert from 'node:assert/strict'; import {validateSpec} from './spec.js';
test('normaliza especificação de jogo insegura/inválida',()=>{const v=validateSpec({title:'a'.repeat(200),type:'hacked',speed:1000,player:'🚀'});assert.equal(v.type,'dodge');assert.equal(v.speed,6);assert.equal(v.title.length,35);assert.equal(v.palette.length,3);});
test('mantém configuração legítima',()=>{const v=validateSpec({title:'Teste',type:'platform',difficulty:3,palette:['#112233','#445566','#778899']});assert.equal(v.type,'platform');assert.equal(v.palette[2],'#778899');});
