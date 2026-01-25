(function() {
  try {
    // Check if the user has already been redirected or manually selected a language
    var hasRedirected = localStorage.getItem('kinesica_lang_redirected');

    if (!hasRedirected) {
      // Get browser language
      var userLang = navigator.language || navigator.userLanguage; 
      
      // Check if language starts with 'en' (English)
      if (userLang && userLang.toLowerCase().startsWith('en')) {
        // Mark as redirected so it doesn't happen again
        localStorage.setItem('kinesica_lang_redirected', 'true');
        
        // Redirect to English version
        // We assume we are on index.html, so we go to index_en.html
        // If we want to be smarter about other pages, we'd need a map, but request was simple.
        if (!window.location.href.includes('_en.html')) {
             window.location.replace('index_en.html');
        }
      } else {
        // If not english, we also mark as 'visited' so we don't keep checking unnecessarily? 
        // Or maybe strictly "only redirect if english". 
        // Let's set the flag anyway so we don't run this logic every single time if they prefer Spanish.
        localStorage.setItem('kinesica_lang_redirected', 'true');
      }
    }
  } catch (e) {
    console.warn('Language redirect suppressed', e);
  }
})();
