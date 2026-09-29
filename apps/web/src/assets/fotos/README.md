# Fotos da landing

Mesmas imagens usadas no seed da API (`apps/api/public/fotos`), exportadas do
arquivo de design [Rally — Quadras de Areia](https://www.figma.com/design/M6neeXlII8VbrxV5GOpo5Z)
para que o site e o app mostrem as mesmas quadras das telas.

Ficam em `src/assets` (e não em `public/`) de propósito: importadas como módulo,
o Next resolve dimensão e `blurDataURL` na build — sem layout shift e sem
depender de caminho em tempo de execução.

Em produção, as fotos das quadras são enviadas pelo estabelecimento e servidas
do S3/CloudFront (ver `docs/arquitetura.md`).
