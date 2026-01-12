
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {GoogleGenAI} from '@google/genai';
import {APP_DEFINITIONS_CONFIG, getSystemPrompt} from '../constants';
import {InteractionData, CacheConfig} from '../types';

if (!process.env.API_KEY) {
  console.error(
    'API_KEY environment variable is not set. The application will not be able to connect to the Gemini API.',
  );
}

/**
 * Streams content from the Gemini API based on user interaction history.
 * Handles quota and project configuration errors specifically to guide the user.
 */
export async function* streamAppContent(
  interactionHistory: InteractionData[],
  currentMaxHistoryLength: number,
  cacheConfig: CacheConfig,
): AsyncGenerator<string, void, void> {
  const model = 'gemini-3-flash-preview'; 

  if (!process.env.API_KEY) {
    yield `<div class="p-8 text-red-900 bg-red-50 border border-red-200 rounded-3xl shadow-xl font-sans">
      <h2 class="text-2xl font-black mb-4 flex items-center gap-3 uppercase tracking-tight">
        <span class="text-3xl">⚠️</span> Kernel Key Missing
      </h2>
      <p class="mb-6 text-sm leading-relaxed text-red-800/80 font-medium">
        The <strong>API_KEY</strong> environment variable is not set. The Gemini OS kernel cannot initialize without a valid uplink.
      </p>
      <button class="llm-button bg-red-600 hover:bg-red-700 w-full font-bold py-3" data-interaction-id="change_api_key">
        Select API Key
      </button>
    </div>`;
    return;
  }

  // Always create a new instance to ensure we use the most recent key if it was just changed via the dialog
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  if (interactionHistory.length === 0) {
    yield `<div class="p-4 text-orange-700 bg-orange-50 rounded-lg">
      <p class="font-bold">No interaction context found.</p>
    </div>`;
    return;
  }

  const systemPrompt = getSystemPrompt(
    currentMaxHistoryLength,
    cacheConfig.enabled,
    cacheConfig.sizeGB
  );

  const currentInteraction = interactionHistory[0];
  const pastInteractions = interactionHistory.slice(1);

  const currentElementName =
    currentInteraction.elementText ||
    currentInteraction.id ||
    'System Init';
  
  let currentInteractionSummary = `USER ACTION: [${currentInteraction.type}] on '${currentElementName}' (ID: ${currentInteraction.id}).`;
  if (currentInteraction.value) {
    currentInteractionSummary += ` DATA: "${currentInteraction.value}"`;
  }

  const currentAppDef = APP_DEFINITIONS_CONFIG.find(
    (app) => app.id === currentInteraction.appContext,
  );
  const currentAppContext = currentInteraction.appContext
    ? `LOCATION: ${currentAppDef?.name || currentInteraction.appContext} App.`
    : 'LOCATION: OS Desktop.';

  let historyStr = '';
  if (pastInteractions.length > 0) {
    historyStr = "\n\nRECENT ACTIVITY LOG (Older to Newer):";
    [...pastInteractions].reverse().forEach((ix, i) => {
      historyStr += `\n${i+1}. [${ix.appContext || 'OS'}] ${ix.type} '${ix.elementText || ix.id}'${ix.value ? ` value: "${ix.value}"` : ''}`;
    });
  }

  const fullPrompt = `${systemPrompt}

${currentAppContext}
${currentInteractionSummary}
${historyStr}

GENERATE WINDOW HTML:`;

  try {
    const response = await ai.models.generateContentStream({
      model: model,
      contents: fullPrompt,
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    console.error('Gemini Kernel Panic:', error);
    
    // Deeper check for 429 / Quota Errors
    const errorStr = JSON.stringify(error).toLowerCase();
    const isQuotaError = 
      error.code === 429 || 
      error.status === 'RESOURCE_EXHAUSTED' || 
      errorStr.includes('429') || 
      errorStr.includes('quota') || 
      errorStr.includes('exhausted');

    const isKeyError = 
      error.message?.includes("Requested entity was not found.") || 
      errorStr.includes("not found");

    if (isQuotaError) {
      let retryDelay: string | null = null;
      try {
        // The error.message from the SDK is often a stringified JSON object
        const parsedError = JSON.parse(error.message);
        if (parsedError?.error?.details) {
            const retryInfo = parsedError.error.details.find(
                (d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
            );
            if (retryInfo?.retryDelay) {
                retryDelay = retryInfo.retryDelay.replace('s', ' seconds');
            }
        }
      } catch (e) {
          console.warn('Could not parse retryDelay from error message.');
      }

      yield `<div class="p-8 text-amber-900 bg-amber-50 border border-amber-200 rounded-3xl shadow-xl font-sans">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center text-white text-2xl animate-pulse shadow-lg">⚡</div>
          <h2 class="text-2xl font-black uppercase tracking-tight">Quota Exhausted</h2>
        </div>
        <p class="mb-6 text-sm leading-relaxed text-amber-800/80 font-medium">
          The <strong>Free Tier</strong> of the Gemini API has reached its request limit. To continue, please switch to an API key from a <strong>Paid Google Cloud Project</strong>.
          ${retryDelay ? `<br/><br/><strong class="text-amber-900">You can try again on the current key in approximately ${retryDelay}.</strong>` : ''}
        </p>
        <div class="flex flex-col gap-3">
          <button class="llm-button bg-amber-600 hover:bg-amber-700 w-full font-bold py-3 transition-all active:scale-95" data-interaction-id="change_api_key">
            Switch to Paid API Key
          </button>
          <div class="flex justify-between items-center text-[10px] text-amber-600/60 font-bold uppercase tracking-widest px-1">
             <span>Model: gemini-3-flash</span>
             <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" class="underline hover:text-amber-800">Billing Docs</a>
          </div>
        </div>
      </div>`;
    } else if (isKeyError) {
      yield `<div class="p-8 text-red-900 bg-red-50 border border-red-200 rounded-3xl shadow-xl font-sans">
        <h2 class="text-2xl font-black mb-4 flex items-center gap-3 uppercase tracking-tight text-red-600">
          <span class="text-3xl">🔑</span> Uplink Refused
        </h2>
        <p class="mb-6 text-sm leading-relaxed text-red-800/80">
          The selected project was not found or the API key is invalid for this model. Please select a valid API key from a billable Google Cloud project.
        </p>
        <button class="llm-button bg-red-600 hover:bg-red-700 w-full font-bold py-3" data-interaction-id="change_api_key">
          Re-select API Key
        </button>
      </div>`;
    } else {
      let errorMessage = error.message || 'Unknown internal kernel error.';
      yield `<div class="p-6 text-red-800 bg-red-50 border border-red-200 rounded-xl font-mono text-sm shadow-inner">
        <p class="font-bold text-lg mb-2 uppercase tracking-widest text-red-600">Kernel Panic</p>
        <div class="bg-red-100 p-4 rounded-lg border border-red-300 overflow-x-auto mb-6 text-xs leading-relaxed">
          ${errorMessage}
        </div>
        <div class="flex gap-3">
          <button class="llm-button bg-red-600 hover:bg-red-700 flex-grow font-bold" data-interaction-id="app_close_button">Restart Application</button>
          <button class="llm-button bg-slate-800 hover:bg-slate-900 font-bold" data-interaction-id="change_api_key">Switch Key</button>
        </div>
      </div>`;
    }
  }
}
