# film-calculator

Plugin (bundle) para **DeepSeek Harness**: calculadora de film plástico en la barra lateral.

Calcula, a partir de calibre, ancho y kilos (o metros), la superficie, los metros
lineales y el consumo de tinta seca. La UI es 100 % cliente —no hay servicio,
herramienta ni configuración de Host— y está en español por petición explícita,
con formato numérico `es-CO` a dos decimales.

## Instalación

```bash
# 1) instalar la dependencia en el perfil
dsh plugin --profile web add github:john102594/film-calculator

# 2) seleccionar el bundle
#    - desde la página Plugins de la web, o
#    - añadiendo "@local/film-calculator" a "dsh.profile.bundles" en
#      ~/.dsh/profiles/<perfil>/package.json
```

Reinicia el perfil (o deja que HMR recargue) y el icono aparece en la barra
lateral. `dsh plugin add` solo instala la dependencia: la selección del bundle
se hace aparte, como en el paso 2.

Probado con DSH `0.2.1-rc.5`.

## Estructura

| Archivo | Papel |
|---|---|
| `index.js` | Mitad Host: `apply()` vacío; el bundle no aporta servicios. |
| `client.js` | Mitad Cliente: entrada `sidebar.panellist` + página de la calculadora, registradas vía `window.__ModuleLoader__`. |
| `cordis.patch.yml` | Inserta la fila `film-calculator` del bundle. |
| `package.json` | `exports`, `files` y los campos `dsh.bundle` / `dsh.client`. |
| `locale/` | Cadenas en inglés y español. |
| `icon.svg` | Icono de la barra lateral. |

## Licencia

Sin licencia declarada por ahora: todos los derechos reservados.
