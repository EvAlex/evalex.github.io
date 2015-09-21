
//var lang = 'ru';
//if (window.location.search && window.location.search.indexOf('lang=') !== -1) {
//    lang = window.location.search
//        .split('&')
//        .filter(function (e) { return e.indexOf('lang=') !== -1 })[0]
//        .substring(6);
//}
i18n.init({ detectLngQS: 'lang', fallbackLng: 'en' }, function (err, t) {
    // translate nav
    //$(".nav").i18n();

    // programatical access
    //var appName = t("app.name");
});