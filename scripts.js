+function () {
    'use strict';

    $(init);

    function init() {
        new Internationalizer().init();
    }

    function Internationalizer() {
        this.init = init;

        ////////////////////////////////
        var translate = null;

        function init() {
            var options = {
                lng: 'ru',
                resources: {
                    en: {
                        translation: {
                            "key": "hello world",
                            "myself": {
                                "fullName": "Alexander Pavlyuk"
                            }
                        }
                    },
                    ru: {
                        translation: {
                            "key": "Здравствуй, мир",
                            "myself": {
                                "fullName": "Павлюк Александр"
                            }
                        }
                    }
                }
            };
	        i18next.init(options, onI18nInitialized);

            $('.lang-list .lang-list-item').click(function () {
                var key = $(this).data('key'),
                    name = $(this).text(),
                    flagClass = $(this).find('.lang-list-item_flag').attr('class').replace('lang-list-item_flag', '');
                $('.selected-lang .selected-lang_name').text(name);
                $('.selected-lang .selected-lang_flag')
                    .removeClass()
                    .addClass('selected-lang_flag' + flagClass);
                i18next.changeLanguage(key, onI18nInitialized);

                $('.lang-list li.active').removeClass('active');
                $(this).parent().addClass('active');
            });
        }

        function onI18nInitialized(err, t) {
            if (err) {
                return console.error('Failed to initialize i18next.', err);
            }
            translate = t;
            $('[data-i18n]').each(translateElement);
        }

        function translateElement() {
            var $e = $(this),
                key = $e.data('i18n'),
                value = translate(key);
            if (key !== value) {    //  translation successful
                $e.text(value);
            }
        }
    }
} ();