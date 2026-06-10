import { PromptBuilder } from '../prompts/prompt-builder.js';

export function createGhostwriteManager({ executeSlashCommandsWithOptions, customApiClient }) {
  async function callGenCommand(prompt) {
    try {
      if (customApiClient?.isReady?.()) {
        console.log('[Custom API] Using diary-specific API for ghostwrite generation');
        return await customApiClient.generate(prompt);
      }

      const result = await executeSlashCommandsWithOptions(`/gen ${prompt}`, {
        handleParserErrors: true,
        handleExecutionErrors: true,
        parserFlags: {},
        abortController: null,
      });

      let generatedContent = '';

      if (result && typeof result === 'string') {
        generatedContent = result;
      } else if (result && result.pipe) {
        generatedContent = result.pipe || '';
      } else if (result) {
        generatedContent = String(result);
      }

      console.log('[AI代写] /gen返回类型:', typeof result);
      console.log('[AI代写] 提取的内容长度:', generatedContent.length);

      return generatedContent || '';
    } catch (error) {
      console.error('[AI代写] /gen命令执行失败:', error);
      throw error;
    }
  }

  async function generateGhostwrittenDiary(chatHistory, characterName) {
    try {
      console.log('[AI代写] 开始生成代写日记...');
      console.log('[AI代写] 角色名:', characterName);
      console.log('[AI代写] 聊天历史长度:', chatHistory.length);

      if (!chatHistory || chatHistory.length === 0) {
        console.warn('[AI代写] 聊天历史为空');
        return {
          success: false,
          error: '聊天历史为空，无法生成日记',
        };
      }

      const prompt = PromptBuilder.buildGhostwritePrompt(chatHistory, characterName);
      console.log('[AI代写] 提示词已构建');

      console.log('[AI代写] 调用/gen命令...');
      const responseText = await callGenCommand(prompt);

      console.log('[AI代写] AI回复长度:', responseText.length);

      if (!responseText || !responseText.trim()) {
        console.error('[AI代写] AI回复为空');
        return {
          success: false,
          error: 'AI回复为空',
        };
      }

      const cleanedContent = responseText.trim();

      console.log('[AI代写] 日记生成成功');
      return {
        success: true,
        content: cleanedContent,
      };
    } catch (error) {
      console.error('[AI代写] 生成日记失败:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  return {
    generateGhostwrittenDiary,
    callGenCommand,
  };
}
