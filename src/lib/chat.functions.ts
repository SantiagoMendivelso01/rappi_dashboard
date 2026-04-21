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

const ANTHROPIC_MODEL = "claude-haiku-4-5";

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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "ANTHROPIC_API_KEY no está configurada en el servidor.",
      };
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT + data.context,
          messages: data.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (res.status === 429) {
        return {
          ok: false as const,
          error: "Demasiadas solicitudes a Anthropic. Espera un momento e intenta de nuevo.",
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false as const,
          error: "La API key de Anthropic no es válida o no tiene permisos.",
        };
      }
      if (res.status === 402) {
        return {
          ok: false as const,
          error: "Se agotaron los créditos de tu cuenta Anthropic.",
        };
      }
      if (!res.ok) {
        const txt = await res.text();
        console.error("Anthropic API error:", res.status, txt);
        return {
          ok: false as const,
          error: `Error del servicio de IA (${res.status}). Intenta de nuevo.`,
        };
      }

      const json = await res.json();
      // Anthropic devuelve { content: [{ type: "text", text: "..." }, ...] }
      const content = Array.isArray(json?.content)
        ? json.content
            .filter((c: { type: string }) => c.type === "text")
            .map((c: { text: string }) => c.text)
            .join("\n")
        : "";

      return {
        ok: true as const,
        content: String(content || "No pude generar una respuesta."),
      };
    } catch (e) {
      console.error("chatWithDashboard error:", e);
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Error inesperado",
      };
    }
  });
