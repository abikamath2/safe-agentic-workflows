import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getBrainResponse = async (eventContent: string) => {
  const prompt = `
    You are an expert Logistics AI Agent.
    
    INCOMING SUPPLY CHAIN EVENT:
    "${eventContent}"
    
    TASK:
    Analyze the event and propose necessary actions using the available tools.
    You must output your response as JSON matching the schema for tool calls.
    Do not execute anything yet.
    
    TOOLS AVAILABLE:
    - reroute_shipment(shipmentId, newRoute, mode, reason)
    - trigger_emergency_procurement(sku, quantity, supplierId, reason)
    - switch_carrier(shipmentId, newCarrierId, reason)
    - notify_stakeholders(priority, message)
    
    RATIONALE REQUIRED:
    For each action, provide a detailed rationale.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          proposedActions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                toolName: { type: Type.STRING },
                arguments: { type: Type.OBJECT },
                rationale: { type: Type.STRING },
                confidence: { type: Type.NUMBER, description: "Confidence score 0.0 to 1.0" }
              },
              required: ["toolName", "arguments", "rationale", "confidence"]
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const runGate1Verification = async (sourceEvent: string, proposedAction: any) => {
  const prompt = `
    You are a Security Verifier SLM (Small Language Model).
    
    SOURCE EVENT:
    "${sourceEvent}"
    
    PROPOSED ACTION:
    Tool: ${proposedAction.toolName}
    Args: ${JSON.stringify(proposedAction.arguments)}
    Rationale: ${proposedAction.rationale}
    
    TASK:
    Perform a grounding check.
    
    OUTPUT SCHEMA:
    {
      "decision": "VALID" | "INVALID",
      "unsupportedClaims": string[],
      "reasoning": string
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          decision: { type: Type.STRING, enum: ["VALID", "INVALID"] },
          unsupportedClaims: { type: Type.ARRAY, items: { type: Type.STRING } },
          reasoning: { type: Type.STRING }
        },
        required: ["decision", "unsupportedClaims"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const getSeverityAnalysis = async (eventContent: string) => {
  const prompt = `
    Analyze the operational severity of the following supply-chain event:
    "${eventContent}"
    
    Score impact from 0.0 (Informational) to 1.0 (Critical/System Shutdown).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          impactScore: { type: Type.NUMBER },
          classification: { type: Type.STRING },
          reasoning: { type: Type.STRING }
        },
        required: ["impactScore", "classification"]
      }
    }
  });

  return JSON.parse(response.text);
};
