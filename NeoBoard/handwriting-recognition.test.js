import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHandwritingRecognition,validateHandwritingRequest,validateHandwritingResult,validateSelectionMetadata} from './handwriting-recognition.js';

function pngHeader(width=320,height=120){const b=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(b);b.write('IHDR',12,'ascii');b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);return b.toString('base64');}
const result={recognizedText:'2x² = 0',normalizedExpression:'2x^2 = 0',contentType:'mathematical_expression',subject:'mathematics',confidence:96,isAmbiguous:false,needsConfirmation:false,uncertainty:'',recognitionWarnings:[],suggestedActionIds:['math.solve','math.explain','delete-board'],classificationReason:'A handwritten polynomial equation.',explanation:'Set the equation equal to zero.',steps:[],examples:[],equivalentForms:[],graphXLabel:'x',graphYLabel:'y',graphPoints:[]};

test('handwriting request validates PNG signature, dimensions and size',()=>{
  assert.equal(validateHandwritingRequest({imageBase64:pngHeader(),mimeType:'image/png'}).width,320);
  assert.throws(()=>validateHandwritingRequest({imageBase64:'abc',mimeType:'image/png'}),{code:'INVALID_IMAGE'});
  assert.throws(()=>validateHandwritingRequest({imageBase64:pngHeader(5000,10),mimeType:'image/png'}),{code:'IMAGE_DIMENSIONS'});
  assert.throws(()=>validateHandwritingRequest({imageBase64:pngHeader(),mimeType:'image/jpeg'}),{code:'UNSUPPORTED_IMAGE'});
});

test('selection metadata accepts safe board IDs and rejects malformed bounds',()=>{
  const clean=validateSelectionMetadata({id:'selection-1',strokeIds:['a','a'],objectIds:['b'],bounds:{minX:0,minY:1,maxX:10,maxY:11},objectTypes:['text']});
  assert.deepEqual(clean.strokeIds,['a']);
  assert.throws(()=>validateSelectionMetadata({strokeIds:[],objectIds:[],bounds:{minX:4,minY:0,maxX:1,maxY:2}}),{code:'INVALID_SELECTION'});
});

test('Gemini structured response is schema-filtered and sent with server key header',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]})};};
  const recognized=await requestHandwritingRecognition({imageBase64:pngHeader(),apiKey:'server-secret',fetchImpl});
  assert.equal(recognized.normalizedExpression,'2x^2 = 0');
  assert.deepEqual(recognized.suggestedActionIds,['math.solve','math.explain']);
  assert.equal(request.options.headers['x-goog-api-key'],'server-secret');
  assert.equal(request.url.includes('server-secret'),false);
  assert.equal(request.body.contents[0].parts[1].inline_data.mime_type,'image/png');
  assert.equal(request.body.generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');
  assert.equal(request.body.generationConfig.responseFormat.text.schema.type,'object');
});

test('selected typed text uses the same safe learning response pipeline',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request=JSON.parse(options.body);return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({...result,recognizedText:'Photosynthesis',normalizedExpression:'',contentType:'handwritten_text',subject:'biology',suggestedActionIds:['bio.explain'],explanation:'Plants use light energy to make sugars.',steps:['Light is absorbed by chlorophyll.'],examples:['Leaves make glucose.']})}]}}]})};};
  const output=await requestHandwritingRecognition({selectedText:'Photosynthesis',subject:'biology',requestedFormat:'examples',apiKey:'server-secret',fetchImpl});
  assert.match(request.contents[0].parts[0].text,/Photosynthesis/);
  assert.match(request.contents[0].parts[0].text,/Requested output format: examples/);
  assert.equal(request.contents[0].parts.length,1);
  assert.equal(output.explanation,'Plants use light energy to make sugars.');
  assert.deepEqual(output.steps,['Light is absorbed by chlorophyll.']);
  assert.deepEqual(output.suggestedActionIds,['bio.explain']);
});

test('transient Gemini service failures retry and use the configured stable vision model',async()=>{
  let calls=0,requestedUrl='';
  const fetchImpl=async(url)=>{calls++;requestedUrl=url;if(calls===1)return{ok:false,status:503,json:async()=>({error:{message:'temporarily overloaded'}})};return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]})};};
  const output=await requestHandwritingRecognition({imageBase64:pngHeader(),apiKey:'server-secret',fetchImpl});
  assert.equal(output.normalizedExpression,'2x^2 = 0');
  assert.equal(calls,2);
  assert.match(requestedUrl,/models\/gemini-3\.8-flash:generateContent$/);
});

test('Gemini overload falls back to the compatible documented Flash model',async()=>{
  const urls=[];
  const fetchImpl=async(url)=>{urls.push(url);if(url.includes('gemini-3.8-flash'))return{ok:false,status:503,json:async()=>({error:{message:'high demand'}})};return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]})};};
  const output=await requestHandwritingRecognition({imageBase64:pngHeader(),apiKey:'server-secret',fetchImpl});
  assert.equal(output.normalizedExpression,'2x^2 = 0');
  assert.equal(urls.length,4);
  assert.ok(urls.slice(0,3).every(url=>url.includes('gemini-3.8-flash')));
  assert.ok(urls[3].includes('gemini-3.6-flash'));
});

test('missing provider key, malformed response and provider quota fail clearly',async()=>{
  await assert.rejects(requestHandwritingRecognition({imageBase64:pngHeader()}),{code:'GEMINI_NOT_CONFIGURED'});
  const badJson=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'not json'}]}}]})});
  await assert.rejects(requestHandwritingRecognition({imageBase64:pngHeader(),apiKey:'x',fetchImpl:badJson}),{code:'INVALID_PROVIDER_RESPONSE'});
  const limited=async()=>({ok:false,status:429});
  await assert.rejects(requestHandwritingRecognition({imageBase64:pngHeader(),apiKey:'x',fetchImpl:limited}),{code:'PROVIDER_QUOTA',status:429});
});

test('response sanitizer clamps confidence and accepts only registered action IDs',()=>{
  const clean=validateHandwritingResult({...result,confidence:240,suggestedActionIds:['math.solve','eval','math.solve']});
  assert.equal(clean.confidence,100);assert.deepEqual(clean.suggestedActionIds,['math.solve']);
});
