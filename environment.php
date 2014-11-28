<?php
require_once('config.php');
require_once('models/constants.php');

// Update request uri in subdirectory installation
if( $_CONF['subdirectory_install'] ) {
    $url  = parse_url($_SERVER['REQUEST_URI']);
    if( !empty($url['query']) ) {
        parse_str($url['query'], $_GET);
    }

    $_SERVER['REQUEST_URI'] = strtok($_SERVER['REQUEST_URI'], '?');
    $_SERVER['REQUEST_URI'] = substr($_SERVER['REQUEST_URI'], strlen(APP_PATH));
    $_SERVER['REQUEST_URI'] = preg_replace("/[^A-Za-z0-9\/\-]/", '', $_SERVER['REQUEST_URI']);
}
