/**
 * Client half of the film-calculator bundle.
 *
 * Registers two things in the Harness Web page:
 * - `sidebar.panellist` entry (icon + label) whose id doubles as the `main`
 *   panel key the shell dispatches when the row is clicked;
 * - the calculator page itself in `main`, keyed by the same id.
 *
 * The calculator is pure Client state: no Host round trip, no session.
 *
 * Its copy is Spanish by explicit user request, so it does not follow
 * `ctx.locale`; numbers always use two decimals in es-CO formatting.
 */
window.__ModuleLoader__.load({
  id: '@local/film-calculator',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useCallback = React.useCallback;

    /** Sidebar list id and `main` panel key. */
    const PANEL_ID = 'film-calculator';

    /** Number formatting: Spanish (Colombia) grouping, exactly two decimals. */
    const NUMBER_FORMAT = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    /** Film substrates and their density in g/cm³. */
    const MATERIALS = [
      { id: 'PET', density: 1.4 },
      { id: 'PEBD', density: 0.92 },
      { id: 'BIOPP', density: 0.91 },
      { id: 'PPCAST', density: 0.9 },
      { id: 'PEHD', density: 0.95 },
      { id: 'PAPEL', density: 0.8 },
    ];
    const DENSITY = MATERIALS.reduce((map, material) => {
      map[material.id] = material.density;
      return map;
    }, {});

    /** Default form state; also the Reset target. */
    const DEFAULTS = {
      material: 'PET',
      calibre: '12',
      width: '100',
      ink: '1.6',
      mode: 'kg',
      kg: '100',
      includeInk: true,
      metersKind: 'linear',
      meters: '1000',
    };

    /** Last form state, kept across panel switches (unmount clears component state). */
    let remembered = { ...DEFAULTS };

    /** Spanish copy for the calculator. */
    const MESSAGES = {
      panel: 'Film Calculator',
      title: 'Film Calculator',
      subtitle:
        'Convierte calibre y ancho en metros cuadrados, metros lineales, kilos de película y kilos de tinta seca.',
      'material.label': 'Material',
      'material.hint': 'Densidad {density} g/cm³',
      'material.PET': 'PET',
      'material.PEBD': 'PEBD (polietileno de baja densidad)',
      'material.BIOPP': 'BIOPP / BOPP',
      'material.PPCAST': 'PP CAST',
      'material.PEHD': 'PEHD (polietileno de alta densidad)',
      'material.PAPEL': 'Papel',
      'calibre.label': 'Calibre',
      'width.label': 'Ancho del rollo',
      'width.hint': 'Equivale a {value} m',
      'ink.label': 'Tinta seca',
      'ink.hint': 'Predeterminado: 1,6 g/m²',
      'mode.label': 'Calcular a partir de',
      'mode.kg': 'Kilos',
      'mode.meters': 'Metros',
      'kg.label': 'Kilos de película',
      'kg.includeInk': 'Los kilos incluyen la tinta seca',
      'kg.includeInkHint': 'Desactívalo si los kilos son solo de película sin imprimir.',
      'metersKind.label': 'Tipo de metro',
      'metersKind.linear': 'Metros lineales',
      'metersKind.square': 'Metros cuadrados',
      'meters.linear.label': 'Metros lineales',
      'meters.square.label': 'Metros cuadrados',
      'result.title': 'Resultado',
      'result.area': 'Área total',
      'result.linear': 'Metros lineales',
      'result.filmKg': 'Película',
      'result.inkKg': 'Tinta seca',
      'result.totalKg': 'Total impreso',
      'result.filmGsm': 'Gramaje de película',
      'result.inkGsm': 'Gramaje de tinta',
      'result.grossGsm': 'Gramaje total',
      'result.yield': 'Rendimiento',
      'result.formula': '{calibre} µm × {density} g/cm³ = {gsm} g/m² de película',
      'result.empty': 'Completa material, calibre, ancho y la cantidad para ver el resultado.',
      'basis.kgInk': 'A partir de {value} kg impresos (película + tinta)',
      'basis.kgFilm': 'A partir de {value} kg de película',
      'basis.linear': 'A partir de {value} m lineales',
      'basis.square': 'A partir de {value} m²',
      reset: 'Restablecer',
      'note.density': 'Gramaje de película = calibre (µm) × densidad (g/cm³).',
      'note.decimals': 'Los resultados se muestran con 2 decimales.',
      'note.paper':
        'En papel el calibre en µm no es la especificación habitual: se usa una densidad aproximada de 0,80 g/cm³. Verifica el gramaje real con tu proveedor.',
      'note.ink': 'La tinta seca se calcula sobre el área total impresa, sin mermas ni desperdicio de arranque.',
      'error.calibre': 'Ingresa un calibre mayor que 0.',
      'error.width': 'Ingresa un ancho mayor que 0.',
      'error.ink': 'Ingresa un gramaje de tinta igual o mayor que 0.',
      'error.amount': 'Ingresa una cantidad mayor que 0.',
    };

    /** Translate a message key; `{name}` placeholders come from `params`. */
    function t(key, params) {
      const template = MESSAGES[key];
      if (template === undefined) return key;
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
    }

    /** Two-decimal number text; an em dash marks a non-finite value. */
    function formatNumber(value) {
      if (!Number.isFinite(value)) return '—';
      return NUMBER_FORMAT.format(value);
    }

    /** Parse a user-typed decimal, accepting comma decimals and thousands dots. */
    function parseDecimal(text) {
      const raw = String(text === undefined || text === null ? '' : text).trim().replace(/\s+/g, '');
      if (raw === '') return NaN;
      let normalized = raw;
      if (raw.indexOf(',') !== -1 && raw.indexOf('.') !== -1) {
        normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.')
          ? raw.replace(/\./g, '').replace(',', '.')
          : raw.replace(/,/g, '');
      } else if (raw.indexOf(',') !== -1) {
        normalized = raw.replace(',', '.');
      }
      const value = Number(normalized);
      return Number.isFinite(value) ? value : NaN;
    }

    /**
     * Convert the form state into a result.
     *
     * Film grammage follows directly from the definition of density:
     * 1 m² of film at calibre c (µm) has volume c cm³, so g/m² = c × density.
     *
     * @param values - current form state.
     * @returns field error flags plus the computed result, when valid.
     */
    function compute(values) {
      const calibre = parseDecimal(values.calibre);
      /* The form takes the roll width in centimeters so a whole number is enough. */
      const widthCm = parseDecimal(values.width);
      const width = widthCm / 100;
      const ink = parseDecimal(values.ink);
      const density = DENSITY[values.material] === undefined ? DENSITY.PET : DENSITY[values.material];
      const filmGsm = calibre * density;
      const inkGsm = ink;
      const errors = {};

      if (!Number.isFinite(calibre) || calibre <= 0) errors.calibre = true;
      if (!Number.isFinite(widthCm) || widthCm <= 0) errors.width = true;
      if (!Number.isFinite(ink) || ink < 0) errors.ink = true;

      if (Object.keys(errors).length > 0) {
        return { errors, result: null, filmGsm, inkGsm };
      }

      let area;
      let filmKg;
      let inkKg;

      if (values.mode === 'kg') {
        const kg = parseDecimal(values.kg);
        if (!Number.isFinite(kg) || kg <= 0) {
          errors.amount = true;
          return { errors, result: null, filmGsm, inkGsm };
        }
        if (values.includeInk) {
          const grossGsm = filmGsm + inkGsm;
          area = (kg * 1000) / grossGsm;
          inkKg = (area * inkGsm) / 1000;
          filmKg = kg - inkKg;
        } else {
          area = (kg * 1000) / filmGsm;
          filmKg = kg;
          inkKg = (area * inkGsm) / 1000;
        }
      } else {
        const meters = parseDecimal(values.meters);
        if (!Number.isFinite(meters) || meters <= 0) {
          errors.amount = true;
          return { errors, result: null, filmGsm, inkGsm };
        }
        area = values.metersKind === 'linear' ? meters * width : meters;
        filmKg = (area * filmGsm) / 1000;
        inkKg = (area * inkGsm) / 1000;
      }

      return {
        errors,
        filmGsm,
        inkGsm,
        result: {
          area,
          linear: area / width,
          filmKg,
          inkKg,
          totalKg: filmKg + inkKg,
          filmGsm,
          inkGsm,
          grossGsm: filmGsm + inkGsm,
          linearPerKg: filmGsm > 0 ? 1000 / (filmGsm * width) : NaN,
        },
      };
    }

    /** Field label, unit, control, and optional hint or error. */
    function Field({ label, unit, hint, error, htmlFor, children }) {
      return h(
        'div',
        { className: 'fcalc-field' },
        h(
          'label',
          { className: 'fcalc-label', htmlFor },
          h('span', null, label),
          unit ? h('span', { className: 'fcalc-unit' }, unit) : null,
        ),
        children,
        error
          ? h('p', { className: 'fcalc-error', role: 'alert' }, error)
          : hint
            ? h('p', { className: 'fcalc-hint' }, hint)
            : null,
      );
    }

    /** Page-side chevron; the native select arrow is removed so the row matches host controls. */
    function Chevron() {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 14,
          height: 14,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', { d: 'M4 6.5 8 10.5 12 6.5' }),
      );
    }

    /** Sidebar glyph: a film roll paying out a strip. */
    function PanelIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 18;
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('circle', { cx: 9, cy: 12, r: 5.6 }),
        h('circle', { cx: 9, cy: 12, r: 1.9 }),
        h('path', { d: 'M14.4 9.1h2.5c1.5 0 2.6 1.1 2.6 2.5s-1.1 2.5-2.6 2.5h-2.5' }),
      );
    }

    const CSS = `
.fcalc-page{box-sizing:border-box;width:100%;min-width:0;height:100%;min-height:0;display:flex;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}
.fcalc-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
.fcalc-content{max-width:1040px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}
.fcalc-heading{display:flex;flex-direction:column;gap:6px;padding-top:28px;margin-bottom:24px}
[data-platform=darwin] .fcalc-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.fcalc-heading h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
.fcalc-subtitle{margin:0;max-width:72ch;font-size:13px;color:var(--dsw-alias-label-secondary)}
.fcalc-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,360px);gap:20px;align-items:start}
@media (max-width:900px){.fcalc-layout{grid-template-columns:minmax(0,1fr)}}
.fcalc-card{display:flex;flex-direction:column;gap:18px;padding:20px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}
.fcalc-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.fcalc-label{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.fcalc-unit{font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.fcalc-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:560px){.fcalc-row2{grid-template-columns:minmax(0,1fr)}}
.fcalc-input,.fcalc-select{box-sizing:border-box;width:100%;height:40px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;outline:none}
.fcalc-input:hover,.fcalc-select:hover{border-color:var(--dsw-alias-border-l2)}
.fcalc-input:focus-visible,.fcalc-select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.fcalc-input-invalid{border-color:var(--dsw-alias-state-error-primary)}
.fcalc-select-wrap{position:relative;display:flex;align-items:center}
.fcalc-select{appearance:none;padding-right:36px;cursor:pointer}
.fcalc-select-wrap svg{position:absolute;right:12px;pointer-events:none;color:var(--dsw-alias-label-secondary)}
.fcalc-hint,.fcalc-error{margin:0;font-size:12px;line-height:1.5}
.fcalc-hint{color:var(--dsw-alias-label-secondary)}
.fcalc-error{color:var(--dsw-alias-state-error-primary)}
.fcalc-segmented{display:inline-flex;align-self:flex-start;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
.fcalc-segment{height:30px;padding:0 12px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.fcalc-segment:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-base))}
.fcalc-segment[aria-pressed=true]{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2)}
.fcalc-segment:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.fcalc-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer}
.fcalc-check input{flex:none;width:16px;height:16px;margin:3px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.fcalc-check-text{display:flex;flex-direction:column;gap:2px}
.fcalc-reset{align-self:flex-start;height:32px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.fcalc-reset:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}
.fcalc-reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.fcalc-results{position:sticky;top:20px;display:flex;flex-direction:column;gap:14px;padding:20px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}
.fcalc-results h2{margin:0;font-size:14px;font-weight:500;line-height:22px}
.fcalc-basis{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.fcalc-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fcalc-stat{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
.fcalc-stat-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.fcalc-stat-value{font-size:20px;font-weight:500;line-height:1.3;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.fcalc-stat-unit{margin-left:4px;font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.fcalc-rows{display:flex;flex-direction:column;margin:0}
.fcalc-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:13px}
.fcalc-row:first-child{border-top:0;padding-top:0}
.fcalc-row dt{margin:0;color:var(--dsw-alias-label-secondary)}
.fcalc-row dd{margin:0;font-variant-numeric:tabular-nums;text-align:right}
.fcalc-formula{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.fcalc-empty{margin:0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.fcalc-notes{display:flex;flex-direction:column;gap:4px;margin-top:20px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.fcalc-notes p{margin:0}
`;

    /** The calculator page. */
    function FilmCalculatorPage() {
      const [values, setValues] = useState(() => ({ ...remembered }));
      const update = useCallback((patch) => {
        setValues((previous) => {
          const next = { ...previous, ...patch };
          remembered = next;
          return next;
        });
      }, []);

      const state = compute(values);
      const result = state.result;
      const errors = state.errors;
      const density =
        DENSITY[values.material] === undefined ? DENSITY.PET : DENSITY[values.material];
      const isKgMode = values.mode === 'kg';
      /* Width is typed in centimeters; every formula consumes meters. */
      const widthCm = parseDecimal(values.width);
      const widthMeters = widthCm / 100;

      /** Where the current numbers come from, so the mode change is visible in the results. */
      let basis = null;
      if (isKgMode) {
        const kg = parseDecimal(values.kg);
        if (Number.isFinite(kg) && kg > 0) {
          basis = t(values.includeInk ? 'basis.kgInk' : 'basis.kgFilm', { value: formatNumber(kg) });
        }
      } else {
        const meters = parseDecimal(values.meters);
        if (Number.isFinite(meters) && meters > 0) {
          basis = t(values.metersKind === 'linear' ? 'basis.linear' : 'basis.square', {
            value: formatNumber(meters),
          });
        }
      }

      /** Headline cards answer the question the current mode asks. */
      const stats = result
        ? isKgMode
          ? [
              { key: 'area', label: t('result.area'), value: formatNumber(result.area), unit: 'm²' },
              { key: 'linear', label: t('result.linear'), value: formatNumber(result.linear), unit: 'm' },
            ]
          : [
              { key: 'total', label: t('result.totalKg'), value: formatNumber(result.totalKg), unit: 'kg' },
              { key: 'film', label: t('result.filmKg'), value: formatNumber(result.filmKg), unit: 'kg' },
            ]
        : [];

      /** Detail rows hold every value the headline cards of the current mode do not show. */
      const rows = result
        ? (isKgMode
            ? [
                { label: t('result.filmKg'), value: formatNumber(result.filmKg) + ' kg' },
                { label: t('result.inkKg'), value: formatNumber(result.inkKg) + ' kg' },
                { label: t('result.totalKg'), value: formatNumber(result.totalKg) + ' kg' },
              ]
            : [
                { label: t('result.inkKg'), value: formatNumber(result.inkKg) + ' kg' },
                { label: t('result.area'), value: formatNumber(result.area) + ' m²' },
                { label: t('result.linear'), value: formatNumber(result.linear) + ' m' },
              ]
          ).concat([
            { label: t('result.filmGsm'), value: formatNumber(result.filmGsm) + ' g/m²' },
            { label: t('result.inkGsm'), value: formatNumber(result.inkGsm) + ' g/m²' },
            { label: t('result.grossGsm'), value: formatNumber(result.grossGsm) + ' g/m²' },
            { label: t('result.yield'), value: formatNumber(result.linearPerKg) + ' m/kg' },
          ])
        : [];

      const amountField = isKgMode
        ? [
            h(
              Field,
              {
                key: 'kg',
                label: t('kg.label'),
                unit: 'kg',
                htmlFor: 'fcalc-kg',
                error: errors.amount ? t('error.amount') : null,
              },
              h('input', {
                id: 'fcalc-kg',
                className: errors.amount ? 'fcalc-input fcalc-input-invalid' : 'fcalc-input',
                type: 'text',
                inputMode: 'decimal',
                autoComplete: 'off',
                value: values.kg,
                'aria-invalid': errors.amount || undefined,
                onChange: (event) => update({ kg: event.target.value }),
              }),
            ),
            h(
              'label',
              { key: 'include-ink', className: 'fcalc-check', htmlFor: 'fcalc-include-ink' },
              h('input', {
                id: 'fcalc-include-ink',
                type: 'checkbox',
                checked: values.includeInk,
                onChange: (event) => update({ includeInk: event.target.checked }),
              }),
              h(
                'span',
                { className: 'fcalc-check-text' },
                h('span', null, t('kg.includeInk')),
                h('span', { className: 'fcalc-hint' }, t('kg.includeInkHint')),
              ),
            ),
          ]
        : [
            h(
              'div',
              { key: 'meters-kind', className: 'fcalc-field' },
              h('span', { className: 'fcalc-label' }, t('metersKind.label')),
              h(
                'div',
                { className: 'fcalc-segmented', role: 'group', 'aria-label': t('metersKind.label') },
                ['linear', 'square'].map((kind) =>
                  h(
                    'button',
                    {
                      key: kind,
                      type: 'button',
                      className: 'fcalc-segment',
                      'aria-pressed': values.metersKind === kind,
                      onClick: () => update({ metersKind: kind }),
                    },
                    t('metersKind.' + kind),
                  ),
                ),
              ),
            ),
            h(
              Field,
              {
                key: 'meters',
                label: t(values.metersKind === 'linear' ? 'meters.linear.label' : 'meters.square.label'),
                unit: values.metersKind === 'linear' ? 'm' : 'm²',
                htmlFor: 'fcalc-meters',
                error: errors.amount ? t('error.amount') : null,
              },
              h('input', {
                id: 'fcalc-meters',
                className: errors.amount ? 'fcalc-input fcalc-input-invalid' : 'fcalc-input',
                type: 'text',
                inputMode: 'decimal',
                autoComplete: 'off',
                value: values.meters,
                'aria-invalid': errors.amount || undefined,
                onChange: (event) => update({ meters: event.target.value }),
              }),
            ),
          ];

      return h(
        'section',
        { className: 'fcalc-page', 'aria-label': t('title') },
        h('style', null, CSS),
        h(
          'div',
          { className: 'fcalc-scroll' },
          h(
            'div',
            { className: 'fcalc-content' },
            h(
              'header',
              { className: 'fcalc-heading' },
              h('h1', null, t('title')),
              h('p', { className: 'fcalc-subtitle' }, t('subtitle')),
            ),
            h(
              'div',
              { className: 'fcalc-layout' },
              h(
                'form',
                {
                  className: 'fcalc-card',
                  onSubmit: (event) => {
                    event.preventDefault();
                  },
                },
                h(
                  Field,
                  {
                    label: t('material.label'),
                    hint: t('material.hint', { density: formatNumber(density) }),
                    htmlFor: 'fcalc-material',
                  },
                  h(
                    'div',
                    { className: 'fcalc-select-wrap' },
                    h(
                      'select',
                      {
                        id: 'fcalc-material',
                        className: 'fcalc-select',
                        value: values.material,
                        onChange: (event) => update({ material: event.target.value }),
                      },
                      MATERIALS.map((material) =>
                        h('option', { key: material.id, value: material.id }, t('material.' + material.id)),
                      ),
                    ),
                    h(Chevron),
                  ),
                ),
                h(
                  'div',
                  { className: 'fcalc-row2' },
                  h(
                    Field,
                    {
                      label: t('calibre.label'),
                      unit: 'µm',
                      htmlFor: 'fcalc-calibre',
                      error: errors.calibre ? t('error.calibre') : null,
                    },
                    h('input', {
                      id: 'fcalc-calibre',
                      className: errors.calibre ? 'fcalc-input fcalc-input-invalid' : 'fcalc-input',
                      type: 'text',
                      inputMode: 'decimal',
                      autoComplete: 'off',
                      value: values.calibre,
                      'aria-invalid': errors.calibre || undefined,
                      onChange: (event) => update({ calibre: event.target.value }),
                    }),
                  ),
                  h(
                    Field,
                    {
                      label: t('width.label'),
                      unit: 'cm',
                      htmlFor: 'fcalc-width',
                      hint:
                        Number.isFinite(widthMeters) && widthCm > 0
                          ? t('width.hint', { value: formatNumber(widthMeters) })
                          : null,
                      error: errors.width ? t('error.width') : null,
                    },
                    h('input', {
                      id: 'fcalc-width',
                      className: errors.width ? 'fcalc-input fcalc-input-invalid' : 'fcalc-input',
                      type: 'text',
                      inputMode: 'decimal',
                      autoComplete: 'off',
                      value: values.width,
                      'aria-invalid': errors.width || undefined,
                      onChange: (event) => update({ width: event.target.value }),
                    }),
                  ),
                ),
                h(
                  Field,
                  {
                    label: t('ink.label'),
                    unit: 'g/m²',
                    htmlFor: 'fcalc-ink',
                    hint: t('ink.hint'),
                    error: errors.ink ? t('error.ink') : null,
                  },
                  h('input', {
                    id: 'fcalc-ink',
                    className: errors.ink ? 'fcalc-input fcalc-input-invalid' : 'fcalc-input',
                    type: 'text',
                    inputMode: 'decimal',
                    autoComplete: 'off',
                    value: values.ink,
                    'aria-invalid': errors.ink || undefined,
                    onChange: (event) => update({ ink: event.target.value }),
                  }),
                ),
                h(
                  'div',
                  { className: 'fcalc-field' },
                  h('span', { className: 'fcalc-label' }, t('mode.label')),
                  h(
                    'div',
                    { className: 'fcalc-segmented', role: 'group', 'aria-label': t('mode.label') },
                    ['kg', 'meters'].map((mode) =>
                      h(
                        'button',
                        {
                          key: mode,
                          type: 'button',
                          className: 'fcalc-segment',
                          'aria-pressed': values.mode === mode,
                          onClick: () => update({ mode }),
                        },
                        t('mode.' + mode),
                      ),
                    ),
                  ),
                ),
                ...amountField,
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fcalc-reset',
                    onClick: () => {
                      remembered = { ...DEFAULTS };
                      setValues({ ...DEFAULTS });
                    },
                  },
                  t('reset'),
                ),
              ),
              h(
                'aside',
                { className: 'fcalc-results', 'aria-live': 'polite' },
                h('h2', null, t('result.title')),
                basis ? h('p', { className: 'fcalc-basis' }, basis) : null,
                result
                  ? h(
                      React.Fragment,
                      null,
                      h(
                        'div',
                        { className: 'fcalc-stats' },
                        stats.map((card) =>
                          h(
                            'div',
                            { key: card.key, className: 'fcalc-stat' },
                            h('span', { className: 'fcalc-stat-label' }, card.label),
                            h(
                              'span',
                              { className: 'fcalc-stat-value' },
                              card.value,
                              h('span', { className: 'fcalc-stat-unit' }, card.unit),
                            ),
                          ),
                        ),
                      ),
                      h(
                        'dl',
                        { className: 'fcalc-rows' },
                        rows.map((row) =>
                          h(
                            'div',
                            { key: row.label, className: 'fcalc-row' },
                            h('dt', null, row.label),
                            h('dd', null, row.value),
                          ),
                        ),
                      ),
                      h(
                        'p',
                        { className: 'fcalc-formula' },
                        t('result.formula', {
                          calibre: formatNumber(parseDecimal(values.calibre)),
                          density: formatNumber(density),
                          gsm: formatNumber(result.filmGsm),
                        }),
                      ),
                    )
                  : h('p', { className: 'fcalc-empty' }, t('result.empty')),
              ),
            ),
            h(
              'div',
              { className: 'fcalc-notes' },
              h('p', null, t('note.density')),
              h('p', null, t('note.decimals')),
              values.material === 'PAPEL' ? h('p', null, t('note.paper')) : null,
              h('p', null, t('note.ink')),
            ),
          ),
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              label: () => t('panel'),
            },
            PanelIcon,
          ),
        );

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
            },
            FilmCalculatorPage,
          ),
        );
      },
    };
  },
});
