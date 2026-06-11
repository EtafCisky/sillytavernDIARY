const DIARY_REGEX =
  /<日记>\s*标题：([^\n]+)\s*时间：([^\n]+)\s*内容：([\s\S]*?)\s*<\/日记>/;
const EXCHANGE_DIARY_REGEX =
  /<交换日记>\s*标题：([^\n]+)\s*时间：([^\n]+)\s*内容：([\s\S]*?)\s*<\/交换日记>/;

function extractDiaryFields(response, regex, missingTagError) {
  if (!response || typeof response !== 'string') {
    return {
      success: false,
      error: '消息内容为空或不是字符串',
    };
  }

  const match = response.match(regex);
  if (!match) {
    return {
      success: false,
      error: missingTagError,
    };
  }

  const title = match[1]?.trim();
  const time = match[2]?.trim();
  const content = match[3]?.trim();

  if (!title || !time || !content) {
    return {
      success: false,
      error: '日记内容不完整（标题、时间或内容为空）',
    };
  }

  return {
    success: true,
    title,
    time,
    content,
  };
}

export function parseDiaryBlock(response) {
  const result = extractDiaryFields(response, DIARY_REGEX, '未找到日记格式标签');

  if (!result.success) {
    return result;
  }

  if (result.title === '{{标题}}' || result.time === '{{时间}}' || result.content === '{{内容}}') {
    return {
      success: false,
      error: '检测到模板格式内容',
      isTemplate: true,
    };
  }

  return result;
}

export class ExchangeDiaryFormatValidator {
  static get EXCHANGE_DIARY_REGEX() {
    return EXCHANGE_DIARY_REGEX;
  }

  static validateAndExtract(response) {
    return extractDiaryFields(response, EXCHANGE_DIARY_REGEX, '未找到交换日记格式标签');
  }

  static isValidFormat(response) {
    return typeof response === 'string' && EXCHANGE_DIARY_REGEX.test(response);
  }

  static extractTitle(response) {
    const match = typeof response === 'string' ? response.match(EXCHANGE_DIARY_REGEX) : null;
    return match ? match[1].trim() : null;
  }

  static extractTime(response) {
    const match = typeof response === 'string' ? response.match(EXCHANGE_DIARY_REGEX) : null;
    return match ? match[2].trim() : null;
  }

  static extractContent(response) {
    const match = typeof response === 'string' ? response.match(EXCHANGE_DIARY_REGEX) : null;
    return match ? match[3].trim() : null;
  }
}
