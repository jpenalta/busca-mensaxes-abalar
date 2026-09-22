# Busca mensaxes Abalar

Extensión para **Firefox** e **Chrome** (Manifest V3) que permite buscar as mensaxes da bandexa de Abalar (edu.xunta.gal) por **nome de alumno/a**, aínda que a listaxe estea paxinada.

## Obxectivo

A listaxe de mensaxes de Abalar amosa as mensaxes paxinadas de 10 en 10, sen buscador por destinatario. Cando hai decenas de mensaxes, localizar as de un alumno/a concreto é tedioso. Esta extensión:

- **Cachea** automaticamente todas as páxinas da listaxe (coa túa sesión activa).
- Inclúe os **participantes das mensaxes de difusión** (grupos), consultando a listaxe de participantes.
- Permite **buscar por nome de alumno/a**, total ou parcialmente, sen distinguir maiúsculas nin acentos.
- Amosando, para cada mensaxe: asunto, data, emisor/a, alumno/a(s), contido e un botón **Abrir conversa**.

## Funcionamento

Inxéctase un panel flotante na páxina `ListarMensaxesBandexa.do`:

1. 🗃️ **Cachear páxinas**: descarga secuencialmente as páxinas `1..N` da listaxe (detecta o número total a partir do paginador), extrae as mensaxes de cada fila e garda os datos en `browser.storage.local` (caché persistente entre sesións). Para as mensaxes de difusión consulta ademais `/abalar/VerListaParticipantes.do` e garda os nomes dos alumnos/as do grupo.
2. 🔍 **Buscador**: filtra a caché por substring do nome de alumno/a (normalización de acentos/maiúsculas), con actualización en vivo.
3. 💬 **Abrir conversa**: replica o envío do formulario orixinal a `ListarMensaxesChat.do`, mantendo a sesión.

A extensión **non recolle nin transmite ningún dato fóra do teu navegador** (declarado como `required: ["none"]` nas permisos de recollida de datos de Firefox); toda a información queda no almacenamento local do perfil.

A **caché está illada por usuario de Abalar**: asóciase ao nome que aparece na cabeceira da aplicación (`#cabeceiraNomeUsuario`). Se dous usuarios usan o mesmo perfil do navegador, cada un ve e busca só as súas mensaxes; as cachés conviven sen mesturarse.

> ⚠️ **Ordenador compartido**: se a extensión se utiliza nun ordenador compartido por varios usuarios de Abalar, é **boa práctica limpar a caché do complemento cando se remata** (botón *Limpar* no panel). Ao estares gardada localmente no perfil do navegador, outro usuario dese mesmo perfil non a verá grazas ao illamento por usuario, pero a limpeza evita deixar datos sensibles no disco.

## Instalación

### Firefox (versión asinada por Mozilla)

Descarga o ficheiro asinado desde a [última release](https://github.com/jpenalta/busca-mensaxes-abalar/releases/latest) (`abalar-asinado-v1.0.3.xpi`) e:

1. Abre `about:addons` en Firefox.
2. ⚙ (engrenaxe) → **Instalar complemento desde arquivo…**.
3. Selecciona o `.xpi` descargado → **Engadir**.

> A versión asinada está "unlisted" (non lista en addons.mozilla.org). O ficheiro asinado tamén está dispoñible en `dist/abalar-asinado-v1.0.3.xpi` deste repo.

**Como alternativa de desenvolvemento** (sen recorrer ao asinamento de AMO):
- **Temporal**: `about:debugging` → *Cargar complemento temporal* → selecciona `manifest.json` (pérdese ao reiniciar).
- **Permanente en Firefox ESR/Developer Edition/Nightly**: en `about:config` define `xpinstall.signatures.required = false` e instala o `.xpi` desde arquivo como no apartado anterior.

### Chrome

1. Descarga `abalar-chrome-v1.0.3.zip` desde a [última release](https://github.com/jpenalta/busca-mensaxes-abalar/releases/latest) e **descomprimílo** nua carpeta.
2. Abre `chrome://extensions`.
3. Activa o **Modo de desenvolvedor** (interruptor arriba á dereita).
4. Preme **Cargar descomprimida** e selecciona a carpeta descomprimida.

Isto instálaa en modo desenvolvedor (válida para uso persoal, sen custe). Se a queres **publicar na Chrome Web Store**, o rexistro de conta de desenvolvedor ten unha taxa única de 5 USD e a extensión pasa por revisión; o `.zip` xa está listo para esa subida.

## Construción

Con `build.sh` (requisitos: `zip` ou `python3`, salvo para a validación):

| Comando | Resultado |
|---|---|
| `./build.sh` | `dist/abalar-vX.Y.Z.xpi` (Firefox) |
| `./build.sh chrome` | `dist/abalar-chrome-vX.Y.Z.zip` (Chrome) |
| `./build.sh --check [firefox\|chrome]` | Valida o manifest sen empaquetar |

O script valida o ID, `data_collection_permissions` e as versións mínimas (Desktop ≥ 140.0, Android ≥ 142.0) do manifest de Firefox, e que a versión de Chrome coincida.

## Estrutura

```
.
├── manifest.json            # Manifest de Firefox (MV3)
├── manifest-chrome.json     # Manifest de Chrome (MV3)
├── content/
│   ├── abalar.js            # Content script: panel, cache e busca
│   └── abalar.css           # Estilos do panel
├── build.sh                 # Script de construción
├── dist/                    # Artefactos (xerados/asinados)
└── README.md
```

## Licenza

Este proxecto está baixo a licenza **Creative Commons Attribution 4.0 International** (CC BY 4.0). Véxase o ficheiro [`LICENSE`](LICENSE).

## Créditos

Feito con asistencia de intelixencia artificial usando **opencode** co modelo **big-pickle**. Solución sobre as aulas de `content/abalar.js` desenvolvida e verificada para a listaxe de mensaxes de Abalar.