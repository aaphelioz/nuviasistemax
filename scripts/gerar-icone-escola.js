/**
 * Gera o ícone pixel art do Nuvia — uma escolinha reconhecível mesmo em 16px.
 *
 * A arte é definida numa grade 16x16 (código de cor por pixel) e exportada
 * em PNG com escala inteira (nearest-neighbor), sem dependências externas.
 * Execute: node scripts/gerar-icone-escola.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- Paleta (identidade Nuvia: lilás, rosa e creme) ---------- */
const CORES = {
  O: [58, 35, 82, 255], // contorno
  R: [255, 158, 196, 255], // telhado rosa
  r: [255, 193, 221, 255], // telhado claro
  W: [255, 245, 234, 255], // parede creme
  L: [193, 169, 255, 255], // vidro lilás
  l: [143, 116, 232, 255], // moldura da janela
  D: [167, 123, 216, 255], // porta
  K: [255, 214, 161, 255], // maçaneta / bandeira
  F: [255, 214, 161, 255], // bandeira
  '.': [0, 0, 0, 0], // transparente
};

/* ---------- Grade 16x16: escola com telhado, janelas e bandeira ---------- */
const ARTE = [
  '.......OFF......',
  '.......OFF......',
  '......OrRrO.....',
  '.....ORRRRO.....',
  '....ORRRRRRO....',
  '...ORRRRRRRRO...',
  '..OOOOOOOOOOOO..',
  '..OWLLWWWWLLWO..',
  '..OWllWWWWllWO..',
  '..OWLLWWWWLLWO..',
  '..OWWWWWWWWWWO..',
  '..OWWDDDDDDWWO..',
  '..OWWDDDDKDWWO..',
  '..OWWDDDDKDWWO..',
  '..OWWDDDDDDWWO..',
  '..OOOOOOOOOOOO..',
];

/* ---------- PNG mínimo (RGBA, filtro 0) ---------- */
const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = TABELA_CRC[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const cabecalho = Buffer.alloc(4);
  cabecalho.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([cabecalho, corpo, crc]);
}

function png(escala) {
  const tamanho = ARTE.length * escala;
  const linhas = [];
  for (let y = 0; y < tamanho; y += 1) {
    const linha = Buffer.alloc(1 + tamanho * 4); // 1 byte de filtro + RGBA
    for (let x = 0; x < tamanho; x += 1) {
      const pixel = ARTE[Math.floor(y / escala)][Math.floor(x / escala)];
      const cor = CORES[pixel];
      if (!cor) throw new Error(`Cor desconhecida na arte: ${pixel}`);
      const destino = 1 + x * 4;
      linha[destino] = cor[0];
      linha[destino + 1] = cor[1];
      linha[destino + 2] = cor[2];
      linha[destino + 3] = cor[3];
    }
    linhas.push(linha);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compressão
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    ASSINATURA,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(linhas), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- Validação + saída ---------- */
if (ARTE.length !== 16 || ARTE.some((linha) => linha.length !== 16)) {
  throw new Error('A arte do ícone precisa ter exatamente 16x16 pixels.');
}

const raiz = path.join(__dirname, '..', 'frontend');
const saidas = [
  ['favicon.png', 4], // 64x64 — aba do navegador
  ['icons/icon-192.png', 12], // PWA
  ['icons/icon-512.png', 32], // PWA / splash
  ['icons/icon-escola.png', 4], // marca exibida no site
];
for (const [arquivo, escala] of saidas) {
  const destino = path.join(raiz, arquivo);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, png(escala));
  console.log(`OK ${arquivo} (${ARTE.length * escala}x${ARTE.length * escala})`);
}
