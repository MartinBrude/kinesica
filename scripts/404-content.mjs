/**
 * Copy for generated 404 pages (ES / EN / FR / PT).
 * Run: npm run build:404
 */
export const ERROR_404_LANG_LINKS = [
  { href: "/404.html", label: "Español" },
  { href: "/en/404.html", label: "English" },
  { href: "/fr/404.html", label: "Français" },
  { href: "/pt/404.html", label: "Português" },
];

export const ERROR_404 = {
  es: {
    title: "404 - Página no encontrada | Kinésica",
    description: "Página no encontrada - Kinésica",
    message: "Lo sentimos, la página que estás buscando no existe.",
    homeHref: "index.html",
    homeLabel: "Volver al inicio",
    copyright: "© Kinésica - Todos los derechos reservados",
  },
  en: {
    title: "404 - Page not found | Kinésica",
    description: "Page not found - Kinésica",
    message: "Sorry, the page you are looking for does not exist.",
    homeHref: "/en/",
    homeLabel: "Back to home",
    copyright: "© Kinésica - All rights reserved",
  },
  fr: {
    title: "404 - Page introuvable | Kinésica",
    description: "Page introuvable - Kinésica",
    message: "Désolé, la page que vous recherchez n'existe pas.",
    homeHref: "/fr/",
    homeLabel: "Retour à l'accueil",
    copyright: "© Kinésica - Tous droits réservés",
  },
  pt: {
    title: "404 - Página não encontrada | Kinésica",
    description: "Página não encontrada - Kinésica",
    message: "Desculpe, a página que você procura não existe.",
    homeHref: "/pt/",
    homeLabel: "Voltar ao início",
    copyright: "© Kinésica - Todos os direitos reservados",
  },
};
