import { createServerFn } from "@tanstack/react-start";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatInput = {
  messages: ChatMessage[];
  context: string; // resumen serializado del dashboard
};

const SYSTEM_PROMPT = `Eres "Rappi Insights", un asistente analítico experto en disponibilidad de tiendas en la plataforma Rappi.

REGLAS ESTRICTAS:
1. Responde SOLO usando los datos del contexto del dashboard que recibes. No inventes números.
2. Si la pregunta no se puede responder con esos datos, di claramente: "No tengo ese dato en el dashboard cargado".
3. Sé conciso (máximo 4-5 frases). Usa viñetas si listas varios puntos.
4. Cuando cites un número, formatéalo de forma clara (ej. 87.5%, 12,340 tiendas, 03:00 hrs).
5. Responde siempre en español.
6. Si el usuario pregunta sobre temas no relacionados (recetas, política, código, etc.), recházalo amablemente: "Solo puedo ayudarte con los datos de disponibilidad del dashboard".
7. Cuando hagas comparaciones (ej. mejor/peor día, hora pico/valle), sé específico con la fecha y el valor.

CONTEXTO DEL DASHBOARD (datos reales del CSV cargado):
`;

export const chatWithDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: ChatInput) => {
    if (!input || !Array.isArray(input.messages)) {
      throw new Error("Invalid input: messages array required");
    }
    if (typeof input.context !== "string") {
      throw new Error("Invalid input: context string required");
    }
    if (input.messages.length === 0) {
      throw new Error("Empty messages");
    }
    if (input.messages.length > 30) {
      throw new Error("Too many messages");
    }
    if (input.context.length > 30000) {
      throw new Error("Context too large");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "LOVABLE_API_KEY no está configurada en el servidor.",
      };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + data.context },
            ...data.messages,
          ],
        }),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." };
      }
      if (res.status === 402) {
        return {
          ok: false as const,
          error: "Se agotaron los créditos de IA. Añade fondos en Settings → Workspace → Usage.",
        };
      }
      if (!res.ok) {
        const txt = await res.text();
        console.error("AI gateway error:", res.status, txt);
        return { ok: false as const, error: "Error del servicio de IA. Intenta de nuevo." };
      }

      const json = await res.json();
      const content =
        json?.choices?.[0]?.message?.content ?? "No pude generar una respuesta.";
      return { ok: true as const, content: String(content) };
    } catch (e) {
      console.error("chatWithDashboard error:", e);
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Error inesperado",
      };
    }
  });
