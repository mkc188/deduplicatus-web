<?php
$_CONF = array();

/*
 * Database Configuration
 */
$_CONF['db'] = array();
$_CONF['db']['host'] = 'localhost';
$_CONF['db']['port'] = '3306';
$_CONF['db']['user'] = '';
$_CONF['db']['pass'] = '';
$_CONF['db']['name'] = '';

/*
 * Security Configuration
 */
// AES key of cookie encryption
$_CONF['cookie_aes_key'] = '';

// Cookies
$_CONF['cookie_time'] = 60 * 60 * 24 * 7;
$_CONF['cookie_prefix']  = 'duplicatus';

/*
 * General Configuration
 */
$_CONF['subdirectory_install'] = true;
define('APP_PATH', '/');
