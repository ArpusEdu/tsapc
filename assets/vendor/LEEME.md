Librerías de terceros servidas desde el propio sitio (sin CDN): funcionan sin conexión y no envían la IP a terceros.

- three 0.160.0 (MIT): build/three.module.min.js y examples/jsm/{environments/RoomEnvironment.js, geometries/RoundedBoxGeometry.js}, de cdn.jsdelivr.net/npm/three@0.160.0
- gsap 3.12.5 (licencia estándar de GreenSock, gratuita): gsap.min.js de cdnjs; sha384 comprobado igual al SRI que usaba la portada

Para actualizar: descargar la versión nueva, cambiar las rutas si cambian y ejecutar node scripts/sw-version.mjs.
