import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTechnicalDescription = async (materialName: string, lotContext: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Contexto: Soy un instructor del SENA del área de ${lotContext}.
      Tarea: Genera una descripción técnica detallada, profesional y completa para un material de formación llamado "${materialName}". 
      Incluye especificaciones típicas (material, dimensiones, uso) si aplica. 
      La respuesta debe ser solo el texto de la descripción, sin introducciones.`,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating description:", error);
    return "";
  }
};

export const suggestUNSPSC = async (materialName: string): Promise<{code: string, name: string}> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Identify the most likely UNSPSC code (8 digits) and the standard UNSPSC Segment/Family name for: "${materialName}".
      Return ONLY a JSON object with this format: {"code": "12345678", "name": "Segment Name"}. Do not add markdown code blocks.`,
    });
    
    const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error suggesting UNSPSC:", error);
    return { code: "", name: "" };
  }
};