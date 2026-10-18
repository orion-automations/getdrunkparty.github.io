# Get Drunk Party Web

Aplicación de fiesta mobile-first, creada con HTML, CSS y JavaScript nativo. Incluye cinco mazos, dado digital 3D con modo físico opcional, participantes, editor, manuales, respaldos JSON y PWA con caché offline. No usa cuenta, backend, CDN ni fuentes remotas.

## Ejecutar en PC

Requiere Node.js 18 o superior. En la carpeta del proyecto:

```powershell
npm run serve
```

Abre `http://localhost:8080`. También puedes usar Live Server de VS Code, pero para probar la PWA usa un origen HTTPS o `localhost`. No abras `index.html` con `file://`.

## Abrir en Android por Wi-Fi durante desarrollo

1. Conecta el PC y el teléfono a la misma red Wi-Fi.
2. Ejecuta `npm run serve` en el PC. El servidor escucha en `0.0.0.0:8080`.
3. Consulta la IPv4 privada del PC con `ipconfig` (adaptador Wi-Fi), por ejemplo `192.168.1.25`.
4. En Chrome Android abre `http://192.168.1.25:8080`.
5. Si no conecta, permite Node.js o el puerto 8080 en el firewall para redes privadas.

El acceso por HTTP a una IP local sirve para desarrollo en la red, pero no permite instalar una PWA con service worker en Chrome como lo hace HTTPS. Para instalarla de forma realista, publica los archivos estáticos en un hosting con HTTPS (por ejemplo GitHub Pages, Cloudflare Pages o Netlify). No se necesita un backend. Abre el enlace HTTPS en Android, carga la aplicación una vez y usa el menú de Chrome → **Instalar aplicación** o **Añadir a pantalla de inicio**.

## Comprobar uso offline

Con la URL HTTPS abierta y conectada, espera a que el service worker termine de instalarse (en la aplicación aparece el estado local en Ajustes). Cierra Chrome o la PWA, activa modo avión y vuelve a abrirla desde su icono. Prueba una partida, participantes y el editor. La primera visita debe completarse con internet para almacenar el shell. Una versión publicada actualiza la caché de archivos; los datos personales están en otra clave de almacenamiento y no se borran al actualizar.

## Usar el juego

1. Abre **Participantes**, agrega los nombres y ajusta el orden; el primer nombre activo tiene el primer turno.
2. En **Partida**, el modo predeterminado es **Dado digital**. Pulsa **LANZAR DADO**; la cara queda elegida antes de girar y la animación termina con esa misma categoría. Las probabilidades son 35 % VERDAD, 35 % DESAFÍO, 15 % MINIJUEGO y 15 % BLOQUEADA.
3. Al terminar la tirada, se iluminan los reversos de los tres mazos principales y solo queda habilitado el que corresponde al resultado. Pulsa ese mazo para revelar la carta. BLOQUEADA no roba carta ni genera acción y permite finalizar el turno.
4. En VERDAD o DESAFÍO, si la regla de la carta requiere una carta auxiliar, puedes elegir un PREMIO o CASTIGO durante el turno. Solo se permite una selección auxiliar en esos turnos normales.
5. En un MINIJUEGO, selecciona los participantes si la carta requiere una pareja. El grupo registra manualmente quién ganó, perdió o quedó neutral. La aplicación nunca decide el resultado. Solo las consecuencias configuradas en el manual generan selecciones; cada una se identifica con su destinatario y debe completarse antes de finalizar.
6. Marca el resultado de VERDAD o DESAFÍO con los botones disponibles y pulsa **Finalizar turno**. En un minijuego sin consecuencias configuradas, registra el resultado del grupo y finaliza sin premios ni castigos.
7. El menú permite cambiar a **Dado físico**. En ese modo eliges manualmente VERDAD, DESAFÍO, MINIJUEGO o BLOQUEADA; no se genera una tirada aleatoria digital. La opción persiste en este navegador.
8. El botón `?` abre el manual cuando la carta tiene uno. Cerrar el manual mantiene el turno y las cartas en pantalla.

## Editar, añadir y administrar cartas

En **Cartas** puedes buscar por texto o ID y filtrar por categoría. Para añadir una carta:

1. Abre **Cartas** y pulsa **＋ Nueva carta**.
2. Escribe un ID único con letras, números, guion o guion bajo (por ejemplo `DESAFIO_mimo_de_robot`).
3. Selecciona categoría, título, descripción e intensidad de 0 a 5.
4. Configura asignación y cantidad. Las parejas voluntarias se acuerdan entre jugadores; no se asignan al azar.
5. Opcionalmente asigna manual e icono local. Para penalizar con shots, activa **Tiene penalización en shots** e indica la cantidad; la vista previa muestra el singular o plural.
6. Revisa la vista previa y pulsa **Guardar carta**.

Para editar una existente, busca o filtra la carta y pulsa **Editar**. Cambia los campos y guarda; el ID permanece estable. **Duplicar** crea otra carta con un ID nuevo. **Desactivar** la conserva en el catálogo pero la excluye de los sorteos. **Eliminar** solicita confirmación y la quita del catálogo. Exporta el catálogo antes de hacer cambios grandes; la importación valida el JSON y rechaza IDs repetidos.

También puedes añadir cartas en lote desde JSON: crea un archivo con `{ "version": 1, "cards": [...] }`, agrega solo las cartas nuevas dentro de `cards`, usa IDs nuevos y pulsa **Importar cartas JSON**. Si partes de una exportación completa, conserva en el archivo que vas a importar solo las cartas nuevas, pues la importación añade y rechaza IDs que ya existen; no actualiza ni elimina cartas. Edita o elimina una existente desde el editor de **Cartas**.

Las categorías y colores están en `js/config.js`. Las seis caras, su peso y orientación están en `js/dice.js`: ajusta los valores `weight` y conserva una suma total de 100 para cambiar la distribución. El cubo, sus tamaños, iluminación y transición de 2.5 segundos se configuran en `css/dice.css`; las caras visibles están en `index.html`. Las 310 cartas suministradas con el proyecto están individualizadas en `data/pdf-catalog.js`; `data/initial-cards.js` carga únicamente ese catálogo. Los manuales completos de los 50 minijuegos están en el mismo archivo y se cargan desde `data/initial-manuals.js`. Las instalaciones existentes eliminan una sola vez las 50 cartas iniciales reemplazadas, cargan las 310 nuevas y mantienen sus demás datos.

## Manuales, bebidas e iconos

En **Manuales**, usa **＋ Nuevo manual** para crear reglas o **Editar manual** para cambiar un manual existente. El formulario solicita título, resumen, instrucciones y, opcionalmente, un objeto JSON `details` con `objective`, `participants`, `materials`, `preparation`, `victoryCondition`, `tiebreaker`, `duration`, `resultToRecord` y `consequenceRules`. Estos campos aparecen en la ayuda de la carta cuando se rellenan. Semana inglesa queda marcada como pendiente hasta que el grupo configure sus reglas. Los IDs de manual se generan al crearlos; luego selecciónalo en el editor de cartas. El catálogo editable de bebidas y alternativas está en **Ajustes**. La penalización configurada en una carta se muestra como cantidad de Shots.

`consequenceRules` es una lista opcional para minijuegos. Cada regla usa `when` (`WIN`, `LOSS` o `ANY`), `category` (`PREMIO` o `CASTIGO`), `recipients` (`WINNERS`, `LOSERS`, `PARTICIPANTS` o `GROUP`) y exactamente uno de `cardsPerRecipient` o `totalCards`. Ejemplo: `[{"when":"LOSS","category":"CASTIGO","recipients":"LOSERS","cardsPerRecipient":1},{"when":"WIN","category":"PREMIO","recipients":"WINNERS","cardsPerRecipient":1}]`. `totalCards` crea esa cantidad fija de selecciones y permite asignar cada una a un destinatario elegible. No se añade ninguna regla por defecto; una lista vacía permite registrar el resultado y finalizar sin consecuencias.

El catálogo inicial incorpora los minijuegos del documento Cartas Get Drunk Party.pdf con sus instrucciones completas. Si alguna regla requiere definir resultados o consecuencias, edita el manual correspondiente en **Manuales**; las reglas no se deducen automáticamente del texto.

El editor admite un glifo o emoji local para icono (no HTML, SVG arbitrario ni URLs remotas). Para añadir iconos vectoriales locales revisa `assets/icons/icon.svg`; no son necesarios para jugar.

Las cartas pueden incluir opcionalmente `effects`. Es un objeto de datos; por ejemplo `{"onCompleted":[{"type":"DRAW_AUXILIARY","category":"PREMIO"},{"type":"GRANT_REWARD","key":"protection","label":"Protección futura"}]}` permite acceder a un mazo auxiliar tras confirmar el resultado y guardar una ventaja con nombre para usar manualmente. `onNotCompleted` puede declarar de la misma forma una acción auxiliar de castigo. Estos efectos no se derivan del texto de la carta.

El importador acepta una lista JSON o un objeto `{ "version": 1, "cards": [...] }`; valida IDs únicos, categorías y campos obligatorios antes de incorporar el lote. Un ID que ya existe cancela la importación completa con un mensaje. Las cartas recibidas conservan sus propiedades opcionales como `effects` y los campos extra del manual. El ciclo y el orden de barajado se guardan por categoría en el estado local para evitar repetir una carta antes de agotar el mazo, incluso tras recargar.

Ejemplos mínimos válidos por tipo (son solo plantillas documentales, no se cargan al catálogo):

```json
[
  {"id":"V_ejemplo","categoryId":"VERDAD","title":"Título","description":"Descripción","icon":{"type":"glyph","value":"✦"},"spiceLevel":0,"target":{"mode":"CURRENT_PLAYER","count":1},"penalty":{"enabled":false,"units":0},"manualId":null,"enabled":true},
  {"id":"D_ejemplo","categoryId":"DESAFIO","title":"Título","description":"Descripción","icon":{"type":"glyph","value":"✦"},"spiceLevel":0,"target":{"mode":"CURRENT_PLAYER","count":1},"penalty":{"enabled":false,"units":0},"manualId":null,"enabled":true},
  {"id":"M_ejemplo","categoryId":"MINIJUEGO","title":"Título","description":"Descripción","icon":{"type":"glyph","value":"✦"},"spiceLevel":0,"target":{"mode":"ALL_PLAYERS","count":0},"penalty":{"enabled":false,"units":0},"manualId":"MANUAL_MIMICA","enabled":true},
  {"id":"P_ejemplo","categoryId":"PREMIO","title":"Título","description":"Descripción","icon":{"type":"glyph","value":"✦"},"spiceLevel":0,"target":{"mode":"CURRENT_PLAYER","count":1},"penalty":{"enabled":false,"units":0},"manualId":null,"enabled":true},
  {"id":"C_ejemplo","categoryId":"CASTIGO","title":"Título","description":"Descripción","icon":{"type":"glyph","value":"✦"},"spiceLevel":0,"target":{"mode":"CURRENT_PLAYER","count":1},"penalty":{"enabled":false,"units":0},"manualId":null,"enabled":true}
]
```

Ejemplo de carta:

```js
{
  id: 'VERDAD_anecdota_favorita', categoryId: 'VERDAD',
  title: 'Anécdota favorita', description: 'Comparte un recuerdo que te haga reír.',
  icon: { type: 'glyph', value: '✦' }, spiceLevel: 1,
  target: { mode: 'CURRENT_PLAYER', count: 1, position: null },
  penalty: { enabled: true, units: 1 }, // 1 Shot
  manualId: null, enabled: true,
  effects: { onCompleted: [{ type: 'DRAW_AUXILIARY', category: 'PREMIO' }] }
}
```

Para preparar archivos con una carta de cada categoría, usa el mismo formato y cambia el `id`, `categoryId`, `title`, `description` y `target` de cada objeto. Los cinco valores válidos para `categoryId` son `VERDAD`, `DESAFIO`, `MINIJUEGO`, `PREMIO` y `CASTIGO`. En una carta de `MINIJUEGO`, `manualId` debe apuntar a un ID existente; el manual puede agregar los campos opcionales descritos abajo.

Ejemplo de manual: `{ id: 'MANUAL_MIMICA', title: 'Mímica', summary: 'Adivina con gestos', instructions: ['Una persona representa una palabra'], notes: '', pending: false }`.

Ejemplo de participante: `{ id: 'player_abc123', name: 'Ana', active: true, preferences: {} }`.

## Respaldos y almacenamiento

En **Ajustes y respaldo**, exporta el respaldo completo o importa uno válido. El navegador guarda el estado versionado en `localStorage` del dispositivo y origen; borrar los datos del sitio puede eliminarlos. No se sincronizan entre celulares. Mantén respaldos JSON fuera del navegador. La aplicación valida archivos importados y no ejecuta contenido del JSON.

En **Ajustes → Partida → Reiniciar partida**, confirma para iniciar desde el primer participante activo y restaurar el orden completo de los mazos. Se conservan participantes, cartas, manuales y ajustes; se borran el turno actual, historial y premios pendientes. La acción no se ejecuta automáticamente.

Al registrar los resultados de un minijuego, las reglas de consecuencias de su manual se procesan primero. Después puedes asignar opcionalmente una carta de **Premio** a un ganador y una de **Castigo** a un perdedor, incluso si el manual no define reglas. Cada mazo auxiliar puede utilizarse una vez por minijuego.

## Ejecutar directamente en Android

No abras el HTML desde un administrador de archivos esperando que funcionen módulos o service workers. Para una instalación PWA usa un origen HTTPS, como se explica arriba. Para una futura ejecución totalmente local, copia los archivos a Android, instala un servidor HTTP local que sirva la carpeta y abre su origen local en Chrome; ese servidor debe soportar módulos JavaScript y tipos MIME correctos. Esta versión no incluye APK ni servidor Android empaquetado.

## Pruebas

```powershell
npm test
```

El catálogo inicial contiene las 310 cartas transcritas de Cartas Get Drunk Party.pdf (107 verdades, 102 desafíos, 50 minijuegos, 26 premios y 25 castigos). Las cantidades de shots de los desafíos se muestran en la parte inferior de la carta; si el documento no especificaba una, se configuran 2 Shots. El navegador debe probarse por separado para la instalación HTTPS y el comportamiento real offline.


