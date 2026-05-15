(function () {
  try {
    if (window.location.href.includes('_en.html')) {
      return;
    }

    var hasRedirected = localStorage.getItem('kinesica_lang_redirected');
    if (hasRedirected) {
      return;
    }

    var userLang = navigator.language || navigator.userLanguage;
    if (!userLang || !userLang.toLowerCase().startsWith('en')) {
      localStorage.setItem('kinesica_lang_redirected', 'true');
      return;
    }

    var path = window.location.pathname;
    var file = path.substring(path.lastIndexOf('/') + 1);
    if (!file || file === '/') {
      file = 'index.html';
    }

    var enMap = {
      'index.html': 'index_en.html',
      'rpg.html': 'rpg_en.html',
      'osteopatia.html': 'osteopatia_en.html',
      'cadenas.html': 'cadenas_en.html',
      'manipulaciones.html': 'manipulaciones_en.html',
      'neurodinamia.html': 'neurodinamia_en.html',
      'articulos.html': 'articulos_en.html',
      'cervicalgia.html': 'cervicalgia_en.html',
      'lumbalgia.html': 'lumbalgia_en.html',
    };

    var target = enMap[file];
    if (!target) {
      localStorage.setItem('kinesica_lang_redirected', 'true');
      return;
    }

    localStorage.setItem('kinesica_lang_redirected', 'true');
    window.location.replace(target);
  } catch (e) {
    console.warn('Language redirect suppressed', e);
  }
})();
