/**
 * Map common tech names to devicon CDN URLs.
 * Returns null for unknown technologies.
 */
const TECH_ICON_MAP: Record<string, string> = {
  // Languages
  javascript: "javascript/javascript-original",
  typescript: "typescript/typescript-original",
  python: "python/python-original",
  rust: "rust/rust-original",
  go: "go/go-original",
  java: "java/java-original",
  swift: "swift/swift-original",
  kotlin: "kotlin/kotlin-original",
  ruby: "ruby/ruby-original",
  php: "php/php-original",
  "c#": "csharp/csharp-original",
  csharp: "csharp/csharp-original",
  "c++": "cplusplus/cplusplus-original",
  c: "c/c-original",
  dart: "dart/dart-original",
  elixir: "elixir/elixir-original",
  scala: "scala/scala-original",
  lua: "lua/lua-original",
  zig: "zig/zig-original",
  solidity: "solidity/solidity-original",
  html: "html5/html5-original",
  css: "css3/css3-original",

  // Frontend Frameworks
  react: "react/react-original",
  "react native": "react/react-original",
  "next.js": "nextjs/nextjs-original",
  nextjs: "nextjs/nextjs-original",
  vue: "vuejs/vuejs-original",
  "vue.js": "vuejs/vuejs-original",
  angular: "angular/angular-original",
  svelte: "svelte/svelte-original",
  nuxt: "nuxtjs/nuxtjs-original",
  "nuxt.js": "nuxtjs/nuxtjs-original",
  astro: "astro/astro-original",

  // Backend Frameworks
  "node.js": "nodejs/nodejs-original",
  nodejs: "nodejs/nodejs-original",
  express: "express/express-original",
  django: "django/django-plain",
  flask: "flask/flask-original",
  fastapi: "fastapi/fastapi-original",
  rails: "rails/rails-original",
  "ruby on rails": "rails/rails-original",
  spring: "spring/spring-original",
  laravel: "laravel/laravel-original",
  nestjs: "nestjs/nestjs-original",

  // Databases
  postgresql: "postgresql/postgresql-original",
  postgres: "postgresql/postgresql-original",
  mysql: "mysql/mysql-original",
  mongodb: "mongodb/mongodb-original",
  redis: "redis/redis-original",
  sqlite: "sqlite/sqlite-original",
  supabase: "supabase/supabase-original",
  firebase: "firebase/firebase-original",

  // Cloud / DevOps
  aws: "amazonwebservices/amazonwebservices-plain-wordmark",
  docker: "docker/docker-original",
  kubernetes: "kubernetes/kubernetes-original",
  vercel: "vercel/vercel-original",
  nginx: "nginx/nginx-original",
  linux: "linux/linux-original",
  git: "git/git-original",
  github: "github/github-original",
  "github actions": "githubactions/githubactions-original",

  // CSS / Styling
  tailwindcss: "tailwindcss/tailwindcss-original",
  tailwind: "tailwindcss/tailwindcss-original",
  "tailwind css": "tailwindcss/tailwindcss-original",
  sass: "sass/sass-original",
  bootstrap: "bootstrap/bootstrap-original",

  // Tools
  webpack: "webpack/webpack-original",
  vite: "vitejs/vitejs-original",
  figma: "figma/figma-original",
  graphql: "graphql/graphql-plain",
  prisma: "prisma/prisma-original",
  electron: "electron/electron-original",
  terraform: "terraform/terraform-original",
};

export function getTechIconUrl(tech: string): string | null {
  const key = tech.toLowerCase().trim();
  const path = TECH_ICON_MAP[key];
  if (!path) return null;
  return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${path}.svg`;
}

/**
 * Get a simple color dot for technologies without icons.
 * Returns a consistent color based on the tech name hash.
 */
export function getTechColor(tech: string): string {
  const colors = [
    "#FF3A00", "#0891B2", "#CA8A04", "#D97706",
    "#059669", "#7C3AED", "#DB2777", "#2563EB",
    "#DC2626", "#65A30D",
  ];
  let hash = 0;
  for (let i = 0; i < tech.length; i++) {
    hash = tech.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
