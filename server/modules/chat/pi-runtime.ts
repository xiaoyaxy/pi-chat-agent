import { createRequire } from 'module';
import { existsSync } from 'fs';
import { dirname, join, parse } from 'path';

import type { Agent } from '@earendil-works/pi-agent-core';
import type {
  ProviderStreams,
  createModels,
  createProvider,
} from '@earendil-works/pi-ai';

interface PiRuntime {
  Agent: typeof Agent;
  createModels: typeof createModels;
  createProvider: typeof createProvider;
  openAICompletionsApi: () => ProviderStreams;
}

interface PiAgentCoreExports {
  Agent: typeof Agent;
}

interface PiAiExports {
  createModels: typeof createModels;
  createProvider: typeof createProvider;
}

interface PiOpenAiApiExports {
  openAICompletionsApi: () => ProviderStreams;
}

const runtimeRequire = createRequire(__filename);
let cachedRuntime: PiRuntime | undefined;

function requirePackageFile<T>(packageName: string, filePath: string): T {
  let searchDirectory = __dirname;
  const rootDirectory = parse(searchDirectory).root;

  while (searchDirectory !== rootDirectory) {
    const absolutePath = join(
      searchDirectory,
      'node_modules',
      packageName,
      filePath,
    );
    if (existsSync(absolutePath)) {
      return runtimeRequire(absolutePath) as T;
    }
    searchDirectory = dirname(searchDirectory);
  }

  throw new Error(`Unable to locate Pi runtime package: ${packageName}`);
}

function loadPiRuntime(): PiRuntime {
  if (cachedRuntime) return cachedRuntime;

  const agentCore = requirePackageFile<PiAgentCoreExports>(
    '@earendil-works/pi-agent-core',
    'dist/index.js',
  );
  const piAi = requirePackageFile<PiAiExports>(
    '@earendil-works/pi-ai',
    'dist/index.js',
  );
  const openAiApi = requirePackageFile<PiOpenAiApiExports>(
    '@earendil-works/pi-ai',
    'dist/api/openai-completions.lazy.js',
  );

  cachedRuntime = {
    Agent: agentCore.Agent,
    createModels: piAi.createModels,
    createProvider: piAi.createProvider,
    openAICompletionsApi: openAiApi.openAICompletionsApi,
  };
  return cachedRuntime;
}

export { loadPiRuntime };
