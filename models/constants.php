<?php

// Auth
define('AUTH_SUCCESS', 0);
define('AUTH_WRONG_CREDENTIALS', 1);
define('AUTH_REFRESH_SESSION', 2);
define('AUTH_INVAILD_APPKEY', 3);

// Register
define('REGISTER_SUCCESS', 0);
define('REGISTER_USER_EXITS', 1);
define('REGISTER_EMAIL_EXITS', 2);
define('REGISTER_FIELD_INCOMPLETE', 3);
define('REGISTER_REFRESH_SESSION', 4);

// Vault
define('VAULT_SUCCESS', 0);
define('VAULT_NAME_EMPTY', 1);
define('VAULT_NAME_EXISTS', 2);
define('VAULT_UNKNOWN_ERR', 3);
define('VAULT_NOT_FOUND', 4);
define('VAULT_ALREADY_FINALIZED', 4);

// Storage Mode
define('STORAGE_SPACE_SAVING', 1);
$_storageMode = array(
    'space-saving' => STORAGE_SPACE_SAVING,
    );

// Cloud Storage Provider
define('CLOUD_GOOGLEDRIVE', 1);
define('CLOUD_DROPBOX', 2);
$_storageProvider = array(
    'googledrive' => CLOUD_GOOGLEDRIVE,
    'dropbox'     => CLOUD_DROPBOX,
    );
$_storageProviderClass = array(
    'googledrive' => 'GoogleDrive',
    'dropbox'     => 'Dropbox',
    );
