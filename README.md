# Get Drunk Party Web

Aplicación de fiesta mobile-first, creada con HTML, CSS y JavaScript nativo. Incluye cinco mazos, selección con dado físico, acción SHOT independiente, participantes, editor, manuales, respaldos JSON y PWA con caché offline. No usa cuenta, backend, CDN ni fuentes remotas.

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
2. En **Partida**, lanza un dado físico. La cara 1 corresponde a **SHOT** y la cara 6 a **MINIJUEGO**. El grupo acuerda qué categorías corresponden a las caras 2–5; luego toca el reverso de esa categoría en el dashboard. El juego no hace una segunda tirada digital.
3. Se ven siempre los cinco reversos. Toca uno para tomar una carta de ese mazo; se muestra primero el dorso y se voltea para revelar la carta. Encima aparece solo la persona cuyo turno está activo; la asignación de la dinámica se mantiene en la carta.
4. Si sale **SHOT**, toca el control de cara 1. No roba carta y ofrece registrar la acción, elegir alternativa sin alcohol o pasar.
5. Resuelve una carta con **Completada**, **Alternativa** o **Pasar**. El siguiente turno avanza una posición circular.
6. El botón `?` aparece cuando la carta tiene manual. Abrirlo no altera el turno.

## Editar, añadir y administrar cartas

En **Cartas** puedes buscar por texto o ID y filtrar por categoría. Para añadir una carta:

1. Abre **Cartas** y pulsa **＋ Nueva carta**.
2. Escribe un ID único con letras, números, guion o guion bajo (por ejemplo `DESAFIO_mimo_de_robot`).
3. Selecciona categoría, título, descripción e intensidad de 0 a 5.
4. Configura asignación y cantidad. Las parejas voluntarias se acuerdan entre jugadores; no se asignan al azar.
5. Opcionalmente asigna manual e icono local. Para penalizar con shots, activa **Tiene penalización en shots** e indica la cantidad; la vista previa muestra el singular o plural.
6. Revisa la vista previa y pulsa **Guardar carta**.

Para editar una existente, busca o filtra la carta y pulsa **Editar**. Cambia los campos y guarda; el ID permanece estable. **Duplicar** crea otra carta con un ID nuevo. **Desactivar** la conserva en el catálogo pero la excluye de los sorteos. **Eliminar** solicita confirmación y la quita del catálogo. Exporta el catálogo antes de hacer cambios grandes; la importación valida el JSON y rechaza IDs repetidos.

Para crear una carta: elige un ID descriptivo que no exista (por ejemplo `DESAFIO_mimo_de_robot`), completa los campos y guarda. Para editar una existente, pulsa **Editar** en la fila; el ID no cambia. Desactivar conserva la carta pero la retira de los sorteos. Eliminar la quita del catálogo y de las referencias del mazo. También puedes exportar/importar catálogos JSON; se validan antes de modificar los datos y se rechazan IDs duplicados.

Las cinco categorías y colores están en `js/config.js`. Las 50 cartas de fábrica están individualizadas en `data/initial-cards.js`, y se copian al almacenamiento solo en una instalación nueva. Para agregar código fuente a una versión nueva, edita ese archivo; los usuarios existentes mantienen su catálogo local y pueden importar cartas nuevas con IDs no repetidos.

## Manuales, bebidas e iconos

En **Manuales**, edita título, resumen e instrucciones. Semana inglesa queda marcada como pendiente hasta que el grupo configure sus reglas. Para un manual nuevo, añade un objeto con ID estable en `data/initial-manuals.js` y selecciónalo desde el editor. El catálogo editable de bebidas y alternativas está en **Ajustes**. La penalización configurada en una carta se muestra como cantidad de shots.

El editor admite un glifo o emoji local para icono (no HTML, SVG arbitrario ni URLs remotas). Para añadir iconos vectoriales locales revisa `assets/icons/icon.svg`; no son necesarios para jugar.

Ejemplo de carta:

```js
{
  id: 'VERDAD_anecdota_favorita', categoryId: 'VERDAD',
  title: 'Anécdota favorita', description: 'Comparte un recuerdo que te haga reír.',
  icon: { type: 'glyph', value: '✦' }, spiceLevel: 1,
  target: { mode: 'CURRENT_PLAYER', count: 1, position: null },
  penalty: { enabled: true, units: 1 }, // 1 Shot
  manualId: null, enabled: true
}
```

Ejemplo de manual: `{ id: 'MANUAL_MIMICA', title: 'Mímica', summary: 'Adivina con gestos', instructions: ['Una persona representa una palabra'], notes: '', pending: false }`.

Ejemplo de participante: `{ id: 'player_abc123', name: 'Ana', active: true, preferences: {} }`.

## Respaldos y almacenamiento

En **Ajustes y respaldo**, exporta el respaldo completo o importa uno válido. El navegador guarda el estado versionado en `localStorage` del dispositivo y origen; borrar los datos del sitio puede eliminarlos. No se sincronizan entre celulares. Mantén respaldos JSON fuera del navegador. La aplicación valida archivos importados y no ejecuta contenido del JSON.

## Ejecutar directamente en Android

No abras el HTML desde un administrador de archivos esperando que funcionen módulos o service workers. Para una instalación PWA usa un origen HTTPS, como se explica arriba. Para una futura ejecución totalmente local, copia los archivos a Android, instala un servidor HTTP local que sirva la carpeta y abre su origen local en Chrome; ese servidor debe soportar módulos JavaScript y tipos MIME correctos. Esta versión no incluye APK ni servidor Android empaquetado.

## Pruebas

```powershell
npm test
```

Las pruebas cubren las 50 cartas y sus IDs, manuales, ciclos del mazo, categoría agotada, asignación de participantes, turnos, bloqueos, SHOT independiente y validación de estado/cartas. El navegador debe probarse por separado para la instalación HTTPS y el comportamiento real offline.

