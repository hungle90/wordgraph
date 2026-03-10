#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const VOCAB_PATH = path.join(ROOT, 'data/vocab/google-10000-english.txt');
const MOCK_DEFINITIONS_PATH = path.join(ROOT, 'data/mock-definitions.json');
const OUTPUT_PATH = path.join(ROOT, 'public/graph-data.json');

function tokenizeDefinition(text) {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []);
}

async function loadVocabulary(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const list = raw.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const rank = new Map(list.map((word, idx) => [word, idx + 1]));
  return { list, rank, set: new Set(list) };
}

async function loadDefinitions(vocabList) {
  const raw = await fs.readFile(MOCK_DEFINITIONS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const definitions = parsed.definitions ?? {};

  // Ensure every vocabulary term can be rendered in UI, even if mock data is missing.
  for (const word of vocabList) {
    if (!definitions[word]) {
      definitions[word] = `${word} is connected to language and communication in common use`;
    }
  }

  return definitions;
}

async function buildGraph() {
  const vocab = await loadVocabulary(VOCAB_PATH);
  const definitions = await loadDefinitions(vocab.list);

  const outgoing = new Map();
  const incoming = new Map();
  const linkSet = new Set();

  for (const sourceWord of vocab.list) {
    const definition = definitions[sourceWord];
    const tokens = tokenizeDefinition(definition).filter((token) => vocab.set.has(token) && token !== sourceWord);

    for (const token of new Set(tokens)) {
      const edgeKey = `${sourceWord}->${token}`;
      if (linkSet.has(edgeKey)) continue;
      linkSet.add(edgeKey);

      if (!outgoing.has(sourceWord)) outgoing.set(sourceWord, new Set());
      outgoing.get(sourceWord).add(token);

      if (!incoming.has(token)) incoming.set(token, new Set());
      incoming.get(token).add(sourceWord);
    }
  }

  const nodes = vocab.list.map((word) => {
    const outgoingNeighbors = [...(outgoing.get(word) ?? new Set())].sort();
    const incomingNeighbors = [...(incoming.get(word) ?? new Set())].sort();

    return {
      id: word,
      freqRank: vocab.rank.get(word),
      inDegree: incomingNeighbors.length,
      outDegree: outgoingNeighbors.length,
      incomingNeighbors,
      outgoingNeighbors,
      definition: definitions[word],
    };
  });

  const links = [...linkSet].map((item) => {
    const [source, target] = item.split('->');
    return { source, target };
  });

  const output = {
    meta: {
      definitionSource: 'mock',
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      linkCount: links.length,
    },
    nodes,
    links,
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Generated ${OUTPUT_PATH} with ${nodes.length} nodes and ${links.length} links.`);
}

buildGraph().catch((error) => {
  console.error('Failed to build graph data:', error);
  process.exit(1);
});
