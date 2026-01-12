
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {GoogleGenAI} from '@google/genai';
import {APP_DEFINITIONS_CONFIG, getSystemPrompt} from './constants';
import {CacheConfig, InteractionData} from './types';

// Fixed: Initializing GoogleGenAI inside streamAppContent following the recommendation to create a new instance right before making an API call.
export async function* streamAppContent(
  interactionHistory: InteractionData[],
  currentMaxHistoryLength: number,
  cacheConfig: CacheConfig,
): AsyncGenerator<string, void, void> {
  const model = 'gemini-3-flash-preview';

  if (!process.env.API_KEY) {
    yield `<div class="p-6 text-red-700 bg-red-50 border border-red-200 rounded-xl">
      <p class="font-bold text-xl flex items-center gap-2">⚠️ Configuration Required</p>
      <p class="mt-3">The <strong>API_KEY</strong> environment variable is not set.</p>
      <p class="mt-2 text-sm text-red-600">Please provide a valid Gemini API key to initialize the OS kernel.</p>
    </div>`;
    return;
  }

  // Fixed: Create new GoogleGenAI instance directly inside the generator.
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

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
    let errorMessage = error.message || 'Unknown internal kernel error.';
    
    yield `<div class="p-6 text-red-800 bg-red-50 border border-red-200 rounded-xl font-mono text-sm">
      <p class="font-bold text-lg mb-2">OS KERNEL PANIC</p>
      <p class="mb-4">Failed to process instruction in ${model}.</p>
      <div class="bg-red-100 p-3 rounded border border-red-300 overflow-x-auto">
        ${errorMessage}
      </div>
      <button class="llm-button mt-6 bg-red-600 hover:bg-red-700" data-interaction-id="app_close_button">Restart Application</button>
    </div>`;
  }
}
