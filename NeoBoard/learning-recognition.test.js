import test from 'node:test';
import assert from 'node:assert/strict';
import {recognizeContent,parseSimpleEquation,solveSimpleEquation} from './learning-recognition.js';
const selected=text=>({objects:[{type:'text',text}],strokes:[]});
test('recognition suggests relevant types for common board selections',()=>{
  assert.equal(recognizeContent(selected('x² - 5x + 6 = 0')).subject,'mathematics');
  assert.equal(recognizeContent(selected('sin²(x) + cos²(x) = 1')).subject,'mathematics');
  assert.equal(recognizeContent(selected('H2O')).subject,'chemistry');
  assert.equal(recognizeContent(selected('Photosynthesis')).subject,'biology');
  assert.equal(recognizeContent(selected('qzxv 8471')).subject,null);
});
test('unrecognized freehand remains explicitly unrecognized',()=>{
  const result=recognizeContent({objects:[],strokes:[{id:'s'}]});
  assert.equal(result.kind,'handwriting');assert.deepEqual(result.actions,[]);
});
test('simple equation parser handles quadratic and linear examples',()=>{
  assert.deepEqual(parseSimpleEquation('x² - 5x + 6 = 0'),{a:1,b:-5,c:6,degree:2});
  assert.deepEqual(parseSimpleEquation('2x + 3 = 7'),{a:0,b:2,c:-4,degree:1});
  assert.deepEqual(parseSimpleEquation('2x² = 0'),{a:2,b:0,c:0,degree:2});
  assert.deepEqual(solveSimpleEquation('2x² = 0'),{kind:'repeated-root',solutions:[0],multiplicity:2,text:'Repeated root: x = 0 (multiplicity 2).'});
  assert.deepEqual(solveSimpleEquation('x² - 5x + 6 = 0').solutions,[3,2]);
  assert.equal(solveSimpleEquation('2x + 3 = 7').solutions[0],2);
  assert.equal(parseSimpleEquation('sin(x)'),null);
});
