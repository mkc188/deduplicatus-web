<?php
// Composer autoload
require('vendor/autoload.php');

// Database handler
DB::$user     = $_CONF['db']['user'];
DB::$password = $_CONF['db']['pass'];
DB::$dbName   = $_CONF['db']['name'];
DB::$host     = $_CONF['db']['host'];
DB::$port     = $_CONF['db']['port'];
DB::$encoding = 'utf8';
unset($_CONF['db']);

// Session
session_start();

// User authorization handler
require_once('models/class.auth.php');
if( defined('IN_API') ) {
    $auth = new Auth(file_get_contents('php://input'));
} else {
    $auth = new Auth();
}
if( defined('REQUIRE_AUTH') && !$auth->valid() ) {
    header('Location: ' . APP_PATH);
    exit();
}

// Mustache handler
if( !defined('NO_TPL') ) {
    $mustache = new Mustache_Engine(array(
        'loader' => new Mustache_Loader_FilesystemLoader(dirname(__FILE__).'/views'),
    ));
}

// Template variables for all pages
$global_val = array(
    'app-path'   => APP_PATH,
    'valid-user' => $auth->valid(),
    );

if( $auth->valid() ) {
    $global_val['username'] = $auth->username;
}
