<?php

// follow the $_parts to determine the action
$action = ( !empty($_parts[1]) ) ? $_parts[1] : '';

if( $action == "auth" ) {
    $raw_data = file_get_contents('php://input');

    $result = $auth->signInApp($raw_data);
    if( is_array($result) ) {
        $response = $result;
    } else {
        http_response_code(400);
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
    $raw_data = file_get_contents('php://input');
    $response = array();

    $json         = json_decode($raw_data);
    $isJSONValid  = ( json_last_error() == JSON_ERROR_NONE );

    if( $isJSONValid && $auth->valid() && !empty($json->vault) ) {
        // load required classes
        require_once('models/class.metafile.php');
        require_once('models/class.vault.php');
        require_once('models/interface.cloudstorage.php');

        $path  = ( !empty($json->path) ) ? $json->path : '/';
        $cloud = ( !empty($json->cloud) ) ? $json->cloud : false;

        $vault = Vault::load($json->vault);
        if( !empty($vault) ) {
            $response = $vault->listFile($path, $cloud);
        } else {
            http_response_code(400);
            $response = array(
                'is_authenticated' => true,
                'error_msg'        => 'File vault not owned.',
                );
        }

    } else {
        http_response_code(400);
        $response = array(
            'is_authenticated' => false,
            'error_msg'        => 'Please re-sign in the client.',
            );
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "pre-upload" ) {
    $raw_data = file_get_contents('php://input');
    $response = array();

    $json         = json_decode($raw_data);
    $isJSONValid  = ( json_last_error() == JSON_ERROR_NONE );

    if( $isJSONValid && $auth->valid() && !empty($json->vault) ) {
        // load required classes
        require_once('models/class.metafile.php');
        require_once('models/class.vault.php');
        require_once('models/interface.cloudstorage.php');

        $base  = ( !empty($json->base) ) ? $json->base : '/';
        $name  = ( !empty($json->name) ) ? $json->name : '';
        $path  = $base . $name;

        $size  = ( !empty($json->size) ) ? $json->size : false;
        $cloud = ( !empty($json->cloud) ) ? $json->cloud : false;

        $vault = Vault::load($json->vault);
        if( !empty($vault) ) {
            $response = $vault->upload($path, $size, $cloud);
        } else {
            http_response_code(400);
            $response = array(
                'is_authenticated' => true,
                'error_msg'        => 'File vault not owned.',
                );
        }

    } else {
        http_response_code(400);
        $response = array(
            'is_authenticated' => false,
            'error_msg'        => 'Please re-sign in the client.',
            );
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "get" ) {
    $raw_data = file_get_contents('php://input');
    $response = array();

    $json         = json_decode($raw_data);
    $isJSONValid  = ( json_last_error() == JSON_ERROR_NONE );

    if( $isJSONValid && $auth->valid() && !empty($json->vault) ) {
        // load required classes
        require_once('models/class.metafile.php');
        require_once('models/class.vault.php');
        require_once('models/interface.cloudstorage.php');

        $path    = ( !empty($json->path) ) ? $json->path : '/';
        $file_id = ( !empty($json->file_id) ) ? $json->file_id : false;
        $cloud   = ( !empty($json->cloud) ) ? $json->cloud : false;

        $vault = Vault::load($json->vault);
        if( !empty($vault) ) {
            $response = $vault->get($path, $file_id, $cloud);
        } else {
            http_response_code(400);
            $response = array(
                'is_authenticated' => true,
                'error_msg'        => 'File vault not owned.',
                );
        }

    } else {
        http_response_code(400);
        $response = array(
            'is_authenticated' => false,
            'error_msg'        => 'Please re-sign in the client.',
            );
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "rmr" ) {
    $raw_data = file_get_contents('php://input');
    $response = array();

    $json         = json_decode($raw_data);
    $isJSONValid  = ( json_last_error() == JSON_ERROR_NONE );

    if( $isJSONValid && $auth->valid() && !empty($json->vault) ) {
        // load required classes
        require_once('models/class.metafile.php');
        require_once('models/class.vault.php');
        require_once('models/interface.cloudstorage.php');

        $path    = ( !empty($json->path) ) ? $json->path : '/';
        $file_id = ( !empty($json->file_id) ) ? $json->file_id : false;
        $cloud   = ( !empty($json->cloud) ) ? $json->cloud : false;

        $vault = Vault::load($json->vault);
        if( !empty($vault) ) {
            $error = $vault->rmr($path, $file_id, $cloud);
            if( empty($error) ) {
                $response = array(
                    'success' => true,
                    );
            } else {
                http_response_code(400);
                $response = array(
                    'is_authenticated' => true,
                    'error_msg'        => $error,
                    );
            }
        } else {
            http_response_code(400);
            $response = array(
                'is_authenticated' => true,
                'error_msg'        => 'File vault not owned.',
                );
        }

    } else {
        http_response_code(400);
        $response = array(
            'is_authenticated' => false,
            'error_msg'        => 'Please re-sign in the client.',
            );
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}
