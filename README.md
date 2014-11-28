duplicatus-web
==============

Backend web service for Duplicatus.

## Nginx Configuration
***
The following directives **MUST** be added to nginx configuration to prevent security issues.
```nginx
try_files $uri $uri/ /index.php;

location ~ ^/(models|vendor|views) {
    deny all;
}

location ~ ^/(composer.json|composer.lock|composer.phar|README.md) {
    deny all;
}
```
