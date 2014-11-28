<?php
require_once('environment.php');

// decode the request uri to init model and view
$_parts = explode("/", $_SERVER['REQUEST_URI']);

// based on the first part to determine view controller
switch ($_parts[0]) {
    // vault related
    // -------------
    // vault list
    case 'dashboard':
        define('REQUIRE_AUTH', true);
        require_once('common.php');
        require_once('models/view.dashboard.php');
        break;

    // single vault operations
    case 'vault':
        define('REQUIRE_AUTH', true);
        require_once('common.php');
        require_once('models/view.vault.php');
        break;

    // system related
    // -------------
    // main page
    case '':
        require_once('common.php');
        require_once('models/view.index.php');
        break;

    // authorization service
    case 'auth':
        require_once('common.php');
        require_once('models/view.auth.php');
        break;

    // api for clients
    case 'api':
        define('IN_API', true);
        require_once('common.php');
        require_once('models/view.api.php');
        break;

    // not matched, return 404 not found
    default:
        require_once('common.php');

        $tpl = $mustache->loadTemplate('http_404');
        echo $tpl->render();
        break;
}

exit();
