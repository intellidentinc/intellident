import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })

/**
 * Multi-turn chat with optional OpenAI function calling.
 * - tools: array of OpenAI tool objects ({ type: 'function', function: {...} })
 * - executeFunction: async (name, args) => any — called when the model requests a tool
 * Returns the final text response after all tool call rounds.
 */
export async function chatWithTools(systemPrompt, history, userMessage, tools = [], executeFunction = null) {
  const params = {
    model: 'gpt-5',
    max_completion_tokens: 2000,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role === 'USER' ? 'user' : 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ],
  }

  if (tools.length > 0) {
    params.tools = tools
  }

  const MAX_TOOL_ROUNDS = 5
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (round === MAX_TOOL_ROUNDS - 1) delete params.tools
    const response = await client.chat.completions.create(params)
    const choice = response.choices[0]
    const message = choice.message

    if (choice.finish_reason === 'tool_calls' && message.tool_calls?.length > 0 && executeFunction) {
      params.messages = [...params.messages, message]

      const toolResults = await Promise.all(
        message.tool_calls.map(async (toolCall) => {
          let result
          try {
            result = await executeFunction(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments ?? '{}'),
            )
          } catch (err) {
            result = { error: err instanceof Error ? err.message : 'Function failed' }
          }
          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          }
        }),
      )

      params.messages = [...params.messages, ...toolResults]
    } else {
      return message.content ?? ''
    }
  }
  return ''
}

export async function generateJSON(prompt, model = 'gpt-5') {
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })
  return JSON.parse(response.choices[0].message.content)
}
