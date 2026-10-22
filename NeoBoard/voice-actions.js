const ALLOWED = new Set(['text', 'line', 'arrow', 'rect', 'ellipse', 'graph']);

export function validateVoiceObjects(proposals) {
  if (!Array.isArray(proposals) || !proposals.length || proposals.length > 8) throw new Error('A voice drawing must contain between 1 and 8 objects.');
  return proposals.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !ALLOWED.has(item.type)) throw new Error('The requested board object type is not supported.');
    if (item.type === 'text') {
      if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 1000) throw new Error('Board text must contain 1–1000 characters.');
      return { type:'text', text:item.text.trim(), width:Math.max(180,Math.min(600,Number.isFinite(item.width)?item.width:360)), height:Math.max(50,Math.min(400,Number.isFinite(item.height)?item.height:Math.max(60,item.text.split('\n').length*32))) };
    }
    if (item.type === 'graph') {
      for (const key of ['a','b','c']) if (!Number.isFinite(item[key]) || Math.abs(item[key]) > 100000) throw new Error('Graph coefficients must be finite and within supported limits.');
      const title = `y = ${item.a}x² ${item.b<0?'-':'+'} ${Math.abs(item.b)}x ${item.c<0?'-':'+'} ${Math.abs(item.c)}`;
      return { type:'graph', a:item.a, b:item.b, c:item.c, title:typeof item.title==='string'?item.title.slice(0,100):title, width:420, height:260 };
    }
    return { type:item.type, width:Math.max(40,Math.min(500,Number.isFinite(item.width)?item.width:120)), height:Math.max(40,Math.min(400,Number.isFinite(item.height)?item.height:90)) };
  });
}
