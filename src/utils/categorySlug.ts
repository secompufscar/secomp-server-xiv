const CANONICAL_SLUGS: Record<string, string> = {
  minicursos: "minicurso",
  palestras: "palestra",
  competicoes: "competicao",
  competicao: "competicao",
  gamenight: "gamenight",
  "game-night": "gamenight",
  socioculturais: "sociocultural",
  credenciamentos: "credenciamento",
  cafes: "coffee",
  cafe: "coffee",
};

export function createCategorySlug(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return CANONICAL_SLUGS[normalized] ?? normalized;
}
