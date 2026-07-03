// @ts-ignore – openai-oauth-provider is ESM-only; tsx resolves it correctly at runtime
import { createOpenAIOAuth } from 'openai-oauth-provider';
// @ts-ignore – ai v6 uses ESM exports map; tsx resolves correctly at runtime
import { generateText, streamText } from 'ai';
import type { ModelMessage } from 'ai';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { CHATGPT_REFRESH_TOKEN } from '../../env';

export const DEFAULT_OPENAI_OAUTH_MODEL = 'gpt-5.4';

const AUTH_FILE_PATH = process.env.OPENAI_OAUTH_AUTH_FILE ?? path.join(os.tmpdir(), 'chatgpt-auth.json');

type AuthTokens = {
  refresh_token?: string;
  access_token?: string;
  account_id?: string;
  id_token?: string;
};

function shouldPersistOptionalBootstrapTokens(): boolean {
  return process.env.CHATGPT_BOOTSTRAP_FULL_TOKENS === 'true';
}

function buildBootstrapTokens(): AuthTokens {
  if (!CHATGPT_REFRESH_TOKEN) {
    throw new Error('[openai-oauth] CHATGPT_REFRESH_TOKEN env var is required but not set.');
  }

  const tokens: AuthTokens = {
    refresh_token: CHATGPT_REFRESH_TOKEN
  };

  // Refresh-token bootstrap is the safest remote default. Persisting short-lived
  // account-bound tokens can leave the provider pinned to an invalid workspace.
  if (!shouldPersistOptionalBootstrapTokens()) {
    return tokens;
  }

  return tokens;
}

async function writeAuthFile(tokens: AuthTokens): Promise<void> {
  const authJson = { tokens };
  await fs.mkdir(path.dirname(AUTH_FILE_PATH), { recursive: true });
  await fs.writeFile(AUTH_FILE_PATH, JSON.stringify(authJson, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export async function bootstrapRemoteAuth(): Promise<void> {
  await writeAuthFile(buildBootstrapTokens());
  console.log(`[openai-oauth] Auth bootstrapped → ${AUTH_FILE_PATH}`);
}

export async function readLocalAuthToken(): Promise<AuthTokens> {
  const filePath = [
    process.env.CHATGPT_LOCAL_HOME && path.join(process.env.CHATGPT_LOCAL_HOME, 'auth.json'),
    process.env.CODEX_HOME && path.join(process.env.CODEX_HOME, 'auth.json'),
    path.join(os.homedir(), '.chatgpt-local', 'auth.json'),
    path.join(os.homedir(), '.codex', 'auth.json')
  ].filter(Boolean) as string[];
  for (const candidate of filePath) {
    try {
      const raw = await fs.readFile(candidate, 'utf-8');
      const parsed = JSON.parse(raw);
      const tokens = parsed?.tokens ?? {};
      return {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        account_id: tokens.account_id,
        id_token: tokens.id_token
      };
    } catch {}
  }
  return {};
}

let _provider: ReturnType<typeof createOpenAIOAuth> | null = null;

function getProvider() {
  if (!_provider) {_provider = createOpenAIOAuth({ authFilePath: AUTH_FILE_PATH, ensureFresh: true });}
  return _provider;
}

function resetProvider() {
  _provider = null;
}

function isInvalidWorkspaceSelectedError(error: unknown): boolean {
  const serialized =
    error instanceof Error
      ? `${error.message} ${error.stack ?? ''}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  return serialized.toLowerCase().includes('invalidworkspaceselected');
}

async function recoverFromInvalidWorkspaceSelected(): Promise<void> {
  await writeAuthFile(buildBootstrapTokens());
  resetProvider();
  console.warn('[openai-oauth] Rebuilt auth state from refresh token after invalid workspace selection.');
}

export interface OpenAIOAuthOptions {model?: string; system?: string; temperature?: number; maxTokens?: number;}

function buildMessages(input: string | ModelMessage[]): ModelMessage[] {
  if (typeof input === 'string') {return [{ role: 'user', content: input }];}
  return input;
}

export const queryOpenAIOAuth = async (messages: string | ModelMessage[], options: OpenAIOAuthOptions = {}): Promise<string> => {
  const { model = DEFAULT_OPENAI_OAUTH_MODEL, system, temperature = 0.7, maxTokens } = options;
  try {
    const provider = getProvider();
    const result = await generateText({
      model: provider(model),
      messages: buildMessages(messages),
      ...(system ? { system } : {}),
      temperature,
      ...(maxTokens ? { maxTokens } : {})
    });
    return result.text;
  } catch (error) {
    if (isInvalidWorkspaceSelectedError(error)) {
      try {
        await recoverFromInvalidWorkspaceSelected();
        const provider = getProvider();
        const result = await generateText({
          model: provider(model),
          messages: buildMessages(messages),
          ...(system ? { system } : {}),
          temperature,
          ...(maxTokens ? { maxTokens } : {})
        });
        return result.text;
      } catch (retryError) {
        console.error('[openai-oauth] Retry after invalid workspace selection failed:', retryError);
        throw retryError;
      }
    }
    console.error('[openai-oauth] Error calling provider:', error);
    throw error;
  }
};

export const streamOpenAIOAuth = async (messages: string | ModelMessage[], options: OpenAIOAuthOptions = {}) => {
  const { model = DEFAULT_OPENAI_OAUTH_MODEL, system, temperature = 0.7, maxTokens } = options;
  try {
    const provider = getProvider();
    return await streamText({
      model: provider(model),
      messages: buildMessages(messages),
      ...(system ? { system } : {}),
      temperature,
      ...(maxTokens ? { maxTokens } : {})
    });
  } catch (error) {
    if (isInvalidWorkspaceSelectedError(error)) {
      await recoverFromInvalidWorkspaceSelected();
      const provider = getProvider();
      return await streamText({
        model: provider(model),
        messages: buildMessages(messages),
        ...(system ? { system } : {}),
        temperature,
        ...(maxTokens ? { maxTokens } : {})
      });
    }
    console.error('[openai-oauth] Error streaming from provider:', error);
    throw error;
  }
};

export { createOpenAIOAuth };
