import { toolDefinitions } from "./tools.js";

// A Groq usa o mesmo formato de "function calling" da OpenAI, diferente
// do formato da Anthropic (input_schema -> parameters, e cada tool
// embrulhada em { type: "function", function: {...} }).
// Reaproveitamos a mesma definição de schema — só muda a "embalagem".
export const openAiTools = toolDefinitions.map((tool) => ({
    type: "function",
    function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
    },
}));
