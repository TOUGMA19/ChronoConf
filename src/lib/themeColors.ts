import { getCategories } from "./conference";

export type RGB = [number, number, number];

/** Palette officielle des thématiques (36 couleurs, attribuées dans l'ordre de la liste des thématiques). */
export const THEME_PALETTE: RGB[] = [
  [178, 24, 43],    // 1. Rouge profond
  [255, 140, 0],    // 2. Orange vif
  [255, 215, 0],    // 3. Jaune doré
  [138, 43, 226],   // 4. Violet
  [0, 179, 179],    // 5. Cyan foncé
  [30, 58, 138],    // 6. Indigo
  [209, 0, 143],    // 7. Fuchsia
  [255, 111, 97],   // 8. Saumon
  [93, 64, 55],     // 9. Brun foncé
  [245, 245, 220],  // 10. Ivoire
  [0, 100, 0],      // 11. Vert forêt
  [64, 224, 208],   // 12. Turquoise
  [106, 13, 173],   // 13. Pourpre
  [0, 128, 128],    // 14. Sarcelle
  [204, 85, 0],     // 15. Terre cuite
  [112, 128, 144],  // 16. Gris ardoise
  [191, 255, 0],    // 17. Vert anis
  [0, 0, 128],      // 18. Bleu nuit
  [159, 122, 234],  // 19. Lavande
  [0, 191, 255],    // 20. Bleu électrique
  [114, 47, 55],    // 21. Bordeaux
  [255, 127, 80],   // 22. Corail
  [107, 142, 35],   // 23. Kaki
  [46, 46, 46],     // 24. Anthracite
  // --- Couleurs supplémentaires ---
  [255, 105, 180],  // 25. Rose bonbon
  [62, 180, 137],   // 26. Vert menthe
  [135, 206, 235],  // 27. Bleu ciel
  [204, 153, 0],    // 28. Ocre
  [142, 69, 133],   // 29. Prune
  [70, 130, 180],   // 30. Bleu acier
  [222, 49, 99],    // 31. Rouge cerise
  [80, 200, 120],   // 32. Vert émeraude
  [194, 178, 128],  // 33. Sable
  [97, 64, 81],     // 34. Aubergine
  [169, 169, 169],  // 35. Gris perle
  [50, 205, 50],    // 36. Citron vert
];

/** Mélange la couleur avec du blanc (factor 0 = couleur pure, 1 = blanc). */
export function lightenRgb(color: RGB, factor = 0.82): RGB {
  return [
    Math.min(255, color[0] + Math.round((255 - color[0]) * factor)),
    Math.min(255, color[1] + Math.round((255 - color[1]) * factor)),
    Math.min(255, color[2] + Math.round((255 - color[2]) * factor)),
  ];
}

export const rgbCss = (c: RGB): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/**
 * Couleur d'une thématique : sa position dans la liste des thématiques définies
 * détermine la couleur (stable). Les thématiques absentes de la liste (ex. importées)
 * reçoivent les couleurs suivantes, dans l'ordre fourni par `extra`.
 */
export function getThemeColor(category: string, extra: string[] = []): RGB {
  const ordered = [...getCategories()];
  for (const c of extra) if (c && !ordered.includes(c)) ordered.push(c);
  let i = ordered.indexOf(category);
  if (i < 0) i = ordered.length;
  return THEME_PALETTE[i % THEME_PALETTE.length];
}
