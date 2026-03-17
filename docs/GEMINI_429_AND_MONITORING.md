# Gemini 429 (Resource Exhausted) y cómo ver consumo

## Por qué aparece 429 aunque tengas cuota diaria alta

La cuota de **10,000,000,000** que ves para Gemini 2.5 Flash (GA) es un límite **por día** (tokens o requests). El error **429 Resource Exhausted** en Vertex AI **no suele ser** “se acabó la cuota del día”, sino:

1. **Límite por minuto (TPM/RPM)**  
   Vertex AI usa un pool compartido y limita **tokens por minuto (TPM)** y/o **requests por minuto (RPM)**. Aunque tengas 10B/día, en un minuto concreto puedes superar TPM/RPM y recibir 429.

2. **Contención temporal (Standard PayGo)**  
   En [Standard PayGo](https://cloud.google.com/vertex-ai/generative-ai/docs/dynamic-shared-quota), Google indica que un 429 **no significa que hayas agotado una cuota fija**, sino **“temporary high contention for a specific shared resource”**: en ese momento el recurso compartido está saturado.

3. **Endpoint regional**  
   Si usas solo `europe-west1`, toda la carga va a una región. El [endpoint global](https://cloud.google.com/vertex-ai/generative-ai/docs/dynamic-shared-quota) reparte la carga entre regiones y suele reducir 429.

Por tanto: el problema no es “falta de cuota diaria”, sino **ritmo por minuto** o **picos de tráfico** en un recurso compartido.

## Dónde ver consumo de Gemini (logs / métricas)

### 1. Cloud Monitoring – Metrics Explorer (consumo en tiempo real)

- **Consola:** [Metrics Explorer](https://console.cloud.google.com/monitoring/metrics-explorer)
- **Documentación:** [Monitor throughput and performance](https://cloud.google.com/vertex-ai/generative-ai/docs/dynamic-shared-quota#monitor_throughput_and_performance) (Standard PayGo).
- Ahí puedes ver consumo de tokens (y tráfico) por modelo/organización en tiempo casi real.

### 2. Vertex AI Dashboard

- **Consola:** [Vertex AI Dashboard](https://console.cloud.google.com/vertex-ai/dashboard)
- Sirve para ver **usage tier** (Tier 1/2/3) y contexto de uso de Vertex AI.

### 3. Request-response logging (opcional, para depurar llamadas)

Puedes registrar requests/responses de Gemini en **BigQuery** para analizar qué se envió y qué se consumió:

- **Doc:** [Log requests and responses](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/request-response-logging)
- Se configura por modelo (p. ej. `gemini-2.5-flash`) con `setPublisherModelConfig` (REST o Python), con `samplingRate` para no loguear el 100% y controlar coste.

No es un “log de consumo” agregado, pero en cada fila puedes ver tokens/request si el esquema lo incluye y así correlacionar con 429.

### 4. Cloud Logging (errores y llamadas al API)

- **Consola:** [Logs Explorer](https://console.cloud.google.com/logs/query)
- Filtro útil para llamadas a Vertex AI en tu proyecto:
  - `resource.type="aiplatform.googleapis.com"`  
  - o por URL: `protoPayload.resourceName=~"aiplatform"` / `httpRequest.requestUrl=~"generateContent"`
- Aquí ves fallos 429, latencias y qué endpoint/modelo se usó.

**Resumen:** para “consumo de Gemini” lo más directo es **Metrics Explorer** y **Vertex AI Dashboard**. Para analizar 429 concretos, **Cloud Logging** + opcionalmente **request-response logging** en BigQuery.

## Qué hace el código para reducir 429

- **Retry con backoff** en `ScriptGeneratorService`: si la llamada a Gemini devuelve 429 (RESOURCE_EXHAUSTED), se reintenta hasta 3 veces con espera creciente. Así se absorben picos puntuales de contención.
- **Endpoint:** por defecto se usa la región `GCP_LOCATION` (p. ej. `europe-west1`). Si quieres menos 429 y no te importa que la región no sea fija, puedes usar el endpoint global poniendo `GCP_LOCATION=global` en el entorno (ver [Genkit Vertex AI](https://genkit.dev/docs/integrations/vertex-ai/)).

## Modelo usado en el código

En este proyecto se usa **`vertexai/gemini-2.5-flash`** (Genkit resuelve el nombre al modelo GA en Vertex). La cuota de 10B que comentas aplica a ese modelo; el 429 sigue siendo por límites por minuto o contención, no por agotar ese tope diario.
