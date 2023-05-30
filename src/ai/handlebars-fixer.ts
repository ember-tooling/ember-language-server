import { logInfo } from '../utils/logger';
import fetch from 'cross-fetch';
const KEY = '{{OPEN_AI_KEY}}';

const PROMPT_PREFIX = `
Act as syntax fixer function. 
Count '$$' as cursor position and keep it in output. 
Keep original spacing and formatting (do not add newlines). 
Your response should contain valid handlebars (glimmer syntax) and html.
Omit any text in response. 
Output should contain only code.
Amount every open tag should have closing tag.
Closing tag should be placed after open tag.
Fix this html to get valid handlebars (glimmer syntax):
`;

export default class HandlebarsFixer {
  toPrompt(text: string): string {
    return PROMPT_PREFIX + '\n' + text + '\n' + '';
  }
  public async fix(text: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'text-davinci-003', //'code-cushman-001',
        prompt: this.toPrompt(text),
        max_tokens: 1024,
        n: 1,
        stop: null,
        temperature: 0.1,
      }),
    });

    logInfo('response:' + response.ok);

    const responseJson = await response.json();
    const fixedText = responseJson.choices[0].text.trim();

    logInfo('fixedText:' + fixedText);

    return fixedText;
  }
}
