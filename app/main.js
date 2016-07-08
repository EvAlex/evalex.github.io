import { NavbarController } from './controllers/navbar-controller.js'

angular
    .module('app', ['ngRoute'])
    .controller('NavbarController', NavbarController)
    .config(configureRoutes);

angular.element(document).ready(function () {
    angular.bootstrap(document, ['app']);
});
  
configureRoutes.$inject = ['$locationProvider', '$routeProvider'];
function configureRoutes($locationProvider, $routeProvider) {
    $locationProvider.hashPrefix('!');

    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });

    $routeProvider
        .when('/patterns-n-practices', {
            templateUrl: '/app/views/patterns-n-practices/patterns-n-practices.html'
        })
        .when('/', {
            templateUrl: '/app/views/welcome.html'            
        })
        .otherwise({ redirectTo: '/' });
}