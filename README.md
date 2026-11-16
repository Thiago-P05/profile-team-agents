# Full-Chatgipiti-Agents

Definiciones de agentes y perfiles de asignación de modelos para un flujo multi-agente de OpenCode llamado **FULL CHATGIPITI**.

Este repositorio es **descriptivo**: contiene los archivos de definición de agentes y los perfiles de modelos, con instrucciones para ubicarlos en el destino correcto. No es un instalador, no incluye el selector de perfiles y no modifica por sí mismo ninguna instalación de OpenCode.

## Contenido

| Ruta en el repo | Destino al activar | Tipo de archivo |
| --- | --- | --- |
| `agent/orchestrator.md` | `~/.config/opencode/agent/orchestrator.md` | Definición de agente primario |
| `agent/builder.md` | `~/.config/opencode/agent/builder.md` | Definición de subagente |
| `agent/designer.md` | `~/.config/opencode/agent/designer.md` | Definición de subagente |
| `agent/judge.md` | `~/.config/opencode/agent/judge.md` | Definición de subagente |
| `full-chatgipiti-profiles/FAST.json` | `~/.config/opencode/full-chatgipiti-profiles/FAST.json` | Perfil de asignación de modelos |
| `full-chatgipiti-profiles/Full-Codex.json` | `~/.config/opencode/full-chatgipiti-profiles/Full-Codex.json` | Perfil de asignación de modelos |
| `full-chatgipiti-profiles/Opencode-GO.json` | `~/.config/opencode/full-chatgipiti-profiles/Opencode-GO.json` | Perfil de asignación de modelos |

Los archivos `agent/*.md` se copian tal cual: su *frontmatter* declara `description`, `mode`, `model` y `permissions`. Los perfiles JSON **no** son definiciones de agente; solo asignan modelo y variante a agentes que ya existen.

## Roster

- `orchestrator`: agente primario. Conversa, divide el trabajo y delega. No edita código y no ejecuta subagentes fuera de la lista permitida.
- `builder`: subagente de implementación y verificación.
- `designer`: subagente de UI/UX (diseño, implementación y revisión visual).
- `judge`: subagente de revisión en solo lectura.

### Agentes nativos que no se incluyen

`explore` y `build` son agentes **nativos de OpenCode**: no tienen archivo en este repositorio y no deben crearse a mano. Se referencian desde los permisos del orquestador (`explore`) y desde los perfiles (`explore`, `build`); ningún archivo de este repo crea, redefine ni reemplaza agentes nativos. `plan` es además un modo nativo que el prompt del orquestador menciona como disponible para uso directo del usuario: tampoco tiene archivo acá ni asignación en ningún perfil, y este repositorio no lo configura. Si tu versión de OpenCode no expone alguno de estos agentes o modos, el perfil que lo menciona no podrá aplicarse completo.

## Perfiles de modelos

Cada perfil asigna un modelo y una variante por agente. La variante es un ajuste de esfuerzo/razonamiento del proveedor y debe existir para ese modelo.

| Perfil | orchestrator | explore | builder | judge | build | designer |
| --- | --- | --- | --- | --- | --- | --- |
| `FAST` | `opencode-go/deepseek-v4.1-flash` (high) | `opencode-go/minimax-m3.1-flash` (high) | `xai/grok-4.7` (high) | `xai/grok-4.7` (high) | `openai/gpt-6-luna` (max) | — |
| `Full-Codex` | `openai/gpt-6.1-terra` (high) | `openai/gpt-6.1-terra` (medium) | `openai/gpt-6.1-terra` (xhigh) | `openai/gpt-6.1-sol` (low) | `openai/gpt-6.1-terra` (max) | — |
| `Opencode-GO` | `openai/gpt-6.1-terra` (xhigh) | `opencode-go/deepseek-v4.1-flash` (high) | `opencode-go/glm-5.3-flash` (max) | `xai/grok-4.7` (xhigh) | `openai/gpt-6.1-terra` (max) | `opencode-go/kimi-k3.1-pro` (high) |

Notas importantes:

- **`FAST` y `Full-Codex` omiten `designer`.** No es un error de exportación: esos perfiles no reasignan al diseñador. Si `designer` está instalado, conserva el `model` declarado en su propio *frontmatter*. `Opencode-GO` sí incluye `designer`.
- Los identificadores de proveedor (`openai`, `opencode-go`, `xai`) deben existir en tu instalación y estar autenticados. Sin credenciales válidas del proveedor, el perfil falla al aplicarse o al invocar al agente.
- Los nombres de modelo y las variantes son los del momento del export. Si un proveedor retira o renombra un modelo, el perfil queda desactualizado hasta que se edite.
- **`FAST.json` de este repositorio no es el mismo archivo que el `FAST` de ejemplo de Team-Profiles.** Son orígenes distintos y pueden asignar modelos o variantes diferentes a los mismos agentes. No copies uno sobre el otro sin respaldo y una decisión explícita: sobrescribir descarta la versión previa, y cuál corresponde depende de qué instalación y qué modelos tengas disponibles.

## Dependencia del selector `/team`

El comando `/team` que aplica estos perfiles **no está incluido aquí**. Vive en un repositorio separado:

<https://github.com/Thiago-P05/Team-Profiles>

Sin ese repositorio, los archivos de este repo siguen siendo válidos como definiciones y perfiles, pero no hay selector automático: la aplicación de un perfil sería manual o mediante tu propio mecanismo. Los dos repositorios se instalan por separado y no se copian entre sí.

### Requisitos de activación con Team-Profiles

El selector no crea la configuración que necesita: la espera ya presente. Para que `/team` pueda aplicar un perfil, tu instalación debe cumplir al menos esto:

1. `~/.config/opencode/opencode.jsonc` debe existir y declarar `default_agent` como un **string** con el nombre de un agente existente.
2. Ese mismo archivo debe declarar bloques de agente para `build` y `explore`, cada uno con `model` como **string**.
3. Los archivos de agentes requeridos por el catálogo deben existir en `~/.config/opencode/agent/`. El selector aplica perfiles sobre definiciones existentes; no genera ni repara archivos de agente.
4. El catálogo de perfiles debe estar disponible en la instalación. El contrato exacto y los nombres válidos están en el repositorio del selector (`sdd.js` y su README upstream), que es la fuente de verdad.

Si falta cualquiera de estos requisitos, `/team` no puede aplicar un perfil de forma confiable. Completar esa configuración es responsabilidad de quien instala y queda fuera del alcance de este repositorio: acá solo se documenta la dependencia.

## Activación y respaldos

Antes de copiar cualquier archivo, tené en cuenta que la activación **modifica defaults y definiciones de agentes**:

1. Tu `~/.config/opencode/opencode.jsonc` puede declarar ya un `default_agent` y bloques `agent` con modelos, variantes o permisos. Copiar perfiles o cambiar de perfil puede alterar el agente por defecto y el modelo efectivo de cada agente.
2. Los archivos `~/.config/opencode/agent/*.md` pueden existir previamente, con otros `permissions` o `model`. Sobrescribirlos descarta esos valores.
3. Hacé un respaldo del directorio de configuración antes de activar (`opencode.jsonc`, `agent/`, perfiles y cualquier archivo propio) y verificá el contenido del respaldo.
4. Revisá el *frontmatter* de cada agente antes de copiarlo: los permisos de este repositorio son deliberadamente restrictivos en algunos casos (`orchestrator` no edita, `judge` es de solo lectura) y no están pensados para relajarse sin criterio.

No se incluye ningún script de activación ni de respaldo automático.

## Dependencias externas mencionadas por los prompts

Los prompts preservan sus referencias originales. Estas dependencias **no** están incluidas en el repositorio:

- **CodeGraph**: servidor de índice de código, opcional; los prompts indican usarlo solo si el proyecto está indexado y no crear índices por cuenta propia.
- **Engram**: memoria persistente, opcional. Se menciona el protocolo global de memoria; este repo no incluye su servidor, su configuración ni sus datos. No se afirma que la memoria esté disponible ni que funcione.
- **`skill-frontend-design`**: skill opcional citada por `designer`. No se incluye y el prompt aclara que no debe asumirse disponible.
- **Selector `/team`**: ver la sección anterior.

## Compatibilidad y alcance

- El contenido es **descriptivo y específico de la configuración de origen**. No se promete una instalación funcional en otros sistemas ni en Linux: las rutas, la disponibilidad de proveedores, las variantes de modelo y las capacidades de OpenCode pueden diferir.
- No se promete que `/memory` u otros comandos derivados de Engram funcionen.
- Los prompts, roles y permisos se conservan literalmente; no fueron reescritos ni ampliados para este repositorio.

## Verificación offline

Las pruebas no instalan paquetes y no requieren red:

```sh
node tests/validate.mjs
```

o, si preferís npm como atajo:

```sh
npm test
```

Validan que los JSON parsean, que el roster y la ausencia de `designer` en los perfiles esperados son coherentes, que el *frontmatter* de cada agente está completo, que los permisos críticos siguen siendo restrictivos, que no hay rastros del perfil/plugin excluido y que la documentación declara la dependencia del selector.

Además hacen un **barrido heurístico** de secretos y de datos personales sobre los archivos de texto publicados: buscan formas habituales de credenciales (tokens de GitHub, claves de API, claves privadas, credenciales embebidas), correos y rutas absolutas de usuario. Su alcance es acotado: no inspeccionan binarios, historial de git ni servicios externos, y no detectan un secreto que no coincida con esos patrones. Un resultado limpio es evidencia de que no aparecen esos formatos, no una garantía absoluta.

## Exclusions explícitas

Este repositorio **no** incluye, y no debe incorporar:

- el perfil `OH-MY-OPENCODE-SLIM` ni el plugin asociado, en ninguna forma;
- configuración global (`opencode.jsonc`), `AGENTS.md` ni archivos de instrucciones del entorno de origen;
- datos de configuración o de memoria, credenciales, `.env`, archivos de autenticación, `node_modules`;
- rutas personales, nombres propios o correos.

## Licencia y terceros

El contenido de este repositorio fue producido por el titular de la cuenta y se publica en un repositorio privado; no se concede licencia de uso, copia ni redistribución. No se incluye código de terceros ni material con licencia externa, por lo que no hay atribuciones que reproducir. Las menciones a herramientas de terceros (CodeGraph, Engram, OpenCode, proveedores de modelos) son referencias descriptivas y no implican distribución de su código.
