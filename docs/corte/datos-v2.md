# Datos v2: `tsapc:v2` y `assets/store.js`

Estado: módulo listo y probado (`tests/store.test.mjs`). Todavía **no** está integrado en las páginas ni en `sw.js`; las páginas siguen usando sus claves antiguas.

## Esquema (`schema: 1`)

```
tsapc:v2 = {
  schema: 1, creado, actualizado,            // ISO 8601
  unidades: { <carpeta>: {
    repaso:    { dominados:[n…], modo, abiertos:[id…], filtro },
    simulacro: <objeto original tal cual>,
    plan:      <objeto original tal cual>,
    pos:       { <subruta>: "<scrollY en crudo>" }   // p. ej. pos.repaso, pos.simulacro
  } },
  ingles:    { examen, simulacro, examenVocabulario, simulacroVocabulario, vocabulario },
  lab1Tests: { test50, test50b, banco },
  personal:  { nombre:null, entregadas:{}, profes:{} },
  meta:      { migradoDe:[claves], version:1, sinInterpretar?:{ <clave>: "<valor en crudo>" } }
}
```

Solo aparecen las unidades que tienen datos. Carpetas: bio1, bio2, bio3, fisio1, fisio2, fisio3, gest1, gest2, ingles1, ipe2, ipe-tema5, lab1, lab2.

## Mapeo clave antigua -> ruta nueva

| Clave antigua | Ruta nueva |
|---|---|
| `<carpeta>-repaso-vN` (`ing1`->ingles1, `ipe5`->ipe-tema5) | `unidades.<carpeta>.repaso` (`done`->`dominados`, `mode`->`modo`, `open`->`abiertos`, `f`->`filtro`) |
| `<carpeta>-simulacro-vN` (`ipe3`->ipe-tema5) | `unidades.<carpeta>.simulacro` |
| `plan-estudio-v1-<id>` (`ing1`, `ipe5` como arriba) | `unidades.<carpeta>.plan` |
| `pos:/tsapc/<carpeta>/<sub>/` | `unidades.<carpeta>.pos.<sub>` |
| `eng-u12-exam-v2` / `eng-u12-simulacro-v1` | `ingles.examen` / `ingles.simulacro` |
| `eng-lab-vocab-v2` / `eng-lab-vocab-full-v1` | `ingles.examenVocabulario` / `ingles.simulacroVocabulario` |
| `lab-words-learn-v1` | `ingles.vocabulario` |
| `lab-u1-test50` / `-test50-b` / `-test153` | `lab1Tests.test50` / `test50b` / `banco` |

Cualquier otra clave permitida, o cualquier valor que no se pueda interpretar (JSON roto, tipo inesperado, versión más vieja de una misma clave), va en crudo a `meta.sinInterpretar[clave]`.

## Garantías

- **No se borra ni se modifica ninguna clave antigua.** Los tests comparan byte a byte.
- **Backup**: antes de escribir `tsapc:v2` se guarda `tsapc:backup-v1` (`{app, creado, claves}` con los valores en crudo), solo si no existe. Si no se puede guardar, no se escribe `tsapc:v2`. Un usuario nuevo no genera backup.
- **Idempotente**: `migrar()` repetido no cambia nada. Si aparecen claves antiguas nuevas, solo añade lo que falta; nunca pisa lo ya migrado ni lo escrito con `set()`.
- `tsapc:v2` ilegible: se copia a `tsapc:v2-corrupto` y se reconstruye. Un `schema` mayor que 1 no se toca.
- Defensas: `try/catch` en todo acceso a `localStorage`, `JSON.parse` seguro, rechazo de `__proto__`, `constructor` y `prototype` (en rutas y dentro de los valores).

## API

`cargar()`, `migrar()`, `get(ruta)`, `set(ruta, valor)` (rutas `"a.b.c"` o array; relee lo guardado, cambia solo esa ruta y actualiza `actualizado`), `exportar()` (usa `copia.js` si existe; no lo sustituye) y `persistir()` (`navigator.storage?.persist?.()`). `crear({storage, ahora})` permite inyectar almacenamiento y reloj para tests.
