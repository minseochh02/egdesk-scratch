import { ipcMain } from 'electron';
import { ollamaManager } from './installer';

export function registerOllamaHandlers(): void {
  // Check if Ollama is installed and running
  ipcMain.handle('ollama:check-installed', async () => {
    try {
      const isInstalled = await ollamaManager.checkInstalled();
      return { success: true, isInstalled };
    } catch (error) {
      console.error('Failed to check Ollama installation:', error);
      return { success: false, isInstalled: false, error: String(error) };
    }
  });

  // Ensure Ollama is installed (with user prompt if needed)
  ipcMain.handle('ollama:ensure-installed', async () => {
    try {
      const ready = await ollamaManager.ensureOllama();
      return { success: true, ready };
    } catch (error) {
      console.error('Failed to ensure Ollama installation:', error);
      return { success: false, ready: false, error: String(error) };
    }
  });

  // Start Ollama server
  ipcMain.handle('ollama:start', async () => {
    try {
      const started = await ollamaManager.startOllama();
      return { success: true, started };
    } catch (error) {
      console.error('Failed to start Ollama:', error);
      return { success: false, started: false, error: String(error) };
    }
  });

  // List installed models
  ipcMain.handle('ollama:list-models', async () => {
    try {
      const models = await ollamaManager.listModels();
      return { success: true, models };
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return { success: false, models: [], error: String(error) };
    }
  });

  // Check if a specific model exists
  ipcMain.handle('ollama:has-model', async (_event, model: string) => {
    try {
      const exists = await ollamaManager.hasModel(model);
      return { success: true, exists };
    } catch (error) {
      console.error(`Failed to check if model "${model}" exists:`, error);
      return { success: false, exists: false, error: String(error) };
    }
  });

  // Pull a model
  ipcMain.handle('ollama:pull-model', async (_event, model: string) => {
    try {
      const pulled = await ollamaManager.pullModel(model);
      return { success: true, pulled };
    } catch (error) {
      console.error(`Failed to pull model "${model}":`, error);
      return { success: false, pulled: false, error: String(error) };
    }
  });

  // Chat completion (streaming)
  ipcMain.handle('ollama:chat', async (_event, { model, messages, stream = true, websiteContext, systemPrompt }) => {
    try {
      let enrichedMessages = messages ?? [];
      
      // Build system message combining system prompt and website context
      const systemParts: string[] = [];
      if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
        systemParts.push(systemPrompt.trim());
      }
      if (websiteContext && typeof websiteContext === 'string' && websiteContext.trim().length > 0) {
        systemParts.push(`\n\nWebsite content to analyze:\n${websiteContext.trim()}`);
      }
      
      if (systemParts.length > 0) {
        enrichedMessages = [
          {
            role: 'system',
            content: systemParts.join(''),
          },
          ...enrichedMessages,
        ];
      }

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: enrichedMessages,
          stream,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      if (stream) {
        // For streaming, we'll return chunks as they come
        // The renderer will need to handle this differently
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const chunks: string[] = [];

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            chunks.push(chunk);
          }
        }

        return { success: true, chunks };
      } else {
        const data = await response.json();
        return { success: true, data };
      }
    } catch (error) {
      console.error('Ollama chat failed:', error);
      return { success: false, error: String(error) };
    }
  });

  console.log('✅ Ollama IPC handlers registered');
}

