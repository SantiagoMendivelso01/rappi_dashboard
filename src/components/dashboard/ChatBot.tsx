import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { X, Send, Loader2, Sparkles, Trash2, Mic, MicOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithDashboard } from "@/lib/chat.functions";
import type { Row } from "@/lib/csv";
import { buildDashboardContext } from "@/lib/chat-context";
import rappiChatbotIcon from "@/assets/rappi-chatbot-icon.png";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "¿Cuál fue el día con mayor disponibilidad?",
  "¿A qué hora del día hay más tiendas activas?",
  "Resume las anomalías más críticas",
  "¿Cómo va la tendencia de los últimos 7 días?",
];

type Props = {
  rows: Row[];
  fileName: string;
};

export function ChatBot({ rows, fileName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const callChat = useServerFn(chatWithDashboard);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Indica si el usuario quiere seguir dictando (para auto-reiniciar ante pausas largas)
  const wantListeningRef = useRef<boolean>(false);
  const finalTranscriptRef = useRef<string>("");
  // Timer de inactividad: si no se detecta voz en 5s, se detiene automáticamente
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SILENCE_MS = 5000;

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const armSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const rec = recognitionRef.current;
      if (!rec) return;
      wantListeningRef.current = false;
      try {
        rec.stop();
      } catch {
        // noop
      }
    }, SILENCE_MS);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  // Auto-resize del textarea según el contenido (crece suavemente)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const max = 200; // px
    const next = Math.min(ta.scrollHeight, max);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
  }, [input, open]);

  // Inicializar SpeechRecognition (Web Speech API)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }
    setVoiceSupported(true);
    const rec = new SR();
    rec.lang = "es-ES";
    // Modo continuo: tolera pausas naturales de habla sin cortarse al primer silencio.
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let interim = "";
      // Acumulamos los resultados "final" en finalTranscriptRef para que sobrevivan
      // a reinicios automáticos del reconocedor.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) {
          const prev = finalTranscriptRef.current;
          const sep = prev && !prev.endsWith(" ") ? " " : "";
          finalTranscriptRef.current = prev + sep + txt.trim();
        } else {
          interim += txt;
        }
      }
      // Hubo actividad de voz: reiniciamos el timer de silencio
      armSilenceTimer();
      const base = baseInputRef.current;
      const finals = finalTranscriptRef.current;
      const sep1 = base && finals && !base.endsWith(" ") ? " " : "";
      const sep2 = (base + sep1 + finals) && interim ? " " : "";
      setInput((base + sep1 + finals + sep2 + interim).trimStart());
    };

    // Algunos navegadores emiten onspeechstart / onsoundstart cuando detectan audio
    rec.onspeechstart = () => armSilenceTimer();
    rec.onsoundstart = () => armSilenceTimer();

    rec.onerror = (e: any) => {
      const code = e?.error || "error";
      // "no-speech" y "aborted" son frecuentes en pausas largas: ignorar y dejar
      // que onend reinicie automáticamente si el usuario sigue queriendo dictar.
      if (code === "no-speech" || code === "aborted") {
        return;
      }
      const map: Record<string, string> = {
        "not-allowed": "Permiso de micrófono denegado",
        "service-not-allowed": "Servicio de voz no permitido",
        "audio-capture": "No se encontró micrófono",
        network: "Error de red en el reconocimiento",
      };
      setVoiceError(map[code] || `Error de voz: ${code}`);
      wantListeningRef.current = false;
      setListening(false);
    };

    rec.onend = () => {
      // Si el usuario aún quiere seguir dictando (pausa larga), reiniciamos.
      if (wantListeningRef.current) {
        try {
          rec.start();
          return;
        } catch {
          // si falla, caemos a apagado
        }
      }
      setListening(false);
    };

    recognitionRef.current = rec;
    return () => {
      wantListeningRef.current = false;
      try {
        rec.abort();
      } catch {
        // noop
      }
    };
  }, []);

  const toggleListening = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      wantListeningRef.current = false;
      try {
        rec.stop();
      } catch {
        // noop
      }
      return;
    }
    setVoiceError(null);
    baseInputRef.current = input;
    finalTranscriptRef.current = "";
    wantListeningRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      // ya estaba activa
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const context = buildDashboardContext(rows, fileName);
      const res = await callChat({
        data: {
          messages: next,
          context,
        },
      });

      if (res.ok) {
        setMessages([...next, { role: "assistant", content: res.content }]);
      } else {
        setMessages([
          ...next,
          { role: "assistant", content: `⚠️ ${res.error}` },
        ]);
      }
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : "Error inesperado"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-2xl hover:scale-105 transition-transform pl-2 pr-5 py-2 font-semibold animate-float"
          style={{
            boxShadow: "0 12px 32px -8px oklch(0.65 0.22 30 / 0.45)",
          }}
        >
          <span className="w-11 h-11 rounded-full overflow-hidden inline-block shrink-0">
            <img
              src={rappiChatbotIcon}
              alt="Rappi AI"
              className="w-full h-full object-cover"
              style={{ objectPosition: "center 35%", transform: "scale(1.4)" }}
            />
          </span>
          <span className="hidden sm:inline">Pregúntale a Rappi AI</span>
          <span className="sm:hidden">Rappi AI</span>
        </button>
      )}

      {/* Panel del chat */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-40 w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-3rem))] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-pop"
          style={{ boxShadow: "0 24px 48px -12px oklch(0.2 0.02 30 / 0.35)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary to-[oklch(0.7_0.2_25)] text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                <img
                  src={rappiChatbotIcon}
                  alt="Rappi AI"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "center 35%", transform: "scale(1.4)" }}
                />
              </div>
              <div>
                <p className="font-bold leading-tight text-sm">Rappi Insights</p>
                <p className="text-[11px] opacity-80 leading-tight">
                  Pregunta sobre tu dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  aria-label="Limpiar conversación"
                  className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors"
                  title="Limpiar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar asistente"
                className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background">
            {messages.length === 0 && (
              <div className="text-center pt-4">
                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden mb-3">
                  <img
                    src={rappiChatbotIcon}
                    alt="Rappi AI"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: "center 35%", transform: "scale(1.4)" }}
                  />
                </div>
                <p className="font-semibold text-foreground">Hola 👋</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Soy tu asistente analítico. Pregúntame lo que quieras sobre los datos cargados.
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm px-3 py-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0 prose-strong:text-foreground">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analizando datos…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-3 border-t border-border bg-card flex flex-col gap-1.5"
          >
            {(voiceError || listening) && (
              <div className="flex items-center gap-2 px-1 text-[11px]">
                {listening ? (
                  <span className="flex items-center gap-1.5 text-primary font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    Escuchando… habla ahora
                  </span>
                ) : (
                  <span className="text-destructive">{voiceError}</span>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={listening ? "Escuchando…" : "Escribe o dicta tu pregunta…"}
                rows={1}
                disabled={loading}
                style={{ height: "40px", transition: "height 120ms ease-out" }}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary leading-relaxed"
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={loading}
                  aria-label={listening ? "Detener dictado" : "Dictar por voz"}
                  title={listening ? "Detener dictado" : "Dictar por voz"}
                  className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    listening
                      ? "bg-destructive text-destructive-foreground hover:opacity-90 animate-pulse"
                      : "bg-muted text-foreground hover:bg-muted/70 border border-border"
                  }`}
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Enviar"
                className="w-10 h-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
