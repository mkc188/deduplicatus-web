<?php

// follow the $_parts to determine the action
$action = ( !empty($_parts[1]) ) ? $_parts[1] : '';

if( $action == "auth" ) {
    $raw_data = file_get_contents('php://input');

    $result = $auth->signInApp($raw_data);
    if( is_array($result) ) {
        $response = $result;
    } else {
        switch ($result) {
            case AUTH_INVAILD_APPKEY:
                $response = array(
                    'success'          => false,
                    'is_authenticated' => false,
                    'error_msg'        => 'Invalid App Key.',
                    );
                break;

            case AUTH_WRONG_CREDENTIALS:
            default:
                $response = array(
                    'success'          => false,
                    'is_authenticated' => false,
                    'error_msg'        => 'Wrong Credentials.',
                    );
                break;
        }
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "list" ) {
    $raw_data = file_get_contents('php://input');

    // load required classes
    require_once('models/class.metafile.php');
    require_once('models/class.vaultlist.php');
    $response = new VaultList();

    header('Content-type: application/json');
    echo json_encode($response->get());
    exit();
}

if( $action == "ls" ) {

}

if( $action == "pre-load" ) {

}

if( $action == "get" ) {

}
