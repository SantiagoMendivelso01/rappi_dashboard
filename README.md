<p align="center">
  <img src="assets/logo.png" width="180" alt="Rappi Logo"/>
</p>

<h1 align="center">Rappi Makers 2026</h1>
<h3 align="center">AI-Powered Store Availability Dashboard</h3>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react"/>
  <img src="https://img.shields.io/badge/Lovable-Deployed-FF441B?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Claude-Haiku-191919?style=for-the-badge&logo=anthropic"/>
  <img src="https://img.shields.io/badge/HuggingFace-Pipeline-FFD21E?style=for-the-badge&logo=huggingface"/>
</p>

<p align="center">
  Dashboard interactivo para visualizar y analizar la disponibilidad histórica de tiendas en la plataforma Rappi,<br/>
  con detección de anomalías operacionales, reportes en PDF y chatbot conversacional con IA.
</p>

---

## 🚀 Demo en vivo

El dashboard está desplegado públicamente en Lovable. **No requiere instalación local, no requiere ejecutar ningún notebook, no requiere configurar variables de entorno.**

🔗 **[Ver dashboard en vivo → rappiboard.lovable.app](https://rappiboard.lovable.app/)**

---

## 📂 Archivos de datos incluidos

Este repositorio incluye dos archivos para que puedas probar el dashboard de inmediato:

| Archivo | Descripción |
|---------|-------------|
| `archivo.zip` | ZIP original del desafío con los **201 archivos CSV sin procesar** (datos sucios) |
| `cleaned_data.csv` | DataFrame limpio generado por el pipeline de EDA, listo para cargar directamente |

---

## 🔀 Dos formas de cargar los datos

Una de las decisiones de diseño más importantes fue no obligar al usuario a ejecutar código. El dashboard soporta **dos modalidades de ingesta**:

```
┌─────────────────────────────────────────────────────────────┐
│                   ¿Cómo quieres cargar los datos?           │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌─────────────────┐       ┌──────────────────────┐
│  Datos limpios  │       │  Datos sin procesar  │
│                 │       │                      │
│  Sube el CSV    │       │  Sube el ZIP original│
│  cleaned_data   │       │  con los 201 archivos│
│  .csv           │       │                      │
│                 │       │  ↓                   │
│  Carga directa  │       │  Se envía a Hugging  │
│  al dashboard   │       │  Face Spaces donde   │
└────────┬────────┘       │  corre el pipeline   │
         │                │  de limpieza         │
         │                │                      │
         │                │  ↓                   │
         │                │  Devuelve el CSV     │
         │                │  limpio al dashboard │
         │                └──────────┬───────────┘
         │                           │
         └──────────────┬────────────┘
                        │
                        ▼
              Dashboard cargado ✅
```

**Modalidad 1 — CSV limpio:** sube directamente el archivo `cleaned_data.csv` incluido en este repositorio. El dashboard lo procesa en segundos.

**Modalidad 2 — ZIP sin procesar:** sube el archivo `archivo.zip` con los datos originales del desafío. El dashboard lo envía al pipeline desplegado en **Hugging Face Spaces**, que ejecuta toda la limpieza (parseo de timestamps, deduplicación, reindexado, interpolación) y devuelve el CSV limpio listo para visualizar. Esta modalidad existe para demostrar el pipeline en acción sin necesidad de abrir Google Colab.

---

## 📓 Notebook de EDA

El archivo `Rappi.ipynb` en la raíz del repositorio contiene el pipeline completo de análisis exploratorio y limpieza de datos, desarrollado en Google Colab. Puedes abrirlo directamente en Colab para ver el proceso paso a paso, reproducir el análisis, o descargar el CSV limpio generado.

[![Abrir en Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/drive/15gijiYdNqXfrqtBoZ_SnimrmxZG4bvYR?usp=sharing)

---

## 🔄 Pipeline de procesamiento

```
                    📦 ZIP — 201 archivos CSV
                            │
                ┌───────────▼───────────┐
                │      EXPLORACIÓN      │
                │  estructura · muestra │
                │  formato · tamaños    │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │        PARSEO         │
                │  limpiar timestamps   │
                │  {timestamp: valor}   │◄── deduplicación
                │  201 archivos → dict  │    automática
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │   DATAFRAME CRUDO     │
                │  dict → DataFrame     │
                │  ordenar por fecha    │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │    GAPS TEMPORALES    │
                │  diff entre puntos    │
                │  detectar huecos      │
                └───────────┬───────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │         LIMPIEZA PROFUNDA         │
          │                                   │
          │  1 ── drop_duplicates             │
          │  2 ── reindex freq="10s"  → NaN   │
          │  3 ── interpolate linear          │
          │  4 ── columnas derivadas          │
          │       hour · date · day_of_week   │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │           ANOMALÍAS               │
          │                                   │
          │  ① Ceros absolutos               │
          │     valor == 0 en cualquier hora  │
          │                                   │
          │  ② Ventana operacional 10h–21h   │
          │     caída > 12% en 1 minuto       │
          │     severity: critical / warning  │
          └─────────────────┬─────────────────┘
                            │
                ┌───────────▼───────────┐
                │     AGREGACIONES      │
                │  por hora · por día   │
                │  por día de semana    │
                │  heatmap hora × día   │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │       EXPORTAR        │
                │                       │
                │  cleaned_availability │
                │  _data.csv ← dashboard│
                └───────────────────────┘
```

---

## 🧠 Estrategia y decisiones técnicas

### El problema de los falsos positivos en anomalías

El primer intento de detección aplicó un rolling de `pct_change` sobre toda la serie sin restricciones horarias. El resultado fue una cantidad enorme de alertas que no eran incidentes reales: eran la **rampa de apertura** de tiendas en la mañana (5h–9h) y el **cierre gradual** en la noche (22h–2h). Durante esas franjas el número de tiendas sube y baja de forma drástica pero completamente esperada. Tratar esos movimientos como anomalías habría contaminado cualquier análisis operacional.

La solución fue implementar **dos estrategias de detección con propósitos distintos**:

**① Detección de ceros absolutos — toda la jornada**
Cuando la métrica llega a exactamente cero en cualquier hora, eso es operacionalmente relevante: significa que la plataforma no reportó ninguna tienda visible, lo que puede indicar un fallo de infraestructura o un evento de mantenimiento. Esta detección corre sin restricción horaria.

**② Detección operacional — solo 10h a 21h**
Dentro de la ventana operacional, donde el volumen es estable y predecible, una caída mayor al 12% en 1 minuto representa una anomalía real. Por debajo del 10% había ruido excesivo; por encima del 15% se perdían eventos relevantes. El 12% fue el umbral que mejor equilibra sensibilidad y precisión.

### Integración con Hugging Face Spaces

Para eliminar la fricción de tener que ejecutar código localmente, el pipeline de limpieza fue desplegado como un Space en Hugging Face. Cuando el usuario sube el ZIP con los datos crudos, el dashboard lo envía al Space, que ejecuta todo el procesamiento y devuelve el CSV limpio directamente. Esto hace que ambas modalidades de carga sean igual de accesibles desde el navegador.

### Por qué Lovable para el frontend

El objetivo era tener un dashboard funcional, visualmente profesional y desplegado públicamente dentro del tiempo disponible. Lovable permitió iterar sobre componentes React complejos con ciclos de feedback rápidos y generar un deploy sin configuración de infraestructura. El código es React + TypeScript estándar, completamente auditable.

### Por qué Claude Haiku para el chatbot

Se evaluaron los tres modelos de la familia Anthropic. Haiku fue la elección por eficiencia: el chatbot solo necesita responder preguntas sobre estadísticas precalculadas que se entregan en el system prompt. No requiere razonamiento complejo. Haiku cumple esa tarea con menor latencia y costo significativamente más bajo que Sonnet u Opus.

El chatbot está además **restringido por diseño** a responder únicamente preguntas sobre el dashboard. Es una decisión de seguridad deliberada para prevenir prompt injection y el uso del chatbot como vector para extraer información o generar contenido arbitrario.

---

## 📊 Funcionalidades del dashboard

### Filtros avanzados
- Período completo, esta semana, o día específico
- Franja horaria: mañana (6–11h), tarde (12–17h), noche (18–23h), o personalizada
- Día de la semana
- Rango de fechas personalizado con selector de calendario

### KPIs principales
- Promedio global de tiendas visibles
- Máximo histórico con fecha y hora exacta
- Mínimo histórico con fecha y hora exacta
- Tendencia de los últimos 7 días en porcentaje
- Conteo de anomalías operacionales detectadas

### Visualizaciones
- **Línea de tiempo** — evolución de tiendas visibles durante los 11 días con zoom interactivo
- **Promedio por hora del día** — bar chart con la franja horaria de mayor actividad destacada
- **Mapa de calor hora × día** — grid que cruza las 24 horas del día con los 11 días del dataset
- **Top 5 caídas más abruptas** — los momentos donde la métrica cayó a cero más bruscamente
- **Top 5 recuperaciones más abruptas** — los momentos de mayor subida después de una caída

### Detalle diario
Tabla con una fila por día que incluye: fecha, día de la semana, promedio de tiendas, mínimo, máximo, hora pico (mayor actividad), hora valle (menor actividad) y número de anomalías.

### Reporte PDF
Exporta un reporte del día seleccionado con KPIs del día, serie temporal, tabla de anomalías detectadas y comparativo vs promedio histórico. Generado con jsPDF + html2canvas directamente desde el navegador.

### Chatbot semántico
Asistente conversacional conectado a la API de Anthropic que puede responder preguntas (Tanto escritas como dictadas por voz) sobre cualquier dato, métrica o patrón visible en el dashboard.

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| EDA y limpieza | Python · pandas · matplotlib · seaborn |
| Pipeline en la nube | Hugging Face Spaces |
| Frontend | React · TypeScript · Vite · Recharts · TailwindCSS |
| Plataforma de desarrollo | Lovable |
| Chatbot | Anthropic API · Claude Haiku |
| Reportes PDF | jsPDF · html2canvas |
| Deploy | Lovable (Cloudflare) |



<p align="center">
  <sub>Rappi Engineering · Prueba Técnica Makers 2026 x santiago mendivelso</sub>
</p>
