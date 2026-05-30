import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

/**
 * Multi-turn chat with optional Gemini function calling.
 * - tools: array of FunctionDeclaration objects (pass [] for plain chat)
 * - executeFunction: async (name, args) => any  — called when Gemini requests a tool
 * Returns the final text response after all function call rounds.
 */
export async function chatWithTools(systemPrompt, history, userMessage, tools = [], executeFunction = null) {
  const modelConfig = {
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: 500 },
  }
  if (tools.length > 0) {
    modelConfig.tools = [{ functionDeclarations: tools }]
  }

  const model = genAI.getGenerativeModel(modelConfig)

  const chat = model.startChat({
    history: history.map((msg) => ({
      role: msg.role === 'USER' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
  })

  let response = await chat.sendMessage(userMessage)

  // Function calling loop — Gemini may call tools multiple times
  while (executeFunction && tools.length > 0) {
    const fnCalls = response.response.functionCalls() ?? []
    if (fnCalls.length === 0) break

    const fnResponses = await Promise.all(
      fnCalls.map(async (fnCall) => {
        let result
        try {
          result = await executeFunction(fnCall.name, fnCall.args ?? {})
        } catch (err) {
          result = { error: err instanceof Error ? err.message : 'Function failed' }
        }
        return {
          functionResponse: {
            name: fnCall.name,
            response: { result },
          },
        }
      })
    )

    response = await chat.sendMessage(fnResponses)
  }

  return response.response.text()
}

export async function generateJSON(prompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  return JSON.parse(result.response.text())
}
