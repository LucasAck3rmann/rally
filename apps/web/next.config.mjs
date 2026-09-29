/** @type {import('next').NextConfig} */

// As fotos das quadras são servidas pela API (ver apps/api/prisma/seed.ts e, em
// produção, o S3/CloudFront) e o next/image exige host declarado. Declaramos os
// dois endereços possíveis: o público (o que fica gravado na URL do seed) e o
// interno do docker-compose, por onde o otimizador de imagem busca o arquivo.
const origens = [
  process.env.API_PUBLIC_URL ?? "http://localhost:3333",
  process.env.API_URL ?? "http://localhost:3333/api/v1",
].map((valor) => new URL(valor));

const remotePatterns = [];
for (const origem of origens) {
  const chave = `${origem.protocol}//${origem.host}`;
  if (
    remotePatterns.some(
      (p) => `${p.protocol}://${p.hostname}${p.port ? `:${p.port}` : ""}` === chave,
    )
  )
    continue;
  remotePatterns.push({
    protocol: origem.protocol.replace(":", ""),
    hostname: origem.hostname,
    ...(origem.port ? { port: origem.port } : {}),
    pathname: "/static/**",
  });
}

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rally/tokens"],
  images: { remotePatterns },
};

export default nextConfig;
